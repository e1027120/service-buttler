import { Church as ChurchIcon, LogOut, Plus } from 'lucide-react';
import { type FormEvent, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Badge, Button, EmptyState, Field, Input, Modal, PageLoader, Select, useToast } from '../../components/ui';
import { useAuth } from '../../lib/auth';
import { supabase, unwrap } from '../../lib/supabase';
import type { Church, Membership } from '../../lib/types';
import { errorMessage, slugify, timezones } from '../../lib/utils';

export default function ChurchPicker() {
  const { user, signOut } = useAuth();
  const [list, setList] = useState<Membership[] | null>(null);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    supabase
      .from('church_members')
      .select('church_id, role, churches(*)')
      .eq('user_id', user!.id)
      .then(({ data }) => {
        const l = ((data as unknown as Membership[]) || []).filter((m) => m.churches);
        setList(l.sort((a, b) => a.churches.name.localeCompare(b.churches.name)));
      });
  }, [user]);

  if (!list) return <PageLoader />;

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-4">
          <Link to="/" className="font-bold text-slate-900">Service Buttler</Link>
          <div className="flex items-center gap-3 text-sm text-slate-500">
            <span className="hidden sm:inline">{user?.email}</span>
            <Button variant="ghost" size="sm" onClick={signOut}>
              <LogOut className="h-4 w-4" /> Sign out
            </Button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-4xl px-4 py-10">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-bold">Your churches</h1>
          <Button onClick={() => setCreating(true)}>
            <Plus className="h-4 w-4" /> New church
          </Button>
        </div>

        {list.length === 0 ? (
          <EmptyState
            icon={<ChurchIcon className="h-10 w-10" />}
            title="No churches yet"
            description="Create your church to start configuring services and live actions. If a teammate invited you, ask them to use this email address."
            action={<Button onClick={() => setCreating(true)}>Create a church</Button>}
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {list.map((m) => (
              <Link key={m.church_id} to={`/admin/${m.church_id}`} className="card flex items-center gap-4 p-5 transition hover:border-slate-300 hover:shadow">
                {m.churches.logo_url ? (
                  <img src={m.churches.logo_url} alt="" className="h-12 w-12 rounded-xl object-contain" />
                ) : (
                  <span className="flex h-12 w-12 items-center justify-center rounded-xl text-lg font-bold text-white" style={{ background: m.churches.primary_color }}>
                    {m.churches.name.charAt(0)}
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <div className="truncate font-semibold">{m.churches.name}</div>
                  <div className="truncate text-sm text-slate-500">/c/{m.churches.slug}</div>
                </div>
                <Badge>{m.role}</Badge>
              </Link>
            ))}
          </div>
        )}
      </main>
      <CreateChurchModal open={creating} onClose={() => setCreating(false)} />
    </div>
  );
}

function CreateChurchModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate();
  const toast = useToast();
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [slugTouched, setSlugTouched] = useState(false);
  const [tz, setTz] = useState(Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC');
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const { data: auth } = await supabase.auth.getUser();
      const church = unwrap(
        await supabase
          .from('churches')
          .insert({ name: name.trim(), slug, timezone: tz, created_by: auth.user!.id, landing: { welcome_title: `Welcome to ${name.trim()}`, show_next_service: true } })
          .select()
          .single(),
      ) as Church;
      toast('Church created');
      navigate(`/admin/${church.id}/services`);
    } catch (err) {
      const msg = errorMessage(err);
      toast(msg.includes('duplicate') ? 'That URL is already taken — pick another.' : msg, 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Create a church">
      <form onSubmit={submit} className="space-y-4">
        <Field label="Church name">
          <Input
            required
            autoFocus
            maxLength={120}
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              if (!slugTouched) setSlug(slugify(e.target.value));
            }}
            placeholder="Grace Community Church"
          />
        </Field>
        <Field label="Public URL" hint={`${window.location.origin}/c/${slug || 'your-church'}`}>
          <Input
            required
            pattern="[a-z0-9][a-z0-9\-]{1,48}[a-z0-9]"
            title="3–50 lowercase letters, numbers or dashes"
            value={slug}
            onChange={(e) => {
              setSlugTouched(true);
              setSlug(slugify(e.target.value));
            }}
          />
        </Field>
        <Field label="Time zone" hint="Service times are interpreted in this time zone.">
          <Select value={tz} onChange={(e) => setTz(e.target.value)}>
            {timezones().map((z) => (
              <option key={z}>{z}</option>
            ))}
          </Select>
        </Field>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={busy}>Create church</Button>
        </div>
      </form>
    </Modal>
  );
}

