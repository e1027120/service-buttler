import { type Env, errorResponse, HttpError, json } from '../../../server/supabase';

interface PCOItem {
  id: string;
  type: 'form' | 'signup' | 'event';
  title: string;
  description?: string;
  url: string;
}

interface PCOResource {
  id: string;
  attributes?: {
    name?: string;
    title?: string;
    description?: string;
    summary?: string;
    public_url?: string;
  };
}

interface PCOListResponse {
  data?: PCOResource[];
}

/**
 * POST /api/pco/forms
 * Proxies calls to Planning Center Online API using Basic Auth (App ID & Secret).
 * Fetches:
 * 1. People Custom Forms (/people/v2/forms)
 * 2. Registrations Signups/Events (/registrations/v2/events or /registrations/v2/signups)
 */
export const onRequestPost: PagesFunction<Env> = async (ctx) => {
  try {
    const body = (await ctx.request.json().catch(() => ({}))) as {
      app_id?: string;
      secret?: string;
      subdomain?: string;
    };

    const appId = body.app_id?.trim();
    const secret = body.secret?.trim();
    const subdomain = body.subdomain?.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\.churchcenter\.com.*$/, '');

    if (!appId || !secret) {
      throw new HttpError(400, 'Missing Planning Center App ID or Secret');
    }

    const authHeader = `Basic ${btoa(`${appId}:${secret}`)}`;
    const items: PCOItem[] = [];

    // Helper fetch with timeout
    const pcoFetch = async (url: string): Promise<PCOListResponse | null> => {
      const res = await fetch(url, {
        headers: {
          Authorization: authHeader,
          Accept: 'application/json',
          'User-Agent': 'ServiceButtler/1.0',
        },
      });
      if (!res.ok) {
        if (res.status === 401) {
          throw new HttpError(401, 'Invalid Planning Center credentials (401 Unauthorized)');
        }
        return null;
      }
      return (await res.json()) as PCOListResponse;
    };

    // 1. Fetch People Forms
    try {
      const formsData = await pcoFetch('https://api.planningcenteronline.com/people/v2/forms?filter=active&order=name&per_page=50');
      if (formsData?.data && Array.isArray(formsData.data)) {
        for (const f of formsData.data) {
          const name = f.attributes?.name || f.attributes?.title || 'Untitled Form';
          const description = f.attributes?.description || '';
          // Public Church Center URL format: https://subdomain.churchcenter.com/people/forms/{id}
          const url = subdomain
            ? `https://${subdomain}.churchcenter.com/people/forms/${f.id}`
            : f.attributes?.public_url || `https://churchcenter.com/people/forms/${f.id}`;

          items.push({
            id: `pco_form_${f.id}`,
            type: 'form',
            title: name,
            description,
            url,
          });
        }
      }
    } catch (e: unknown) {
      console.warn('Error fetching PCO people forms:', e);
      if (e instanceof HttpError && e.status === 401) throw e;
    }

    // 2. Fetch Registrations Events/Signups
    try {
      const eventsData = await pcoFetch('https://api.planningcenteronline.com/registrations/v2/events?filter=open&order=name&per_page=50');
      if (eventsData?.data && Array.isArray(eventsData.data)) {
        for (const ev of eventsData.data) {
          const name = ev.attributes?.name || ev.attributes?.title || 'Untitled Signup';
          const description = ev.attributes?.summary || ev.attributes?.description || '';
          // Public Church Center URL format: https://subdomain.churchcenter.com/registrations/events/{id}
          const url = subdomain
            ? `https://${subdomain}.churchcenter.com/registrations/events/${ev.id}`
            : ev.attributes?.public_url || `https://churchcenter.com/registrations/events/${ev.id}`;

          items.push({
            id: `pco_event_${ev.id}`,
            type: 'signup',
            title: name,
            description,
            url,
          });
        }
      }
    } catch (e: unknown) {
      console.warn('Error fetching PCO registrations:', e);
      if (e instanceof HttpError && e.status === 401) throw e;
    }

    // Sort items alphabetically by title
    items.sort((a, b) => a.title.localeCompare(b.title));

    return json({
      items,
      count: items.length,
    });
  } catch (err) {
    return errorResponse(err);
  }
};
