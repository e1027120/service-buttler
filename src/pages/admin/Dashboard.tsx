import { CalendarClock, ExternalLink, Inbox, Pin, Sparkles, Users } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Badge, Button, PageLoader, useToast } from '../../components/ui';
import { supabase, unwrap } from '../../lib/supabase';
import type { Action, Service } from '../../lib/types';
import { describeOffsets, errorMessage, landingUrl } from '../../lib/utils';
import { PageHeader } from './AdminLayout';
import { useAdmin } from './context';

export default function Dashboard() {
  const { church } = useAdmin();
  const toast = useToast();
  const [services, setServices] = useState<Service[]>([]);
  const [actions, setActions] = useState<Action[]>([]);
  const [stats, setStats] = useState({ responses: 0, members: 0 });
  const [loading, setLoading] = useState(true);
  const [liveActionId, setLiveActionId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [srvRes, actRes, respRes, memRes] = await Promise.all([
      supabase.from('services').select('*, service_times(*)').eq('church_id', church.id).order('name'),
      supabase.from('actions').select('*').eq('church_id', church.id).order('priority', { ascending: false }),
      supabase.from('action_responses').select('id', { count: 'exact', head: true }).eq('church_id', church.id).eq('is_archived', false),
      supabase.from('church_members').select('user_id', { count: 'exact', head: true }).eq('church_id', church.id),
    ]);
    const sList = unwrap(srvRes) as Service[];
    setServices(sList);
    setActions(unwrap(actRes) as Action[]);
    setStats({ responses: respRes.count || 0, members: memRes.count || 0 });
    setLiveActionId(sList.find((s) => s.live_action_id)?.live_action_id || null);
    setLoading(false);
  }, [church.id]);

  useEffect(() => {
    load().catch((e) => toast(errorMessage(e), 'error'));
  }, [load, toast]);

  const togglePin = async (a: Action) => {
    if (!a.service_id) return;
    const isPinned = liveActionId === a.id;
    try {
      unwrap(await supabase.from('services').update({ live_action_id: isPinned ? null : a.id }).eq('id', a.service_id));
      toast(isPinned ? 'Live pin cleared' : `“${a.title}” is live on all attendee screens!`);
      load();
    } catch (e) {
      toast(errorMessage(e), 'error');
    }
  };

  if (loading) return <PageLoader />;

  const liveAction = actions.find((a) => a.id === liveActionId);
  const publicUrl = landingUrl(church.slug);

  return (
    <>
      <PageHeader
        title={church.name}
        description={`Timezone: ${church.timezone} · Public URL: ${publicUrl}`}
        actions={
          <a href={publicUrl} target="_blank" rel="noopener noreferrer" className="btn btn-secondary inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium hover:bg-slate-50">
            Open landing page <ExternalLink className="h-4 w-4" />
          </a>
        }
      />

      {/* Live control room banner */}
      <section className="card mb-6 border-l-4 border-l-brand p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex h-3 w-3 items-center justify-center">
                <span className={`inline-block h-2.5 w-2.5 rounded-full ${liveAction ? 'bg-red-500 animate-ping' : 'bg-slate-300'}`} />
              </span>
              <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-700">Live control room</h2>
            </div>
            {liveAction ? (
              <p className="mt-1 font-semibold text-slate-900">
                Pinned action: <span className="text-brand">“{liveAction.title}”</span> is currently forced on attendee screens.
              </p>
            ) : (
              <p className="mt-1 text-sm text-slate-500">
                Automatic schedule is running. Attendees will see actions according to their time windows.
              </p>
            )}
          </div>
          {liveAction && (
            <Button variant="secondary" size="sm" onClick={() => togglePin(liveAction)}>
              Clear manual pin
            </Button>
          )}
        </div>
      </section>

      {/* Quick stats */}
      <div className="mb-6 grid gap-4 sm:grid-cols-4">
        <StatCard icon={<CalendarClock className="h-5 w-5 text-brand" />} label="Services" value={services.length} to="services" />
        <StatCard icon={<Sparkles className="h-5 w-5 text-brand" />} label="Actions" value={actions.length} to="actions" />
        <StatCard icon={<Inbox className="h-5 w-5 text-brand" />} label="New responses" value={stats.responses} to="responses" />
        <StatCard icon={<Users className="h-5 w-5 text-brand" />} label="Team members" value={stats.members} to="team" />
      </div>

      {/* Quick live actions cue-sheet */}
      <section className="card mb-6">
        <header className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
          <h2 className="font-semibold text-slate-800">Quick cue sheet</h2>
          <Link to="actions" className="text-xs font-medium text-brand hover:underline">
            Manage all actions →
          </Link>
        </header>
        <div className="p-5">
          {actions.length === 0 ? (
            <p className="text-sm text-slate-500">No actions configured yet.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {actions.slice(0, 8).map((a) => {
                const svc = services.find((s) => s.id === a.service_id);
                const isPinned = liveActionId === a.id;
                return (
                  <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-sm font-medium">{a.title}</span>
                        <Badge tone="brand">{a.type.replace('_', ' ')}</Badge>
                        {isPinned && <Badge tone="red">LIVE</Badge>}
                      </div>
                      <span className="text-xs text-slate-500">
                        {svc ? `${svc.name} · ${describeOffsets(a.start_offset_minutes, a.end_offset_minutes)}` : 'Church-wide'}
                      </span>
                    </div>
                    {svc && (
                      <Button variant={isPinned ? 'primary' : 'secondary'} size="sm" onClick={() => togglePin(a)}>
                        <Pin className="h-3 w-3" /> {isPinned ? 'Pinned' : 'Push live'}
                      </Button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </section>
    </>
  );
}

function StatCard({ icon, label, value, to }: { icon: React.ReactNode; label: string; value: number; to: string }) {
  return (
    <Link to={to} className="card p-4 transition hover:border-slate-300 hover:shadow">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">{label}</span>
        {icon}
      </div>
      <div className="mt-2 text-2xl font-bold">{value}</div>
    </Link>
  );
}
