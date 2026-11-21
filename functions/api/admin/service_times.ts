import { assertChurchRole, authenticate } from '../../../server/auth';
import { type Env, errorResponse, HttpError, json, readJson } from '../../../server/db';

export const onRequest: PagesFunction<Env> = async (ctx) => {
  try {
    const { user } = await authenticate(ctx.request, ctx.env);
    const method = ctx.request.method;
    const url = new URL(ctx.request.url);

    // POST /api/admin/service_times - Add time
    if (method === 'POST') {
      const body = await readJson<{
        service_id: string;
        day_of_week?: number | null;
        specific_date?: string | null;
        start_time: string;
        end_time: string;
        label?: string | null;
        is_active?: boolean;
      }>(ctx.request);

      if (!body.service_id || !body.start_time || !body.end_time) {
        throw new HttpError(400, 'service_id, start_time, and end_time are required');
      }

      const svc = await ctx.env.DB
        .prepare('SELECT church_id FROM services WHERE id = ?')
        .bind(body.service_id)
        .first<{ church_id: string }>();

      if (!svc) throw new HttpError(404, 'Service not found');
      await assertChurchRole(ctx.env.DB, svc.church_id, user.id);

      const id = crypto.randomUUID();
      const now = new Date().toISOString();
      const isActive = body.is_active !== false ? 1 : 0;

      await ctx.env.DB
        .prepare(`
          INSERT INTO service_times (id, service_id, day_of_week, specific_date, start_time, end_time, label, is_active, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `)
        .bind(
          id,
          body.service_id,
          body.day_of_week !== undefined ? body.day_of_week : null,
          body.specific_date || null,
          body.start_time,
          body.end_time,
          body.label || null,
          isActive,
          now
        )
        .run();

      return json({
        id,
        ...body,
        is_active: Boolean(isActive),
        created_at: now,
      }, { status: 201 });
    }

    // PATCH /api/admin/service_times - Update time (e.g. toggle active)
    if (method === 'PATCH') {
      const body = await readJson<{
        id: string;
        is_active?: boolean;
        start_time?: string;
        end_time?: string;
        day_of_week?: number | null;
        specific_date?: string | null;
        label?: string | null;
      }>(ctx.request);

      if (!body.id) throw new HttpError(400, 'id is required');

      const existing = await ctx.env.DB
        .prepare(`
          SELECT st.*, s.church_id
          FROM service_times st
          JOIN services s ON s.id = st.service_id
          WHERE st.id = ?
        `)
        .bind(body.id)
        .first<{ church_id: string }>();

      if (!existing) throw new HttpError(404, 'Service time not found');
      await assertChurchRole(ctx.env.DB, existing.church_id, user.id);

      const updates: string[] = [];
      const values: unknown[] = [];

      if (body.is_active !== undefined) { updates.push('is_active = ?'); values.push(body.is_active ? 1 : 0); }
      if (body.start_time !== undefined) { updates.push('start_time = ?'); values.push(body.start_time); }
      if (body.end_time !== undefined) { updates.push('end_time = ?'); values.push(body.end_time); }
      if (body.day_of_week !== undefined) { updates.push('day_of_week = ?'); values.push(body.day_of_week); }
      if (body.specific_date !== undefined) { updates.push('specific_date = ?'); values.push(body.specific_date); }
      if (body.label !== undefined) { updates.push('label = ?'); values.push(body.label); }

      values.push(body.id);

      if (updates.length > 0) {
        await ctx.env.DB
          .prepare(`UPDATE service_times SET ${updates.join(', ')} WHERE id = ?`)
          .bind(...values)
          .run();
      }

      return json({ ok: true });
    }

    // DELETE /api/admin/service_times?id=...
    if (method === 'DELETE') {
      const id = url.searchParams.get('id');
      if (!id) throw new HttpError(400, 'id is required');

      const existing = await ctx.env.DB
        .prepare(`
          SELECT st.id, s.church_id
          FROM service_times st
          JOIN services s ON s.id = st.service_id
          WHERE st.id = ?
        `)
        .bind(id)
        .first<{ church_id: string }>();

      if (!existing) throw new HttpError(404, 'Service time not found');
      await assertChurchRole(ctx.env.DB, existing.church_id, user.id);

      await ctx.env.DB.prepare('DELETE FROM service_times WHERE id = ?').bind(id).run();
      return json({ ok: true });
    }

    throw new HttpError(405, 'Method not allowed');
  } catch (err) {
    return errorResponse(err);
  }
};
