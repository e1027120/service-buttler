import { assertChurchRole, authenticate } from '../../../server/auth';
import { type Env, errorResponse, HttpError, json, readJson } from '../../../server/db';

export const onRequest: PagesFunction<Env> = async (ctx) => {
  try {
    const { user } = await authenticate(ctx.request, ctx.env);
    const method = ctx.request.method;
    const url = new URL(ctx.request.url);

    // GET /api/admin/responses?church_id=...
    if (method === 'GET') {
      const churchId = url.searchParams.get('church_id');
      if (!churchId) throw new HttpError(400, 'church_id is required');

      await assertChurchRole(ctx.env.DB, churchId, user.id);

      if (url.searchParams.get('votes') === '1') {
        const rows = await ctx.env.DB
          .prepare(`
            SELECT pv.* FROM poll_votes pv
            JOIN actions a ON a.id = pv.action_id
            WHERE a.church_id = ?
            ORDER BY pv.created_at DESC
          `)
          .bind(churchId)
          .all<Record<string, unknown>>();
        return json(rows.results);
      }

      const rows = await ctx.env.DB
        .prepare(`
          SELECT ar.id, ar.action_id, ar.church_id, ar.payload, ar.is_archived, ar.created_at,
                 a.title as action_title, a.type as action_type, a.service_id
          FROM action_responses ar
          LEFT JOIN actions a ON a.id = ar.action_id
          WHERE ar.church_id = ?
          ORDER BY ar.created_at DESC
        `)
        .bind(churchId)
        .all<Record<string, unknown>>();

      const responses = rows.results.map((r) => ({
        ...r,
        payload: typeof r.payload === 'string' ? JSON.parse(r.payload || '{}') : r.payload || {},
        is_archived: Boolean(r.is_archived),
      }));

      return json(responses);
    }

    // PATCH /api/admin/responses
    if (method === 'PATCH') {
      const body = await readJson<{
        id: string;
        is_archived?: boolean;
        payload?: Record<string, unknown>;
      }>(ctx.request);

      if (!body.id) throw new HttpError(400, 'id is required');

      const existing = await ctx.env.DB
        .prepare('SELECT church_id FROM action_responses WHERE id = ?')
        .bind(body.id)
        .first<{ church_id: string }>();

      if (!existing) throw new HttpError(404, 'Response not found');
      await assertChurchRole(ctx.env.DB, existing.church_id, user.id);

      const updates: string[] = [];
      const values: unknown[] = [];

      if (body.is_archived !== undefined) {
        updates.push('is_archived = ?');
        values.push(body.is_archived ? 1 : 0);
      }
      if (body.payload !== undefined) {
        updates.push('payload = ?');
        values.push(JSON.stringify(body.payload));
      }

      values.push(body.id);

      if (updates.length > 0) {
        await ctx.env.DB
          .prepare(`UPDATE action_responses SET ${updates.join(', ')} WHERE id = ?`)
          .bind(...values)
          .run();
      }

      return json({ ok: true });
    }

    // DELETE /api/admin/responses?id=...
    if (method === 'DELETE') {
      const id = url.searchParams.get('id');
      if (!id) throw new HttpError(400, 'id is required');

      const existing = await ctx.env.DB
        .prepare('SELECT church_id FROM action_responses WHERE id = ?')
        .bind(id)
        .first<{ church_id: string }>();

      if (!existing) throw new HttpError(404, 'Response not found');
      await assertChurchRole(ctx.env.DB, existing.church_id, user.id, ['owner', 'admin']);

      await ctx.env.DB.prepare('DELETE FROM action_responses WHERE id = ?').bind(id).run();
      return json({ ok: true });
    }

    throw new HttpError(405, 'Method not allowed');
  } catch (err) {
    return errorResponse(err);
  }
};
