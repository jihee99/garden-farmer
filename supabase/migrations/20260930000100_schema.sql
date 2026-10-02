-- 하늘정원 스키마: 테이블, 헬퍼, RLS, 가입 트리거

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nickname text not null check (char_length(nickname) between 1 and 20),
  avatar_url text,
  notify boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.gardens (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 20),
  kind text not null check (kind in ('solo', 'group')),
  invite_code text unique,
  max_members int not null default 8 check (max_members between 1 and 8),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  check ((kind = 'solo') = (invite_code is null)),
  check (kind <> 'solo' or max_members = 1)
);

create table public.garden_members (
  garden_id uuid not null references public.gardens(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  petal_order int not null check (petal_order >= 1),
  joined_at timestamptz not null default now(),
  primary key (garden_id, user_id),
  constraint garden_members_order_unique unique (garden_id, petal_order) deferrable initially deferred
);
create index garden_members_user_idx on public.garden_members (user_id);

create table public.sky_photos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  local_date date not null,
  taken_at timestamptz not null,
  image_path text not null,
  dominant_color text not null check (dominant_color ~ '^#[0-9A-F]{6}$'),
  note text check (char_length(note) <= 60),
  unique (user_id, local_date)
);

create table public.plantings (
  garden_id uuid not null references public.gardens(id) on delete cascade,
  sky_photo_id uuid not null references public.sky_photos(id) on delete cascade,
  local_date date not null,
  primary key (garden_id, sky_photo_id)
);
create index plantings_garden_date_idx on public.plantings (garden_id, local_date);

create table public.push_subscriptions (
  user_id uuid not null references public.profiles(id) on delete cascade,
  endpoint text primary key,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);

create table public.daily_alerts (
  local_date date primary key,
  alert_at timestamptz not null,
  sent_at timestamptz
);

-- 헬퍼 (security definer: RLS 재귀 방지)

create function public.seoul_today() returns date
language sql stable set search_path = '' as $$
  select (now() at time zone 'Asia/Seoul')::date
$$;

create function public.is_member(g uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.garden_members where garden_id = g and user_id = auth.uid()
  )
$$;

create function public.shares_garden(other uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from public.garden_members mine
    join public.garden_members theirs on theirs.garden_id = mine.garden_id
    where mine.user_id = auth.uid() and theirs.user_id = other
  )
$$;

create function public.can_see_photo(p uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.sky_photos s where s.id = p and s.user_id = auth.uid())
      or exists (
        select 1
        from public.plantings pl
        join public.garden_members m on m.garden_id = pl.garden_id and m.user_id = auth.uid()
        where pl.sky_photo_id = p
      )
$$;

-- RLS

alter table public.profiles enable row level security;
alter table public.gardens enable row level security;
alter table public.garden_members enable row level security;
alter table public.sky_photos enable row level security;
alter table public.plantings enable row level security;
alter table public.push_subscriptions enable row level security;
alter table public.daily_alerts enable row level security;

create policy "profiles: 본인과 같은 정원 멤버 조회" on public.profiles
  for select to authenticated using (id = auth.uid() or public.shares_garden(id));
create policy "profiles: 본인 수정" on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

revoke update on public.profiles from anon, authenticated;
grant update (nickname, notify, avatar_url) on public.profiles to authenticated;

create policy "gardens: 멤버 조회" on public.gardens
  for select to authenticated using (public.is_member(id));

create policy "garden_members: 멤버 조회" on public.garden_members
  for select to authenticated using (public.is_member(garden_id));

create policy "sky_photos: 본인 또는 같은 정원에 심긴 사진" on public.sky_photos
  for select to authenticated using (public.can_see_photo(id));

create policy "plantings: 멤버 조회" on public.plantings
  for select to authenticated using (public.is_member(garden_id));

create policy "push_subscriptions: 본인 조회" on public.push_subscriptions
  for select to authenticated using (user_id = auth.uid());
create policy "push_subscriptions: 본인 추가" on public.push_subscriptions
  for insert to authenticated with check (user_id = auth.uid());
create policy "push_subscriptions: 본인 삭제" on public.push_subscriptions
  for delete to authenticated using (user_id = auth.uid());

create policy "daily_alerts: 로그인 사용자 조회" on public.daily_alerts
  for select to authenticated using (true);

-- 가입 트리거: profile + 나만의 정원

create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  solo_id uuid;
begin
  insert into public.profiles (id, nickname, avatar_url)
  values (
    new.id,
    left(coalesce(
      nullif(trim(meta ->> 'nickname'), ''),
      nullif(trim(meta ->> 'name'), ''),
      nullif(trim(meta ->> 'full_name'), ''),
      '하늘친구'
    ), 20),
    coalesce(meta ->> 'avatar_url', meta ->> 'picture')
  );

  insert into public.gardens (name, kind, max_members, created_by)
  values ('나만의 정원', 'solo', 1, new.id)
  returning id into solo_id;

  insert into public.garden_members (garden_id, user_id, petal_order)
  values (solo_id, new.id, 1);

  return new;
end
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

revoke execute on function public.handle_new_user() from public, anon, authenticated;
