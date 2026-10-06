import { assertUuid, type Env, errorResponse, HttpError, json, readJson, rpc } from '../../../../server/supabase';

/** POST /api/polls/:id/vote  { optionId, voterToken } */
export const onRequestPost: PagesFunction<Env> = async (ctx) => {
  try {
    const id = assertUuid(ctx.params.id);
    const body = await readJson<{ optionId?: unknown; voterToken?: unknown }>(ctx.request, 1_000);
    if (typeof body.optionId !== 'string' || typeof body.voterToken !== 'string') {
      throw new HttpError(400, 'optionId and voterToken are required');
    }
    const results = await rpc(ctx.env, 'cast_vote', {
      p_action: id,
      p_option: body.optionId,
      p_voter: body.voterToken,
    });
    return json(results);
  } catch (err) {
    return errorResponse(err);
  }
};
