import { assertUuid, type Env, errorResponse, HttpError, json, readJson } from '../../../../server/db';

/** POST /api/forms/:id/submit  { values: { [fieldId]: string }, website?: string } */
export const onRequestPost: PagesFunction<Env> = async (ctx) => {
  try {
    const actionId = assertUuid(ctx.params.id);
    const body = await readJson<{ values?: Record<string, string>; website?: string }>(ctx.request, 16_000);

    // Honeypot: bots fill hidden "website" field — pretend success
    if (typeof body.website === 'string' && body.website.length > 0) {
      return json({ ok: true });
    }
    if (!body.values || typeof body.values !== 'object' || Array.isArray(body.values)) {
      throw new HttpError(400, 'values are required');
    }

    const action = await ctx.env.DB
      .prepare('SELECT id, church_id, type, content, is_active FROM actions WHERE id = ?')
      .bind(actionId)
      .first<{
        id: string;
        church_id: string;
        type: string;
        content: string;
        is_active: number;
      }>();

    if (!action || !action.is_active) {
      throw new HttpError(404, 'Form or Question not found');
    }

    const responseId = crypto.randomUUID();
    const now = new Date().toISOString();
    const payloadStr = JSON.stringify(body.values);

    await ctx.env.DB
      .prepare(`
        INSERT INTO action_responses (id, action_id, church_id, payload, is_archived, created_at)
        VALUES (?, ?, ?, ?, 0, ?)
      `)
      .bind(responseId, actionId, action.church_id, payloadStr, now)
      .run();

    return json({ ok: true, id: responseId }, { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
};
