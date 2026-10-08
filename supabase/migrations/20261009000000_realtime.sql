-- Enable Supabase Realtime for the tables powering the live attendee view
-- This allows attendee browsers to receive WebSocket push notifications
-- as soon as an action is created, edited, pinned, or unpinned, or church settings change.

do $$
begin
  -- Ensure publication supabase_realtime exists (standard in Supabase)
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    -- Add actions table if not already in publication
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'actions'
    ) then
      alter publication supabase_realtime add table public.actions;
    end if;

    -- Add services table if not already in publication
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'services'
    ) then
      alter publication supabase_realtime add table public.services;
    end if;

    -- Add churches table if not already in publication
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'churches'
    ) then
      alter publication supabase_realtime add table public.churches;
    end if;
  end if;
end $$;
