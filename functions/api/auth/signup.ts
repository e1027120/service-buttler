import { acceptPendingInvitations, createSession, hashPassword } from '../../../server/auth';
import { type Env, errorResponse, HttpError, json, readJson } from '../../../server/db';

export const onRequestPost: PagesFunction<Env> = async (ctx) => {
  try {
    const body = await readJson<{ email?: string; password?: string; full_name?: string }>(ctx.request);
    const email = body.email?.trim().toLowerCase();
    const password = body.password;
    const fullName = body.full_name?.trim() || null;

    if (!email || !password) {
      throw new HttpError(400, 'Email and password are required');
    }
    if (password.length < 6) {
      throw new HttpError(400, 'Password must be at least 6 characters long');
    }

    const existing = await ctx.env.DB
      .prepare('SELECT id FROM users WHERE email = ?')
      .bind(email)
      .first();

    if (existing) {
      throw new HttpError(409, 'An account with this email already exists');
    }

    const userId = crypto.randomUUID();
    const passwordHash = await hashPassword(password);
    const now = new Date().toISOString();

    await ctx.env.DB
      .prepare('INSERT INTO users (id, email, password_hash, full_name, created_at) VALUES (?, ?, ?, ?, ?)')
      .bind(userId, email, passwordHash, fullName, now)
      .run();

    const user = {
      id: userId,
      email,
      full_name: fullName,
      created_at: now,
    };

    // Auto-accept any pending invitations for this email
    await acceptPendingInvitations(ctx.env.DB, user);

    const token = await createSession(ctx.env.DB, userId);

    return json({
      user,
      token,
    }, { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
};
