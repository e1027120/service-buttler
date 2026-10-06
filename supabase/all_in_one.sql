-- =============================================================================
-- Service Buttler — core schema
-- Users <-> (many) Churches <-> (many) Services <-> (many) Service Times
-- Churches own Actions (announcements, sermon notes, polls, offering, forms, links)
-- which are scheduled relative to a service occurrence.
-- =============================================================================

create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
create type public.member_role as enum ('owner', 'admin', 'editor');
create type public.action_type as enum ('announcement', 'sermon_notes', 'poll', 'offering', 'form', 'link');

-- ---------------------------------------------------------------------------
-- Utilities
-- ---------------------------------------------------------------------------
create or replace function public.is_valid_timezone(tz text)
returns boolean language plpgsql stable as $$
begin
  perform now() at time zone tz;
  return true;
exception when others then
  return false;
end $$;

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------
create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  email       text,
  full_name   text,
  created_at  timestamptz not null default now()
);

create table public.churches (
  id             uuid primary key default gen_random_uuid(),
  slug           text not null unique
                   check (slug ~ '^[a-z0-9][a-z0-9-]{1,48}[a-z0-9]$'),
  name           text not null check (char_length(name) between 1 and 120),
  timezone       text not null default 'UTC' check (public.is_valid_timezone(timezone)),
  logo_url       text,
  primary_color  text not null default '#4f46e5' check (primary_color ~ '^#[0-9a-fA-F]{6}$'),
  accent_color   text not null default '#f59e0b' check (accent_color ~ '^#[0-9a-fA-F]{6}$'),
  -- Landing page customization (see src/lib/types.ts -> LandingConfig)
  landing        jsonb not null default '{}'::jsonb check (jsonb_typeof(landing) = 'object'),
  created_by     uuid references auth.users (id) on delete set null default auth.uid(),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create table public.church_members (
  church_id   uuid not null references public.churches (id) on delete cascade,
  user_id     uuid not null references auth.users (id) on delete cascade,
  role        public.member_role not null default 'editor',
  created_at  timestamptz not null default now(),
  primary key (church_id, user_id)
);
create index church_members_user_idx on public.church_members (user_id);

create table public.church_invitations (
  id          uuid primary key default gen_random_uuid(),
  church_id   uuid not null references public.churches (id) on delete cascade,
  email       text not null check (email = lower(email) and position('@' in email) > 1),
  role        public.member_role not null default 'editor',
  invited_by  uuid references auth.users (id) on delete set null default auth.uid(),
  created_at  timestamptz not null default now(),
  unique (church_id, email)
);
create index church_invitations_email_idx on public.church_invitations (email);

create table public.services (
  id                 uuid primary key default gen_random_uuid(),
  church_id          uuid not null references public.churches (id) on delete cascade,
  name               text not null check (char_length(name) between 1 and 120),
  slug               text not null check (slug ~ '^[a-z0-9][a-z0-9-]{0,48}[a-z0-9]$|^[a-z0-9]$'),
  description        text,
  -- Landing page goes "live" lead_minutes before start, and stays live trail_minutes after end
  lead_minutes       integer not null default 15 check (lead_minutes between 0 and 240),
  trail_minutes      integer not null default 30 check (trail_minutes between 0 and 240),
  -- Manual "go live" override: pins one action on top while set
  live_action_id     uuid,
  live_action_until  timestamptz,
  is_active          boolean not null default true,
  sort_order         integer not null default 0,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  unique (church_id, slug)
);
create index services_church_idx on public.services (church_id);

create table public.service_times (
  id             uuid primary key default gen_random_uuid(),
  service_id     uuid not null references public.services (id) on delete cascade,
  -- Either recurring weekly (day_of_week 0=Sunday..6) OR a one-off date
  day_of_week    smallint check (day_of_week between 0 and 6),
  specific_date  date,
  start_time     time not null,
  end_time       time not null,
  label          text,
  is_active      boolean not null default true,
  created_at     timestamptz not null default now(),
  check (end_time > start_time),
  check ((day_of_week is null) <> (specific_date is null))
);
create index service_times_service_idx on public.service_times (service_id);

create table public.actions (
  id                    uuid primary key default gen_random_uuid(),
  church_id             uuid not null references public.churches (id) on delete cascade,
  -- NULL service = church-wide action, shown when no service is live
  service_id            uuid references public.services (id) on delete cascade,
  type                  public.action_type not null,
  title                 text not null check (char_length(title) between 1 and 200),
  content               jsonb not null default '{}'::jsonb check (jsonb_typeof(content) = 'object'),
  -- Visibility window in minutes relative to the service START time.
  -- NULL start = from the beginning of the live window (start - lead_minutes)
  -- NULL end   = until the end of the live window (end + trail_minutes)
  start_offset_minutes  integer check (start_offset_minutes between -1440 and 1440),
  end_offset_minutes    integer check (end_offset_minutes between -1440 and 1440),
  priority              integer not null default 0,
  is_active             boolean not null default true,
  sort_order            integer not null default 0,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  check (start_offset_minutes is null or end_offset_minutes is null or end_offset_minutes > start_offset_minutes)
);
create index actions_church_idx on public.actions (church_id);
create index actions_service_idx on public.actions (service_id);

alter table public.services
  add constraint services_live_action_fk
  foreign key (live_action_id) references public.actions (id) on delete set null;

create table public.poll_votes (
  action_id    uuid not null references public.actions (id) on delete cascade,
  voter_token  text not null check (char_length(voter_token) between 8 and 100),
  option_id    text not null check (char_length(option_id) between 1 and 64),
  created_at   timestamptz not null default now(),
  primary key (action_id, voter_token)
);

create table public.action_responses (
  id           uuid primary key default gen_random_uuid(),
  action_id    uuid not null references public.actions (id) on delete cascade,
  church_id    uuid not null references public.churches (id) on delete cascade,
  payload      jsonb not null check (jsonb_typeof(payload) = 'object' and octet_length(payload::text) <= 8000),
  is_archived  boolean not null default false,
  created_at   timestamptz not null default now()
);
create index action_responses_action_idx on public.action_responses (action_id, created_at desc);
create index action_responses_church_idx on public.action_responses (church_id, created_at desc);

-- updated_at triggers
create trigger churches_updated_at before update on public.churches for each row execute function public.set_updated_at();
create trigger services_updated_at before update on public.services for each row execute function public.set_updated_at();
create trigger actions_updated_at  before update on public.actions  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Authorization helpers (security definer => no RLS recursion)
-- ---------------------------------------------------------------------------
create or replace function public.has_church_role(
  p_church uuid,
  p_roles public.member_role[] default array['owner','admin','editor']::public.member_role[]
) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.church_members
    where church_id = p_church and user_id = auth.uid() and role = any (p_roles)
  );
$$;

create or replace function public.shares_church_with(p_user uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from public.church_members me
    join public.church_members other on other.church_id = me.church_id
    where me.user_id = auth.uid() and other.user_id = p_user
  );
$$;

-- ---------------------------------------------------------------------------
-- Integrity triggers
-- ---------------------------------------------------------------------------

-- New auth user -> profile + accept pending invitations
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, lower(new.email), coalesce(new.raw_user_meta_data ->> 'full_name', ''))
  on conflict (id) do nothing;

  insert into public.church_members (church_id, user_id, role)
  select i.church_id, new.id, i.role
  from public.church_invitations i
  where i.email = lower(new.email)
  on conflict do nothing;

  delete from public.church_invitations where email = lower(new.email);
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Creator of a church becomes its owner
create or replace function public.handle_new_church()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.created_by is not null then
    insert into public.church_members (church_id, user_id, role)
    values (new.id, new.created_by, 'owner')
    on conflict do nothing;
  end if;
  return new;
end $$;

create trigger on_church_created
  after insert on public.churches
  for each row execute function public.handle_new_church();

-- Only owners may grant/alter/remove the owner role; never remove the last owner
create or replace function public.guard_church_members()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_church uuid := coalesce(new.church_id, old.church_id);
  v_is_owner boolean;
begin
  -- Internal operations (triggers, service role) run without a JWT user
  if auth.uid() is null then
    return coalesce(new, old);
  end if;

  v_is_owner := public.has_church_role(v_church, array['owner']::public.member_role[]);

  if tg_op = 'INSERT' and new.role = 'owner' and not v_is_owner
     -- bootstrap: the creator of a brand-new church becomes its first owner
     and not (
       new.user_id = auth.uid()
       and exists (select 1 from public.churches where id = v_church and created_by = auth.uid())
       and not exists (select 1 from public.church_members where church_id = v_church)
     ) then
    raise exception 'Only owners can add owners' using errcode = '42501';
  end if;

  if tg_op = 'UPDATE' and (old.role = 'owner' or new.role = 'owner') and not v_is_owner then
    raise exception 'Only owners can change owner roles' using errcode = '42501';
  end if;

  if tg_op = 'DELETE' and old.role = 'owner' and not v_is_owner and old.user_id <> auth.uid() then
    raise exception 'Only owners can remove owners' using errcode = '42501';
  end if;

  if (tg_op = 'DELETE' and old.role = 'owner') or (tg_op = 'UPDATE' and old.role = 'owner' and new.role <> 'owner') then
    if not exists (
      select 1 from public.church_members
      where church_id = v_church and role = 'owner' and user_id <> old.user_id
    ) and exists (select 1 from public.churches where id = v_church) then
      raise exception 'A church must keep at least one owner' using errcode = '23514';
    end if;
  end if;

  return coalesce(new, old);
end $$;

create trigger church_members_guard
  before insert or update or delete on public.church_members
  for each row execute function public.guard_church_members();

-- Action's service must belong to the same church; pinned action must belong to the service
create or replace function public.guard_action_service()
returns trigger language plpgsql as $$
begin
  if new.service_id is not null and not exists (
    select 1 from public.services where id = new.service_id and church_id = new.church_id
  ) then
    raise exception 'Service does not belong to this church' using errcode = '23514';
  end if;
  return new;
end $$;

create trigger actions_guard_service
  before insert or update on public.actions
  for each row execute function public.guard_action_service();

create or replace function public.guard_service_live_action()
returns trigger language plpgsql as $$
begin
  if new.live_action_id is not null and not exists (
    select 1 from public.actions where id = new.live_action_id and service_id = new.id
  ) then
    raise exception 'Pinned action must belong to this service' using errcode = '23514';
  end if;
  return new;
end $$;

create trigger services_guard_live_action
  before insert or update of live_action_id on public.services
  for each row execute function public.guard_service_live_action();

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.profiles            enable row level security;
alter table public.churches            enable row level security;
alter table public.church_members      enable row level security;
alter table public.church_invitations  enable row level security;
alter table public.services            enable row level security;
alter table public.service_times       enable row level security;
alter table public.actions             enable row level security;
alter table public.poll_votes          enable row level security;
alter table public.action_responses    enable row level security;

-- profiles
create policy "profiles: read self and teammates" on public.profiles
  for select to authenticated using (id = auth.uid() or public.shares_church_with(id));
create policy "profiles: update self" on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- churches
create policy "churches: members read" on public.churches
  for select to authenticated using (public.has_church_role(id) or created_by = auth.uid());
create policy "churches: any user can create" on public.churches
  for insert to authenticated with check (created_by = auth.uid());
create policy "churches: admins update" on public.churches
  for update to authenticated
  using (public.has_church_role(id, array['owner','admin']::public.member_role[]))
  with check (public.has_church_role(id, array['owner','admin']::public.member_role[]));
create policy "churches: owners delete" on public.churches
  for delete to authenticated using (public.has_church_role(id, array['owner']::public.member_role[]));

-- church_members
create policy "members: read own churches" on public.church_members
  for select to authenticated using (public.has_church_role(church_id));
create policy "members: admins add" on public.church_members
  for insert to authenticated
  with check (public.has_church_role(church_id, array['owner','admin']::public.member_role[]));
create policy "members: admins update" on public.church_members
  for update to authenticated
  using (public.has_church_role(church_id, array['owner','admin']::public.member_role[]))
  with check (public.has_church_role(church_id, array['owner','admin']::public.member_role[]));
create policy "members: admins remove, anyone can leave" on public.church_members
  for delete to authenticated
  using (user_id = auth.uid() or public.has_church_role(church_id, array['owner','admin']::public.member_role[]));

-- church_invitations
create policy "invitations: admins manage" on public.church_invitations
  for all to authenticated
  using (public.has_church_role(church_id, array['owner','admin']::public.member_role[]))
  with check (public.has_church_role(church_id, array['owner','admin']::public.member_role[]));

-- services
create policy "services: members read" on public.services
  for select to authenticated using (public.has_church_role(church_id));
create policy "services: editors write" on public.services
  for all to authenticated
  using (public.has_church_role(church_id))
  with check (public.has_church_role(church_id));

-- service_times
create policy "service_times: members read" on public.service_times
  for select to authenticated using (
    exists (select 1 from public.services s where s.id = service_id and public.has_church_role(s.church_id))
  );
create policy "service_times: editors write" on public.service_times
  for all to authenticated
  using (exists (select 1 from public.services s where s.id = service_id and public.has_church_role(s.church_id)))
  with check (exists (select 1 from public.services s where s.id = service_id and public.has_church_role(s.church_id)));

-- actions
create policy "actions: members read" on public.actions
  for select to authenticated using (public.has_church_role(church_id));
create policy "actions: editors write" on public.actions
  for all to authenticated
  using (public.has_church_role(church_id))
  with check (public.has_church_role(church_id));

-- poll_votes (writes only through cast_vote RPC)
create policy "poll_votes: members read" on public.poll_votes
  for select to authenticated using (
    exists (select 1 from public.actions a where a.id = action_id and public.has_church_role(a.church_id))
  );
create policy "poll_votes: editors reset" on public.poll_votes
  for delete to authenticated using (
    exists (select 1 from public.actions a where a.id = action_id and public.has_church_role(a.church_id))
  );

-- action_responses (writes only through submit_response RPC)
create policy "responses: members read" on public.action_responses
  for select to authenticated using (public.has_church_role(church_id));
create policy "responses: editors update" on public.action_responses
  for update to authenticated
  using (public.has_church_role(church_id)) with check (public.has_church_role(church_id));
create policy "responses: admins delete" on public.action_responses
  for delete to authenticated
  using (public.has_church_role(church_id, array['owner','admin']::public.member_role[]));

-- =============================================================================
-- Public API (RPCs) — the only way anonymous attendees touch the database.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- get_live_page: resolves what an attendee should see right now.
--   p_church_slug  : church slug from the QR/NFC URL
--   p_service_slug : optional — restrict to one service (e.g. per-room tags)
--   p_at           : optional preview timestamp; honoured ONLY for church members
-- ---------------------------------------------------------------------------
create or replace function public.get_live_page(
  p_church_slug text,
  p_service_slug text default null,
  p_at timestamptz default null
) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  c         public.churches;
  v_now     timestamptz;
  v_local   timestamp;
  v_occ     record;
  v_live    boolean := false;
  v_actions jsonb := '[]'::jsonb;
  v_next    jsonb;
  v_service jsonb;
begin
  select * into c from public.churches where slug = lower(trim(p_church_slug));
  if not found then
    return null;
  end if;

  v_now := case when p_at is not null and public.has_church_role(c.id) then p_at else now() end;
  v_local := v_now at time zone c.timezone;

  -- Live occurrence: check yesterday/today/tomorrow so lead/trail windows can cross midnight
  select
    s.id as service_id, s.name, s.slug, s.lead_minutes, s.trail_minutes,
    s.live_action_id, s.live_action_until,
    (dd.d + st.start_time) as occ_start,
    (dd.d + st.end_time)   as occ_end
  into v_occ
  from public.services s
  join public.service_times st on st.service_id = s.id and st.is_active
  cross join lateral (select (v_local::date + g) as d from generate_series(-1, 1) as g) dd
  where s.church_id = c.id
    and s.is_active
    and (p_service_slug is null or s.slug = lower(trim(p_service_slug)))
    and (st.specific_date = dd.d or (st.specific_date is null and st.day_of_week = extract(dow from dd.d)::int))
    and v_local >= (dd.d + st.start_time) - make_interval(mins => s.lead_minutes)
    and v_local <  (dd.d + st.end_time)   + make_interval(mins => s.trail_minutes)
  order by
    (v_local >= (dd.d + st.start_time) and v_local < (dd.d + st.end_time)) desc,
    abs(extract(epoch from v_local - (dd.d + st.start_time))) asc,
    s.sort_order
  limit 1;

  v_live := found;

  if v_live then
    v_service := jsonb_build_object(
      'id', v_occ.service_id,
      'name', v_occ.name,
      'slug', v_occ.slug,
      'starts_at', v_occ.occ_start at time zone c.timezone,
      'ends_at',   v_occ.occ_end   at time zone c.timezone
    );

    select coalesce(jsonb_agg(jsonb_build_object(
             'id', x.id, 'type', x.type, 'title', x.title, 'content', x.content,
             'pinned', x.pinned, 'visible_until', x.visible_until at time zone c.timezone
           ) order by x.pinned desc, x.priority desc, x.sort_order, x.created_at), '[]'::jsonb)
      into v_actions
    from (
      select a.*,
             (a.id = v_occ.live_action_id and (v_occ.live_action_until is null or v_occ.live_action_until > v_now)) as pinned,
             case when a.end_offset_minutes is null
                  then v_occ.occ_end + make_interval(mins => v_occ.trail_minutes)
                  else v_occ.occ_start + make_interval(mins => a.end_offset_minutes) end as visible_until,
             case when a.start_offset_minutes is null
                  then v_occ.occ_start - make_interval(mins => v_occ.lead_minutes)
                  else v_occ.occ_start + make_interval(mins => a.start_offset_minutes) end as visible_from
      from public.actions a
      where a.church_id = c.id and a.is_active and a.service_id = v_occ.service_id
    ) x
    where x.pinned or (v_local >= x.visible_from and v_local < x.visible_until);
  else
    -- Between services: church-wide actions
    select coalesce(jsonb_agg(jsonb_build_object(
             'id', a.id, 'type', a.type, 'title', a.title, 'content', a.content,
             'pinned', false, 'visible_until', null
           ) order by a.priority desc, a.sort_order, a.created_at), '[]'::jsonb)
      into v_actions
    from public.actions a
    where a.church_id = c.id and a.is_active and a.service_id is null;

    -- Next upcoming occurrence
    select jsonb_build_object(
             'name', s.name, 'slug', s.slug,
             'starts_at', y.occ at time zone c.timezone,
             'label', st.label
           )
      into v_next
    from public.services s
    join public.service_times st on st.service_id = s.id and st.is_active
    cross join lateral (
      select case
        when st.specific_date is not null then st.specific_date + st.start_time
        else (v_local::date + ((st.day_of_week - extract(dow from v_local)::int + 7) % 7)) + st.start_time
      end as occ0
    ) x
    cross join lateral (
      select case when st.specific_date is null and x.occ0 <= v_local
                  then x.occ0 + interval '7 days' else x.occ0 end as occ
    ) y
    where s.church_id = c.id and s.is_active
      and (p_service_slug is null or s.slug = lower(trim(p_service_slug)))
      and y.occ > v_local
    order by y.occ
    limit 1;
  end if;

  return jsonb_build_object(
    'church', jsonb_build_object(
      'id', c.id, 'slug', c.slug, 'name', c.name, 'timezone', c.timezone,
      'logo_url', c.logo_url, 'primary_color', c.primary_color, 'accent_color', c.accent_color,
      'landing', c.landing
    ),
    'live', v_live,
    'service', v_service,
    'actions', v_actions,
    'next_service', v_next,
    'server_time', v_now
  );
end $$;

-- ---------------------------------------------------------------------------
-- is_action_live: true when the action is currently shown on its landing page
-- ---------------------------------------------------------------------------
create or replace function public.is_action_live(p_action uuid)
returns boolean
language plpgsql stable security definer set search_path = public as $$
declare
  v_church_slug text;
  v_service_slug text;
  v_page jsonb;
begin
  select c.slug, s.slug into v_church_slug, v_service_slug
  from public.actions a
  join public.churches c on c.id = a.church_id
  left join public.services s on s.id = a.service_id
  where a.id = p_action and a.is_active;

  if v_church_slug is null then
    return false;
  end if;

  v_page := public.get_live_page(v_church_slug, v_service_slug, null);
  return exists (
    select 1 from jsonb_array_elements(v_page -> 'actions') e where (e ->> 'id')::uuid = p_action
  );
end $$;

-- ---------------------------------------------------------------------------
-- Polls
-- ---------------------------------------------------------------------------
create or replace function public.poll_results(p_action uuid)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  a public.actions;
  v_counts jsonb;
  v_total int;
begin
  select * into a from public.actions where id = p_action and type = 'poll';
  if not found then
    raise exception 'Poll not found' using errcode = 'P0002';
  end if;

  if coalesce((a.content ->> 'show_results')::boolean, true) = false and not public.has_church_role(a.church_id) then
    return jsonb_build_object('hidden', true);
  end if;

  select coalesce(jsonb_object_agg(option_id, n), '{}'::jsonb), coalesce(sum(n), 0)::int
    into v_counts, v_total
  from (select option_id, count(*) as n from public.poll_votes where action_id = p_action group by option_id) t;

  return jsonb_build_object('hidden', false, 'total', v_total, 'counts', v_counts);
end $$;

create or replace function public.cast_vote(p_action uuid, p_option text, p_voter text)
returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare
  a public.actions;
begin
  select * into a from public.actions where id = p_action and type = 'poll' and is_active;
  if not found then
    raise exception 'Poll not found' using errcode = 'P0002';
  end if;

  if coalesce((a.content ->> 'closed')::boolean, false) then
    raise exception 'This poll is closed' using errcode = '22023';
  end if;

  if not exists (
    select 1 from jsonb_array_elements(coalesce(a.content -> 'options', '[]'::jsonb)) o
    where o ->> 'id' = p_option
  ) then
    raise exception 'Invalid option' using errcode = '22023';
  end if;

  if char_length(coalesce(p_voter, '')) not between 8 and 100 then
    raise exception 'Invalid voter token' using errcode = '22023';
  end if;

  if not public.is_action_live(p_action) then
    raise exception 'This poll is not live right now' using errcode = '22023';
  end if;

  insert into public.poll_votes (action_id, voter_token, option_id)
  values (p_action, p_voter, p_option)
  on conflict (action_id, voter_token) do update
    set option_id = excluded.option_id, created_at = now()
    where coalesce((a.content ->> 'allow_change')::boolean, true);

  return public.poll_results(p_action);
end $$;

-- ---------------------------------------------------------------------------
-- Forms (prayer requests, connect cards, ...)
-- ---------------------------------------------------------------------------
create or replace function public.submit_response(p_action uuid, p_payload jsonb)
returns uuid
language plpgsql volatile security definer set search_path = public as $$
declare
  a public.actions;
  v_field jsonb;
  v_clean jsonb := '{}'::jsonb;
  v_val text;
  v_id uuid;
begin
  select * into a from public.actions where id = p_action and type = 'form' and is_active;
  if not found then
    raise exception 'Form not found' using errcode = 'P0002';
  end if;

  if p_payload is null or jsonb_typeof(p_payload) <> 'object' or octet_length(p_payload::text) > 8000 then
    raise exception 'Invalid submission' using errcode = '22023';
  end if;

  if not public.is_action_live(p_action) then
    raise exception 'This form is not open right now' using errcode = '22023';
  end if;

  -- Keep only declared fields, enforce required ones
  for v_field in select * from jsonb_array_elements(coalesce(a.content -> 'fields', '[]'::jsonb)) loop
    v_val := left(trim(coalesce(p_payload ->> (v_field ->> 'id'), '')), 4000);
    if coalesce((v_field ->> 'required')::boolean, false) and v_val = '' then
      raise exception 'Missing required field: %', v_field ->> 'label' using errcode = '22023';
    end if;
    if v_val <> '' then
      v_clean := v_clean || jsonb_build_object(v_field ->> 'id', v_val);
    end if;
  end loop;

  if v_clean = '{}'::jsonb then
    raise exception 'Empty submission' using errcode = '22023';
  end if;

  insert into public.action_responses (action_id, church_id, payload)
  values (a.id, a.church_id, v_clean)
  returning id into v_id;

  return v_id;
end $$;

-- ---------------------------------------------------------------------------
-- Team management
-- ---------------------------------------------------------------------------
create or replace function public.invite_member(p_church uuid, p_email text, p_role public.member_role default 'editor')
returns text
language plpgsql volatile security definer set search_path = public as $$
declare
  v_email text := lower(trim(p_email));
  v_user uuid;
begin
  if not public.has_church_role(p_church, array['owner','admin']::public.member_role[]) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  if p_role = 'owner' and not public.has_church_role(p_church, array['owner']::public.member_role[]) then
    raise exception 'Only owners can add owners' using errcode = '42501';
  end if;
  if position('@' in v_email) < 2 then
    raise exception 'Invalid email' using errcode = '22023';
  end if;

  select id into v_user from auth.users where lower(email) = v_email limit 1;

  if v_user is not null then
    insert into public.church_members (church_id, user_id, role)
    values (p_church, v_user, p_role)
    on conflict (church_id, user_id) do update set role = excluded.role;
    return 'added';
  end if;

  insert into public.church_invitations (church_id, email, role)
  values (p_church, v_email, p_role)
  on conflict (church_id, email) do update set role = excluded.role;
  return 'invited';
end $$;

create or replace function public.list_members(p_church uuid)
returns table (user_id uuid, email text, full_name text, role public.member_role, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select m.user_id, p.email, p.full_name, m.role, m.created_at
  from public.church_members m
  left join public.profiles p on p.id = m.user_id
  where m.church_id = p_church and public.has_church_role(p_church)
  order by m.role, p.email;
$$;

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------
revoke execute on function public.is_action_live(uuid) from public, anon;
revoke execute on function public.invite_member(uuid, text, public.member_role) from public, anon;
revoke execute on function public.list_members(uuid) from public, anon;

grant execute on function public.get_live_page(text, text, timestamptz) to anon, authenticated;
grant execute on function public.poll_results(uuid) to anon, authenticated;
grant execute on function public.cast_vote(uuid, text, text) to anon, authenticated;
grant execute on function public.submit_response(uuid, jsonb) to anon, authenticated;
grant execute on function public.invite_member(uuid, text, public.member_role) to authenticated;
grant execute on function public.list_members(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Storage: public bucket for logos / hero images, path = <church_id>/<file>
-- ---------------------------------------------------------------------------
do $$
begin
  if exists (select 1 from information_schema.tables where table_schema = 'storage' and table_name = 'buckets') then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values ('church-assets', 'church-assets', true, 5242880,
            array['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml', 'image/gif'])
    on conflict (id) do nothing;
  end if;
end $$;

do $$
begin
  if exists (select 1 from information_schema.tables where table_schema = 'storage' and table_name = 'objects') then
    execute '
      create policy "church-assets: members upload" on storage.objects
        for insert to authenticated
        with check (
          bucket_id = ''church-assets''
          and exists (
            select 1 from public.church_members m
            where m.user_id = auth.uid() and m.church_id::text = (storage.foldername(name))[1]
          )
        );
      create policy "church-assets: members update" on storage.objects
        for update to authenticated
        using (
          bucket_id = ''church-assets''
          and exists (
            select 1 from public.church_members m
            where m.user_id = auth.uid() and m.church_id::text = (storage.foldername(name))[1]
          )
        );
      create policy "church-assets: members delete" on storage.objects
        for delete to authenticated
        using (
          bucket_id = ''church-assets''
          and exists (
            select 1 from public.church_members m
            where m.user_id = auth.uid() and m.church_id::text = (storage.foldername(name))[1]
          )
        );
    ';
  end if;
exception when duplicate_object then
  -- policies already exist
  null;
end $$;
