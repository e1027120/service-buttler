/**
 * Database helper for Cloudflare D1
 */

export interface D1Database {
  prepare(query: string): D1PreparedStatement;
  batch<T = unknown>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]>;
  exec(query: string): Promise<D1ExecResult>;
}

export interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  first<T = unknown>(colName?: string): Promise<T | null>;
  run(): Promise<D1Result>;
  all<T = unknown>(): Promise<D1Result<T>>;
}

export interface D1Result<T = unknown> {
  results: T[];
  success: boolean;
  meta: Record<string, unknown>;
  error?: string;
}

export interface D1ExecResult {
  count: number;
  duration: number;
}

export interface Env {
  DB: D1Database;
  ASSETS_BUCKET: R2Bucket;
  RESEND_API_KEY?: string;
  RESEND_FROM_EMAIL?: string;
  VITE_RESEND_API_KEY?: string;
  JWT_SECRET?: string;
  VITE_PUBLIC_SITE_URL?: string;
}

export interface R2Bucket {
  get(key: string): Promise<R2ObjectBody | null>;
  put(key: string, value: ReadableStream | ArrayBuffer | ArrayBufferView | string | Blob | null, options?: R2PutOptions): Promise<R2Object>;
  delete(keys: string | string[]): Promise<void>;
}

export interface R2PutOptions {
  httpMetadata?: {
    contentType?: string;
    cacheControl?: string;
  };
}

export interface R2Object {
  key: string;
  size: number;
  etag: string;
}

export interface R2ObjectBody extends R2Object {
  body: ReadableStream;
  httpMetadata?: {
    contentType?: string;
    cacheControl?: string;
  };
  writeHttpMetadata(headers: Headers): void;
}

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
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
  return json({ error: (err as Error)?.message || 'Internal error' }, { status: 500 });
}

export async function readJson<T>(request: Request, maxBytes = 64_000): Promise<T> {
  const len = Number(request.headers.get('content-length') || '0');
  if (len > maxBytes) throw new HttpError(413, 'Payload too large');
  try {
    return (await request.json()) as T;
  } catch {
    throw new HttpError(400, 'Invalid JSON');
  }
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function assertUuid(value: unknown): string {
  if (typeof value !== 'string' || !UUID_RE.test(value)) throw new HttpError(400, 'Invalid id');
  return value;
}
