import type { Env } from '../../server/supabase';
import { json } from '../../server/supabase';

/** GET /api/health — deployment smoke check */
export const onRequestGet: PagesFunction<Env> = async ({ env }) =>
  json({
    ok: true,
    supabaseConfigured: Boolean((env.SUPABASE_URL || env.VITE_SUPABASE_URL) && (env.SUPABASE_ANON_KEY || env.VITE_SUPABASE_ANON_KEY)),
  });
