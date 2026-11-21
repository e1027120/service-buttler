import { hashToken } from '../../../server/auth';
import { type Env, errorResponse, json } from '../../../server/db';

export const onRequestPost: PagesFunction<Env> = async (ctx) => {
  try {
    const authHeader = ctx.request.headers.get('Authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.slice(7).trim();
      const tokenHash = await hashToken(token);
      await ctx.env.DB.prepare('DELETE FROM sessions WHERE token_hash = ?').bind(tokenHash).run();
    }
    return json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
};
