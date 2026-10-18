-- =============================================================================
-- Migration: Add 'question' action type, enhance submit_response, add service_scans
-- =============================================================================

-- 1. Add question to action_type enum if not exists
do $$
begin
  alter type public.action_type add value if not exists 'question';
exception when others then
  null;
end $$;

-- 2. Update submit_response to accept both 'form' and 'question'
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
  select * into a from public.actions where id = p_action and (type = 'form' or type = 'question' or (content->>'form_type') = 'question') and is_active;
  if not found then
    raise exception 'Form not found' using errcode = 'P0002';
  end if;

  if p_payload is null or jsonb_typeof(p_payload) <> 'object' or octet_length(p_payload::text) > 8000 then
    raise exception 'Invalid submission' using errcode = '22023';
  end if;

  if not public.is_action_live(p_action) then
    raise exception 'This form is not open right now' using errcode = '22023';
  end if;

  -- If question, validate question body and optional author_name
  if a.type = 'question' or (a.content->>'form_type') = 'question' then
    v_val := left(trim(coalesce(p_payload ->> 'question', '')), 4000);
    if v_val = '' then
      raise exception 'Question cannot be empty' using errcode = '22023';
    end if;
    v_clean := jsonb_build_object(
      'question', v_val,
      'author_name', left(trim(coalesce(p_payload ->> 'author_name', 'Anonymous')), 100),
      'is_anonymous', coalesce(p_payload ->> 'is_anonymous', 'true'),
      'answered', coalesce(p_payload ->> 'answered', 'false')
    );
  else
    -- Standard form: keep only declared fields, enforce required ones
    for v_field in select * from jsonb_array_elements(coalesce(a.content -> 'fields', '[]'::jsonb)) loop
      v_val := left(trim(coalesce(p_payload ->> (v_field ->> 'id'), '')), 4000);
      if coalesce((v_field ->> 'required')::boolean, false) and v_val = '' then
        raise exception 'Missing required field: %', v_field ->> 'label' using errcode = '22023';
      end if;
      if v_val <> '' then
        v_clean := v_clean || jsonb_build_object(v_field ->> 'id', v_val);
      end if;
    end loop;
  end if;

  insert into public.action_responses (action_id, church_id, payload)
  values (a.id, a.church_id, v_clean)
  returning id into v_id;

  return v_id;
end $$;

grant execute on function public.submit_response(uuid, jsonb) to anon, authenticated;

-- 3. Telemetry / scan logging table
create table if not exists public.service_scans (
  id uuid primary key default gen_random_uuid(),
  church_id uuid not null references public.churches(id) on delete cascade,
  service_id uuid references public.services(id) on delete set null,
  source text not null default 'qr', -- 'qr' | 'link' | 'nfc'
  scanned_at timestamptz not null default now()
);

create index if not exists service_scans_church_idx on public.service_scans(church_id, scanned_at desc);
create index if not exists service_scans_service_idx on public.service_scans(service_id, scanned_at desc);

alter table public.service_scans enable row level security;

do $$
begin
  create policy "service_scans: insert from any" on public.service_scans
    for insert to anon, authenticated
    with check (true);
exception when duplicate_object then null;
end $$;

do $$
begin
  create policy "service_scans: members read" on public.service_scans
    for select to authenticated
    using (public.has_church_role(church_id));
exception when duplicate_object then null;
end $$;

-- 4. Scan logger RPC
create or replace function public.log_scan(p_church_slug text, p_service_slug text default null, p_source text default 'qr')
returns void
language plpgsql volatile security definer set search_path = public as $$
declare
  v_church_id uuid;
  v_service_id uuid;
begin
  select id into v_church_id from public.churches where slug = p_church_slug;
  if not found then return; end if;

  if p_service_slug is not null and p_service_slug <> '' then
    select id into v_service_id from public.services where church_id = v_church_id and slug = p_service_slug;
  end if;

  insert into public.service_scans (church_id, service_id, source)
  values (v_church_id, v_service_id, coalesce(p_source, 'qr'));
end $$;

grant execute on function public.log_scan(text, text, text) to anon, authenticated;
