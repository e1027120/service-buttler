import { type Env, errorResponse, json, readJson } from '../../../server/db';

/** POST /api/scan/log  { church_slug, service_slug, source } */
export const onRequestPost: PagesFunction<Env> = async (ctx) => {
  try {
    const body = await readJson<{
      church_slug?: string;
      service_slug?: string | null;
      source?: string;
    }>(ctx.request);

    const churchSlug = body.church_slug?.trim().toLowerCase();
    const serviceSlug = body.service_slug?.trim().toLowerCase() || null;
    const source = body.source || 'qr';

    if (!churchSlug) return json({ ok: false });

    const church = await ctx.env.DB
      .prepare('SELECT id FROM churches WHERE slug = ?')
      .bind(churchSlug)
      .first<{ id: string }>();

    if (!church) return json({ ok: false });

    let serviceId: string | null = null;
    if (serviceSlug) {
      const svc = await ctx.env.DB
        .prepare('SELECT id FROM services WHERE church_id = ? AND slug = ?')
        .bind(church.id, serviceSlug)
        .first<{ id: string }>();
      serviceId = svc?.id || null;
    }

    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    await ctx.env.DB
      .prepare('INSERT INTO service_scans (id, church_id, service_id, source, scanned_at) VALUES (?, ?, ?, ?, ?)')
      .bind(id, church.id, serviceId, source, now)
      .run();

    return json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
};
