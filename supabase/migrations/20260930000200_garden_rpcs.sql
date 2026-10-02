-- 정원 RPC: 만들기, 참여, 나가기, 꽃잎 순서

create function public.gen_invite_code() returns text
language plpgsql volatile set search_path = '' as $$
declare
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  code text;
begin
  loop
    code := '';
    for i in 1..6 loop
      code := code || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;
    exit when not exists (select 1 from public.gardens where invite_code = code);
  end loop;
  return code;
end
$$;

create function public.create_garden(p_name text, p_max_members int)
returns public.gardens
language plpgsql security definer set search_path = '' as $$
#variable_conflict use_column
declare
  uid uuid := auth.uid();
  g public.gardens;
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  if p_name is null or char_length(trim(p_name)) not between 1 and 20 then raise exception 'invalid_name'; end if;
  if p_max_members is null or p_max_members not in (2, 8) then raise exception 'invalid_size'; end if;

  insert into public.gardens (name, kind, invite_code, max_members, created_by)
  values (trim(p_name), 'group', public.gen_invite_code(), p_max_members, uid)
  returning * into g;

  insert into public.garden_members (garden_id, user_id, petal_order) values (g.id, uid, 1);
  return g;
end
$$;

create function public.join_garden(p_code text)
returns public.gardens
language plpgsql security definer set search_path = '' as $$
#variable_conflict use_column
declare
  uid uuid := auth.uid();
  g public.gardens;
  member_count int;
  next_order int;
begin
  if uid is null then raise exception 'not_authenticated'; end if;

  select * into g from public.gardens where invite_code = upper(trim(p_code)) for update;
  if not found then raise exception 'invalid_code'; end if;

  if exists (select 1 from public.garden_members where garden_id = g.id and user_id = uid) then
    raise exception 'already_member';
  end if;

  select count(*), coalesce(max(petal_order), 0) + 1
    into member_count, next_order
    from public.garden_members where garden_id = g.id;
  if member_count >= g.max_members then raise exception 'garden_full'; end if;

  insert into public.garden_members (garden_id, user_id, petal_order) values (g.id, uid, next_order);
  return g;
end
$$;

create function public.renumber_petals(p_garden uuid) returns void
language sql security definer set search_path = '' as $$
  update public.garden_members m
     set petal_order = r.rn
    from (
      select user_id, row_number() over (order by petal_order) as rn
        from public.garden_members where garden_id = p_garden
    ) r
   where m.garden_id = p_garden and m.user_id = r.user_id
$$;

create function public.leave_garden(p_garden uuid)
returns void
language plpgsql security definer set search_path = '' as $$
#variable_conflict use_column
declare
  uid uuid := auth.uid();
  g public.gardens;
begin
  select * into g from public.gardens where id = p_garden for update;
  if not found or not exists (
    select 1 from public.garden_members where garden_id = p_garden and user_id = uid
  ) then
    raise exception 'not_member';
  end if;
  if g.kind = 'solo' then raise exception 'cannot_leave_solo'; end if;

  delete from public.plantings pl
   using public.sky_photos s
   where pl.sky_photo_id = s.id and pl.garden_id = p_garden and s.user_id = uid;
  delete from public.garden_members where garden_id = p_garden and user_id = uid;

  if not exists (select 1 from public.garden_members where garden_id = p_garden) then
    delete from public.gardens where id = p_garden;
  else
    perform public.renumber_petals(p_garden);
  end if;
end
$$;

create function public.reorder_petals(p_garden uuid, p_user_ids uuid[])
returns void
language plpgsql security definer set search_path = '' as $$
#variable_conflict use_column
declare
  member_count int;
begin
  if not public.is_member(p_garden) then raise exception 'not_member'; end if;
  perform 1 from public.gardens where id = p_garden for update;

  select count(*) into member_count from public.garden_members where garden_id = p_garden;
  if coalesce(array_length(p_user_ids, 1), 0) <> member_count
     or (select count(distinct u) from unnest(p_user_ids) u) <> member_count
     or exists (
       select 1 from unnest(p_user_ids) u
        where not exists (select 1 from public.garden_members where garden_id = p_garden and user_id = u)
     )
  then
    raise exception 'invalid_order';
  end if;

  update public.garden_members m
     set petal_order = t.ord
    from unnest(p_user_ids) with ordinality as t(uid, ord)
   where m.garden_id = p_garden and m.user_id = t.uid;
end
$$;

revoke execute on function public.gen_invite_code() from public, anon, authenticated;
revoke execute on function public.renumber_petals(uuid) from public, anon, authenticated;
revoke execute on function public.create_garden(text, int) from public, anon;
revoke execute on function public.join_garden(text) from public, anon;
revoke execute on function public.leave_garden(uuid) from public, anon;
revoke execute on function public.reorder_petals(uuid, uuid[]) from public, anon;
grant execute on function public.create_garden(text, int) to authenticated;
grant execute on function public.join_garden(text) to authenticated;
grant execute on function public.leave_garden(uuid) to authenticated;
grant execute on function public.reorder_petals(uuid, uuid[]) to authenticated;
