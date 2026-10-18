import { ArrowDown, ArrowUp, Clock, Eye, FastForward, LayoutList, Pencil, Pin, Plus, Radio, RefreshCw, Sparkles, Trash2 } from 'lucide-react';
import { type FormEvent, useCallback, useEffect, useState } from 'react';
import { Badge, Button, ConfirmButton, EmptyState, Field, Input, Modal, PageLoader, Select, Toggle, useToast } from '../../components/ui';
import { fetchPlanningCenterLive } from '../../lib/api';
import { supabase, unwrap } from '../../lib/supabase';
import { ACTION_TYPES, type Action, type ActionType, type Church, type LiveAction, type Service } from '../../lib/types';
import { brandStyle, describeOffsets, errorMessage } from '../../lib/utils';
import { ActionView } from '../live/ActionView';
import { THEMES } from '../live/LivePage';
import { ContentEditor, defaultContent, FORM_PRESETS, normalizeContent, validateContent } from './ActionEditors';
import { ActionsSubNav } from './ActionsSubNav';
import { PageHeader } from './AdminLayout';
import { WaterfallTimeline } from './WaterfallTimeline';
import { useAdmin } from './context';

export default function Actions() {
  const { church } = useAdmin();
  const toast = useToast();
  const [actions, setActions] = useState<Action[] | null>(null);
  const [services, setServices] = useState<Service[]>([]);
  const [serviceFilter, setServiceFilter] = useState<string>('all');
  const [editing, setEditing] = useState<Partial<Action> | null>(null);
  const [liveActionId, setLiveActionId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'timeline'>('list');
  const [pcoLive, setPcoLive] = useState<{
    live: boolean;
    currentItem?: string;
    delayMinutes: number;
    planTitle?: string;
  } | null>(null);
  const [checkingPco, setCheckingPco] = useState(false);

  const checkPco = useCallback(async () => {
    const pco = church.landing?.planning_center;
    if (!pco?.app_id || !pco?.secret) return;
    setCheckingPco(true);
    try {
      const res = await fetchPlanningCenterLive({
        app_id: pco.app_id,
        secret: pco.secret,
      });
      setPcoLive(res);
    } catch {
      /* ignore */
    } finally {
      setCheckingPco(false);
    }
  }, [church.landing?.planning_center]);

  useEffect(() => {
    checkPco();
  }, [checkPco]);

  const updateOffsets = async (actionId: string, start: number | null, end: number | null) => {
    try {
      unwrap(
        await supabase
          .from('actions')
          .update({ start_offset_minutes: start, end_offset_minutes: end })
          .eq('id', actionId),
      );
      load();
    } catch (e) {
      toast(errorMessage(e), 'error');
    }
  };

  const nudgeAction = async (actionId: string, deltaMinutes: number) => {
    const act = actions?.find((x) => x.id === actionId);
    if (!act) return;
    const start = (act.start_offset_minutes ?? 0) + deltaMinutes;
    const end = (act.end_offset_minutes ?? (act.start_offset_minutes ?? 0) + 20) + deltaMinutes;
    await updateOffsets(actionId, start, end);
    toast(`Timing nudged ${deltaMinutes > 0 ? `+${deltaMinutes}` : deltaMinutes}m`);
  };

  const applyPcoDelayToAll = async (delayMinutes: number) => {
    if (!actions) return;
    const targetServiceId =
      serviceFilter !== 'all' && serviceFilter !== 'church' ? serviceFilter : services[0]?.id;
    if (!targetServiceId) {
      toast('Please select a specific service to sync with PCO Live', 'error');
      return;
    }
    const targetActions = actions.filter((a) => a.service_id === targetServiceId);
    if (targetActions.length === 0) {
      toast('No actions found in this service to shift', 'error');
      return;
    }

    try {
      await Promise.all(
        targetActions.map((a) => {
          const s = (a.start_offset_minutes ?? 0) + delayMinutes;
          const e = (a.end_offset_minutes ?? (a.start_offset_minutes ?? 0) + 20) + delayMinutes;
          return supabase
            .from('actions')
            .update({ start_offset_minutes: s, end_offset_minutes: e })
            .eq('id', a.id);
        }),
      );
      toast(`Shifted ${targetActions.length} actions by +${delayMinutes}m to match stage clock`);
      load();
    } catch (e) {
      toast(errorMessage(e), 'error');
    }
  };

  const load = useCallback(async () => {
    const [acts, srvs] = await Promise.all([
      supabase.from('actions').select('*').eq('church_id', church.id).order('priority', { ascending: false }).order('sort_order').order('created_at'),
      supabase.from('services').select('*, service_times(*)').eq('church_id', church.id).order('name'),
    ]);
    setActions(unwrap(acts) as Action[]);
    const sList = unwrap(srvs) as Service[];
    setServices(sList);
    // Find any pinned action across services
    const pinned = sList.find((s) => s.live_action_id)?.live_action_id;
    setLiveActionId(pinned || null);
  }, [church.id]);

  useEffect(() => {
    load().catch((e) => toast(errorMessage(e), 'error'));
  }, [load, toast]);

  const remove = async (a: Action) => {
    try {
      unwrap(await supabase.from('actions').delete().eq('id', a.id));
      toast('Action deleted');
      load();
    } catch (e) {
      toast(errorMessage(e), 'error');
    }
  };

  const toggle = async (a: Action) => {
    try {
      unwrap(await supabase.from('actions').update({ is_active: !a.is_active }).eq('id', a.id));
      load();
    } catch (e) {
      toast(errorMessage(e), 'error');
    }
  };

  const pin = async (a: Action) => {
    if (!a.service_id) {
      toast('Only actions attached to a service can be pushed live.', 'error');
      return;
    }
    const isPinned = liveActionId === a.id;
    try {
      unwrap(await supabase.from('services').update({ live_action_id: isPinned ? null : a.id }).eq('id', a.service_id));
      toast(isPinned ? 'Live pin cleared' : `“${a.title}” is now pinned on top!`);
      load();
    } catch (e) {
      toast(errorMessage(e), 'error');
    }
  };

  const move = async (a: Action, dir: -1 | 1) => {
    if (!actions) return;
    const sameScope = actions.filter((x) => x.service_id === a.service_id);
    const i = sameScope.findIndex((x) => x.id === a.id);
    const target = sameScope[i + dir];
    if (!target) return;
    try {
      await Promise.all([
        supabase.from('actions').update({ sort_order: target.sort_order }).eq('id', a.id),
        supabase.from('actions').update({ sort_order: a.sort_order }).eq('id', target.id),
      ]);
      load();
    } catch (e) {
      toast(errorMessage(e), 'error');
    }
  };

  if (!actions) return <PageLoader />;

  const filtered = actions.filter((a) => {
    if (serviceFilter === 'all') return true;
    if (serviceFilter === 'church') return a.service_id === null;
    return a.service_id === serviceFilter;
  });

  return (
    <>
      <PageHeader
        title="Actions"
        description="The content attendees see on their phones during the service."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Select value={serviceFilter} onChange={(e) => setServiceFilter(e.target.value)} className="w-auto">
              <option value="all">All scopes</option>
              <option value="church">Church-wide (between services)</option>
              {services.map((s) => (
                <option key={s.id} value={s.id}>Service: {s.name}</option>
              ))}
            </Select>
            <Button
              onClick={() =>
                setEditing({
                  type: 'announcement',
                  service_id: serviceFilter !== 'all' && serviceFilter !== 'church' ? serviceFilter : services[0]?.id || null,
                  content: defaultContent('announcement'),
                  is_active: true,
                  priority: 0,
                  sort_order: (actions.length + 1) * 10,
                })
              }
            >
              <Plus className="h-4 w-4" /> New action
            </Button>
          </div>
        }
      />

      <ActionsSubNav current="actions" />

      {/* Planning Center Live status and sync alert */}
      {pcoLive?.live && pcoLive.delayMinutes > 0 && (
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-amber-500/10 border border-amber-500/30 px-5 py-3 text-sm text-amber-900 shadow-xs">
          <div className="flex items-center gap-2.5">
            <Radio className="h-5 w-5 text-amber-600 animate-pulse" />
            <div>
              <span className="font-bold">Planning Center Live:</span> Service is currently{' '}
              <span className="font-extrabold text-amber-700">{pcoLive.delayMinutes}m behind schedule</span> (current: {pcoLive.currentItem}).
            </div>
          </div>
          <Button
            variant="primary"
            size="sm"
            onClick={() => applyPcoDelayToAll(pcoLive.delayMinutes)}
            className="bg-amber-600 hover:bg-amber-700 text-white"
          >
            <FastForward className="h-4 w-4" /> Shift Service Actions (+{pcoLive.delayMinutes}m)
          </Button>
        </div>
      )}

      {/* View mode toggle */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-1 rounded-xl bg-slate-100 p-1 border border-slate-200/80">
          <button
            type="button"
            onClick={() => setViewMode('list')}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
              viewMode === 'list' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <LayoutList className="h-3.5 w-3.5" /> List View
          </button>
          <button
            type="button"
            onClick={() => setViewMode('timeline')}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
              viewMode === 'timeline' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Clock className="h-3.5 w-3.5" /> Waterfall Timeline
          </button>
        </div>

        {church.landing?.planning_center?.app_id && (
          <button
            type="button"
            onClick={checkPco}
            disabled={checkingPco}
            className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-800"
          >
            <RefreshCw className={`h-3 w-3 ${checkingPco ? 'animate-spin' : ''}`} />
            <span>PCO Live Status</span>
          </button>
        )}
      </div>

      {viewMode === 'timeline' && (
        <WaterfallTimeline
          actions={actions}
          services={services}
          selectedServiceId={serviceFilter}
          onSelectService={setServiceFilter}
          onUpdateOffsets={updateOffsets}
          onNudge={nudgeAction}
          onPin={pin}
          liveActionId={liveActionId}
          onEditAction={(a) => setEditing(a)}
          timezone={church.timezone}
        />
      )}

      {viewMode === 'list' && (
        <>
          {filtered.length === 0 ? (
            <EmptyState
              icon={<Sparkles className="h-10 w-10" />}
              title="No actions found"
              description="Actions show up on attendee phones based on the service schedule or when pinned live."
              action={
                <Button
                  onClick={() =>
                    setEditing({
                      type: 'announcement',
                      service_id: services[0]?.id || null,
                      content: defaultContent('announcement'),
                      is_active: true,
                    })
                  }
                >
                  Create action
                </Button>
              }
            />
          ) : (
            <div className="space-y-3">
              {filtered.map((a) => {
                const svc = services.find((s) => s.id === a.service_id);
                const isPinned = liveActionId === a.id;
                return (
                  <div key={a.id} className={`card flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between ${isPinned ? 'ring-2 ring-brand' : ''}`}>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold">{a.title}</span>
                        <Badge tone="brand">
                          {((a.content as Record<string, unknown>)?.form_type === 'question' ? 'question' : a.type).replace('_', ' ')}
                        </Badge>
                        {isPinned && <Badge tone="red">LIVE PINNED</Badge>}
                        {!a.is_active && <Badge tone="amber">Paused</Badge>}
                        {a.priority > 0 && <Badge>Priority {a.priority}</Badge>}
                      </div>
                      <div className="mt-1 flex flex-wrap gap-x-3 text-xs text-slate-500">
                        <span>{svc ? `Service: ${svc.name}` : 'Church-wide (between services)'}</span>
                        {svc && <span>· Time window: {describeOffsets(a.start_offset_minutes, a.end_offset_minutes)}</span>}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5">
                      {svc && (
                        <Button
                          variant={isPinned ? 'primary' : 'secondary'}
                          size="sm"
                          onClick={() => pin(a)}
                          title={isPinned ? 'Clear pin override' : 'Pin this action on top of attendee screens right now'}
                        >
                          <Pin className="h-3.5 w-3.5" /> {isPinned ? 'Pinned' : 'Push live'}
                        </Button>
                      )}
                      <Button variant="ghost" size="sm" onClick={() => toggle(a)}>
                        {a.is_active ? 'Pause' : 'Resume'}
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => setEditing(a)}>
                        <Pencil className="h-3.5 w-3.5" /> Edit
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => move(a, -1)} aria-label="Move up">
                        <ArrowUp className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => move(a, 1)} aria-label="Move down">
                        <ArrowDown className="h-3.5 w-3.5" />
                      </Button>
                      <ConfirmButton variant="ghost" size="sm" message={`Delete “${a.title}”?`} onConfirm={() => remove(a)} aria-label="Delete action">
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </ConfirmButton>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {editing && (
        <ActionModal
          initial={editing}
          church={church}
          services={services}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            load();
          }}
        />
      )}
    </>
  );
}

function ActionModal({
  initial,
  church,
  services,
  onClose,
  onSaved,
}: {
  initial: Partial<Action>;
  church: Church;
  services: Service[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const toast = useToast();
  const [form, setForm] = useState<Partial<Action>>(() => {
    const isQuestionFallback =
      initial.type === 'form' && (initial.content as Record<string, unknown>)?.form_type === 'question';
    const effectiveType = isQuestionFallback ? 'question' : (initial.type || 'announcement');
    return {
      ...initial,
      type: effectiveType,
      content: initial.content || defaultContent(effectiveType),
    };
  });
  const [busy, setBusy] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);

  const set = (patch: Partial<Action>) => setForm((f) => ({ ...f, ...patch }));

  const changeType = (t: ActionType) => {
    set({ type: t, content: defaultContent(t) });
  };

  const applyPreset = (presetKey: string) => {
    const p = FORM_PRESETS[presetKey];
    if (!p) return;
    set({ title: p.title, content: p.content as unknown as Record<string, unknown> });
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const type = form.type || 'announcement';
    const err = validateContent(type, form.content || {});
    if (err) {
      toast(err, 'error');
      return;
    }
    const start = form.start_offset_minutes !== undefined && form.start_offset_minutes !== null && form.start_offset_minutes !== ('' as unknown)
      ? Number(form.start_offset_minutes) : null;
    const end = form.end_offset_minutes !== undefined && form.end_offset_minutes !== null && form.end_offset_minutes !== ('' as unknown)
      ? Number(form.end_offset_minutes) : null;

    if (start !== null && end !== null && end <= start) {
      toast('End offset must be after start offset', 'error');
      return;
    }

    setBusy(true);
    const payload = {
      church_id: church.id,
      service_id: form.service_id || null,
      type,
      title: form.title?.trim(),
      content: normalizeContent(type, form.content || {}),
      start_offset_minutes: start,
      end_offset_minutes: end,
      priority: Number(form.priority) || 0,
      is_active: form.is_active ?? true,
      sort_order: Number(form.sort_order) || 0,
    };
    try {
      if (initial.id) unwrap(await supabase.from('actions').update(payload).eq('id', initial.id));
      else unwrap(await supabase.from('actions').insert(payload));
      toast('Action saved');
      onSaved();
    } catch (e) {
      if (type === 'question' && errorMessage(e).toLowerCase().includes('action_type')) {
        // Fallback for database instances where ALTER TYPE action_type ADD VALUE 'question' has not run yet
        const fallbackPayload = {
          ...payload,
          type: 'form',
          content: { ...payload.content, form_type: 'question' },
        };
        try {
          if (initial.id) unwrap(await supabase.from('actions').update(fallbackPayload).eq('id', initial.id));
          else unwrap(await supabase.from('actions').insert(fallbackPayload));
          toast('Action saved');
          onSaved();
          return;
        } catch (err2) {
          toast(errorMessage(err2), 'error');
          return;
        }
      }
      toast(errorMessage(e), 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open onClose={onClose} title={initial.id ? 'Edit action' : 'New action'} wide>
      <form onSubmit={submit} className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Action type">
            <Select value={form.type} onChange={(e) => changeType(e.target.value as ActionType)}>
              {ACTION_TYPES.map((t) => (
                <option key={t.type} value={t.type}>{t.label}</option>
              ))}
            </Select>
          </Field>
          <Field label="Service" hint="Attach to a service or leave church-wide.">
            <Select value={form.service_id || ''} onChange={(e) => set({ service_id: e.target.value || null })}>
              <option value="">Church-wide (between services)</option>
              {services.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </Select>
          </Field>
        </div>

        {form.type === 'form' && (
          <div className="flex items-center gap-2 text-xs">
            <span className="font-medium text-slate-500">Quick presets:</span>
            <button type="button" onClick={() => applyPreset('prayer')} className="rounded bg-slate-100 px-2 py-1 hover:bg-slate-200">
              Prayer request
            </button>
            <button type="button" onClick={() => applyPreset('connect')} className="rounded bg-slate-100 px-2 py-1 hover:bg-slate-200">
              Connect card
            </button>
          </div>
        )}

        <Field label="Title">
          <Input required value={form.title || ''} onChange={(e) => set({ title: e.target.value })} placeholder="Title shown to attendees" />
        </Field>

        <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4">
          <ContentEditor
            type={form.type || 'announcement'}
            value={form.content || {}}
            onChange={(c) => set({ content: c })}
            churchId={church.id}
            church={church}
          />
        </div>

        {form.service_id && (
          <div className="rounded-xl border border-slate-200 p-4">
            <h3 className="text-sm font-semibold text-slate-800">Time window</h3>
            <p className="mb-3 text-xs text-slate-500">
              Minutes relative to service start. Leave blank to span the entire live service window.
            </p>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Show starting at (min)" hint="e.g. 0 = service start, -15 = 15m before">
                <Input
                  type="number"
                  value={form.start_offset_minutes ?? ''}
                  onChange={(e) => set({ start_offset_minutes: e.target.value === '' ? null : Number(e.target.value) })}
                  placeholder="From start of live window"
                />
              </Field>
              <Field label="Hide at (min)" hint="e.g. 45 = 45m after start">
                <Input
                  type="number"
                  value={form.end_offset_minutes ?? ''}
                  onChange={(e) => set({ end_offset_minutes: e.target.value === '' ? null : Number(e.target.value) })}
                  placeholder="Until end of live window"
                />
              </Field>
            </div>
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Priority" hint="Higher numbers display above other live actions.">
            <Input type="number" value={form.priority ?? 0} onChange={(e) => set({ priority: Number(e.target.value) })} />
          </Field>
          <div className="pt-6">
            <Toggle checked={form.is_active ?? true} onChange={(v) => set({ is_active: v })} label="Active" description="Paused actions are never shown." />
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-slate-100 pt-3">
          <Button type="button" variant="ghost" size="sm" onClick={() => setPreviewOpen(true)}>
            <Eye className="h-4 w-4" /> Preview
          </Button>
          <div className="flex gap-2">
            <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
            <Button type="submit" loading={busy}>Save action</Button>
          </div>
        </div>
      </form>

      {previewOpen && (
        <Modal open onClose={() => setPreviewOpen(false)} title={`Action Preview: ${form.title || 'Untitled'}`}>
          <div
            className="mx-auto aspect-[9/16] max-h-[70vh] w-full max-w-sm overflow-y-auto rounded-2xl border-4 border-slate-800 bg-slate-100 p-4 shadow-xl select-none"
            style={brandStyle(church.primary_color, church.accent_color)}
          >
            <ActionView
              action={{
                id: form.id || 'preview',
                type: form.type || 'announcement',
                title: form.title || 'Action title',
                content: form.content || {},
                pinned: false,
                visible_until: null,
              } as LiveAction}
              theme={THEMES.light}
              preview={true}
              churchLanding={church.landing}
            />
          </div>
        </Modal>
      )}
    </Modal>
  );
}
