-- 하늘 RPC 보강 2: 경로·메모 검증, set_plantings 행 잠금

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
  if p_image_path is null
     or p_image_path !~ ('^' || uid::text || '/' || to_char(today, 'YYYY-MM-DD') || '/[0-9a-f-]{36}\.(jpg|png)$')
  then
    raise exception 'invalid_path';
  end if;
  if p_color is null or p_color !~ '^#[0-9A-F]{6}$' then raise exception 'invalid_color'; end if;
  if p_note is not null and char_length(trim(p_note)) > 60 then raise exception 'invalid_note'; end if;

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

create or replace function public.set_plantings(p_photo uuid, p_garden_ids uuid[])
returns void
language plpgsql security definer set search_path = '' as $$
declare
  s public.sky_photos := public.own_photo(p_photo);
begin
  perform 1 from public.sky_photos where id = s.id for update;
  if s.local_date <> public.seoul_today() then raise exception 'not_today'; end if;
  perform public.assert_member_of_all(p_garden_ids);
  perform public.sync_plantings(s.id, s.local_date, p_garden_ids);
end
$$;
