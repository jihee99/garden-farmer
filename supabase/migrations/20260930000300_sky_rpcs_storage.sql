-- 하늘 RPC와 Storage

create function public.assert_member_of_all(p_garden_ids uuid[]) returns void
language plpgsql stable security definer set search_path = '' as $$
begin
  if coalesce(array_length(p_garden_ids, 1), 0) = 0 then raise exception 'no_gardens'; end if;
  if exists (
    select 1 from unnest(p_garden_ids) g
     where not exists (select 1 from public.garden_members m where m.garden_id = g and m.user_id = auth.uid())
  ) then
    raise exception 'not_member';
  end if;
end
$$;

create function public.sync_plantings(p_photo uuid, p_date date, p_garden_ids uuid[]) returns void
language sql security definer set search_path = '' as $$
  delete from public.plantings where sky_photo_id = p_photo and garden_id <> all (p_garden_ids);
  insert into public.plantings (garden_id, sky_photo_id, local_date)
  select distinct g, p_photo, p_date from unnest(p_garden_ids) g
  on conflict do nothing;
$$;

create function public.plant_sky(p_image_path text, p_color text, p_note text, p_garden_ids uuid[])
returns table (photo_id uuid, old_image_path text)
language plpgsql security definer set search_path = '' as $$
#variable_conflict use_column
declare
  uid uuid := auth.uid();
  today date := public.seoul_today();
  existing public.sky_photos;
  pid uuid;
  old_path text;
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  perform public.assert_member_of_all(p_garden_ids);
  if p_image_path is null or split_part(p_image_path, '/', 1) <> uid::text then raise exception 'invalid_path'; end if;
  if p_color is null or p_color !~ '^#[0-9A-F]{6}$' then raise exception 'invalid_color'; end if;

  select * into existing from public.sky_photos where user_id = uid and local_date = today for update;
  if found then
    pid := existing.id;
    old_path := nullif(existing.image_path, p_image_path);
    update public.sky_photos
       set image_path = p_image_path,
           dominant_color = p_color,
           note = nullif(trim(p_note), ''),
           taken_at = now()
     where id = pid;
  else
    insert into public.sky_photos (user_id, local_date, taken_at, image_path, dominant_color, note)
    values (uid, today, now(), p_image_path, p_color, nullif(trim(p_note), ''))
    returning id into pid;
  end if;

  perform public.sync_plantings(pid, today, p_garden_ids);
  return query select pid, old_path;
end
$$;

create function public.own_photo(p_photo uuid) returns public.sky_photos
language plpgsql stable security definer set search_path = '' as $$
declare
  s public.sky_photos;
begin
  select * into s from public.sky_photos where id = p_photo;
  if not found or s.user_id <> auth.uid() then raise exception 'not_owner'; end if;
  return s;
end
$$;

create function public.set_plantings(p_photo uuid, p_garden_ids uuid[])
returns void
language plpgsql security definer set search_path = '' as $$
declare
  s public.sky_photos := public.own_photo(p_photo);
begin
  if s.local_date <> public.seoul_today() then raise exception 'not_today'; end if;
  perform public.assert_member_of_all(p_garden_ids);
  perform public.sync_plantings(s.id, s.local_date, p_garden_ids);
end
$$;

create function public.unplant(p_photo uuid, p_garden uuid)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  s public.sky_photos := public.own_photo(p_photo);
begin
  delete from public.plantings where sky_photo_id = s.id and garden_id = p_garden;
end
$$;

create function public.delete_sky(p_photo uuid)
returns text
language plpgsql security definer set search_path = '' as $$
declare
  s public.sky_photos := public.own_photo(p_photo);
begin
  delete from public.sky_photos where id = s.id;
  return s.image_path;
end
$$;

create function public.get_month(p_garden uuid, p_month text)
returns table (local_date date, user_id uuid, dominant_color text)
language plpgsql stable security definer set search_path = '' as $$
#variable_conflict use_column
declare
  first_day date;
begin
  if not public.is_member(p_garden) then raise exception 'not_member'; end if;
  if p_month is null or p_month !~ '^\d{4}-(0[1-9]|1[0-2])$' then raise exception 'invalid_month'; end if;
  first_day := to_date(p_month || '-01', 'YYYY-MM-DD');

  return query
    select pl.local_date, s.user_id, s.dominant_color
      from public.plantings pl
      join public.sky_photos s on s.id = pl.sky_photo_id
      join public.garden_members m on m.garden_id = pl.garden_id and m.user_id = s.user_id
     where pl.garden_id = p_garden
       and pl.local_date >= first_day
       and pl.local_date < (first_day + interval '1 month')::date
     order by pl.local_date, m.petal_order;
end
$$;

revoke execute on function public.assert_member_of_all(uuid[]) from public, anon, authenticated;
revoke execute on function public.sync_plantings(uuid, date, uuid[]) from public, anon, authenticated;
revoke execute on function public.own_photo(uuid) from public, anon, authenticated;
revoke execute on function public.plant_sky(text, text, text, uuid[]) from public, anon;
revoke execute on function public.set_plantings(uuid, uuid[]) from public, anon;
revoke execute on function public.unplant(uuid, uuid) from public, anon;
revoke execute on function public.delete_sky(uuid) from public, anon;
revoke execute on function public.get_month(uuid, text) from public, anon;
grant execute on function public.plant_sky(text, text, text, uuid[]) to authenticated;
grant execute on function public.set_plantings(uuid, uuid[]) to authenticated;
grant execute on function public.unplant(uuid, uuid) to authenticated;
grant execute on function public.delete_sky(uuid) to authenticated;
grant execute on function public.get_month(uuid, text) to authenticated;

-- Storage: 비공개 버킷 skies

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('skies', 'skies', false, 5242880, array['image/jpeg', 'image/png'])
on conflict (id) do nothing;

create policy "skies: 본인 폴더에 업로드" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'skies' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "skies: 본인 또는 볼 수 있는 사진 읽기" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'skies'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or exists (
        select 1 from public.sky_photos s
         where s.image_path = storage.objects.name and public.can_see_photo(s.id)
      )
    )
  );

create policy "skies: 본인 파일 삭제" on storage.objects
  for delete to authenticated
  using (bucket_id = 'skies' and (storage.foldername(name))[1] = auth.uid()::text);
