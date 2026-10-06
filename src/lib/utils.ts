import type { CSSProperties } from 'react';
import type { ServiceTime } from './types';
import { DAYS } from './types';

export function hexToRgbTriplet(hex: string, fallback = '79 70 229'): string {
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex || '');
  if (!m) return fallback;
  return `${parseInt(m[1], 16)} ${parseInt(m[2], 16)} ${parseInt(m[3], 16)}`;
}

/** Inline style that sets the Tailwind `brand` / `accent` colors for a subtree. */
export function brandStyle(primary: string, accent: string): CSSProperties {
  return {
    ['--brand-rgb' as string]: hexToRgbTriplet(primary),
    ['--accent-rgb' as string]: hexToRgbTriplet(accent, '245 158 11'),
  };
}

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50);
}

export function shortId(): string {
  return Math.random().toString(36).slice(2, 10);
}

export function hhmm(time: string): string {
  return time.slice(0, 5);
}

export function describeServiceTime(t: ServiceTime): string {
  const when = t.specific_date
    ? new Date(`${t.specific_date}T00:00:00`).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
    : `Every ${DAYS[t.day_of_week ?? 0]}`;
  return `${when} · ${hhmm(t.start_time)}–${hhmm(t.end_time)}`;
}

export function formatInZone(iso: string, timeZone: string, opts: Intl.DateTimeFormatOptions): string {
  try {
    return new Intl.DateTimeFormat(undefined, { timeZone, ...opts }).format(new Date(iso));
  } catch {
    return new Date(iso).toLocaleString();
  }
}

export function describeOffsets(start: number | null, end: number | null): string {
  const fmt = (m: number) => {
    if (m === 0) return 'start';
    const sign = m < 0 ? '−' : '+';
    const abs = Math.abs(m);
    return `${sign}${abs >= 60 ? `${Math.floor(abs / 60)}h${abs % 60 ? ` ${abs % 60}m` : ''}` : `${abs}m`}`;
  };
  if (start === null && end === null) return 'Whole service';
  const from = start === null ? 'live window start' : fmt(start);
  const to = end === null ? 'live window end' : fmt(end);
  return `${from} → ${to}`;
}

export function timezones(): string[] {
  const intl = Intl as unknown as { supportedValuesOf?: (k: string) => string[] };
  try {
    return intl.supportedValuesOf ? intl.supportedValuesOf('timeZone') : ['UTC'];
  } catch {
    return ['UTC'];
  }
}

export function publicSiteUrl(): string {
  const configured = import.meta.env.VITE_PUBLIC_SITE_URL as string | undefined;
  return (configured || window.location.origin).replace(/\/$/, '');
}

export function landingUrl(churchSlug: string, serviceSlug?: string): string {
  return `${publicSiteUrl()}/c/${churchSlug}${serviceSlug ? `/${serviceSlug}` : ''}`;
}

export function downloadCsv(filename: string, rows: string[][]) {
  const csv = rows
    .map((r) => r.map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(','))
    .join('\n');
  const blob = new Blob([`\ufeff${csv}`], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

export function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}
