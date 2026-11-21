import { assertChurchRole, authenticate } from '../../../server/auth';
import { type Env, errorResponse, HttpError, json, readJson } from '../../../server/db';

export const onRequest: PagesFunction<Env> = async (ctx) => {
  try {
    const { user } = await authenticate(ctx.request, ctx.env);
    const method = ctx.request.method;
    const url = new URL(ctx.request.url);

    // GET /api/admin/actions?church_id=...&service_id=...
    if (method === 'GET') {
      const churchId = url.searchParams.get('church_id');
      if (!churchId) throw new HttpError(400, 'church_id is required');

      await assertChurchRole(ctx.env.DB, churchId, user.id);

      const rows = await ctx.env.DB
        .prepare(`
          SELECT * FROM actions
          WHERE church_id = ?
          ORDER BY priority DESC, sort_order ASC, created_at ASC
        `)
        .bind(churchId)
        .all<Record<string, unknown>>();

      const actions = rows.results.map((a) => ({
        ...a,
        content: typeof a.content === 'string' ? JSON.parse(a.content || '{}') : a.content || {},
        is_active: Boolean(a.is_active),
      }));

      return json(actions);
    }

    // POST /api/admin/actions
    if (method === 'POST') {
      const body = await readJson<{
        church_id: string;
        service_id?: string | null;
        type: string;
        title: string;
        content?: Record<string, unknown>;
        start_offset_minutes?: number | null;
        end_offset_minutes?: number | null;
        priority?: number;
        is_active?: boolean;
        sort_order?: number;
      }>(ctx.request);

      if (!body.church_id || !body.type || !body.title) {
        throw new HttpError(400, 'church_id, type, and title are required');
      }

      await assertChurchRole(ctx.env.DB, body.church_id, user.id);

      const id = crypto.randomUUID();
      const now = new Date().toISOString();
      const contentStr = JSON.stringify(body.content || {});
      const isActive = body.is_active !== false ? 1 : 0;
      const priority = body.priority ?? 0;
      const sortOrder = body.sort_order ?? 0;

      await ctx.env.DB
        .prepare(`
          INSERT INTO actions (
            id, church_id, service_id, type, title, content,
            start_offset_minutes, end_offset_minutes, priority, is_active, sort_order, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `)
        .bind(
          id,
          body.church_id,
          body.service_id || null,
          body.type,
          body.title.trim(),
          contentStr,
          body.start_offset_minutes !== undefined ? body.start_offset_minutes : null,
          body.end_offset_minutes !== undefined ? body.end_offset_minutes : null,
          priority,
          isActive,
          sortOrder,
          now,
          now
        )
        .run();

      return json({
        id,
        ...body,
        content: body.content || {},
        is_active: Boolean(isActive),
        created_at: now,
        updated_at: now,
      }, { status: 201 });
    }

    // PATCH /api/admin/actions
    if (method === 'PATCH') {
      const body = await readJson<{
        id: string;
        service_id?: string | null;
        type?: string;
        title?: string;
        content?: Record<string, unknown>;
        start_offset_minutes?: number | null;
        end_offset_minutes?: number | null;
        priority?: number;
        is_active?: boolean;
        sort_order?: number;
      }>(ctx.request);

      if (!body.id) throw new HttpError(400, 'id is required');

      const existing = await ctx.env.DB
        .prepare('SELECT church_id FROM actions WHERE id = ?')
        .bind(body.id)
        .first<{ church_id: string }>();

      if (!existing) throw new HttpError(404, 'Action not found');
      await assertChurchRole(ctx.env.DB, existing.church_id, user.id);

      const updates: string[] = ['updated_at = ?'];
      const values: unknown[] = [new Date().toISOString()];

      if (body.service_id !== undefined) { updates.push('service_id = ?'); values.push(body.service_id); }
      if (body.type !== undefined) { updates.push('type = ?'); values.push(body.type); }
      if (body.title !== undefined) { updates.push('title = ?'); values.push(body.title.trim()); }
      if (body.content !== undefined) { updates.push('content = ?'); values.push(JSON.stringify(body.content)); }
      if (body.start_offset_minutes !== undefined) { updates.push('start_offset_minutes = ?'); values.push(body.start_offset_minutes); }
      if (body.end_offset_minutes !== undefined) { updates.push('end_offset_minutes = ?'); values.push(body.end_offset_minutes); }
      if (body.priority !== undefined) { updates.push('priority = ?'); values.push(body.priority); }
      if (body.is_active !== undefined) { updates.push('is_active = ?'); values.push(body.is_active ? 1 : 0); }
      if (body.sort_order !== undefined) { updates.push('sort_order = ?'); values.push(body.sort_order); }

      values.push(body.id);

      await ctx.env.DB
        .prepare(`UPDATE actions SET ${updates.join(', ')} WHERE id = ?`)
        .bind(...values)
        .run();

      return json({ ok: true });
    }

    // DELETE /api/admin/actions?id=...
    if (method === 'DELETE') {
      const id = url.searchParams.get('id');
      if (!id) throw new HttpError(400, 'id is required');

      const existing = await ctx.env.DB
        .prepare('SELECT church_id FROM actions WHERE id = ?')
        .bind(id)
        .first<{ church_id: string }>();

      if (!existing) throw new HttpError(404, 'Action not found');
      await assertChurchRole(ctx.env.DB, existing.church_id, user.id);

      await ctx.env.DB.prepare('DELETE FROM actions WHERE id = ?').bind(id).run();
      return json({ ok: true });
    }

    throw new HttpError(405, 'Method not allowed');
  } catch (err) {
    return errorResponse(err);
  }
};
