import { assertUuid, type Env, errorResponse, HttpError, json } from '../../../../server/db';

/** GET /api/polls/:id/results */
export const onRequestGet: PagesFunction<Env> = async (ctx) => {
  try {
    const actionId = assertUuid(ctx.params.id);

    const action = await ctx.env.DB
      .prepare('SELECT id, type, content, is_active FROM actions WHERE id = ?')
      .bind(actionId)
      .first<{ id: string; type: string; content: string; is_active: number }>();

    if (!action || action.type !== 'poll') {
      throw new HttpError(404, 'Poll not found');
    }

    const content = typeof action.content === 'string' ? JSON.parse(action.content || '{}') : action.content || {};

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
