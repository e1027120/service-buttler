import { type D1Database, type Env, HttpError } from './db';

export interface User {
  id: string;
  email: string;
  full_name: string | null;
  created_at: string;
}

export interface Session {
  id: string;
  user_id: string;
  expires_at: string;
  created_at: string;
}

export type MemberRole = 'owner' | 'admin' | 'editor';

// ----------------------------------------------------------------------------
// Password Hashing & Verification (Web Crypto PBKDF2)
// ----------------------------------------------------------------------------

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveBits', 'deriveKey']
  );
  const derivedKey = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt,
      iterations: 100_000,
      hash: 'SHA-256',
    },
    keyMaterial,
    256
  );

  const saltHex = Array.from(salt).map((b) => b.toString(16).padStart(2, '0')).join('');
  const hashHex = Array.from(new Uint8Array(derivedKey)).map((b) => b.toString(16).padStart(2, '0')).join('');
  return `pbkdf2:100000:${saltHex}:${hashHex}`;
}

export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  if (!storedHash) return false;

  // 1. Verify PBKDF2
  if (storedHash.startsWith('pbkdf2:')) {
    const parts = storedHash.split(':');
    if (parts.length !== 4) return false;
    const iterations = parseInt(parts[1], 10);
    const saltHex = parts[2];
    const originalHashHex = parts[3];

    const salt = new Uint8Array(saltHex.match(/.{1,2}/g)?.map((byte) => parseInt(byte, 16)) || []);
    const enc = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      enc.encode(password),
      { name: 'PBKDF2' },
      false,
      ['deriveBits', 'deriveKey']
    );
    const derivedKey = await crypto.subtle.deriveBits(
      {
        name: 'PBKDF2',
        salt,
        iterations,
        hash: 'SHA-256',
      },
      keyMaterial,
      256
    );

    const derivedHashHex = Array.from(new Uint8Array(derivedKey))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
    return derivedHashHex === originalHashHex;
  }

  // 2. Fallback for bcrypt (Supabase export)
  if (storedHash.startsWith('$2a$') || storedHash.startsWith('$2b$') || storedHash.startsWith('$2y$')) {
    // If bcrypt-ts or similar isn't in bundle, we check via basic constant-time or password re-hash on magic link
    return false;
  }

  return false;
}

export async function hashToken(token: string): Promise<string> {
  const enc = new TextEncoder();
  const hashBuffer = await crypto.subtle.digest('SHA-256', enc.encode(token));
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

// ----------------------------------------------------------------------------
// Session & Auth Token Management
// ----------------------------------------------------------------------------

export async function createSession(db: D1Database, userId: string): Promise<string> {
  const rawToken = crypto.randomUUID() + '-' + crypto.randomUUID();
  const tokenHash = await hashToken(rawToken);

  // Sessions valid for 30 days
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

  await db
    .prepare('INSERT INTO sessions (id, user_id, token_hash, expires_at) VALUES (?, ?, ?, ?)')
    .bind(tokenHash, userId, tokenHash, expiresAt)
    .run();

  return rawToken;
}

export async function authenticate(request: Request, env: Env): Promise<{ user: User; session: Session }> {
  let token: string | null = null;

  const authHeader = request.headers.get('Authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.slice(7).trim();
  }

  if (!token) {
    const cookies = request.headers.get('Cookie');
    if (cookies) {
      const match = cookies.match(/(?:^|;\s*)sb_token=([^;]+)/);
      if (match) token = match[1];
    }
  }

  if (!token) {
    throw new HttpError(401, 'Unauthorized: Missing session token');
  }

  const tokenHash = await hashToken(token);
  const now = new Date().toISOString();

  const row = await env.DB.prepare(`
    SELECT s.id as session_id, s.user_id, s.expires_at, s.created_at as session_created_at,
           u.id as user_id, u.email, u.full_name, u.created_at as user_created_at
    FROM sessions s
    JOIN users u ON u.id = s.user_id
    WHERE s.token_hash = ? AND s.expires_at > ?
  `)
    .bind(tokenHash, now)
    .first<{
      session_id: string;
      user_id: string;
      expires_at: string;
      session_created_at: string;
      email: string;
      full_name: string | null;
      user_created_at: string;
    }>();

  if (!row) {
    throw new HttpError(401, 'Unauthorized: Session expired or invalid');
  }

  return {
    user: {
      id: row.user_id,
      email: row.email,
      full_name: row.full_name,
      created_at: row.user_created_at,
    },
    session: {
      id: row.session_id,
      user_id: row.user_id,
      expires_at: row.expires_at,
      created_at: row.session_created_at,
    },
  };
}

export async function assertChurchRole(
  db: D1Database,
  churchId: string,
  userId: string,
  allowedRoles: MemberRole[] = ['owner', 'admin', 'editor']
): Promise<MemberRole> {
  const member = await db
    .prepare('SELECT role FROM church_members WHERE church_id = ? AND user_id = ?')
    .bind(churchId, userId)
    .first<{ role: MemberRole }>();

  if (!member || !allowedRoles.includes(member.role)) {
    throw new HttpError(403, 'Forbidden: Insufficient church permissions');
  }
  return member.role;
}

export async function acceptPendingInvitations(db: D1Database, user: User) {
  const email = user.email.toLowerCase().trim();
  const invitations = await db
    .prepare('SELECT id, church_id, role FROM church_invitations WHERE email = ?')
    .bind(email)
    .all<{ id: string; church_id: string; role: MemberRole }>();

  if (invitations.results.length > 0) {
    for (const inv of invitations.results) {
      await db
        .prepare(`
          INSERT INTO church_members (church_id, user_id, role)
          VALUES (?, ?, ?)
          ON CONFLICT (church_id, user_id) DO UPDATE SET role = excluded.role
        `)
        .bind(inv.church_id, user.id, inv.role)
        .run();

      await db.prepare('DELETE FROM church_invitations WHERE id = ?').bind(inv.id).run();
    }
  }
}
