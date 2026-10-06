import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const isSupabaseConfigured = Boolean(url && anonKey);

if (!isSupabaseConfigured) {
  console.error('Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY. Copy .env.example to .env and fill them in.');
}

export const supabase = createClient(url || 'http://localhost:54321', anonKey || 'missing-anon-key', {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
});

/** Throws on Supabase errors so callers can use try/catch uniformly. */
export function unwrap<T>(res: { data: T | null; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  return res.data as T;
}

export const ASSETS_BUCKET = 'church-assets';

export async function uploadChurchAsset(churchId: string, file: File): Promise<string> {
  if (file.size > 5 * 1024 * 1024) throw new Error('Image must be smaller than 5 MB');
  const ext = (file.name.split('.').pop() || 'png').toLowerCase().replace(/[^a-z0-9]/g, '');
  const path = `${churchId}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from(ASSETS_BUCKET).upload(path, file, {
    cacheControl: '31536000',
    upsert: false,
    contentType: file.type,
  });
  if (error) throw new Error(error.message);
  return supabase.storage.from(ASSETS_BUCKET).getPublicUrl(path).data.publicUrl;
}
