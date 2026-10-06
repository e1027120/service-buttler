import { CalendarClock, Radio, WifiOff } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { Markdown } from '../../components/Markdown';
import { Spinner, cx } from '../../components/ui';
import { fetchLivePage } from '../../lib/api';
import type { LivePage as LivePageData } from '../../lib/types';
import { brandStyle, formatInZone } from '../../lib/utils';
import { ActionView, type ThemeTokens } from './ActionView';

const THEMES: Record<'light' | 'dark' | 'brand', ThemeTokens> = {
  light: {
    page: 'bg-slate-100 text-slate-900',
    card: 'bg-white text-slate-900',
    muted: 'text-slate-500',
    input: 'border-slate-200 bg-slate-50 text-slate-900',
    chip: 'bg-slate-100 text-slate-800 hover:bg-slate-200',
    chipActive: 'bg-brand text-white',
  },
  dark: {
    page: 'bg-slate-950 text-white',
    card: 'bg-slate-900 text-white ring-1 ring-white/10',
    muted: 'text-slate-400',
    input: 'border-slate-700 bg-slate-800 text-white',
    chip: 'bg-slate-800 text-slate-100 hover:bg-slate-700',
    chipActive: 'bg-brand text-white',
  },
  brand: {
    page: 'bg-brand text-white',
    card: 'bg-white text-slate-900',
    muted: 'text-slate-500',
    input: 'border-slate-200 bg-slate-50 text-slate-900',
    chip: 'bg-slate-100 text-slate-800 hover:bg-slate-200',
    chipActive: 'bg-white text-brand',
  },
};

const POLL_MS = 30_000;

export default function LivePage() {
  const { churchSlug = '', serviceSlug } = useParams();
  const [search] = useSearchParams();
  const previewAt = search.get('at') || undefined;
  const isEmbedPreview = search.has('preview');

  const [data, setData] = useState<LivePageData | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'notfound' | 'error'>('loading');
  const [offline, setOffline] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>();

  const load = useCallback(async () => {
    try {
      const page = await fetchLivePage(churchSlug, serviceSlug, previewAt);
      if (!page) {
        setStatus('notfound');
        return;
      }
      setData(page);
      setStatus('ready');
      setOffline(false);
    } catch {
      setOffline(true);
      setStatus((s) => (s === 'loading' ? 'error' : s));
    }
  }, [churchSlug, serviceSlug, previewAt]);

  // Poll + re-fetch exactly when the current primary action's window ends
  useEffect(() => {
    load();
    const id = setInterval(load, POLL_MS);
    const onVisible = () => document.visibilityState === 'visible' && load();
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('online', load);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('online', load);
    };
  }, [load]);

  useEffect(() => {
    clearTimeout(timer.current);
    const until = data?.actions
      .map((a) => (a.visible_until ? new Date(a.visible_until).getTime() : Infinity))
      .reduce((a, b) => Math.min(a, b), Infinity);
    if (until && Number.isFinite(until) && !previewAt) {
      const ms = until - Date.now() + 1500;
      if (ms > 0 && ms < POLL_MS) timer.current = setTimeout(load, ms);
    }
    return () => clearTimeout(timer.current);
  }, [data, load, previewAt]);

  const landing = data?.church.landing || {};
  const theme = THEMES[landing.theme || 'light'];

  const actions = data?.actions || [];
  const primary = useMemo(
    () => actions.find((a) => a.id === selectedId) || actions[0] || null,
    [actions, selectedId],
  );

  // A newly pinned action always wins attention
  const pinnedId = actions.find((a) => a.pinned)?.id;
  useEffect(() => {
    if (pinnedId) setSelectedId(pinnedId);
  }, [pinnedId]);

  useEffect(() => {
    if (!data) return;
    document.title = primary ? `${primary.title} · ${data.church.name}` : data.church.name;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', data.church.primary_color);
  }, [data, primary]);

  if (status === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100">
        <Spinner />
      </div>
    );
  }

  if (status === 'notfound' || (status === 'error' && !data)) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-2 bg-slate-100 p-6 text-center">
        <h1 className="text-xl font-bold text-slate-800">{status === 'notfound' ? 'Page not found' : 'We could not load this page'}</h1>
        <p className="text-slate-500">{status === 'notfound' ? 'Please check the QR code or link.' : 'Check your connection and try again.'}</p>
        {status === 'error' && (
          <button onClick={load} className="mt-4 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white">
            Retry
          </button>
        )}
      </div>
    );
  }

  const church = data!.church;

  return (
    <div className={cx('min-h-screen pb-[env(safe-area-inset-bottom)]', theme.page)} style={brandStyle(church.primary_color, church.accent_color)}>
      <div className="mx-auto flex min-h-screen max-w-xl flex-col px-4 pb-8 pt-[max(1rem,env(safe-area-inset-top))]">
        {/* Header */}
        <header className="flex items-center justify-between gap-3 py-3">
          <div className="flex min-w-0 items-center gap-3">
            {church.logo_url ? (
              <img src={church.logo_url} alt={church.name} className="h-10 w-10 shrink-0 rounded-xl bg-white object-contain p-1" />
            ) : (
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/90 text-lg font-bold text-brand">
                {church.name.charAt(0)}
              </span>
            )}
            <div className="min-w-0">
              <p className="truncate font-semibold leading-tight">{church.name}</p>
              {data!.live && data!.service && landing.show_service_name !== false && (
                <p className="truncate text-xs opacity-75">{data!.service.name}</p>
              )}
            </div>
          </div>
          {data!.live && (
            <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-red-500 px-2.5 py-1 text-xs font-semibold text-white">
              <Radio className="h-3 w-3 animate-pulse" /> LIVE
            </span>
          )}
        </header>

        {offline && (
          <div className="mb-3 flex items-center gap-2 rounded-xl bg-amber-100 px-3 py-2 text-sm text-amber-900">
            <WifiOff className="h-4 w-4" /> Connection lost — showing the latest content.
          </div>
        )}

        {previewAt && !isEmbedPreview && (
          <div className="mb-3 rounded-xl bg-indigo-100 px-3 py-2 text-sm text-indigo-900">
            Preview at {formatInZone(previewAt, church.timezone, { dateStyle: 'medium', timeStyle: 'short' })}
          </div>
        )}

        {/* Action switcher when several actions are live simultaneously */}
        {actions.length > 1 && (
          <nav className="-mx-4 mb-4 flex gap-2 overflow-x-auto px-4 pb-1" aria-label="Live items">
            {actions.map((a) => (
              <button
                key={a.id}
                onClick={() => setSelectedId(a.id)}
                className={cx(
                  'shrink-0 rounded-full px-4 py-2 text-sm font-medium transition',
                  primary?.id === a.id ? theme.chipActive : landing.theme === 'brand' ? 'bg-white/15 text-white' : theme.chip,
                )}
              >
                {a.title}
              </button>
            ))}
          </nav>
        )}

        <main className="flex-1">
          {primary ? (
            <div key={primary.id} className="animate-fade-up">
              <ActionView action={primary} theme={theme} preview={Boolean(previewAt)} />
            </div>
          ) : (
            <Idle data={data!} theme={theme} />
          )}
        </main>

        {/* Footer */}
        {(landing.links?.length || landing.footer_text) && (
          <footer className="mt-8 space-y-3 text-center">
            {landing.links && landing.links.length > 0 && (
              <div className="flex flex-wrap justify-center gap-2">
                {landing.links.map((l, i) => (
                  <a
                    key={i}
                    href={l.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={cx('rounded-full px-3 py-1.5 text-sm font-medium', landing.theme === 'brand' ? 'bg-white/15 text-white' : theme.chip)}
                  >
                    {l.label}
                  </a>
                ))}
              </div>
            )}
            {landing.footer_text && <p className="text-xs opacity-70">{landing.footer_text}</p>}
          </footer>
        )}
      </div>
    </div>
  );
}

function Idle({ data, theme }: { data: LivePageData; theme: ThemeTokens }) {
  const { church, next_service, live } = data;
  const landing = church.landing || {};
  return (
    <article className={cx('overflow-hidden rounded-3xl shadow-xl animate-fade-up', theme.card)}>
      {landing.hero_image_url && <img src={landing.hero_image_url} alt="" className="aspect-[16/9] w-full object-cover" />}
      <div className="space-y-4 p-6 sm:p-8">
        <h1 className="text-2xl font-bold sm:text-3xl">
          {live ? landing.idle_title || landing.welcome_title || 'Welcome!' : landing.welcome_title || `Welcome to ${church.name}`}
        </h1>
        <Markdown className={theme.muted}>{live ? landing.idle_message || landing.welcome_message : landing.welcome_message}</Markdown>
        {!live && next_service && landing.show_next_service !== false && (
          <div className={cx('flex items-center gap-3 rounded-2xl p-4', theme.chip)}>
            <CalendarClock className="h-6 w-6 shrink-0 text-brand" />
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider opacity-70">Next service</p>
              <p className="font-semibold">{next_service.name}</p>
              <p className="text-sm opacity-80">
                {formatInZone(next_service.starts_at, church.timezone, { weekday: 'long', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
          </div>
        )}
      </div>
    </article>
  );
}
