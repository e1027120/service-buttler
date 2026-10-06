import { type Env, errorResponse, HttpError, json, rpc, withEdgeCache } from '../../../server/supabase';

const SLUG_RE = /^[a-z0-9-]{1,50}$/i;

/**
 * GET /api/live/:church
 * GET /api/live/:church/:service
 *
 * Hot path: every attendee scanning the QR code hits this at the same moment.
 * Responses are cached at the edge for 15 seconds, so Supabase sees at most
 * ~4 requests/min per church per Cloudflare location regardless of crowd size.
 */
export const onRequestGet: PagesFunction<Env> = async (ctx) => {
  try {
    const parts = ([] as string[]).concat(ctx.params.path ?? []);
    const [church, service] = parts;
    if (!church || parts.length > 2 || !SLUG_RE.test(church) || (service && !SLUG_RE.test(service))) {
      throw new HttpError(400, 'Invalid church or service');
    }

    return await withEdgeCache(ctx.request, ctx, async () => {
      const page = await rpc<unknown>(ctx.env, 'get_live_page', {
        p_church_slug: church,
        p_service_slug: service ?? null,
      });
      if (!page) return json({ error: 'Church not found' }, { status: 404, cacheSeconds: 60 });
      return json(page, { cacheSeconds: 15 });
    });
  } catch (err) {
    return errorResponse(err);
  }
};
