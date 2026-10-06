import { ExternalLink, Plus, Trash2 } from 'lucide-react';
import { type FormEvent, useState } from 'react';
import { Button, Field, Input, Select, Textarea, Toggle, useToast } from '../../components/ui';
import { supabase, unwrap } from '../../lib/supabase';
import type { LandingConfig, LandingLink } from '../../lib/types';
import { errorMessage, landingUrl, timezones } from '../../lib/utils';
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

  const previewUrl = landingUrl(church.slug);

  return (
    <>
      <PageHeader
        title="Branding & landing page"
        description="Customize what attendees see when they scan the QR code or tap the NFC tag."
        actions={
          <a
            href={previewUrl}
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
              <Input value={landing.welcome_title || ''} onChange={(e) => setL({ welcome_title: e.target.value })} placeholder={`Welcome to ${church.name}`} />
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

          <div className="flex justify-end">
            <Button type="submit" loading={busy} disabled={!canAdmin}>
              Save changes
            </Button>
          </div>
        </form>

        {/* Live mobile preview */}
        <aside className="hidden lg:block">
          <div className="sticky top-20">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Live preview</span>
              <span className="text-xs text-slate-400">Updates on save</span>
            </div>
            <div className="mx-auto aspect-[9/18] w-full overflow-hidden rounded-3xl border-4 border-slate-800 shadow-2xl">
              <iframe src={`${previewUrl}?preview=1`} title="Live preview" className="h-full w-full bg-slate-100" />
            </div>
          </div>
        </aside>
      </div>
    </>
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
