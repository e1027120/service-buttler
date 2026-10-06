import { assertUuid, type Env, errorResponse, HttpError, json, readJson, rpc } from '../../../../server/supabase';

/** POST /api/forms/:id/submit  { values: { [fieldId]: string } } */
export const onRequestPost: PagesFunction<Env> = async (ctx) => {
  try {
    const id = assertUuid(ctx.params.id);
    const body = await readJson<{ values?: unknown; website?: unknown }>(ctx.request, 8_000);

    // Honeypot: bots fill hidden "website" field — pretend success
    if (typeof body.website === 'string' && body.website.length > 0) {
      return json({ ok: true });
    }
    if (!body.values || typeof body.values !== 'object' || Array.isArray(body.values)) {
      throw new HttpError(400, 'values are required');
    }

    const responseId = await rpc<string>(ctx.env, 'submit_response', {
      p_action: id,
      p_payload: body.values,
    });
    return json({ ok: true, id: responseId }, { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
};
