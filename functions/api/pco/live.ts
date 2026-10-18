import { type Env, errorResponse, HttpError, json } from '../../../server/supabase';

interface PCOLiveResponse {
  live: boolean;
  currentItem?: string;
  planTitle?: string;
  delayMinutes: number;
  serviceTypeId?: string;
  planId?: string;
  serviceTypes?: { id: string; name: string }[];
}

/**
 * POST /api/pco/live
 * Fetches real-time status and clock offset from Planning Center Services Live.
 */
export const onRequestPost: PagesFunction<Env> = async (ctx) => {
  try {
    const body = (await ctx.request.json().catch(() => ({}))) as {
      app_id?: string;
      secret?: string;
      service_type_id?: string;
      plan_id?: string;
    };

    const appId = body.app_id?.trim();
    const secret = body.secret?.trim();

    if (!appId || !secret) {
      throw new HttpError(400, 'Missing Planning Center App ID or Secret');
    }

    const authHeader = `Basic ${btoa(`${appId}:${secret}`)}`;

    const pcoFetch = async (url: string) => {
      const res = await fetch(url, {
        headers: {
          Authorization: authHeader,
          Accept: 'application/json',
          'User-Agent': 'ServiceButtler/1.0',
        },
      });
      if (!res.ok) {
        if (res.status === 401) {
          throw new HttpError(401, 'Invalid Planning Center credentials');
        }
        return null;
      }
      return res.json() as Promise<any>;
    };

    // 1. Fetch available service types
    const typesData = await pcoFetch('https://api.planningcenteronline.com/services/v2/service_types?per_page=10');
    const serviceTypes: { id: string; name: string }[] = (typesData?.data || []).map((t: any) => ({
      id: t.id,
      name: t.attributes?.name || 'Service',
    }));

    const serviceTypeId = body.service_type_id || serviceTypes[0]?.id;
    if (!serviceTypeId) {
      return json({
        live: false,
        delayMinutes: 0,
        serviceTypes: [],
      } satisfies PCOLiveResponse);
    }

    // 2. Fetch the current or next plan for this service type
    let planId = body.plan_id;
    let planTitle = 'Service Plan';

    if (!planId) {
      const plansData = await pcoFetch(
        `https://api.planningcenteronline.com/services/v2/service_types/${serviceTypeId}/plans?order=-sort_date&per_page=1`,
      );
      const plan = plansData?.data?.[0];
      if (plan) {
        planId = plan.id;
        planTitle = plan.attributes?.title || plan.attributes?.dates || 'Today’s Plan';
      }
    }

    if (!planId) {
      return json({
        live: false,
        delayMinutes: 0,
        serviceTypeId,
        serviceTypes,
      } satisfies PCOLiveResponse);
    }

    // 3. Fetch Live controller status
    const liveData = await pcoFetch(
      `https://api.planningcenteronline.com/services/v2/service_types/${serviceTypeId}/plans/${planId}/live?include=items,current_item_time`,
    );

    let currentItem = 'Service';
    let delayMinutes = 0;
    let isLive = false;

    if (liveData?.data) {
      isLive = true;
      const currentItemTimeId = liveData.data.relationships?.current_item_time?.data?.id;
      const included = liveData.included || [];

      // Find current item time
      const currentItemTime = included.find((x: any) => x.type === 'ItemTime' && x.id === currentItemTimeId);
      if (currentItemTime) {
        const liveStartAt = currentItemTime.attributes?.live_start_at;
        const length = currentItemTime.attributes?.length || 0;
        if (liveStartAt) {
          const elapsedSec = (Date.now() - new Date(liveStartAt).getTime()) / 1000;
          const diffSec = elapsedSec - length;
          if (diffSec > 60) {
            delayMinutes = Math.round(diffSec / 60);
          }
        }
      }

      // Find current item title
      const items = included.filter((x: any) => x.type === 'Item');
      if (items.length > 0) {
        currentItem = items[0].attributes?.title || 'Service Item';
      }
    }

    return json({
      live: isLive,
      currentItem,
      planTitle,
      delayMinutes,
      serviceTypeId,
      planId,
      serviceTypes,
    } satisfies PCOLiveResponse);
  } catch (e) {
    return errorResponse(e);
  }
};
