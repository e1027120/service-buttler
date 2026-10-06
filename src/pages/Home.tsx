import { ArrowRight, Church, Clock, Heart, MessageSquare, QrCode, Radio, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '../components/ui';
import { useAuth } from '../lib/auth';

export default function Home() {
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      {/* Navigation */}
      <header className="border-b border-slate-200 bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand text-white">
              <Church className="h-5 w-5" />
            </div>
            <span className="text-lg font-bold">Service Buttler</span>
          </div>
          <div className="flex items-center gap-3">
            <Link to={user ? '/admin' : '/login'}>
              <Button size="sm">
                {user ? 'Dashboard' : 'Sign in'} <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-4xl px-4 py-16 text-center sm:py-24">
        <div className="inline-flex items-center gap-2 rounded-full bg-brand/10 px-3 py-1 text-xs font-semibold text-brand">
          <Sparkles className="h-3.5 w-3.5" /> Production-ready for your congregation
        </div>
        <h1 className="mt-6 text-4xl font-extrabold tracking-tight sm:text-6xl">
          The right action on every phone, <span className="text-brand">at the exact right minute</span>.
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-slate-600">
          Attendees scan the seat-back QR code or tap an NFC tag once. As the service progresses, their screen automatically updates: sermon notes, live polls, offering links and prayer requests.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link to={user ? '/admin' : '/login'}>
            <Button size="md" className="px-6 py-3 text-base">
              {user ? 'Go to your dashboard' : 'Get started'} <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
          <a
            href="/c/grace-community"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-5 py-2.5 text-base font-medium text-slate-700 hover:bg-slate-50"
          >
            See sample landing page
          </a>
        </div>
      </section>

      {/* Features */}
      <section className="mx-auto max-w-6xl px-4 py-12">
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          <FeatureCard
            icon={<Clock className="h-6 w-6 text-brand" />}
            title="Time-based cues"
            desc="Schedule actions relative to service start (+15m notes, +40m offering). The screen updates without refreshing."
          />
          <FeatureCard
            icon={<Radio className="h-6 w-6 text-brand" />}
            title="Live control room"
            desc="Pastor ran long? AV team can push any announcement or poll live instantly with one click."
          />
          <FeatureCard
            icon={<MessageSquare className="h-6 w-6 text-brand" />}
            title="Live interactive polls"
            desc="Ask a question and stream results live back to attendees and the AV screen."
          />
          <FeatureCard
            icon={<Heart className="h-6 w-6 text-brand" />}
            title="Offering & giving"
            desc="Direct links to online giving, church center, or one-tap copyable bank/IBAN details."
          />
          <FeatureCard
            icon={<QrCode className="h-6 w-6 text-brand" />}
            title="Seat-back QR & NFC"
            desc="High-res branded print QR codes and a built-in step-by-step NFC tag writing guide."
          />
          <FeatureCard
            icon={<Church className="h-6 w-6 text-brand" />}
            title="Multi-tenant & team roles"
            desc="One account can belong to multiple churches. Owners, admins and editors with granular access."
          />
        </div>
      </section>

      {/* Footer */}
      <footer className="mt-16 border-t border-slate-200 bg-white py-8 text-center text-xs text-slate-500">
        <p>Service Buttler · Built for Cloudflare Pages & Workers + Supabase</p>
      </footer>
    </div>
  );
}

function FeatureCard({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div className="card p-6">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-brand/10">{icon}</div>
      <h3 className="text-base font-semibold text-slate-900">{title}</h3>
      <p className="mt-2 text-sm text-slate-600">{desc}</p>
    </div>
  );
}
