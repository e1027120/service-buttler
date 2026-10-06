import { type Env, json } from '../../server/supabase';

/**
 * GET /api/config
 * Returns public client-safe configuration (Supabase URL and anon key).
 * This allows the client to hydrate credentials from Cloudflare Pages runtime secrets
 * even if they were not baked in at build time!
 */
export const onRequestGet: PagesFunction<Env> = async (ctx) => {
  const supabaseUrl = ctx.env.SUPABASE_URL || ctx.env.VITE_SUPABASE_URL || '';
  const supabaseAnonKey = ctx.env.SUPABASE_ANON_KEY || ctx.env.VITE_SUPABASE_ANON_KEY || '';

  return json(
    {
      supabaseUrl,
      supabaseAnonKey,
    },
    {
      headers: {
        'Cache-Control': 'public, max-age=300',
      },
    }
  );
};
