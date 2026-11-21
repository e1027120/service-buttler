import { acceptPendingInvitations, createSession, verifyPassword } from '../../../server/auth';
import { type Env, errorResponse, HttpError, json, readJson } from '../../../server/db';

export const onRequestPost: PagesFunction<Env> = async (ctx) => {
  try {
    const body = await readJson<{ email?: string; password?: string }>(ctx.request);
    const email = body.email?.trim().toLowerCase();
    const password = body.password;

    if (!email || !password) {
      throw new HttpError(400, 'Email and password are required');
    }

    const user = await ctx.env.DB
      .prepare('SELECT id, email, password_hash, full_name, created_at FROM users WHERE email = ?')
      .bind(email)
      .first<{
        id: string;
        email: string;
        password_hash: string | null;
        full_name: string | null;
        created_at: string;
      }>();

    if (!user) {
      throw new HttpError(401, 'Invalid email or password');
    }
    if (!user.password_hash) {
      throw new HttpError(401, 'No password set on this account. Please use "Email me a magic link" to sign in.');
    }

    const valid = await verifyPassword(password, user.password_hash);
    if (!valid) {
      throw new HttpError(401, 'Invalid email or password');
    }

    // Accept any pending invitations for this email
    await acceptPendingInvitations(ctx.env.DB, {
      id: user.id,
      email: user.email,
      full_name: user.full_name,
      created_at: user.created_at,
    });

    const token = await createSession(ctx.env.DB, user.id);

    return json({
      user: {
        id: user.id,
        email: user.email,
        full_name: user.full_name,
        created_at: user.created_at,
      },
      token,
    });
  } catch (err) {
    return errorResponse(err);
  }
};
