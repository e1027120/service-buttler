import { type Env, errorResponse, HttpError, json, readJson } from '../../../server/db';

export const onRequestPost: PagesFunction<Env> = async (ctx) => {
  try {
    const body = await readJson<{
      church_slug?: string;
      voter_token?: string;
      device?: string;
    }>(ctx.request);

    const churchSlug = body.church_slug?.trim().toLowerCase();
    const voterToken = body.voter_token?.trim();
    const device = body.device === 'desktop' ? 'desktop' : 'mobile';

    if (!churchSlug || !voterToken) {
      throw new HttpError(400, 'church_slug and voter_token are required');
    }

    const church = await ctx.env.DB
      .prepare('SELECT id FROM churches WHERE slug = ?')
      .bind(churchSlug)
      .first<{ id: string }>();

    if (!church) {
      throw new HttpError(404, 'Church not found');
    }

    const now = new Date().toISOString();

    await ctx.env.DB
      .prepare(`
        INSERT INTO attendee_presence (church_id, voter_token, device, last_seen)
        VALUES (?, ?, ?, ?)
        ON CONFLICT (church_id, voter_token) DO UPDATE SET last_seen = excluded.last_seen, device = excluded.device
      `)
      .bind(church.id, voterToken, device, now)
      .run();

    return json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
};
