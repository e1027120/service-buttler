import { acceptPendingInvitations, createSession, hashToken } from '../../../server/auth';
import { type Env, errorResponse, HttpError, json, readJson } from '../../../server/db';

export const onRequestPost: PagesFunction<Env> = async (ctx) => {
  try {
    const body = await readJson<{ token?: string; email?: string }>(ctx.request);
    const rawToken = body.token?.trim();
    const email = body.email?.trim().toLowerCase();

    if (!rawToken || !email) {
      throw new HttpError(400, 'Token and email are required');
    }

    const tokenHash = await hashToken(rawToken);
    const now = new Date().toISOString();

    const link = await ctx.env.DB
      .prepare('SELECT id, email FROM magic_links WHERE token_hash = ? AND email = ? AND expires_at > ?')
      .bind(tokenHash, email, now)
      .first<{ id: string; email: string }>();

    if (!link) {
      throw new HttpError(401, 'Invalid or expired sign-in link');
    }

    // Delete used magic link
    await ctx.env.DB.prepare('DELETE FROM magic_links WHERE id = ?').bind(link.id).run();

    // Find or create user
    let user = await ctx.env.DB
      .prepare('SELECT id, email, full_name, created_at FROM users WHERE email = ?')
      .bind(email)
      .first<{ id: string; email: string; full_name: string | null; created_at: string }>();

    if (!user) {
      const userId = crypto.randomUUID();
      await ctx.env.DB
        .prepare('INSERT INTO users (id, email, full_name, created_at) VALUES (?, ?, ?, ?)')
        .bind(userId, email, null, now)
        .run();
      user = { id: userId, email, full_name: null, created_at: now };
    }

    await acceptPendingInvitations(ctx.env.DB, user);
    const sessionToken = await createSession(ctx.env.DB, user.id);

    return json({
      user,
      token: sessionToken,
    });
  } catch (err) {
    return errorResponse(err);
  }
};
