import { assertChurchRole, authenticate } from '../../../server/auth';
import { type Env, errorResponse, HttpError, json, readJson } from '../../../server/db';

export const onRequest: PagesFunction<Env> = async (ctx) => {
  try {
    const { user } = await authenticate(ctx.request, ctx.env);
    const method = ctx.request.method;
    const url = new URL(ctx.request.url);

    // GET /api/admin/services?church_id=...
    if (method === 'GET') {
      const churchId = url.searchParams.get('church_id');
      if (!churchId) throw new HttpError(400, 'church_id is required');

      await assertChurchRole(ctx.env.DB, churchId, user.id);

      const servicesRows = await ctx.env.DB
        .prepare('SELECT * FROM services WHERE church_id = ? ORDER BY sort_order, name ASC')
        .bind(churchId)
        .all<Record<string, unknown>>();

      const timesRows = await ctx.env.DB
        .prepare(`
          SELECT st.*
          FROM service_times st
          JOIN services s ON s.id = st.service_id
          WHERE s.church_id = ?
          ORDER BY st.start_time ASC
        `)
        .bind(churchId)
        .all<Record<string, unknown>>();

      const timesByService: Record<string, Record<string, unknown>[]> = {};
      for (const t of timesRows.results) {
        const sId = t.service_id as string;
        if (!timesByService[sId]) timesByService[sId] = [];
        timesByService[sId].push({
          ...t,
          is_active: Boolean(t.is_active),
        });
      }

      const services = servicesRows.results.map((s) => ({
        ...s,
        is_active: Boolean(s.is_active),
        service_times: timesByService[s.id as string] || [],
      }));

      return json(services);
    }

    // POST /api/admin/services
    if (method === 'POST') {
      const body = await readJson<{
        church_id: string;
        name: string;
        slug: string;
        description?: string;
        lead_minutes?: number;
        trail_minutes?: number;
        is_active?: boolean;
        sort_order?: number;
      }>(ctx.request);

      if (!body.church_id || !body.name || !body.slug) {
        throw new HttpError(400, 'church_id, name, and slug are required');
      }

      await assertChurchRole(ctx.env.DB, body.church_id, user.id);

      const id = crypto.randomUUID();
      const now = new Date().toISOString();
      const isActive = body.is_active !== false ? 1 : 0;
      const lead = body.lead_minutes ?? 15;
      const trail = body.trail_minutes ?? 30;
      const sort = body.sort_order ?? 0;

      await ctx.env.DB
        .prepare(`
          INSERT INTO services (id, church_id, name, slug, description, lead_minutes, trail_minutes, is_active, sort_order, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `)
        .bind(id, body.church_id, body.name.trim(), body.slug.trim().toLowerCase(), body.description || null, lead, trail, isActive, sort, now, now)
        .run();

      return json({ id, ...body, is_active: Boolean(isActive), service_times: [] }, { status: 201 });
    }

    // PATCH /api/admin/services
    if (method === 'PATCH') {
      const body = await readJson<{
        id: string;
        name?: string;
        slug?: string;
        description?: string | null;
        lead_minutes?: number;
        trail_minutes?: number;
        live_action_id?: string | null;
        live_action_until?: string | null;
        is_active?: boolean;
        sort_order?: number;
      }>(ctx.request);

      if (!body.id) throw new HttpError(400, 'id is required');

      const existing = await ctx.env.DB
        .prepare('SELECT * FROM services WHERE id = ?')
        .bind(body.id)
        .first<{ church_id: string }>();

      if (!existing) throw new HttpError(404, 'Service not found');
      await assertChurchRole(ctx.env.DB, existing.church_id, user.id);

      const updates: string[] = ['updated_at = ?'];
      const values: unknown[] = [new Date().toISOString()];

      if (body.name !== undefined) { updates.push('name = ?'); values.push(body.name.trim()); }
      if (body.slug !== undefined) { updates.push('slug = ?'); values.push(body.slug.trim().toLowerCase()); }
      if (body.description !== undefined) { updates.push('description = ?'); values.push(body.description); }
      if (body.lead_minutes !== undefined) { updates.push('lead_minutes = ?'); values.push(body.lead_minutes); }
      if (body.trail_minutes !== undefined) { updates.push('trail_minutes = ?'); values.push(body.trail_minutes); }
      if (body.live_action_id !== undefined) { updates.push('live_action_id = ?'); values.push(body.live_action_id); }
      if (body.live_action_until !== undefined) { updates.push('live_action_until = ?'); values.push(body.live_action_until); }
      if (body.is_active !== undefined) { updates.push('is_active = ?'); values.push(body.is_active ? 1 : 0); }
      if (body.sort_order !== undefined) { updates.push('sort_order = ?'); values.push(body.sort_order); }

      values.push(body.id);

      await ctx.env.DB
        .prepare(`UPDATE services SET ${updates.join(', ')} WHERE id = ?`)
        .bind(...values)
        .run();

      return json({ ok: true });
    }

    // DELETE /api/admin/services?id=...
    if (method === 'DELETE') {
      const id = url.searchParams.get('id');
      if (!id) throw new HttpError(400, 'id is required');

      const existing = await ctx.env.DB
        .prepare('SELECT church_id FROM services WHERE id = ?')
        .bind(id)
        .first<{ church_id: string }>();

      if (!existing) throw new HttpError(404, 'Service not found');
      await assertChurchRole(ctx.env.DB, existing.church_id, user.id);

      await ctx.env.DB.prepare('DELETE FROM services WHERE id = ?').bind(id).run();
      return json({ ok: true });
    }

    throw new HttpError(405, 'Method not allowed');
  } catch (err) {
    return errorResponse(err);
  }
};
