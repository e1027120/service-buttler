import { Check, Sparkles, Smartphone, BookOpen, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button, Modal } from './ui';

interface Props {
  churchName?: string;
}

export function FirstTimeModal({ churchName }: Props) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    try {
      const seen = localStorage.getItem('sb_welcome_dismissed');
      if (!seen) {
        // Slight delay so the page loads smoothly before the intro appears
        const timer = setTimeout(() => setOpen(true), 600);
        return () => clearTimeout(timer);
      }
    } catch {
      /* ignore storage read error */
    }
  }, []);

  const dismiss = () => {
    try {
      localStorage.setItem('sb_welcome_dismissed', 'true');
    } catch {
      /* ignore */
    }
    setOpen(false);
  };

  if (!open) return null;

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
            Welcome to {churchName || 'the Service'}
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Your live interactive service companion
          </p>
        </div>

        <div className="mt-6 space-y-4 text-left">
          <div className="flex items-start gap-3 rounded-2xl border border-slate-100 bg-slate-50/70 p-3.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-indigo-100 text-brand">
              <Smartphone className="h-4 w-4" />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-slate-800">Automatic Live Updates</h4>
              <p className="mt-0.5 text-xs leading-relaxed text-slate-500">
                Your screen synchronizes in real time as the service progresses: sermon outlines, scripture readings, live polls, and offering. No need to refresh.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 rounded-2xl border border-slate-100 bg-slate-50/70 p-3.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600">
              <BookOpen className="h-4 w-4" />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-slate-800">Private Personal Notes</h4>
              <p className="mt-0.5 text-xs leading-relaxed text-slate-500">
                Type your reflections directly under any sermon point. Your notes are stored privately on this device and can be saved or emailed to yourself at any time.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 rounded-2xl border border-slate-100 bg-slate-50/70 p-3.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-600">
              <Check className="h-4 w-4" />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-slate-800">Screen Stays Awake</h4>
              <p className="mt-0.5 text-xs leading-relaxed text-slate-500">
                Your phone screen will remain on while you follow along with the message so you don't have to keep unlocking your phone.
              </p>
            </div>
          </div>
        </div>

        <div className="mt-6">
          <Button
            type="button"
            onClick={dismiss}
            className="w-full justify-center py-3 text-sm font-semibold shadow-md shadow-brand/20"
          >
            Got it, let's begin
          </Button>
        </div>
      </div>
    </Modal>
  );
}
