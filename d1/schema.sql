-- =============================================================================
-- Service Buttler — Cloudflare D1 Database Schema (SQLite)
-- =============================================================================

-- 1. Users & Authentication
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT,
  full_name TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT UNIQUE NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);

CREATE TABLE IF NOT EXISTS magic_links (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  token_hash TEXT UNIQUE NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 2. Churches (Organizations)
CREATE TABLE IF NOT EXISTS churches (
  id TEXT PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  timezone TEXT NOT NULL DEFAULT 'UTC',
  logo_url TEXT,
  primary_color TEXT NOT NULL DEFAULT '#4f46e5',
  accent_color TEXT NOT NULL DEFAULT '#f59e0b',
  landing TEXT NOT NULL DEFAULT '{}',
  created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_churches_slug ON churches(slug);

-- 3. Church Memberships & Invitations
CREATE TABLE IF NOT EXISTS church_members (
  church_id TEXT NOT NULL REFERENCES churches(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'editor',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (church_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_church_members_user ON church_members(user_id);

CREATE TABLE IF NOT EXISTS church_invitations (
  id TEXT PRIMARY KEY,
  church_id TEXT NOT NULL REFERENCES churches(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'editor',
  invited_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (church_id, email)
);
CREATE INDEX IF NOT EXISTS idx_church_invitations_email ON church_invitations(email);

-- 4. Services & Service Times
CREATE TABLE IF NOT EXISTS services (
  id TEXT PRIMARY KEY,
  church_id TEXT NOT NULL REFERENCES churches(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  description TEXT,
  lead_minutes INTEGER NOT NULL DEFAULT 15,
  trail_minutes INTEGER NOT NULL DEFAULT 30,
  live_action_id TEXT,
  live_action_until TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (church_id, slug)
);
CREATE INDEX IF NOT EXISTS idx_services_church ON services(church_id);

CREATE TABLE IF NOT EXISTS service_times (
  id TEXT PRIMARY KEY,
  service_id TEXT NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  day_of_week INTEGER,
  specific_date TEXT,
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  label TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_service_times_service ON service_times(service_id);

-- 5. Actions (Announcements, Notes, Polls, Offering, Forms, Questions, Links)
CREATE TABLE IF NOT EXISTS actions (
  id TEXT PRIMARY KEY,
  church_id TEXT NOT NULL REFERENCES churches(id) ON DELETE CASCADE,
  service_id TEXT REFERENCES services(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL DEFAULT '{}',
  start_offset_minutes INTEGER,
  end_offset_minutes INTEGER,
  priority INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_actions_church ON actions(church_id);
CREATE INDEX IF NOT EXISTS idx_actions_service ON actions(service_id);

-- 6. Poll Votes & Responses
CREATE TABLE IF NOT EXISTS poll_votes (
  action_id TEXT NOT NULL REFERENCES actions(id) ON DELETE CASCADE,
  voter_token TEXT NOT NULL,
  option_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (action_id, voter_token)
);

CREATE TABLE IF NOT EXISTS action_responses (
  id TEXT PRIMARY KEY,
  action_id TEXT NOT NULL REFERENCES actions(id) ON DELETE CASCADE,
  church_id TEXT NOT NULL REFERENCES churches(id) ON DELETE CASCADE,
  payload TEXT NOT NULL,
  is_archived INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_responses_action ON action_responses(action_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_responses_church ON action_responses(church_id, created_at DESC);

-- 7. Analytics & Presence
CREATE TABLE IF NOT EXISTS service_scans (
  id TEXT PRIMARY KEY,
  church_id TEXT NOT NULL REFERENCES churches(id) ON DELETE CASCADE,
  service_id TEXT REFERENCES services(id) ON DELETE SET NULL,
  source TEXT NOT NULL DEFAULT 'qr',
  scanned_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_scans_church ON service_scans(church_id, scanned_at DESC);

CREATE TABLE IF NOT EXISTS attendee_presence (
  church_id TEXT NOT NULL,
  voter_token TEXT NOT NULL,
  device TEXT NOT NULL DEFAULT 'mobile',
  last_seen TEXT NOT NULL,
  PRIMARY KEY (church_id, voter_token)
);
CREATE INDEX IF NOT EXISTS idx_presence_last_seen ON attendee_presence(church_id, last_seen);
