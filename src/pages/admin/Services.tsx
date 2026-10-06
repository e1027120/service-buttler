import { CalendarClock, Clock, Pencil, Plus, Trash2 } from 'lucide-react';
import { type FormEvent, useCallback, useEffect, useState } from 'react';
import { Badge, Button, ConfirmButton, EmptyState, Field, Input, Modal, PageLoader, Select, Textarea, Toggle, useToast } from '../../components/ui';
import { supabase, unwrap } from '../../lib/supabase';
import { DAYS, type Service, type ServiceTime } from '../../lib/types';
import { describeServiceTime, errorMessage, slugify } from '../../lib/utils';
import { PageHeader } from './AdminLayout';
import { useAdmin } from './context';

export default function Services() {
  const { church } = useAdmin();
  const toast = useToast();
  const [services, setServices] = useState<Service[] | null>(null);
  const [editing, setEditing] = useState<Partial<Service> | null>(null);
  const [addingTimeFor, setAddingTimeFor] = useState<Service | null>(null);

  const load = useCallback(async () => {
    const data = unwrap(
      await supabase
        .from('services')
        .select('*, service_times(*)')
        .eq('church_id', church.id)
        .order('sort_order')
        .order('created_at'),
    ) as Service[];
    data.forEach((s) =>
      s.service_times?.sort((a, b) => (a.specific_date || '').localeCompare(b.specific_date || '') || (a.day_of_week ?? 0) - (b.day_of_week ?? 0) || a.start_time.localeCompare(b.start_time)),
    );
    setServices(data);
  }, [church.id]);

  useEffect(() => {
    load().catch((e) => toast(errorMessage(e), 'error'));
  }, [load, toast]);

  const removeService = async (s: Service) => {
    try {
      unwrap(await supabase.from('services').delete().eq('id', s.id));
      toast('Service deleted');
      load();
    } catch (e) {
      toast(errorMessage(e), 'error');
    }
  };

  const removeTime = async (t: ServiceTime) => {
    try {
      unwrap(await supabase.from('service_times').delete().eq('id', t.id));
      load();
    } catch (e) {
      toast(errorMessage(e), 'error');
    }
  };

  const toggleTime = async (t: ServiceTime) => {
    try {
      unwrap(await supabase.from('service_times').update({ is_active: !t.is_active }).eq('id', t.id));
      load();
    } catch (e) {
      toast(errorMessage(e), 'error');
    }
  };

  if (!services) return <PageLoader />;

  return (
    <>
      <PageHeader
        title="Services & times"
        description={`Each service can run at multiple times. Times are in ${church.timezone}.`}
        actions={
          <Button onClick={() => setEditing({ lead_minutes: 15, trail_minutes: 30, is_active: true })}>
            <Plus className="h-4 w-4" /> New service
          </Button>
        }
      />

      {services.length === 0 ? (
        <EmptyState
          icon={<CalendarClock className="h-10 w-10" />}
          title="No services yet"
          description="Create a service (e.g. “Sunday Worship”) and add the times it takes place."
          action={<Button onClick={() => setEditing({ lead_minutes: 15, trail_minutes: 30, is_active: true })}>Create service</Button>}
        />
      ) : (
        <div className="space-y-4">
          {services.map((s) => (
            <section key={s.id} className="card">
              <header className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-semibold">{s.name}</h2>
                    {!s.is_active && <Badge tone="amber">Inactive</Badge>}
                  </div>
                  <p className="text-sm text-slate-500">
                    /c/{church.slug}/{s.slug} · live {s.lead_minutes} min before → {s.trail_minutes} min after
                  </p>
                  {s.description && <p className="mt-1 text-sm text-slate-600">{s.description}</p>}
                </div>
                <div className="flex gap-2">
                  <Button variant="secondary" size="sm" onClick={() => setEditing(s)}>
                    <Pencil className="h-3.5 w-3.5" /> Edit
                  </Button>
                  <ConfirmButton
                    variant="ghost"
                    size="sm"
                    message={`Delete “${s.name}” and all its times and actions?`}
                    onConfirm={() => removeService(s)}
                    aria-label="Delete service"
                  >
                    <Trash2 className="h-4 w-4 text-red-500" />
                  </ConfirmButton>
                </div>
              </header>
              <div className="p-5">
                {s.service_times && s.service_times.length > 0 ? (
                  <ul className="divide-y divide-slate-100">
                    {s.service_times.map((t) => (
                      <li key={t.id} className="flex items-center justify-between gap-3 py-2.5">
                        <div className="flex items-center gap-3">
                          <Clock className="h-4 w-4 text-slate-400" />
                          <span className={t.is_active ? 'text-slate-800' : 'text-slate-400 line-through'}>{describeServiceTime(t)}</span>
                          {t.label && <Badge>{t.label}</Badge>}
                          {t.specific_date && <Badge tone="brand">One-off</Badge>}
                        </div>
                        <div className="flex items-center gap-1">
                          <Button variant="ghost" size="sm" onClick={() => toggleTime(t)}>
                            {t.is_active ? 'Pause' : 'Resume'}
                          </Button>
                          <ConfirmButton variant="ghost" size="sm" message="Delete this time?" onConfirm={() => removeTime(t)} aria-label="Delete time">
                            <Trash2 className="h-4 w-4 text-slate-400" />
                          </ConfirmButton>
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-slate-500">No times yet — this service will never go live.</p>
                )}
                <Button variant="secondary" size="sm" className="mt-3" onClick={() => setAddingTimeFor(s)}>
                  <Plus className="h-3.5 w-3.5" /> Add time
                </Button>
              </div>
            </section>
          ))}
        </div>
      )}

      {editing && (
        <ServiceModal
          initial={editing}
          churchId={church.id}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            load();
          }}
        />
      )}
      {addingTimeFor && (
        <TimeModal
          service={addingTimeFor}
          onClose={() => setAddingTimeFor(null)}
          onSaved={() => {
            setAddingTimeFor(null);
            load();
          }}
        />
      )}
    </>
  );
}

function ServiceModal({ initial, churchId, onClose, onSaved }: { initial: Partial<Service>; churchId: string; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [form, setForm] = useState<Partial<Service>>(initial);
  const [slugTouched, setSlugTouched] = useState(Boolean(initial.id));
  const [busy, setBusy] = useState(false);
  const set = (patch: Partial<Service>) => setForm((f) => ({ ...f, ...patch }));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const payload = {
      church_id: churchId,
      name: form.name?.trim(),
      slug: form.slug,
      description: form.description || null,
      lead_minutes: Number(form.lead_minutes) || 0,
      trail_minutes: Number(form.trail_minutes) || 0,
      is_active: form.is_active ?? true,
    };
    try {
      if (initial.id) unwrap(await supabase.from('services').update(payload).eq('id', initial.id));
      else unwrap(await supabase.from('services').insert(payload));
      toast('Service saved');
      onSaved();
    } catch (err) {
      const msg = errorMessage(err);
      toast(msg.includes('duplicate') ? 'Another service already uses this URL.' : msg, 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open onClose={onClose} title={initial.id ? 'Edit service' : 'New service'}>
      <form onSubmit={submit} className="space-y-4">
        <Field label="Name">
          <Input
            required
            autoFocus
            value={form.name || ''}
            onChange={(e) => set({ name: e.target.value, ...(slugTouched ? {} : { slug: slugify(e.target.value) }) })}
            placeholder="Sunday Worship"
          />
        </Field>
        <Field label="URL slug" hint="Used for service-specific QR codes / NFC tags.">
          <Input
            required
            value={form.slug || ''}
            onChange={(e) => {
              setSlugTouched(true);
              set({ slug: slugify(e.target.value) });
            }}
          />
        </Field>
        <Field label="Description">
          <Textarea rows={2} value={form.description || ''} onChange={(e) => set({ description: e.target.value })} />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Go live before (min)" hint="Landing switches to this service early.">
            <Input type="number" min={0} max={240} value={form.lead_minutes ?? 15} onChange={(e) => set({ lead_minutes: Number(e.target.value) })} />
          </Field>
          <Field label="Stay live after (min)" hint="Keep content up after the end.">
            <Input type="number" min={0} max={240} value={form.trail_minutes ?? 30} onChange={(e) => set({ trail_minutes: Number(e.target.value) })} />
          </Field>
        </div>
        <Toggle checked={form.is_active ?? true} onChange={(v) => set({ is_active: v })} label="Active" description="Inactive services never go live." />
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={busy}>Save</Button>
        </div>
      </form>
    </Modal>
  );
}

function TimeModal({ service, onClose, onSaved }: { service: Service; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [mode, setMode] = useState<'weekly' | 'once'>('weekly');
  const [day, setDay] = useState(0);
  const [date, setDate] = useState('');
  const [start, setStart] = useState('10:00');
  const [end, setEnd] = useState('11:30');
  const [label, setLabel] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (end <= start) {
      toast('End time must be after start time', 'error');
      return;
    }
    setBusy(true);
    try {
      unwrap(
        await supabase.from('service_times').insert({
          service_id: service.id,
          day_of_week: mode === 'weekly' ? day : null,
          specific_date: mode === 'once' ? date : null,
          start_time: start,
          end_time: end,
          label: label || null,
        }),
      );
      toast('Time added');
      onSaved();
    } catch (err) {
      toast(errorMessage(err), 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open onClose={onClose} title={`Add time · ${service.name}`}>
      <form onSubmit={submit} className="space-y-4">
        <div className="inline-flex rounded-lg bg-slate-100 p-1">
          {(['weekly', 'once'] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium ${mode === m ? 'bg-white shadow' : 'text-slate-600'}`}
            >
              {m === 'weekly' ? 'Every week' : 'One-off date'}
            </button>
          ))}
        </div>
        {mode === 'weekly' ? (
          <Field label="Day">
            <Select value={day} onChange={(e) => setDay(Number(e.target.value))}>
              {DAYS.map((d, i) => (
                <option key={d} value={i}>{d}</option>
              ))}
            </Select>
          </Field>
        ) : (
          <Field label="Date">
            <Input type="date" required value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
        )}
        <div className="grid grid-cols-2 gap-4">
          <Field label="Start">
            <Input type="time" required value={start} onChange={(e) => setStart(e.target.value)} />
          </Field>
          <Field label="End">
            <Input type="time" required value={end} onChange={(e) => setEnd(e.target.value)} />
          </Field>
        </div>
        <Field label="Label (optional)">
          <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. Early service, Christmas Eve" />
        </Field>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={busy}>Add time</Button>
        </div>
      </form>
    </Modal>
  );
}
