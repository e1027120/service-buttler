import { assertChurchRole, authenticate } from '../../../server/auth';
import { type Env, errorResponse, HttpError, json } from '../../../server/db';

export const onRequestGet: PagesFunction<Env> = async (ctx) => {
  try {
    const { user } = await authenticate(ctx.request, ctx.env);
    const url = new URL(ctx.request.url);
    const churchId = url.searchParams.get('church_id');

    if (!churchId) throw new HttpError(400, 'church_id is required');
    await assertChurchRole(ctx.env.DB, churchId, user.id);

    // 1. Online count (active in last 2 minutes)
    const presenceRow = await ctx.env.DB
      .prepare(`
        SELECT COUNT(DISTINCT voter_token) as online_count
        FROM attendee_presence
        WHERE church_id = ? AND last_seen >= datetime('now', '-2 minutes')
      `)
      .bind(churchId)
      .first<{ online_count: number }>();

    // 2. Scan statistics
    const scansTotal = await ctx.env.DB
      .prepare('SELECT COUNT(*) as total FROM service_scans WHERE church_id = ?')
      .bind(churchId)
      .first<{ total: number }>();

    const scansByService = await ctx.env.DB
      .prepare(`
        SELECT service_id, COUNT(*) as count
        FROM service_scans
        WHERE church_id = ? AND service_id IS NOT NULL
        GROUP BY service_id
      `)
      .bind(churchId)
      .all<{ service_id: string; count: number }>();

    const byServiceMap: Record<string, number> = {};
    for (const row of scansByService.results) {
      byServiceMap[row.service_id] = row.count;
    }

    return json({
      onlineCount: presenceRow?.online_count || 0,
      scanStats: {
        totalScans: scansTotal?.total || 0,
        byService: byServiceMap,
      },
    });
  } catch (err) {
    return errorResponse(err);
  }
};
