-- 하늘 RPC 보강: 동시 첫 심기 경쟁, null 안전, 인덱스

create or replace function public.plant_sky(p_image_path text, p_color text, p_note text, p_garden_ids uuid[])
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

  insert into public.sky_photos (user_id, local_date, taken_at, image_path, dominant_color, note)
  values (uid, today, now(), p_image_path, p_color, nullif(trim(p_note), ''))
  on conflict (user_id, local_date) do nothing
  returning id into pid;

  if pid is null then
    select * into existing from public.sky_photos where user_id = uid and local_date = today for update;
    pid := existing.id;
    old_path := nullif(existing.image_path, p_image_path);
    update public.sky_photos
       set image_path = p_image_path,
           dominant_color = p_color,
           note = nullif(trim(p_note), ''),
           taken_at = now()
     where id = pid;
  end if;

  perform public.sync_plantings(pid, today, p_garden_ids);
  return query select pid, old_path;
end
$$;

create or replace function public.own_photo(p_photo uuid) returns public.sky_photos
language plpgsql stable security definer set search_path = '' as $$
declare
  s public.sky_photos;
begin
  select * into s from public.sky_photos where id = p_photo;
  if not found or s.user_id is distinct from auth.uid() then raise exception 'not_owner'; end if;
  return s;
end
$$;

create or replace function public.get_month(p_garden uuid, p_month text)
returns table (local_date date, user_id uuid, dominant_color text)
language plpgsql stable security definer set search_path = '' as $$
#variable_conflict use_column
declare
  first_day date;
begin
  if p_garden is null or not public.is_member(p_garden) then raise exception 'not_member'; end if;
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

create index if not exists sky_photos_image_path_idx on public.sky_photos (image_path);
