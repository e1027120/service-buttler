import {
  ArrowRight,
  CheckCircle2,
  Church,
  Clock,
  Layers,
  Palette,
  QrCode,
  Radio,
  Smartphone,
  Sparkles,
  Zap,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '../components/ui';
import { useAuth } from '../lib/auth';

export default function Home() {
  const { user } = useAuth();

  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-50 text-slate-900 selection:bg-brand selection:text-white">
      {/* Dynamic ambient gradient orbs in background */}
      <div className="pointer-events-none absolute -top-40 left-1/2 -z-10 h-[600px] w-[900px] -translate-x-1/2 rounded-full bg-gradient-to-tr from-indigo-500/15 via-purple-500/15 to-pink-500/10 blur-3xl" />
      <div className="pointer-events-none absolute top-96 -left-32 -z-10 h-[450px] w-[450px] rounded-full bg-gradient-to-br from-cyan-400/15 to-brand/10 blur-3xl animate-pulse" />
      <div className="pointer-events-none absolute top-[600px] -right-32 -z-10 h-[500px] w-[500px] rounded-full bg-gradient-to-bl from-amber-300/15 to-purple-400/10 blur-3xl" />

      {/* Navigation */}
      <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/75 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3.5 sm:px-6">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-tr from-brand to-violet-600 text-white shadow-md shadow-brand/20">
              <Church className="h-5 w-5" />
            </div>
            <div>
              <span className="text-lg font-extrabold tracking-tight text-slate-900">Service Buttler</span>
              <span className="ml-1.5 hidden rounded-md bg-brand/10 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-brand sm:inline">
                Live
              </span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Link to={user ? '/admin' : '/login'}>
              <Button size="sm" className="gap-1.5 shadow-md shadow-brand/20">
                <span>{user ? 'Open Dashboard' : 'Sign in'}</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative mx-auto max-w-4xl px-4 pt-16 pb-14 text-center sm:pt-24 sm:pb-20 sm:px-6">
        {/* Glow badge pill */}
        <div className="inline-flex items-center gap-2 rounded-full border border-indigo-200/80 bg-gradient-to-r from-indigo-50/90 via-purple-50/70 to-pink-50/90 px-3.5 py-1 text-xs font-semibold text-indigo-700 shadow-sm backdrop-blur">
          <Sparkles className="h-3.5 w-3.5 text-indigo-600 animate-spin-slow" />
          <span>Sunday Morning Interactive Platform</span>
        </div>

        {/* Text mask gradient headline */}
        <h1 className="mt-7 text-4xl font-extrabold tracking-tight sm:text-6xl sm:leading-[1.12]">
          The right action on every phone,{' '}
          <span className="bg-gradient-to-r from-indigo-600 via-violet-600 to-pink-600 bg-clip-text text-transparent">
            at the exact right minute.
          </span>
        </h1>

        <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-slate-600 sm:text-xl">
          Attendees scan the seat-back QR code or tap an NFC tag once. As your service unfolds, their screen dynamically synchronizes: sermon notes, live polls, digital giving, and connect cards.
        </p>

        {/* Call to action */}
        <div className="mt-9 flex flex-wrap justify-center gap-3">
          <Link to={user ? '/admin' : '/login'}>
            <Button size="md" className="gap-2 px-7 py-3.5 text-base font-semibold shadow-xl shadow-brand/25 transition-all hover:shadow-brand/40 hover:-translate-y-0.5">
              <span>{user ? 'Go to your dashboard' : 'Get started for free'}</span>
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </section>

      {/* Features Bento Grid */}
      <section className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
        <div className="mb-8 text-center sm:mb-12">
          <h2 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            Everything your church needs for an{' '}
            <span className="bg-gradient-to-r from-indigo-600 to-violet-600 bg-clip-text text-transparent">
              engaging gathering
            </span>
          </h2>
          <p className="mt-2 text-sm text-slate-500 sm:text-base">
            Engineered specifically for the dynamic flow and timing of Sunday services.
          </p>
        </div>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {/* 1. Time Based Cues - Hero Card taking 2 spaces */}
          <div className="group relative flex flex-col justify-between overflow-hidden rounded-3xl border border-indigo-100 bg-gradient-to-br from-indigo-50/80 via-violet-50/40 to-white p-7 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-indigo-200 hover:shadow-xl hover:shadow-indigo-500/5 sm:col-span-2 lg:col-span-2">
            <div>
              <div className="flex items-center justify-between">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-tr from-brand to-indigo-600 text-white shadow-md shadow-brand/20">
                  <Clock className="h-6 w-6" />
                </div>
                <span className="rounded-full border border-indigo-200/80 bg-white/80 px-3 py-1 text-xs font-semibold text-indigo-700 shadow-sm backdrop-blur">
                  Primary Feature
                </span>
              </div>

              <h3 className="mt-5 text-xl font-bold text-slate-900 sm:text-2xl">
                Time-Based Cues
              </h3>

              <p className="mt-3 text-sm leading-relaxed text-slate-600 sm:text-base">
                Set up your service order relative to your start time, and let Service Buttler automate the rest. Transition seamlessly from pre-service welcome slides (-10m) to live sermon scripture notes (+15m), digital offering links (+38m), and prayer request cards (+55m). Attendee screens transition automatically in real-time without requiring any manual refreshing or app installations.
              </p>
            </div>

            {/* Visual Timeline Cue Strip */}
            <div className="mt-6 rounded-2xl border border-indigo-100/80 bg-white/70 p-4 shadow-sm backdrop-blur">
              <div className="mb-2.5 flex items-center justify-between text-xs font-semibold text-slate-500">
                <span className="flex items-center gap-1.5">
                  <Zap className="h-3.5 w-3.5 text-brand" /> Live Automated Timeline
                </span>
                <span className="text-[11px] font-normal text-slate-400">Zero attendee reloads</span>
              </div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <div className="rounded-xl border border-slate-100 bg-white p-2.5 text-center shadow-xs">
                  <span className="text-[10px] font-bold text-slate-400">-15m to 0m</span>
                  <p className="mt-0.5 truncate text-xs font-semibold text-slate-800">Welcome Slide</p>
                </div>
                <div className="rounded-xl border border-indigo-200 bg-indigo-50/70 p-2.5 text-center shadow-xs">
                  <span className="text-[10px] font-bold text-brand">+15m to +40m</span>
                  <p className="mt-0.5 truncate text-xs font-bold text-indigo-900">Sermon Notes</p>
                </div>
                <div className="rounded-xl border border-slate-100 bg-white p-2.5 text-center shadow-xs">
                  <span className="text-[10px] font-bold text-slate-400">+40m to +50m</span>
                  <p className="mt-0.5 truncate text-xs font-semibold text-slate-800">Giving & Tithe</p>
                </div>
                <div className="rounded-xl border border-slate-100 bg-white p-2.5 text-center shadow-xs">
                  <span className="text-[10px] font-bold text-slate-400">+50m onward</span>
                  <p className="mt-0.5 truncate text-xs font-semibold text-slate-800">Connect Card</p>
                </div>
              </div>
            </div>
          </div>

          {/* 2. Live Control Room - 1 space */}
          <div className="group relative flex flex-col justify-between overflow-hidden rounded-3xl border border-rose-100 bg-gradient-to-br from-rose-50/80 via-orange-50/40 to-white p-7 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-rose-200 hover:shadow-xl hover:shadow-rose-500/5">
            <div>
              <div className="flex items-center justify-between">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-tr from-rose-500 to-orange-500 text-white shadow-md shadow-rose-500/20">
                  <Radio className="h-6 w-6" />
                </div>
                <span className="rounded-full border border-rose-200/80 bg-white/80 px-2.5 py-0.5 text-xs font-semibold text-rose-700 shadow-sm backdrop-blur">
                  Live Overrides
                </span>
              </div>

              <h3 className="mt-5 text-lg font-bold text-slate-900 sm:text-xl">
                Live Control Room
              </h3>

              <p className="mt-2.5 text-sm leading-relaxed text-slate-600">
                Pastor running long or need to trigger an unscheduled announcement? Give your AV and media booth instant manual control. Pin any action or broadcast live interactive polls with one click, reaching attendee phones in under 200ms via real-time WebSockets.
              </p>
            </div>

            <div className="mt-6 flex items-center gap-2 rounded-xl border border-rose-100 bg-white/70 px-3 py-2 text-xs font-semibold text-rose-700">
              <span className="h-2 w-2 rounded-full bg-rose-500 animate-ping" />
              <span>Instant booth-to-phone synchronization</span>
            </div>
          </div>

          {/* 3. Seat-back QR & NFC - 1 space */}
          <div className="group relative flex flex-col justify-between overflow-hidden rounded-3xl border border-sky-100 bg-gradient-to-br from-sky-50/80 via-cyan-50/40 to-white p-7 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-sky-200 hover:shadow-xl hover:shadow-sky-500/5">
            <div>
              <div className="flex items-center justify-between">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-tr from-sky-500 to-cyan-500 text-white shadow-md shadow-sky-500/20">
                  <QrCode className="h-6 w-6" />
                </div>
                <span className="rounded-full border border-sky-200/80 bg-white/80 px-2.5 py-0.5 text-xs font-semibold text-sky-700 shadow-sm backdrop-blur">
                  Zero friction
                </span>
              </div>

              <h3 className="mt-5 text-lg font-bold text-slate-900 sm:text-xl">
                Seat-back QR & NFC
              </h3>

              <p className="mt-2.5 text-sm leading-relaxed text-slate-600">
                Generate high-resolution, print-ready QR codes for seat backs, banners, and bulletins, with PDF export. Program inexpensive NFC stickers using our built-in tag-writing assistant for a single-tap experience on iOS and Android.
              </p>
            </div>

            <div className="mt-6 flex items-center gap-2 text-xs font-medium text-sky-800">
              <Smartphone className="h-4 w-4 text-sky-600" />
              <span>Works directly in browser, no app download</span>
            </div>
          </div>

          {/* 4. Customisable Landing Page - 1 space */}
          <div className="group relative flex flex-col justify-between overflow-hidden rounded-3xl border border-amber-100 bg-gradient-to-br from-amber-50/80 via-yellow-50/30 to-white p-7 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-amber-200 hover:shadow-xl hover:shadow-amber-500/5">
            <div>
              <div className="flex items-center justify-between">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-tr from-amber-500 to-yellow-500 text-white shadow-md shadow-amber-500/20">
                  <Palette className="h-6 w-6" />
                </div>
                <span className="rounded-full border border-amber-200/80 bg-white/80 px-2.5 py-0.5 text-xs font-semibold text-amber-700 shadow-sm backdrop-blur">
                  Branded
                </span>
              </div>

              <h3 className="mt-5 text-lg font-bold text-slate-900 sm:text-xl">
                Customisable Landing Page
              </h3>

              <p className="mt-2.5 text-sm leading-relaxed text-slate-600">
                Shape your congregation’s digital hub with custom brand colors, logos, and Light, Dark, or Brand themes. Deliver slide announcements, personal sermon note-taking stored safely on device, and direct Austrian bank QR/IBAN transfer options.
              </p>
            </div>

            <div className="mt-6 flex items-center gap-2 text-xs font-medium text-amber-800">
              <CheckCircle2 className="h-4 w-4 text-amber-600" />
              <span>Full control over layouts, themes & notes</span>
            </div>
          </div>

          {/* 5. Planning Center Integration - 1 space */}
          <div className="group relative flex flex-col justify-between overflow-hidden rounded-3xl border border-emerald-100 bg-gradient-to-br from-emerald-50/80 via-teal-50/40 to-white p-7 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-emerald-200 hover:shadow-xl hover:shadow-emerald-500/5">
            <div>
              <div className="flex items-center justify-between">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-500 text-white shadow-md shadow-emerald-500/20">
                  <Layers className="h-6 w-6" />
                </div>
                <span className="rounded-full border border-emerald-200/80 bg-white/80 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 shadow-sm backdrop-blur">
                  Connected
                </span>
              </div>

              <h3 className="mt-5 text-lg font-bold text-slate-900 sm:text-xl">
                Planning Center Integration
              </h3>

              <p className="mt-2.5 text-sm leading-relaxed text-slate-600">
                Connect your Planning Center Services workflow directly. Sync service plans and order of worship, embed Church Center forms, and connect your giving portals without having to copy-paste service data into another tool every weekend.
              </p>
            </div>

            <div className="mt-6 flex items-center gap-2 text-xs font-medium text-emerald-800">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              <span>PCO Services & Church Center sync ready</span>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="mt-20 border-t border-slate-200/80 bg-white/60 py-10 text-center text-xs text-slate-500 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 sm:flex-row sm:px-6">
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-brand text-white text-[11px] font-bold">
              <Church className="h-3.5 w-3.5" />
            </div>
            <span className="font-semibold text-slate-700">Service Buttler</span>
          </div>
          <p>© {new Date().getFullYear()} Service Buttler · The modern live service companion for churches.</p>
        </div>
      </footer>
    </div>
  );
}
