import type {
  Action,
  ActionResponse,
  Church,
  LivePage,
  MemberRole,
  PlanningCenterItem,
  PollResults,
  PollVote,
  Service,
  ServiceTime,
} from './types';

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

const TOKEN_KEY = 'sb_auth_token';

export function getAuthToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setAuthToken(token: string | null) {
  if (token) {
    localStorage.setItem(TOKEN_KEY, token);
  } else {
    localStorage.removeItem(TOKEN_KEY);
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getAuthToken();
  const headers = new Headers(init?.headers);
  if (!headers.has('Content-Type') && !(init?.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const res = await fetch(path, {
    ...init,
    headers,
  });

  const isJson = res.headers.get('content-type')?.includes('application/json');
  const body = isJson ? await res.json() : null;

  if (!res.ok) {
    throw new ApiError(res.status, body?.error || `Request failed (${res.status})`);
  }

  return body as T;
}

// ----------------------------------------------------------------------------
// Cloudflare D1 & R2 Unified Client API
// ----------------------------------------------------------------------------

export const api = {
  auth: {
    async login(email: string, password: string) {
      const res = await request<{ user: import('./types').Member; token: string }>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      setAuthToken(res.token);
      return res;
    },
    async signup(email: string, password: string, fullName?: string) {
      const res = await request<{ user: import('./types').Member; token: string }>('/api/auth/signup', {
        method: 'POST',
        body: JSON.stringify({ email, password, full_name: fullName }),
      });
      setAuthToken(res.token);
      return res;
    },
    async logout() {
      try {
        await request('/api/auth/logout', { method: 'POST' });
      } finally {
        setAuthToken(null);
      }
    },
    async me() {
      return request<{
        user: { id: string; email: string; full_name: string | null; created_at: string; has_password?: boolean };
        session: { id: string };
      }>('/api/auth/me');
    },
    async updatePassword(data: { current_password?: string; new_password: string }) {
      return request<{ ok: boolean; has_password: boolean }>('/api/auth/password', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },
    async sendMagicLink(email: string) {
      return request<{ ok: boolean }>('/api/auth/magic', {
        method: 'POST',
        body: JSON.stringify({ email }),
      });
    },
    async verifyMagicLink(token: string, email: string) {
      const res = await request<{ user: import('./types').Member; token: string }>('/api/auth/verify', {
        method: 'POST',
        body: JSON.stringify({ token, email }),
      });
      setAuthToken(res.token);
      return res;
    },
  },

  churches: {
    list() {
      return request<(Church & { role: MemberRole })[]>('/api/admin/churches');
    },
    create(data: Partial<Church>) {
      return request<Church>('/api/admin/churches', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },
    update(data: { id: string } & Partial<Church>) {
      return request<{ ok: boolean }>('/api/admin/churches', {
        method: 'PATCH',
        body: JSON.stringify(data),
      });
    },
  },

  services: {
    list(churchId: string) {
      return request<Service[]>(`/api/admin/services?church_id=${encodeURIComponent(churchId)}`);
    },
    create(data: Partial<Service> & { church_id: string }) {
      return request<Service>('/api/admin/services', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },
    update(data: { id: string } & Partial<Service>) {
      return request<{ ok: boolean }>('/api/admin/services', {
        method: 'PATCH',
        body: JSON.stringify(data),
      });
    },
    delete(id: string) {
      return request<{ ok: boolean }>(`/api/admin/services?id=${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });
    },
  },

  serviceTimes: {
    create(data: Partial<ServiceTime> & { service_id: string; start_time: string; end_time: string }) {
      return request<ServiceTime>('/api/admin/service_times', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },
    update(data: { id: string } & Partial<ServiceTime>) {
      return request<{ ok: boolean }>('/api/admin/service_times', {
        method: 'PATCH',
        body: JSON.stringify(data),
      });
    },
    delete(id: string) {
      return request<{ ok: boolean }>(`/api/admin/service_times?id=${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });
    },
  },

  actions: {
    list(churchId: string) {
      return request<Action[]>(`/api/admin/actions?church_id=${encodeURIComponent(churchId)}`);
    },
    create(data: Partial<Action> & { church_id: string; type: string; title: string }) {
      return request<Action>('/api/admin/actions', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },
    update(data: { id: string } & Partial<Action>) {
      return request<{ ok: boolean }>('/api/admin/actions', {
        method: 'PATCH',
        body: JSON.stringify(data),
      });
    },
    delete(id: string) {
      return request<{ ok: boolean }>(`/api/admin/actions?id=${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });
    },
  },

  responses: {
    list(churchId: string) {
      return request<(ActionResponse & { action_title?: string; action_type?: string; service_id?: string | null })[]>(
        `/api/admin/responses?church_id=${encodeURIComponent(churchId)}`
      );
    },
    listVotes(churchId: string) {
      return request<PollVote[]>(
        `/api/admin/responses?church_id=${encodeURIComponent(churchId)}&votes=1`
      );
    },
    update(data: { id: string; is_archived?: boolean; payload?: Record<string, unknown> }) {
      return request<{ ok: boolean }>('/api/admin/responses', {
        method: 'PATCH',
        body: JSON.stringify(data),
      });
    },
    delete(id: string) {
      return request<{ ok: boolean }>(`/api/admin/responses?id=${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });
    },
  },

  team: {
    list(churchId: string) {
      return request<{
        members: {
          church_id: string;
          user_id: string;
          role: MemberRole;
          created_at: string;
          email: string;
          full_name: string | null;
        }[];
        invitations: import('./types').Invitation[];
      }>(`/api/admin/team?church_id=${encodeURIComponent(churchId)}`);
    },
    invite(data: { church_id: string; church_name?: string; email: string; role?: MemberRole; inviter_name?: string }) {
      return request<{ status: string }>('/api/admin/team', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },
    updateRole(churchId: string, userId: string, role: MemberRole) {
      return request<{ ok: boolean }>('/api/admin/team', {
        method: 'PATCH',
        body: JSON.stringify({ church_id: churchId, user_id: userId, role }),
      });
    },
    removeMember(churchId: string, userId: string) {
      return request<{ ok: boolean }>(
        `/api/admin/team?church_id=${encodeURIComponent(churchId)}&user_id=${encodeURIComponent(userId)}`,
        { method: 'DELETE' }
      );
    },
    cancelInvitation(churchId: string, invitationId: string) {
      return request<{ ok: boolean }>(
        `/api/admin/team?church_id=${encodeURIComponent(churchId)}&invitation_id=${encodeURIComponent(invitationId)}`,
        { method: 'DELETE' }
      );
    },
  },

  presence: {
    getStats(churchId: string) {
      return request<{
        onlineCount: number;
        scanStats: { totalScans: number; byService: Record<string, number> };
      }>(`/api/admin/presence?church_id=${encodeURIComponent(churchId)}`);
    },
    sendHeartbeat(churchSlug: string, voterToken: string, device?: string) {
      return request<{ ok: boolean }>('/api/live/heartbeat', {
        method: 'POST',
        body: JSON.stringify({
          church_slug: churchSlug,
          voter_token: voterToken,
          device: device || (/iPhone|iPad|iPod|Android/i.test(navigator.userAgent) ? 'mobile' : 'desktop'),
        }),
      }).catch(() => ({ ok: false }));
    },
  },

  assets: {
    async upload(churchId: string, file: File): Promise<string> {
      if (file.size > 5 * 1024 * 1024) throw new Error('Image must be smaller than 5 MB');
      const formData = new FormData();
      formData.append('church_id', churchId);
      formData.append('file', file);

      const res = await request<{ url: string }>('/api/assets/upload', {
        method: 'POST',
        body: formData,
      });
      return res.url;
    },
  },
};

// ----------------------------------------------------------------------------
// Public Attendee API
// ----------------------------------------------------------------------------

export async function fetchLivePage(
  church: string,
  service?: string,
  _previewAt?: string,
  bypassCache = false
): Promise<LivePage | null> {
  const basePath = `/api/live/${encodeURIComponent(church)}${service ? `/${encodeURIComponent(service)}` : ''}`;
  const path = bypassCache ? `${basePath}?_t=${Date.now()}` : basePath;
  try {
    return await request<LivePage>(path, bypassCache ? { cache: 'no-cache' } : undefined);
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) return null;
    throw e;
  }
}

export function castVote(actionId: string, optionId: string, voterToken: string) {
  return request<PollResults>(`/api/polls/${actionId}/vote`, {
    method: 'POST',
    body: JSON.stringify({ optionId, voterToken }),
  });
}

export function fetchPollResults(actionId: string) {
  return request<PollResults>(`/api/polls/${actionId}/results`);
}

export function submitForm(actionId: string, values: Record<string, string>, honeypot = '') {
  return request<{ ok: boolean; id?: string }>(`/api/forms/${actionId}/submit`, {
    method: 'POST',
    body: JSON.stringify({ values, website: honeypot }),
  });
}

export function uploadChurchAsset(churchId: string, file: File): Promise<string> {
  return api.assets.upload(churchId, file);
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
  return res.json() as Promise<{ items: PlanningCenterItem[]; count: number }>;
}

export async function fetchPlanningCenterLive(config: {
  app_id?: string;
  secret?: string;
  service_type_id?: string;
  plan_id?: string;
}) {
  const res = await fetch('/api/pco/live', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(config),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Failed to check Planning Center Live');
  }
  return res.json() as Promise<{
    live: boolean;
    currentItem?: string;
    planTitle?: string;
    delayMinutes: number;
    serviceTypeId?: string;
    planId?: string;
    serviceTypes?: { id: string; name: string }[];
  }>;
}

export async function logScan(churchSlug: string, serviceSlug?: string | null, source: string = 'qr'): Promise<void> {
  try {
    await request('/api/scan/log', {
      method: 'POST',
      body: JSON.stringify({
        church_slug: churchSlug,
        service_slug: serviceSlug || null,
        source,
      }),
    });
  } catch {
    /* ignore */
  }
}
