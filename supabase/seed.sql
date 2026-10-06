-- =============================================================================
-- Sample seed data: Grace Community Church demo
-- Run this in Supabase SQL Editor if you want instant test data.
-- =============================================================================

do $$
declare
  v_church uuid;
  v_service uuid;
  v_announcement uuid;
  v_notes uuid;
  v_poll uuid;
  v_offering uuid;
  v_form uuid;
begin
  -- Upsert demo church
  insert into public.churches (id, slug, name, timezone, primary_color, accent_color, landing)
  values (
    'a0000000-0000-0000-0000-000000000001',
    'grace-community',
    'Grace Community Church',
    'America/New_York',
    '#4f46e5',
    '#f59e0b',
    jsonb_build_object(
      'welcome_title', 'Welcome to Grace Community',
      'welcome_message', 'We are glad you are here with us today! Follow along with the service below.',
      'theme', 'light',
      'show_service_name', true,
      'show_next_service', true,
      'footer_text', '© 2026 Grace Community Church · All are welcome',
      'links', jsonb_build_array(
        jsonb_build_object('label', 'Church Website', 'url', 'https://example.com'),
        jsonb_build_object('label', 'Watch Livestream', 'url', 'https://youtube.com')
      )
    )
  )
  on conflict (slug) do update set name = excluded.name
  returning id into v_church;

  -- Sunday Morning Service
  insert into public.services (id, church_id, name, slug, description, lead_minutes, trail_minutes, is_active)
  values (
    'b0000000-0000-0000-0000-000000000001',
    v_church,
    'Sunday Morning Worship',
    'worship',
    'Our weekly worship service with modern music, practical teaching and communion.',
    15,
    45,
    true
  )
  on conflict (church_id, slug) do update set name = excluded.name
  returning id into v_service;

  -- Service times: Sunday 10:00 - 11:30 and Sunday 18:00 - 19:15
  delete from public.service_times where service_id = v_service;

  insert into public.service_times (service_id, day_of_week, start_time, end_time, label)
  values
    (v_service, 0, '10:00', '11:30', 'Morning Service'),
    (v_service, 0, '18:00', '19:15', 'Evening Service');

  -- Clean previous sample actions for clean idempotency
  delete from public.actions where church_id = v_church;

  -- 1. Pre-service Announcement (-15m to +5m) (Slideshow demonstration)
  insert into public.actions (church_id, service_id, type, title, start_offset_minutes, end_offset_minutes, priority, content)
  values (
    v_church, v_service, 'announcement',
    'Sunday Announcements',
    -15, 5, 10,
    jsonb_build_object(
      'auto_advance_seconds', 6,
      'slides', jsonb_build_array(
        jsonb_build_object(
          'id', 'slide-1',
          'title', 'Welcome & Baptism Sunday',
          'body', E'We are excited you are here today! We are celebrating **baptisms** next Sunday at the beach.\n\nIf you want to take this step of faith, sign up below.',
          'image_url', 'https://images.unsplash.com/photo-1519817650390-64a93db51149?auto=format&fit=crop&w=1200&q=80',
          'cta_label', 'Sign up for Baptism',
          'cta_url', 'https://example.com/baptism'
        ),
        jsonb_build_object(
          'id', 'slide-2',
          'title', 'New Members Gathering',
          'body', E'Join us this Wednesday at 19:00 in the Fellowship Hall for coffee, dessert, and our newcomer orientation.\n\nMeet the pastors and learn how to get plugged in.',
          'image_url', 'https://images.unsplash.com/photo-1511795409834-ef04bbd61622?auto=format&fit=crop&w=1200&q=80',
          'cta_label', 'RSVP for Dinner',
          'cta_url', 'https://example.com/newcomers'
        ),
        jsonb_build_object(
          'id', 'slide-3',
          'title', 'Youth Camp Registration',
          'body', E'Summer Youth Camp early bird registration is now open! Grades 6–12.\n\nSpaces are limited, reserve your spot today.',
          'image_url', 'https://images.unsplash.com/photo-1478147427282-58a87a120781?auto=format&fit=crop&w=1200&q=80',
          'cta_label', 'Register for Camp',
          'cta_url', 'https://example.com/camp'
        )
      )
    )
  );

  -- 2. Sermon Notes (+10m to +55m) (Slide components stacked with scripture & background images)
  insert into public.actions (church_id, service_id, type, title, start_offset_minutes, end_offset_minutes, priority, content)
  values (
    v_church, v_service, 'sermon_notes',
    'Living with Unshakeable Hope',
    10, 55, 20,
    jsonb_build_object(
      'speaker', 'Pastor David Mitchell',
      'main_verse', 'Romans 8:18–28',
      'allow_personal_notes', true,
      'slides', jsonb_build_array(
        jsonb_build_object(
          'id', 'sermon-pt-1',
          'title', '1. Present struggles are temporary',
          'verse_reference', 'Romans 8:18',
          'body', E'* Real biblical hope does not ignore pain; it anchors through the storm.\n* What God is preparing in you is greater than what is happening to you.',
          'image_url', 'https://images.unsplash.com/photo-1509021436665-8f07dbf5bf1d?auto=format&fit=crop&w=1200&q=80'
        ),
        jsonb_build_object(
          'id', 'sermon-pt-2',
          'title', '2. The Holy Spirit intercedes in our weakness',
          'verse_reference', 'Romans 8:26',
          'body', E'* We do not always have the right words to pray.\n* The Spirit bridges the gap with groans deeper than words.',
          'image_url', 'https://images.unsplash.com/photo-1518495973542-4542c06a5843?auto=format&fit=crop&w=1200&q=80'
        ),
        jsonb_build_object(
          'id', 'sermon-pt-3',
          'title', '3. God works all things together for ultimate good',
          'verse_reference', 'Romans 8:28',
          'body', E'* Not all things that happen are good, but God is able to redeem all things.\n* Trust His character even when you cannot trace His hand.'
        )
      )
    )
  );

  -- 3. Live Poll (+30m to +45m)
  insert into public.actions (id, church_id, service_id, type, title, start_offset_minutes, end_offset_minutes, priority, content)
  values (
    'c0000000-0000-0000-0000-000000000001',
    v_church, v_service, 'poll',
    'Live Reflection Poll',
    30, 45, 30,
    jsonb_build_object(
      'question', 'Where do you need God''s hope most right now?',
      'options', jsonb_build_array(
        jsonb_build_object('id', 'family', 'label', 'Family & relationships'),
        jsonb_build_object('id', 'work', 'label', 'Work & purpose'),
        jsonb_build_object('id', 'health', 'label', 'Physical or mental health'),
        jsonb_build_object('id', 'faith', 'label', 'My spiritual walk')
      ),
      'show_results', true,
      'allow_change', true,
      'closed', false
    )
  );

  -- 4. Offering (+50m to +75m)
  insert into public.actions (church_id, service_id, type, title, start_offset_minutes, end_offset_minutes, priority, content)
  values (
    v_church, v_service, 'offering',
    'Worship Through Giving',
    50, 75, 10,
    jsonb_build_object(
      'message', 'Giving is an act of worship and partnership in God''s mission. Thank you for your faithful generosity to our local community and world missions.',
      'methods', jsonb_build_array(
        jsonb_build_object(
          'id', 'online',
          'label', 'Card / Apple Pay',
          'description', 'Fast and secure giving online',
          'url', 'https://example.com/give'
        ),
        jsonb_build_object(
          'id', 'bank',
          'label', 'Direct Bank Transfer',
          'description', 'Zero fees for the church',
          'details', E'Account Name: Grace Community Church\nIBAN / Account: US89 3704 0044 0532 0130 00\nReference: Offering'
        )
      )
    )
  );

  -- 5. Connect Card (Church-wide fallback, also available between services)
  insert into public.actions (church_id, service_id, type, title, priority, content)
  values (
    v_church, null, 'form',
    'Digital Connect & Prayer Card',
    5,
    jsonb_build_object(
      'intro', 'Visiting for the first time or need prayer? We would love to pray with you or help you take your next step.',
      'fields', jsonb_build_array(
        jsonb_build_object('id', 'name', 'label', 'Your Name', 'type', 'text', 'required', true),
        jsonb_build_object('id', 'email', 'label', 'Email Address', 'type', 'email', 'required', false),
        jsonb_build_object('id', 'prayer', 'label', 'Prayer request or question', 'type', 'textarea', 'required', true)
      ),
      'submit_label', 'Submit Card',
      'success_message', 'Thank you! Our pastoral team will be praying for your request this week.'
    )
  );

end $$;
