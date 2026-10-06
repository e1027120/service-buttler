import { createClient } from '@supabase/supabase-js';

let url = (import.meta.env.VITE_SUPABASE_URL as string | undefined) || '';
let anonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) || '';

export let isSupabaseConfigured = Boolean(url && anonKey);

export let supabase = createClient(url || 'http://localhost:54321', anonKey || 'missing-anon-key', {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
});

// If Vite build-time env vars are missing, fetch them at runtime from the Cloudflare edge worker (/api/config)
export async function initRuntimeConfig(): Promise<boolean> {
  if (isSupabaseConfigured) return true;
  try {
    const res = await fetch('/api/config');
    if (!res.ok) return false;
    const data = await res.json();
    if (data.supabaseUrl && data.supabaseAnonKey) {
      url = data.supabaseUrl;
      anonKey = data.supabaseAnonKey;
      isSupabaseConfigured = true;
      supabase = createClient(url, anonKey, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
      });
      return true;
    }
  } catch (e) {
    console.warn('Failed to fetch runtime config from /api/config', e);
  }
  return false;
}

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
