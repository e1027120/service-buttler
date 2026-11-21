import { authenticate } from '../../../server/auth';
import { type Env, errorResponse, json } from '../../../server/db';

export const onRequestGet: PagesFunction<Env> = async (ctx) => {
  try {
    const { user, session } = await authenticate(ctx.request, ctx.env);
    return json({ user, session });
  } catch (err) {
    return errorResponse(err);
  }
};
