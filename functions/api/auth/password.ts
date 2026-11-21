import { authenticate, hashPassword, verifyPassword } from '../../../server/auth';
import { type Env, errorResponse, HttpError, json, readJson } from '../../../server/db';

export const onRequestPost: PagesFunction<Env> = async (ctx) => {
  try {
    const { user } = await authenticate(ctx.request, ctx.env);
    const body = await readJson<{ current_password?: string; new_password?: string }>(ctx.request);

    const newPassword = body.new_password || '';
    const currentPassword = body.current_password || '';

    if (newPassword.length < 6) {
      throw new HttpError(400, 'New password must be at least 6 characters long');
    }

    const row = await ctx.env.DB
      .prepare('SELECT password_hash FROM users WHERE id = ?')
      .bind(user.id)
      .first<{ password_hash: string | null }>();

    if (!row) {
      throw new HttpError(404, 'User not found');
    }

    // If the user already has a password set, require and verify the current password
    if (row.password_hash) {
      if (!currentPassword) {
        throw new HttpError(400, 'Current password is required');
      }
      const valid = await verifyPassword(currentPassword, row.password_hash);
      if (!valid) {
        throw new HttpError(401, 'Current password is incorrect');
      }
    }

    const newHash = await hashPassword(newPassword);
    await ctx.env.DB
      .prepare('UPDATE users SET password_hash = ? WHERE id = ?')
      .bind(newHash, user.id)
      .run();

    return json({ ok: true, has_password: true });
  } catch (err) {
    return errorResponse(err);
  }
};
