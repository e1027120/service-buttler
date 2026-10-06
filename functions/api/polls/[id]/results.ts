import { assertUuid, type Env, errorResponse, json, rpc, withEdgeCache } from '../../../../server/supabase';

/** GET /api/polls/:id/results — edge cached for 3s to absorb live-result polling. */
export const onRequestGet: PagesFunction<Env> = async (ctx) => {
  try {
    const id = assertUuid(ctx.params.id);
    return await withEdgeCache(ctx.request, ctx, async () =>
      json(await rpc(ctx.env, 'poll_results', { p_action: id }), { cacheSeconds: 3 }),
    );
  } catch (err) {
    return errorResponse(err);
  }
};
