import { assertUuid, type Env, errorResponse, HttpError, json, readJson } from '../../../../server/db';

/** POST /api/polls/:id/vote  { optionId, voterToken } */
export const onRequestPost: PagesFunction<Env> = async (ctx) => {
  try {
    const actionId = assertUuid(ctx.params.id);
    const body = await readJson<{ optionId?: unknown; voterToken?: unknown }>(ctx.request, 2_000);
    const optionId = typeof body.optionId === 'string' ? body.optionId.trim() : null;
    const voterToken = typeof body.voterToken === 'string' ? body.voterToken.trim() : null;

    if (!optionId || !voterToken) {
      throw new HttpError(400, 'optionId and voterToken are required');
    }

    const action = await ctx.env.DB
      .prepare('SELECT id, type, content, is_active FROM actions WHERE id = ?')
      .bind(actionId)
      .first<{ id: string; type: string; content: string; is_active: number }>();

    if (!action || action.type !== 'poll' || !action.is_active) {
      throw new HttpError(404, 'Poll not found');
    }

    const content = typeof action.content === 'string' ? JSON.parse(action.content || '{}') : action.content || {};
    if (content.closed) {
      throw new HttpError(400, 'This poll is closed');
    }

    const options = content.options || [];
    const isValidOption = options.some((o: { id: string }) => o.id === optionId);
    if (!isValidOption) {
      throw new HttpError(400, 'Invalid option');
    }

    const now = new Date().toISOString();

    // Upsert vote (allow_change defaults to true unless explicitly false)
    if (content.allow_change !== false) {
      await ctx.env.DB
        .prepare(`
          INSERT INTO poll_votes (action_id, voter_token, option_id, created_at)
          VALUES (?, ?, ?, ?)
          ON CONFLICT (action_id, voter_token) DO UPDATE SET option_id = excluded.option_id, created_at = excluded.created_at
        `)
        .bind(actionId, voterToken, optionId, now)
        .run();
    } else {
      await ctx.env.DB
        .prepare(`
          INSERT INTO poll_votes (action_id, voter_token, option_id, created_at)
          VALUES (?, ?, ?, ?)
          ON CONFLICT (action_id, voter_token) DO NOTHING
        `)
        .bind(actionId, voterToken, optionId, now)
        .run();
    }

    // Return updated results
    const countsRows = await ctx.env.DB
      .prepare('SELECT option_id, COUNT(*) as count FROM poll_votes WHERE action_id = ? GROUP BY option_id')
      .bind(actionId)
      .all<{ option_id: string; count: number }>();

    let total = 0;
    const counts: Record<string, number> = {};
    for (const row of countsRows.results) {
      counts[row.option_id] = row.count;
      total += row.count;
    }

    return json({
      hidden: content.show_results === false,
      total,
      counts,
    });
  } catch (err) {
    return errorResponse(err);
  }
};
