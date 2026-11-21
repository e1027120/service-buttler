import { type Env, errorResponse, HttpError, json } from '../../../server/db';

const SLUG_RE = /^[a-z0-9-]{1,50}$/i;

interface ServiceRow {
  id: string;
  name: string;
  slug: string;
  lead_minutes: number;
  trail_minutes: number;
  live_action_id: string | null;
  live_action_until: string | null;
  sort_order: number;
}

interface ServiceTimeRow {
  service_id: string;
  day_of_week: number | null;
  specific_date: string | null;
  start_time: string;
  end_time: string;
  label: string | null;
}

interface ActionRow {
  id: string;
  type: string;
  title: string;
  content: string;
  start_offset_minutes: number | null;
  end_offset_minutes: number | null;
  priority: number;
  sort_order: number;
  created_at: string;
}

function parseTimeToMinutes(t: string): number {
  const parts = t.split(':');
  const h = parseInt(parts[0], 10) || 0;
  const m = parseInt(parts[1], 10) || 0;
  return h * 60 + m;
}

export const onRequestGet: PagesFunction<Env> = async (ctx) => {
  try {
    const parts = ([] as string[]).concat(ctx.params.path ?? []);
    const [churchSlug, serviceSlug] = parts;
    if (!churchSlug || parts.length > 2 || !SLUG_RE.test(churchSlug) || (serviceSlug && !SLUG_RE.test(serviceSlug))) {
      throw new HttpError(400, 'Invalid church or service');
    }

    const church = await ctx.env.DB
      .prepare('SELECT * FROM churches WHERE slug = ?')
      .bind(churchSlug.toLowerCase())
      .first<{
        id: string;
        slug: string;
        name: string;
        timezone: string;
        logo_url: string | null;
        primary_color: string;
        accent_color: string;
        landing: string;
      }>();

    if (!church) {
      return json({ error: 'Church not found' }, { status: 404, edgeCacheSeconds: 15, clientCacheSeconds: 0 });
    }

    const now = new Date();
    let tzFormatter: Intl.DateTimeFormat;
    try {
      tzFormatter = new Intl.DateTimeFormat('en-US', {
        timeZone: church.timezone || 'UTC',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        weekday: 'short',
        hour: 'numeric',
        minute: 'numeric',
        second: 'numeric',
        hour12: false,
      });
    } catch {
      tzFormatter = new Intl.DateTimeFormat('en-US', {
        timeZone: 'UTC',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        weekday: 'short',
        hour: 'numeric',
        minute: 'numeric',
        second: 'numeric',
        hour12: false,
      });
    }

    const tzParts = tzFormatter.formatToParts(now);
    const getPart = (t: string) => tzParts.find((p) => p.type === t)?.value || '';

    const localYear = getPart('year');
    const localMonth = getPart('month');
    const localDay = getPart('day');
    const localDateStr = `${localYear}-${localMonth}-${localDay}`;

    const weekdayMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
    const localDayOfWeek = weekdayMap[getPart('weekday')] ?? now.getDay();

    const localH = parseInt(getPart('hour') || '0', 10);
    const localM = parseInt(getPart('minute') || '0', 10);
    const localMinutesNow = (localH === 24 ? 0 : localH) * 60 + localM;

    let servicesSql = 'SELECT * FROM services WHERE church_id = ? AND is_active = 1';
    const params: unknown[] = [church.id];
    if (serviceSlug) {
      servicesSql += ' AND slug = ?';
      params.push(serviceSlug.toLowerCase());
    }
    servicesSql += ' ORDER BY sort_order ASC';

    const services = await ctx.env.DB.prepare(servicesSql).bind(...params).all<ServiceRow>();
    const serviceTimes = await ctx.env.DB
      .prepare(`
        SELECT st.*
        FROM service_times st
        JOIN services s ON s.id = st.service_id
        WHERE s.church_id = ? AND st.is_active = 1
      `)
      .bind(church.id)
      .all<ServiceTimeRow>();

    interface LiveOccurrence {
      service: ServiceRow;
      time: ServiceTimeRow;
      startMinutes: number;
      endMinutes: number;
      startTimeStr: string;
      endTimeStr: string;
    }

    let liveOcc: LiveOccurrence | null = null;
    let nextUpcoming: { name: string; slug: string; starts_at: string; label: string | null } | null = null;
    let minUpcomingDiff = Infinity;

    for (const s of services.results) {
      const times = serviceTimes.results.filter((t) => t.service_id === s.id);
      for (const t of times) {
        const startMins = parseTimeToMinutes(t.start_time);
        const endMins = parseTimeToMinutes(t.end_time);

        const isToday =
          (t.specific_date && t.specific_date === localDateStr) ||
          (t.specific_date === null && t.day_of_week === localDayOfWeek);

        if (isToday) {
          const windowStart = startMins - s.lead_minutes;
          const windowEnd = endMins + s.trail_minutes;

          if (localMinutesNow >= windowStart && localMinutesNow < windowEnd) {
            liveOcc = {
              service: s,
              time: t,
              startMinutes: startMins,
              endMinutes: endMins,
              startTimeStr: t.start_time,
              endTimeStr: t.end_time,
            };
            break;
          }
        }

        // Upcoming occurrence calculation
        let daysUntil = 0;
        if (t.specific_date) {
          const diffDays = (new Date(t.specific_date).getTime() - new Date(localDateStr).getTime()) / 86400000;
          daysUntil = Math.round(diffDays);
        } else if (t.day_of_week !== null) {
          daysUntil = (t.day_of_week - localDayOfWeek + 7) % 7;
          if (daysUntil === 0 && startMins <= localMinutesNow) {
            daysUntil = 7;
          }
        }

        const totalDiffMinutes = daysUntil * 1440 + (startMins - localMinutesNow);
        if (totalDiffMinutes > 0 && totalDiffMinutes < minUpcomingDiff) {
          minUpcomingDiff = totalDiffMinutes;
          nextUpcoming = {
            name: s.name,
            slug: s.slug,
            starts_at: `${localDateStr}T${t.start_time}`,
            label: t.label,
          };
        }
      }
      if (liveOcc) break;
    }

    const isLive = Boolean(liveOcc);
    let visibleActions: Record<string, unknown>[] = [];
    let activeServiceObj: Record<string, unknown> | null = null;

    if (liveOcc) {
      activeServiceObj = {
        id: liveOcc.service.id,
        name: liveOcc.service.name,
        slug: liveOcc.service.slug,
        starts_at: `${localDateStr}T${liveOcc.startTimeStr}`,
        ends_at: `${localDateStr}T${liveOcc.endTimeStr}`,
      };

      const actionsRows = await ctx.env.DB
        .prepare('SELECT * FROM actions WHERE church_id = ? AND is_active = 1 AND service_id = ? ORDER BY priority DESC, sort_order ASC, created_at ASC')
        .bind(church.id, liveOcc.service.id)
        .all<ActionRow>();

      const diffFromStart = localMinutesNow - liveOcc.startMinutes;
      const pinnedId = liveOcc.service.live_action_id;

      visibleActions = actionsRows.results
        .map((a) => {
          const isPinned = Boolean(pinnedId && pinnedId === a.id);
          const startOffset = a.start_offset_minutes ?? -liveOcc!.service.lead_minutes;
          const endOffset = a.end_offset_minutes ?? (liveOcc!.endMinutes - liveOcc!.startMinutes + liveOcc!.service.trail_minutes);
          const inWindow = diffFromStart >= startOffset && diffFromStart < endOffset;

          if (isPinned || inWindow) {
            return {
              id: a.id,
              type: a.type,
              title: a.title,
              content: typeof a.content === 'string' ? JSON.parse(a.content || '{}') : a.content || {},
              pinned: isPinned,
              visible_until: `${localDateStr}T${liveOcc!.endTimeStr}`,
            };
          }
          return null;
        })
        .filter(Boolean) as Record<string, unknown>[];
    } else {
      const actionsRows = await ctx.env.DB
        .prepare('SELECT * FROM actions WHERE church_id = ? AND is_active = 1 AND service_id IS NULL ORDER BY priority DESC, sort_order ASC, created_at ASC')
        .bind(church.id)
        .all<ActionRow>();

      visibleActions = actionsRows.results.map((a) => ({
        id: a.id,
        type: a.type,
        title: a.title,
        content: typeof a.content === 'string' ? JSON.parse(a.content || '{}') : a.content || {},
        pinned: false,
        visible_until: null,
      }));
    }

    const payload = {
      church: {
        id: church.id,
        slug: church.slug,
        name: church.name,
        timezone: church.timezone,
        logo_url: church.logo_url,
        primary_color: church.primary_color,
        accent_color: church.accent_color,
        landing: typeof church.landing === 'string' ? JSON.parse(church.landing || '{}') : church.landing || {},
      },
      live: isLive,
      service: activeServiceObj,
      actions: visibleActions,
      next_service: nextUpcoming,
      server_time: now.toISOString(),
    };

    return json(payload, { edgeCacheSeconds: 5, clientCacheSeconds: 0 });
  } catch (err) {
    return errorResponse(err);
  }
};
