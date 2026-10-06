import { supabase } from './supabase';
import type { LivePage, PollResults } from './types';

/**
 * Public API used by the attendee landing page.
 * - In local dev: calls Supabase RPC directly for fast, zero-configuration development.
 * - In production (Cloudflare Pages): calls the edge-cached Cloudflare Worker (/api/*)
 *   with an automatic direct RPC fallback.
 */

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) },
  });
  const isJson = res.headers.get('content-type')?.includes('application/json');
  if (!isJson) throw new WorkerUnavailable();
  const body = await res.json();
  if (!res.ok) throw new ApiError(res.status, body?.error || 'Request failed');
  return body as T;
}

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}
class WorkerUnavailable extends Error {}

async function withFallback<T>(primary: () => Promise<T>, fallback: () => Promise<T>): Promise<T> {
  // In Vite dev, use Supabase RPC directly to avoid ECONNREFUSED when Wrangler isn't running
  if (import.meta.env.DEV) {
    return fallback();
  }
  try {
    return await primary();
  } catch (e) {
    if (e instanceof WorkerUnavailable || e instanceof TypeError) return fallback();
    throw e;
  }
}

async function rpc<T>(fn: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.rpc(fn, args);
  if (error) throw new ApiError(400, error.message);
  return data as T;
}

export async function fetchLivePage(church: string, service?: string, previewAt?: string): Promise<LivePage | null> {
  // Previews (time travel) require an authenticated church member -> direct RPC with session
  if (previewAt) {
    return rpc<LivePage | null>('get_live_page', {
      p_church_slug: church,
      p_service_slug: service ?? null,
      p_at: previewAt,
    });
  }
  const path = `/api/live/${encodeURIComponent(church)}${service ? `/${encodeURIComponent(service)}` : ''}`;
  return withFallback(
    async () => {
      try {
        return await request<LivePage>(path);
      } catch (e) {
        if (e instanceof ApiError && e.status === 404) return null;
        throw e;
      }
    },
    () => rpc<LivePage | null>('get_live_page', { p_church_slug: church, p_service_slug: service ?? null }),
  );
}

export function castVote(actionId: string, optionId: string, voterToken: string) {
  return withFallback(
    () => request<PollResults>(`/api/polls/${actionId}/vote`, {
      method: 'POST',
      body: JSON.stringify({ optionId, voterToken }),
    }),
    () => rpc<PollResults>('cast_vote', { p_action: actionId, p_option: optionId, p_voter: voterToken }),
  );
}

export function fetchPollResults(actionId: string) {
  return withFallback(
    () => request<PollResults>(`/api/polls/${actionId}/results`),
    () => rpc<PollResults>('poll_results', { p_action: actionId }),
  );
}

export function submitForm(actionId: string, values: Record<string, string>, honeypot = '') {
  return withFallback(
    () => request<{ ok: boolean }>(`/api/forms/${actionId}/submit`, {
      method: 'POST',
      body: JSON.stringify({ values, website: honeypot }),
    }),
    async () => {
      if (honeypot) return { ok: true };
      await rpc('submit_response', { p_action: actionId, p_payload: values });
      return { ok: true };
    },
  );
}

/** Stable anonymous id per device — one vote per poll per device. */
export function getVoterToken(): string {
  const KEY = 'sb_voter_token';
  let token = localStorage.getItem(KEY);
  if (!token) {
    token = crypto.randomUUID();
    localStorage.setItem(KEY, token);
  }
  return token;
}

export async function fetchPlanningCenterForms(config: { app_id?: string; secret?: string; subdomain?: string }) {
  const res = await fetch('/api/pco/forms', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(config),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Failed to load Planning Center forms');
  }
  return res.json() as Promise<{ items: import('./types').PlanningCenterItem[]; count: number }>;
}
