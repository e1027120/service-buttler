import { Check, ChevronLeft, ChevronRight, Copy, ExternalLink, Heart, Send, Share2 } from 'lucide-react';
import { type FormEvent, useCallback, useEffect, useState } from 'react';
import { Markdown } from '../../components/Markdown';
import { cx } from '../../components/ui';
import { castVote, fetchPollResults, getVoterToken, submitForm } from '../../lib/api';
import type {
  AnnouncementContent,
  FormContent,
  LinkContent,
  LiveAction,
  OfferingContent,
  PollContent,
  PollResults,
  SermonNotesContent,
} from '../../lib/types';
import { errorMessage } from '../../lib/utils';

export interface ThemeTokens {
  page: string;
  card: string;
  muted: string;
  input: string;
  chip: string;
  chipActive: string;
}

interface Props {
  action: LiveAction;
  theme: ThemeTokens;
  /** In admin previews, interactive submissions are disabled */
  preview?: boolean;
}

export function ActionView({ action, theme, preview }: Props) {
  const c = action.content as Record<string, unknown>;
  switch (action.type) {
    case 'announcement':
      return <Announcement title={action.title} c={c as AnnouncementContent} theme={theme} />;
    case 'sermon_notes':
      return <SermonNotes id={action.id} title={action.title} c={c as SermonNotesContent} theme={theme} />;
    case 'poll':
      return <Poll id={action.id} title={action.title} c={c as PollContent} theme={theme} preview={preview} />;
    case 'offering':
      return <Offering title={action.title} c={c as OfferingContent} theme={theme} />;
    case 'form':
      return <Form id={action.id} title={action.title} c={c as FormContent} theme={theme} preview={preview} />;
    case 'link':
      return <LinkCard title={action.title} c={c as LinkContent} theme={theme} />;
    default:
      return null;
  }
}

const primaryBtn =
  'inline-flex w-full items-center justify-center gap-2 rounded-xl bg-brand px-5 py-3.5 text-base font-semibold text-white shadow-lg shadow-brand/20 transition active:scale-[0.98] disabled:opacity-60';

function safeUrl(url?: string): string | undefined {
  if (!url) return undefined;
  try {
    const u = new URL(url, window.location.origin);
    return ['http:', 'https:', 'mailto:', 'tel:'].includes(u.protocol) ? u.toString() : undefined;
  } catch {
    return undefined;
  }
}

function Shell({ theme, children, image }: { theme: ThemeTokens; children: React.ReactNode; image?: string }) {
  return (
    <article className={cx('overflow-hidden rounded-3xl shadow-xl', theme.card)}>
      {image && <img src={image} alt="" className="aspect-[16/9] w-full object-cover" loading="eager" />}
      <div className="space-y-5 p-6 sm:p-8">{children}</div>
    </article>
  );
}

function Title({ children, eyebrow, theme }: { children: React.ReactNode; eyebrow?: string; theme: ThemeTokens }) {
  return (
    <header>
      {eyebrow && <p className={cx('mb-1 text-xs font-semibold uppercase tracking-wider', theme.muted)}>{eyebrow}</p>}
      <h1 className="text-2xl font-bold leading-tight sm:text-3xl">{children}</h1>
    </header>
  );
}

// ---------------------------------------------------------------------------
function Announcement({ title, c, theme }: { title: string; c: AnnouncementContent; theme: ThemeTokens }) {
  const slides =
    c.slides && c.slides.length > 0
      ? c.slides
      : [
          {
            id: 'legacy',
            title: '',
            body: c.body,
            image_url: c.image_url,
            cta_label: c.cta_label,
            cta_url: c.cta_url,
          },
        ];

  const [currentIndex, setCurrentIndex] = useState(0);

  // Auto-advance if configured (> 0) and multiple slides exist
  useEffect(() => {
    if (!c.auto_advance_seconds || c.auto_advance_seconds <= 0 || slides.length <= 1) {
      return;
    }
    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % slides.length);
    }, c.auto_advance_seconds * 1000);
    return () => clearInterval(timer);
  }, [c.auto_advance_seconds, slides.length]);

  const activeIndex = Math.min(currentIndex, slides.length - 1);
  const isMultiSlide = slides.length > 1;
  const anySlideHasImage = slides.some((s) => Boolean(s.image_url));

  const prevSlide = () => {
    setCurrentIndex((prev) => (prev === 0 ? slides.length - 1 : prev - 1));
  };

  const nextSlide = () => {
    setCurrentIndex((prev) => (prev === slides.length - 1 ? 0 : prev + 1));
  };

  return (
    <article className={cx('overflow-hidden rounded-3xl shadow-xl', theme.card)}>
      {/* Cross-fading image header when any slide has an image */}
      {anySlideHasImage && (
        <div className="relative aspect-[16/9] w-full overflow-hidden bg-black/5 dark:bg-white/5">
          {slides.map((slide, idx) => (
            <div
              key={slide.id || idx}
              className={cx(
                'absolute inset-0 transition-opacity duration-700 ease-in-out',
                idx === activeIndex ? 'opacity-100 z-10' : 'pointer-events-none opacity-0 z-0'
              )}
            >
              {slide.image_url && (
                <img
                  src={slide.image_url}
                  alt={slide.title || title}
                  className="h-full w-full object-cover"
                  loading={idx === 0 ? 'eager' : 'lazy'}
                />
              )}
            </div>
          ))}
        </div>
      )}

      <div className="space-y-5 p-6 sm:p-8">
        {/* Carousel header controls */}
        {isMultiSlide && (
          <div className="flex items-center justify-between border-b border-black/5 pb-3 dark:border-white/10">
            <span className={cx('text-xs font-semibold uppercase tracking-wider', theme.muted)}>
              Announcement · Slide {activeIndex + 1} of {slides.length}
            </span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={prevSlide}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-black/5 text-current transition hover:bg-black/10 active:scale-95 dark:bg-white/10 dark:hover:bg-white/20"
                aria-label="Previous slide"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={nextSlide}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-black/5 text-current transition hover:bg-black/10 active:scale-95 dark:bg-white/10 dark:hover:bg-white/20"
                aria-label="Next slide"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {/* Cross-fading slide content stack */}
        <div className="grid">
          {slides.map((slide, idx) => {
            const isActive = idx === activeIndex;
            const url = safeUrl(slide.cta_url);
            return (
              <div
                key={slide.id || idx}
                style={{ gridArea: '1 / 1' }}
                className={cx(
                  'space-y-5 transition-all duration-500 ease-out',
                  isActive
                    ? 'opacity-100 translate-y-0 relative z-10'
                    : 'pointer-events-none opacity-0 translate-y-2 absolute inset-0 z-0'
                )}
                aria-hidden={!isActive}
              >
                <Title theme={theme} eyebrow={!isMultiSlide ? 'Announcement' : undefined}>
                  {slide.title || title}
                </Title>

                {slide.body && <Markdown>{slide.body}</Markdown>}

                {url && (
                  <a
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={primaryBtn}
                    tabIndex={isActive ? 0 : -1}
                  >
                    {slide.cta_label || 'Learn more'} <ExternalLink className="h-4 w-4" />
                  </a>
                )}
              </div>
            );
          })}
        </div>

        {/* Dots indicators */}
        {isMultiSlide && (
          <div className="flex items-center justify-center gap-2 pt-2">
            {slides.map((s, idx) => (
              <button
                key={s.id || idx}
                type="button"
                onClick={() => setCurrentIndex(idx)}
                className={cx(
                  'h-2 rounded-full transition-all duration-300',
                  idx === activeIndex
                    ? 'w-6 bg-brand'
                    : 'w-2 bg-black/20 hover:bg-black/40 dark:bg-white/30 dark:hover:bg-white/50'
                )}
                aria-label={`Go to slide ${idx + 1}`}
              />
            ))}
          </div>
        )}
      </div>
    </article>
  );
}

// ---------------------------------------------------------------------------
function SermonNotes({ id, title, c, theme }: { id: string; title: string; c: SermonNotesContent; theme: ThemeTokens }) {
  const key = `sb_notes:${id}`;
  const [notes, setNotes] = useState(() => localStorage.getItem(key) || '');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => localStorage.setItem(key, notes), 300);
    return () => clearTimeout(t);
  }, [key, notes]);

  const fullText = [title, c.speaker, c.scripture, '', c.body, '', '— My notes —', notes].filter((x) => x !== undefined).join('\n');

  const share = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title, text: fullText });
        return;
      } catch {
        /* cancelled */
      }
    }
    await navigator.clipboard.writeText(fullText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const meta = [c.speaker, c.scripture].filter(Boolean).join(' · ');
  return (
    <Shell theme={theme}>
      <Title theme={theme} eyebrow="Sermon notes">{title}</Title>
      {meta && <p className={cx('-mt-3 text-sm font-medium', theme.muted)}>{meta}</p>}
      <Markdown>{c.body}</Markdown>
      {c.allow_personal_notes !== false && (
        <div className="space-y-2">
          <label htmlFor={`notes-${id}`} className="text-sm font-semibold">My notes</label>
          <textarea
            id={`notes-${id}`}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={6}
            placeholder="Write your thoughts… they stay on this device."
            className={cx('w-full rounded-xl border px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-brand/40', theme.input)}
          />
          <button type="button" onClick={share} className={cx('inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium', theme.chip)}>
            {copied ? <Check className="h-4 w-4" /> : <Share2 className="h-4 w-4" />}
            {copied ? 'Copied' : 'Save / share notes'}
          </button>
        </div>
      )}
    </Shell>
  );
}

// ---------------------------------------------------------------------------
function Poll({ id, title, c, theme, preview }: { id: string; title: string; c: PollContent; theme: ThemeTokens; preview?: boolean }) {
  const voteKey = `sb_vote:${id}`;
  const [myVote, setMyVote] = useState<string | null>(() => localStorage.getItem(voteKey));
  const [results, setResults] = useState<PollResults | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const options = c.options || [];
  const showResults = Boolean(myVote || c.closed);

  const loadResults = useCallback(async () => {
    try {
      setResults(await fetchPollResults(id));
    } catch {
      /* transient */
    }
  }, [id]);

  useEffect(() => {
    if (!showResults) return;
    loadResults();
    const t = setInterval(loadResults, 5000);
    return () => clearInterval(t);
  }, [showResults, loadResults]);

  const vote = async (optionId: string) => {
    if (preview || c.closed || busy) return;
    if (myVote && c.allow_change === false) return;
    setBusy(true);
    setError(null);
    try {
      const r = await castVote(id, optionId, getVoterToken());
      localStorage.setItem(voteKey, optionId);
      setMyVote(optionId);
      setResults(r);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const total = results?.total || 0;
  return (
    <Shell theme={theme}>
      <Title theme={theme} eyebrow={c.closed ? 'Poll · closed' : 'Live poll'}>{c.question || title}</Title>
      <div className="space-y-3" role="radiogroup" aria-label={c.question || title}>
        {options.map((o) => {
          const count = results?.counts?.[o.id] || 0;
          const pct = total ? Math.round((count / total) * 100) : 0;
          const selected = myVote === o.id;
          const showBar = showResults && results && !results.hidden;
          return (
            <button
              key={o.id}
              type="button"
              role="radio"
              aria-checked={selected}
              disabled={busy || c.closed || (Boolean(myVote) && c.allow_change === false)}
              onClick={() => vote(o.id)}
              className={cx(
                'relative w-full overflow-hidden rounded-xl border-2 px-4 py-3.5 text-left text-base font-medium transition active:scale-[0.99]',
                selected ? 'border-brand' : 'border-transparent',
                theme.chip,
              )}
            >
              {showBar && <span className="absolute inset-y-0 left-0 bg-brand/20 transition-all duration-700" style={{ width: `${pct}%` }} />}
              <span className="relative flex items-center justify-between gap-3">
                <span className="flex items-center gap-2">
                  {selected && <Check className="h-4 w-4 text-brand" />}
                  {o.label}
                </span>
                {showBar && <span className="tabular-nums">{pct}%</span>}
              </span>
            </button>
          );
        })}
      </div>
      {error && <p className="text-sm font-medium text-red-500">{error}</p>}
      {showResults && results && (
        <p className={cx('text-sm', theme.muted)}>
          {results.hidden ? 'Thanks for voting! Results will be shared soon.' : `${total} vote${total === 1 ? '' : 's'}`}
          {myVote && c.allow_change !== false && !c.closed && ' · tap another option to change your vote'}
        </p>
      )}
    </Shell>
  );
}

// ---------------------------------------------------------------------------
function Offering({ title, c, theme }: { title: string; c: OfferingContent; theme: ThemeTokens }) {
  const [copied, setCopied] = useState<string | null>(null);
  const copy = async (id: string, text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };
  return (
    <Shell theme={theme}>
      <div className="flex items-center gap-3">
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand/15 text-brand">
          <Heart className="h-6 w-6" />
        </span>
        <Title theme={theme} eyebrow="Offering">{title}</Title>
      </div>
      <Markdown>{c.message}</Markdown>
      <div className="space-y-3">
        {(c.methods || []).map((m) => {
          const url = safeUrl(m.url);
          return (
            <div key={m.id} className={cx('rounded-2xl p-4', theme.chip)}>
              <div className="font-semibold">{m.label}</div>
              {m.description && <p className={cx('mt-0.5 text-sm', theme.muted)}>{m.description}</p>}
              {m.details && (
                <div className="mt-3 flex items-start justify-between gap-3">
                  <pre className="whitespace-pre-wrap break-all font-mono text-sm">{m.details}</pre>
                  <button type="button" onClick={() => copy(m.id, m.details!)} className="shrink-0 rounded-lg p-2 hover:bg-black/5" aria-label="Copy details">
                    {copied === m.id ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </button>
                </div>
              )}
              {url && (
                <a href={url} target="_blank" rel="noopener noreferrer" className={cx(primaryBtn, 'mt-3')}>
                  Give with {m.label} <ExternalLink className="h-4 w-4" />
                </a>
              )}
            </div>
          );
        })}
      </div>
    </Shell>
  );
}

// ---------------------------------------------------------------------------
function Form({ id, title, c, theme, preview }: { id: string; title: string; c: FormContent; theme: ThemeTokens; preview?: boolean }) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [honeypot, setHoneypot] = useState('');
  const [state, setState] = useState<'idle' | 'busy' | 'done'>('idle');
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (preview) return;
    setState('busy');
    setError(null);
    try {
      await submitForm(id, values, honeypot);
      setState('done');
      setValues({});
    } catch (err) {
      setError(errorMessage(err));
      setState('idle');
    }
  };

  if (state === 'done') {
    return (
      <Shell theme={theme}>
        <div className="py-6 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-brand/15 text-brand">
            <Check className="h-7 w-7" />
          </div>
          <h2 className="text-xl font-bold">{c.success_message || 'Thank you! We received your submission.'}</h2>
          <button type="button" onClick={() => setState('idle')} className={cx('mt-6 rounded-lg px-4 py-2 text-sm font-medium', theme.chip)}>
            Submit another
          </button>
        </div>
      </Shell>
    );
  }

  const inputCls = cx('w-full rounded-xl border px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-brand/40', theme.input);
  return (
    <Shell theme={theme}>
      <Title theme={theme}>{title}</Title>
      <Markdown>{c.intro}</Markdown>
      <form onSubmit={onSubmit} className="space-y-4">
        {(c.fields || []).map((f) => (
          <label key={f.id} className="block">
            <span className="mb-1 block text-sm font-semibold">
              {f.label}
              {f.required && <span className="text-brand"> *</span>}
            </span>
            {f.type === 'textarea' ? (
              <textarea
                className={inputCls}
                rows={4}
                required={f.required}
                maxLength={4000}
                placeholder={f.placeholder}
                value={values[f.id] || ''}
                onChange={(e) => setValues({ ...values, [f.id]: e.target.value })}
              />
            ) : (
              <input
                className={inputCls}
                type={f.type === 'phone' ? 'tel' : f.type}
                autoComplete={f.type === 'email' ? 'email' : f.type === 'phone' ? 'tel' : undefined}
                required={f.required}
                maxLength={500}
                placeholder={f.placeholder}
                value={values[f.id] || ''}
                onChange={(e) => setValues({ ...values, [f.id]: e.target.value })}
              />
            )}
          </label>
        ))}
        {/* honeypot — hidden from humans */}
        <input
          type="text"
          name="website"
          tabIndex={-1}
          autoComplete="off"
          value={honeypot}
          onChange={(e) => setHoneypot(e.target.value)}
          className="absolute -left-[9999px] h-0 w-0 opacity-0"
          aria-hidden="true"
        />
        {error && <p className="text-sm font-medium text-red-500">{error}</p>}
        <button type="submit" className={primaryBtn} disabled={state === 'busy' || preview}>
          <Send className="h-4 w-4" /> {state === 'busy' ? 'Sending…' : c.submit_label || 'Submit'}
        </button>
      </form>
    </Shell>
  );
}

// ---------------------------------------------------------------------------
function LinkCard({ title, c, theme }: { title: string; c: LinkContent; theme: ThemeTokens }) {
  const url = safeUrl(c.url);
  return (
    <Shell theme={theme} image={c.image_url}>
      <Title theme={theme}>{title}</Title>
      <Markdown>{c.description}</Markdown>
      {url && (
        <a href={url} target="_blank" rel="noopener noreferrer" className={primaryBtn}>
          {c.label || 'Open'} <ExternalLink className="h-4 w-4" />
        </a>
      )}
    </Shell>
  );
}
