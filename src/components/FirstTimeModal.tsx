import { Bell, BookOpen, Check, Heart, Info, Smartphone, Sparkles, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { WelcomeModalConfig, WelcomeModalHighlight, WelcomeModalIcon } from '../lib/types';
import { Button, Modal } from './ui';

export const DEFAULT_WELCOME_HIGHLIGHTS: WelcomeModalHighlight[] = [
  {
    id: 'live-updates',
    icon: 'smartphone',
    title: 'Automatic Live Updates',
    description:
      'Your screen synchronizes in real time as the service progresses: sermon outlines, scripture readings, live polls, and offering. No need to refresh.',
  },
  {
    id: 'personal-notes',
    icon: 'book',
    title: 'Private Personal Notes',
    description:
      'Type your reflections directly under any sermon point. Your notes are stored privately on this device and can be saved or emailed to yourself at any time.',
  },
  {
    id: 'screen-awake',
    icon: 'check',
    title: 'Screen Stays Awake',
    description:
      "Your phone screen will remain on while you follow along with the message so you don't have to keep unlocking your phone.",
  },
];

interface Props {
  churchName?: string;
  churchSlug?: string;
  config?: WelcomeModalConfig;
  previewOpen?: boolean;
  onPreviewClose?: () => void;
}

function HighlightIcon({ icon }: { icon?: WelcomeModalIcon }) {
  switch (icon) {
    case 'smartphone':
      return <Smartphone className="h-4 w-4" />;
    case 'book':
      return <BookOpen className="h-4 w-4" />;
    case 'check':
      return <Check className="h-4 w-4" />;
    case 'bell':
      return <Bell className="h-4 w-4" />;
    case 'heart':
      return <Heart className="h-4 w-4" />;
    case 'info':
      return <Info className="h-4 w-4" />;
    case 'sparkles':
    default:
      return <Sparkles className="h-4 w-4" />;
  }
}

function getIconColorClass(icon?: WelcomeModalIcon) {
  switch (icon) {
    case 'smartphone':
      return 'bg-indigo-100 text-brand';
    case 'book':
      return 'bg-emerald-100 text-emerald-600';
    case 'check':
      return 'bg-amber-100 text-amber-600';
    case 'bell':
      return 'bg-purple-100 text-purple-600';
    case 'heart':
      return 'bg-rose-100 text-rose-600';
    case 'info':
      return 'bg-blue-100 text-blue-600';
    case 'sparkles':
    default:
      return 'bg-brand/10 text-brand';
  }
}

export function FirstTimeModal({
  churchName,
  churchSlug,
  config,
  previewOpen,
  onPreviewClose,
}: Props) {
  const [open, setOpen] = useState(false);

  // If in preview mode, open state is controlled by previewOpen
  const isPreview = previewOpen !== undefined;
  const isEnabled = config?.enabled !== false;
  const currentVersion = String(config?.version || 1);
  const storageKey = `sb_welcome_dismissed_${churchSlug || 'global'}`;

  useEffect(() => {
    if (isPreview) {
      setOpen(Boolean(previewOpen));
      return;
    }

    if (!isEnabled) {
      setOpen(false);
      return;
    }

    try {
      const seen = localStorage.getItem(storageKey);
      if (seen !== currentVersion) {
        // Slight delay so the page loads smoothly before the modal appears
        const timer = setTimeout(() => setOpen(true), 600);
        return () => clearTimeout(timer);
      }
    } catch {
      /* ignore storage read error */
    }
  }, [isPreview, previewOpen, isEnabled, storageKey, currentVersion]);

  const dismiss = () => {
    if (isPreview) {
      onPreviewClose?.();
      return;
    }

    try {
      localStorage.setItem(storageKey, currentVersion);
    } catch {
      /* ignore */
    }
    setOpen(false);
  };

  if (!open) return null;

  const title = config?.title?.trim() || `Welcome to ${churchName || 'the Service'}`;
  const subtitle = config?.subtitle?.trim() || 'Your live interactive service companion';
  const buttonLabel = config?.button_label?.trim() || "Got it, let's begin";
  const highlights = config?.highlights && config.highlights.length > 0 ? config.highlights : DEFAULT_WELCOME_HIGHLIGHTS;

  return (
    <Modal open onClose={dismiss} title="">
      <div className="relative pt-2 pb-1 text-slate-900">
        <button
          type="button"
          onClick={dismiss}
          className="absolute -top-2 -right-2 flex h-8 w-8 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
          aria-label="Close"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-brand/10 text-brand">
            <Sparkles className="h-6 w-6" />
          </div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
            {title}
          </h2>
          {subtitle && (
            <p className="mt-1 text-sm text-slate-500">
              {subtitle}
            </p>
          )}
        </div>

        <div className="mt-6 space-y-3.5 text-left max-h-[50vh] overflow-y-auto pr-1">
          {highlights.map((h) => (
            <div key={h.id} className="flex items-start gap-3 rounded-2xl border border-slate-100 bg-slate-50/70 p-3.5 shadow-2xs">
              <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${getIconColorClass(h.icon)}`}>
                <HighlightIcon icon={h.icon} />
              </div>
              <div className="min-w-0 flex-1">
                <h4 className="text-sm font-semibold text-slate-800">{h.title}</h4>
                <p className="mt-0.5 text-xs leading-relaxed text-slate-500 whitespace-pre-line">
                  {h.description}
                </p>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-6">
          <Button
            type="button"
            onClick={dismiss}
            className="w-full justify-center py-3 text-sm font-semibold shadow-md shadow-brand/20"
          >
            {buttonLabel}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
