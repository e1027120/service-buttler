import { CalendarClock, ExternalLink, Plus, Trash2 } from 'lucide-react';
import { type FormEvent, useState } from 'react';
import { Markdown } from '../../components/Markdown';
import { Button, Field, Input, Select, Textarea, Toggle, cx, useToast } from '../../components/ui';
import { supabase, unwrap } from '../../lib/supabase';
import type { LandingConfig, LandingLink } from '../../lib/types';
import { brandStyle, errorMessage, landingUrl, timezones } from '../../lib/utils';
import { THEMES } from '../live/LivePage';
import { PageHeader } from './AdminLayout';
import { ImageInput } from './ImageInput';
import { useAdmin } from './context';

export default function Branding() {
  const { church, reloadChurch, canAdmin } = useAdmin();
  const toast = useToast();
  const [name, setName] = useState(church.name);
  const [tz, setTz] = useState(church.timezone);
  const [logoUrl, setLogoUrl] = useState<string | undefined>(church.logo_url || undefined);
  const [primary, setPrimary] = useState(church.primary_color);
  const [accent, setAccent] = useState(church.accent_color);
  const [landing, setLanding] = useState<LandingConfig>(church.landing || {});
  const [busy, setBusy] = useState(false);

  const setL = (patch: Partial<LandingConfig>) => setLanding((l) => ({ ...l, ...patch }));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!canAdmin) {
      toast('Only owners and admins can update branding', 'error');
      return;
    }
    setBusy(true);
    try {
      unwrap(
        await supabase
          .from('churches')
          .update({
            name: name.trim(),
            timezone: tz,
            logo_url: logoUrl || null,
            primary_color: primary,
            accent_color: accent,
            landing,
          })
          .eq('id', church.id),
      );
      toast('Branding and landing page saved');
      await reloadChurch();
    } catch (err) {
      toast(errorMessage(err), 'error');
    } finally {
      setBusy(false);
    }
  };

  const publicLandingUrl = landingUrl(church.slug);

  return (
    <>
      <PageHeader
        title="Branding & landing page"
        description="Customize what attendees see when they scan the QR code or tap the NFC tag."
        actions={
          <a
            href={publicLandingUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium hover:bg-slate-50"
          >
            Open landing page <ExternalLink className="h-4 w-4" />
          </a>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        {/* Settings form */}
        <form onSubmit={submit} className="space-y-6">
          <section className="card p-5 space-y-4">
            <h2 className="text-base font-semibold">General</h2>
            <Field label="Church name">
              <Input required value={name} onChange={(e) => setName(e.target.value)} />
            </Field>
            <Field label="Time zone">
              <Select value={tz} onChange={(e) => setTz(e.target.value)}>
                {timezones().map((z) => (
                  <option key={z}>{z}</option>
                ))}
              </Select>
            </Field>
            <ImageInput churchId={church.id} label="Logo" value={logoUrl} onChange={setLogoUrl} />
          </section>

          <section className="card p-5 space-y-4">
            <h2 className="text-base font-semibold">Colors & theme</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Primary color" hint="Buttons, badges, highlights">
                <div className="flex gap-2">
                  <input type="color" value={primary} onChange={(e) => setPrimary(e.target.value)} className="h-10 w-12 cursor-pointer rounded border border-slate-200 bg-transparent p-1" />
                  <Input value={primary} onChange={(e) => setPrimary(e.target.value)} pattern="^#[0-9a-fA-F]{6}$" />
                </div>
              </Field>
              <Field label="Accent color">
                <div className="flex gap-2">
                  <input type="color" value={accent} onChange={(e) => setAccent(e.target.value)} className="h-10 w-12 cursor-pointer rounded border border-slate-200 bg-transparent p-1" />
                  <Input value={accent} onChange={(e) => setAccent(e.target.value)} pattern="^#[0-9a-fA-F]{6}$" />
                </div>
              </Field>
            </div>
            <Field label="Landing theme">
              <Select value={landing.theme || 'light'} onChange={(e) => setL({ theme: e.target.value as LandingConfig['theme'] })}>
                <option value="light">Light (clean white card on light grey)</option>
                <option value="dark">Dark (cinematic dark mode)</option>
                <option value="brand">Brand background (uses your primary color)</option>
              </Select>
            </Field>
          </section>

          <section className="card p-5 space-y-4">
            <h2 className="text-base font-semibold">Welcome & between-services screen</h2>
            <p className="text-xs text-slate-500">Shown when no service action is active.</p>
            <ImageInput churchId={church.id} label="Hero image" value={landing.hero_image_url} onChange={(url) => setL({ hero_image_url: url })} />
            <Field label="Welcome title">
              <Input value={landing.welcome_title || ''} onChange={(e) => setL({ welcome_title: e.target.value })} placeholder={`Welcome to ${name || 'our church'}`} />
            </Field>
            <Field label="Welcome message" hint="Markdown supported">
              <Textarea rows={3} value={landing.welcome_message || ''} onChange={(e) => setL({ welcome_message: e.target.value })} placeholder="We are glad you are here with us today." />
            </Field>
            <div className="space-y-3 pt-2">
              <Toggle checked={landing.show_service_name !== false} onChange={(b) => setL({ show_service_name: b })} label="Show service name in header" />
              <Toggle checked={landing.show_next_service !== false} onChange={(b) => setL({ show_next_service: b })} label="Show next upcoming service countdown" />
            </div>
          </section>

          <section className="card p-5 space-y-4">
            <h2 className="text-base font-semibold">Footer links</h2>
            <LinksEditor links={landing.links || []} onChange={(l) => setL({ links: l })} />
            <Field label="Footer note">
              <Input value={landing.footer_text || ''} onChange={(e) => setL({ footer_text: e.target.value })} placeholder="© 2026 Grace Community Church" />
            </Field>
          </section>

          <section className="card p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold">Planning Center Online (PCO)</h2>
                <p className="text-xs text-slate-500">
                  Connect your Planning Center account to easily select signup forms and events in your announcement CTAs.
                </p>
              </div>
            </div>

            <Field
              label="Church Center Subdomain"
              hint="e.g. 'grace' for grace.churchcenter.com"
            >
              <div className="flex items-center">
                <span className="rounded-l-lg border border-r-0 border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-500">
                  https://
                </span>
                <Input
                  value={landing.planning_center?.church_center_subdomain || ''}
                  onChange={(e) =>
                    setL({
                      planning_center: {
                        ...(landing.planning_center || {}),
                        church_center_subdomain: e.target.value.trim().toLowerCase(),
                      },
                    })
                  }
                  placeholder="yourchurch"
                  className="rounded-none"
                />
                <span className="rounded-r-lg border border-l-0 border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-500">
                  .churchcenter.com
                </span>
              </div>
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label="Application ID (Personal Access Token)"
                hint="Created at api.planningcenteronline.com"
              >
                <Input
                  value={landing.planning_center?.app_id || ''}
                  onChange={(e) =>
                    setL({
                      planning_center: {
                        ...(landing.planning_center || {}),
                        app_id: e.target.value.trim(),
                      },
                    })
                  }
                  placeholder="e.g. 5a1b2c3d4e..."
                />
              </Field>
              <Field
                label="Secret"
                hint="Personal Access Token secret"
              >
                <Input
                  type="password"
                  value={landing.planning_center?.secret || ''}
                  onChange={(e) =>
                    setL({
                      planning_center: {
                        ...(landing.planning_center || {}),
                        secret: e.target.value.trim(),
                      },
                    })
                  }
                  placeholder="••••••••••••••••"
                />
              </Field>
            </div>
          </section>

          <div className="flex justify-end">
            <Button type="submit" loading={busy} disabled={!canAdmin}>
              Save changes
            </Button>
          </div>
        </form>

        {/* Live mobile preview without iframes or flickering */}
        <aside className="hidden lg:block">
          <div className="sticky top-20">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Live preview</span>
              <span className="text-xs font-medium text-brand">Real-time</span>
            </div>
            <div className="mx-auto aspect-[9/18] w-full overflow-hidden rounded-3xl border-4 border-slate-800 shadow-2xl">
              <PhonePreview
                name={name}
                logoUrl={logoUrl}
                primary={primary}
                accent={accent}
                landing={landing}
              />
            </div>
          </div>
        </aside>
      </div>
    </>
  );
}

function PhonePreview({
  name,
  logoUrl,
  primary,
  accent,
  landing,
}: {
  name: string;
  logoUrl?: string;
  primary: string;
  accent: string;
  landing: LandingConfig;
}) {
  const theme = THEMES[landing.theme || 'light'];
  const welcomeTitle = landing.welcome_title || `Welcome to ${name || 'our church'}`;
  const welcomeMessage = landing.welcome_message || 'We are glad you are here with us today.';

  return (
    <div
      className={cx('h-full w-full overflow-y-auto p-4 text-left transition-colors duration-200 select-none', theme.page)}
      style={brandStyle(primary, accent)}
    >
      {/* Phone status bar simulation */}
      <div className="mb-3 flex items-center justify-between text-[11px] opacity-60">
        <span className="font-semibold">9:41</span>
        <div className="flex items-center gap-1">
          <span className="h-1.5 w-1.5 rounded-full bg-current" />
          <span className="h-2 w-3 rounded-sm border border-current" />
        </div>
      </div>

      {/* Header */}
      <header className="mb-4 flex items-center justify-between gap-2 border-b border-black/5 pb-3">
        <div className="flex min-w-0 items-center gap-2.5">
          {logoUrl ? (
            <img src={logoUrl} alt="" className="h-8 w-8 shrink-0 rounded-lg bg-white object-contain p-0.5 shadow-sm" />
          ) : (
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand font-bold text-white shadow-sm text-sm">
              {(name || 'C').charAt(0)}
            </span>
          )}
          <div className="min-w-0">
            <p className="truncate text-xs font-semibold leading-tight">{name || 'Your Church'}</p>
            {landing.show_service_name !== false && (
              <p className="truncate text-[10px] opacity-70">Sunday Worship</p>
            )}
          </div>
        </div>
        <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-red-500 px-2 py-0.5 text-[9px] font-bold text-white">
          LIVE
        </span>
      </header>

      {/* Main card */}
      <article className={cx('overflow-hidden rounded-2xl shadow-md transition-colors', theme.card)}>
        {landing.hero_image_url && (
          <img src={landing.hero_image_url} alt="" className="aspect-[16/9] w-full object-cover" />
        )}
        <div className="space-y-3 p-4">
          <h1 className="text-base font-bold leading-snug">{welcomeTitle}</h1>
          <div className={cx('text-xs', theme.muted)}>
            <Markdown>{welcomeMessage}</Markdown>
          </div>
          {landing.show_next_service !== false && (
            <div className={cx('flex items-center gap-2.5 rounded-xl p-2.5', theme.chip)}>
              <CalendarClock className="h-4 w-4 shrink-0 text-brand" />
              <div className="text-[11px]">
                <p className="font-semibold">Sunday Service</p>
                <p className="opacity-75">Sun 10:00 AM</p>
              </div>
            </div>
          )}
        </div>
      </article>

      {/* Footer */}
      {(landing.links?.length || landing.footer_text) && (
        <footer className="mt-5 space-y-2 text-center text-[11px]">
          {landing.links && landing.links.length > 0 && (
            <div className="flex flex-wrap justify-center gap-1.5">
              {landing.links.map((l, i) => (
                <span
                  key={i}
                  className={cx('rounded-full px-2.5 py-1 font-medium', landing.theme === 'brand' ? 'bg-white/15 text-white' : theme.chip)}
                >
                  {l.label || 'Link'}
                </span>
              ))}
            </div>
          )}
          {landing.footer_text && <p className="text-[10px] opacity-70">{landing.footer_text}</p>}
        </footer>
      )}
    </div>
  );
}

function LinksEditor({ links, onChange }: { links: LandingLink[]; onChange: (l: LandingLink[]) => void }) {
  const add = () => onChange([...links, { label: '', url: '' }]);
  const update = (i: number, patch: Partial<LandingLink>) => onChange(links.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const remove = (i: number) => onChange(links.filter((_, j) => j !== i));
  return (
    <div className="space-y-2">
      {links.map((l, i) => (
        <div key={i} className="flex gap-2">
          <Input value={l.label} onChange={(e) => update(i, { label: e.target.value })} placeholder="Label (e.g. Website)" />
          <Input type="url" value={l.url} onChange={(e) => update(i, { url: e.target.value })} placeholder="https://" />
          <button type="button" onClick={() => remove(i)} className="rounded p-2 text-slate-400 hover:text-red-500">
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      ))}
      <Button type="button" variant="secondary" size="sm" onClick={add}>
        <Plus className="h-3.5 w-3.5" /> Add footer link
      </Button>
    </div>
  );
}
