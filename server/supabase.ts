/**
 * Minimal Supabase PostgREST client for Cloudflare Workers.
 * Uses fetch directly (no SDK) to keep the Worker bundle tiny and cold starts fast.
 */

export interface Env {
  SUPABASE_URL?: string;
  SUPABASE_ANON_KEY?: string;
  // Fallbacks so a single local .env (shared with Vite) is enough
  VITE_SUPABASE_URL?: string;
  VITE_SUPABASE_ANON_KEY?: string;
}

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

function config(env: Env) {
  const url = env.SUPABASE_URL || env.VITE_SUPABASE_URL;
  const key = env.SUPABASE_ANON_KEY || env.VITE_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new HttpError(500, 'Supabase is not configured (SUPABASE_URL / SUPABASE_ANON_KEY).');
  }
  return { url: url.replace(/\/$/, ''), key };
}

export async function rpc<T>(env: Env, fn: string, args: Record<string, unknown>): Promise<T> {
  const { url, key } = config(env);
  const res = await fetch(`${url}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(args),
  });

  const text = await res.text();
  const body = text ? JSON.parse(text) : null;

  if (!res.ok) {
    const message: string = body?.message || `Upstream error (${res.status})`;
    // P0002 = not found, 22023 = invalid parameter (raised by our RPCs)
    const status = body?.code === 'P0002' ? 404 : res.status >= 500 ? 502 : 400;
    throw new HttpError(status, message);
  }
  return body as T;
}

export function json(
  data: unknown,
  init: ResponseInit & {
    cacheSeconds?: number;
    clientCacheSeconds?: number;
    edgeCacheSeconds?: number;
  } = {}
): Response {
  const { cacheSeconds, clientCacheSeconds, edgeCacheSeconds, ...rest } = init;
  const headers = new Headers(rest.headers);
  headers.set('Content-Type', 'application/json; charset=utf-8');

  const edgeMax = edgeCacheSeconds ?? cacheSeconds;
  const clientMax = clientCacheSeconds ?? (edgeMax ? 0 : undefined);

  if (edgeMax !== undefined) {
    headers.set(
      'Cache-Control',
      `public, max-age=${clientMax ?? 0}, s-maxage=${edgeMax}, stale-while-revalidate=5, must-revalidate`
    );
  } else {
    headers.set('Cache-Control', 'no-store, no-cache, must-revalidate');
  }
  return new Response(JSON.stringify(data), { ...rest, headers });
}

export function errorResponse(err: unknown): Response {
  if (err instanceof HttpError) {
    return json({ error: err.message }, { status: err.status });
  }
  console.error(err);
  return json({ error: 'Internal error' }, { status: 500 });
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function assertUuid(value: unknown): string {
  if (typeof value !== 'string' || !UUID_RE.test(value)) throw new HttpError(400, 'Invalid id');
  return value;
}

export async function readJson<T>(request: Request, maxBytes = 10_000): Promise<T> {
  const len = Number(request.headers.get('content-length') || 0);
  if (len > maxBytes) throw new HttpError(413, 'Payload too large');
  const text = await request.text();
  if (text.length > maxBytes) throw new HttpError(413, 'Payload too large');
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new HttpError(400, 'Invalid JSON');
  }
}

/** Edge cache wrapper using the Workers Cache API. */
export async function withEdgeCache(
  request: Request,
  ctx: { waitUntil(p: Promise<unknown>): void },
  produce: () => Promise<Response>,
): Promise<Response> {
  const cache = (caches as unknown as { default: Cache }).default;
  const url = new URL(request.url);
  url.pathname = url.pathname.toLowerCase();
  const key = new Request(url.toString(), { method: 'GET' });

  const hit = await cache.match(key);
  if (hit) return hit;

  const res = await produce();
  if (res.ok) ctx.waitUntil(cache.put(key, res.clone()));
  return res;
}
