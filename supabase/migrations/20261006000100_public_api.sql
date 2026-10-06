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
