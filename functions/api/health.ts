import { type Env, json } from '../../server/db';

/** GET /api/health — deployment smoke check */
export const onRequestGet: PagesFunction<Env> = async ({ env }) =>
  json({
    ok: true,
    provider: 'cloudflare',
    d1Configured: Boolean(env.DB),
    r2Configured: Boolean(env.ASSETS_BUCKET),
  });
