// ----------------------------------------------------------------------------
// Domain types (mirror supabase/migrations)
// ----------------------------------------------------------------------------

export type MemberRole = 'owner' | 'admin' | 'editor';
export type ActionType = 'announcement' | 'sermon_notes' | 'poll' | 'offering' | 'form' | 'link';

export interface LandingLink {
  label: string;
  url: string;
}

export interface LandingConfig {
  welcome_title?: string;
  welcome_message?: string;
  hero_image_url?: string;
  theme?: 'light' | 'dark' | 'brand';
  show_service_name?: boolean;
  show_next_service?: boolean;
  idle_title?: string;
  idle_message?: string;
  footer_text?: string;
  links?: LandingLink[];
}

export interface Church {
  id: string;
  slug: string;
  name: string;
  timezone: string;
  logo_url: string | null;
  primary_color: string;
  accent_color: string;
  landing: LandingConfig;
  created_at: string;
  updated_at: string;
}

export interface Membership {
  church_id: string;
  role: MemberRole;
  churches: Church;
}

export interface Service {
  id: string;
  church_id: string;
  name: string;
  slug: string;
  description: string | null;
  lead_minutes: number;
  trail_minutes: number;
  live_action_id: string | null;
  live_action_until: string | null;
  is_active: boolean;
  sort_order: number;
  service_times?: ServiceTime[];
}

export interface ServiceTime {
  id: string;
  service_id: string;
  day_of_week: number | null;
  specific_date: string | null;
  start_time: string; // HH:MM:SS
  end_time: string;
  label: string | null;
  is_active: boolean;
}

// ---- Action content per type ----------------------------------------------
export interface AnnouncementSlide {
  id: string;
  title?: string;
  body?: string; // markdown
  image_url?: string;
  cta_label?: string;
  cta_url?: string;
}

export interface AnnouncementContent {
  // Slideshow support (each slide has its own image, text, and CTA)
  slides?: AnnouncementSlide[];
  auto_advance_seconds?: number;

  // Single-slide legacy fields (kept for backwards compatibility)
  body?: string; // markdown
  image_url?: string;
  cta_label?: string;
  cta_url?: string;
}

export interface SermonSlide {
  id: string;
  title?: string; // Point or headline, e.g. "1. Present struggles are temporary"
  verse_reference?: string; // e.g. "Romans 8:18" or "John 3:16"
  verse_text?: string; // Optional manual override or cached verse text
  body?: string; // Optional explanatory notes/bullet points (markdown)
  image_url?: string; // Background / feature image for the slide
}

export interface SermonNotesContent {
  speaker?: string;
  main_verse?: string; // Primary sermon scripture, e.g. "Romans 8:18–28"
  slides?: SermonSlide[]; // Sermon slides displayed sequentially one under the other
  allow_personal_notes?: boolean;

  // Backwards compatibility for older single markdown body
  scripture?: string;
  body?: string; // markdown
}

export interface PollOption {
  id: string;
  label: string;
}
export interface PollContent {
  question?: string;
  options?: PollOption[];
  show_results?: boolean;
  allow_change?: boolean;
  closed?: boolean;
}

export interface OfferingMethod {
  id: string;
  label: string;
  description?: string;
  url?: string;
  details?: string; // e.g. bank transfer / IBAN text
}
export interface OfferingContent {
  message?: string;
  methods?: OfferingMethod[];
}

export type FormFieldType = 'text' | 'textarea' | 'email' | 'phone';
export interface FormField {
  id: string;
  label: string;
  type: FormFieldType;
  required?: boolean;
  placeholder?: string;
}
export interface FormContent {
  intro?: string;
  fields?: FormField[];
  submit_label?: string;
  success_message?: string;
}

export interface LinkContent {
  url?: string;
  label?: string;
  description?: string;
  image_url?: string;
}

export type ActionContent =
  | AnnouncementContent
  | SermonNotesContent
  | PollContent
  | OfferingContent
  | FormContent
  | LinkContent;

export interface Action {
  id: string;
  church_id: string;
  service_id: string | null;
  type: ActionType;
  title: string;
  content: Record<string, unknown>;
  start_offset_minutes: number | null;
  end_offset_minutes: number | null;
  priority: number;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface ActionResponse {
  id: string;
  action_id: string;
  church_id: string;
  payload: Record<string, string>;
  is_archived: boolean;
  created_at: string;
}

export interface Member {
  user_id: string;
  email: string | null;
  full_name: string | null;
  role: MemberRole;
  created_at: string;
}

export interface Invitation {
  id: string;
  church_id: string;
  email: string;
  role: MemberRole;
  created_at: string;
}

// ---- Public live page (get_live_page RPC) ---------------------------------
export interface LiveAction {
  id: string;
  type: ActionType;
  title: string;
  content: Record<string, unknown>;
  pinned: boolean;
  visible_until: string | null;
}

export interface LivePage {
  church: Pick<Church, 'id' | 'slug' | 'name' | 'timezone' | 'logo_url' | 'primary_color' | 'accent_color' | 'landing'>;
  live: boolean;
  service: { id: string; name: string; slug: string; starts_at: string; ends_at: string } | null;
  actions: LiveAction[];
  next_service: { name: string; slug: string; starts_at: string; label: string | null } | null;
  server_time: string;
}

export interface PollResults {
  hidden: boolean;
  total?: number;
  counts?: Record<string, number>;
}

// ---- Metadata --------------------------------------------------------------
export const ACTION_TYPES: { type: ActionType; label: string; description: string }[] = [
  { type: 'announcement', label: 'Announcement', description: 'News, events and highlights with an optional button' },
  { type: 'sermon_notes', label: 'Sermon notes', description: 'Outline, scripture and personal note-taking' },
  { type: 'poll', label: 'Live poll', description: 'Ask a question and show results live' },
  { type: 'offering', label: 'Offering', description: 'Giving options: online links, bank transfer, …' },
  { type: 'form', label: 'Form', description: 'Prayer requests, connect cards, feedback' },
  { type: 'link', label: 'Link', description: 'Send people to a page, livestream or sign-up' },
];

export const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
