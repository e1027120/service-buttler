import { Archive, BarChart3, CheckCircle2, Clock, Download, HelpCircle, Inbox, MessageSquare, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Badge, Button, ConfirmButton, EmptyState, PageLoader, Select, useToast } from '../../components/ui';
import { supabase, unwrap } from '../../lib/supabase';
import type { Action, ActionResponse, PollContent, Service } from '../../lib/types';
import { downloadCsv, errorMessage, formatInZone } from '../../lib/utils';
import { PageHeader } from './AdminLayout';
import { useAdmin } from './context';

interface PollVote {
  id: string;
  action_id: string;
  option_id: string;
  voter_token: string;
  created_at: string;
}

type TabType = 'all' | 'questions' | 'forms' | 'polls';

function getServiceMatch(isoString: string, services: Service[], timezone: string): { key: string; label: string } {
  try {
    const d = new Date(isoString);
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      weekday: 'narrow',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(d);

    const get = (type: string) => parts.find((p) => p.type === type)?.value || '';
    const hour = parseInt(get('hour') || '0', 10);
    const min = parseInt(get('minute') || '0', 10);
    const minuteOfDay = hour * 60 + min;

    // Day of week in church timezone
    const dayStr = new Intl.DateTimeFormat('en-US', { timeZone: timezone, weekday: 'short' }).format(d);
    const dayMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
    const dayOfWeek = dayMap[dayStr] ?? -1;
    const dateStr = `${get('year')}-${get('month')}-${get('day')}`;

    for (const svc of services) {
      for (const t of svc.service_times || []) {
        if (!t.is_active) continue;
        const matchesDate = t.specific_date ? t.specific_date === dateStr : t.day_of_week === dayOfWeek;
        if (!matchesDate) continue;

        const [sh, sm] = t.start_time.split(':').map((x) => parseInt(x, 10));
        const [eh, em] = t.end_time.split(':').map((x) => parseInt(x, 10));
        const startMins = sh * 60 + sm - (svc.lead_minutes || 15);
        const endMins = eh * 60 + em + (svc.trail_minutes || 30);

        if (minuteOfDay >= startMins && minuteOfDay <= endMins) {
          const timeLabel = t.label ? `${svc.name} (${t.label})` : `${svc.name} (${t.start_time.slice(0, 5)})`;
          return { key: t.id, label: timeLabel };
        }
      }
    }
  } catch {
    /* ignore date parsing error */
  }

  return { key: 'outside', label: 'Between / Outside Services' };
}

export default function Responses() {
  const { church, canAdmin } = useAdmin();
  const toast = useToast();

  const [actions, setActions] = useState<Action[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [responses, setResponses] = useState<ActionResponse[] | null>(null);
  const [pollVotes, setPollVotes] = useState<PollVote[]>([]);
  const [tab, setTab] = useState<TabType>('all');
  const [selectedAction, setSelectedAction] = useState<string>('all');
  const [selectedServiceTime, setSelectedServiceTime] = useState<string>('all');
  const [showArchived, setShowArchived] = useState(false);
  const [groupByService, setGroupByService] = useState(false);

  const load = useCallback(async () => {
    const [acts, resp, srvs] = await Promise.all([
      supabase
        .from('actions')
        .select('*')
        .eq('church_id', church.id)
        .in('type', ['form', 'question', 'poll']),
      supabase
        .from('action_responses')
        .select('*')
        .eq('church_id', church.id)
        .eq('is_archived', showArchived)
        .order('created_at', { ascending: false }),
      supabase
        .from('services')
        .select('*, service_times(*)')
        .eq('church_id', church.id),
    ]);

    const actsList = (unwrap(acts) as Action[]) || [];
    setActions(actsList);
    setResponses((unwrap(resp) as ActionResponse[]) || []);
    setServices((unwrap(srvs) as Service[]) || []);

    // Load poll votes for any polls in this church
    const pollIds = actsList.filter((a) => a.type === 'poll').map((a) => a.id);
    if (pollIds.length > 0) {
      const { data: votesData } = await supabase
        .from('poll_votes')
        .select('*')
        .in('action_id', pollIds)
        .order('created_at', { ascending: false });
      setPollVotes((votesData as PollVote[]) || []);
    } else {
      setPollVotes([]);
    }
  }, [church.id, showArchived]);

  useEffect(() => {
    load().catch((e) => toast(errorMessage(e), 'error'));
  }, [load, toast]);

  const toggleArchive = async (r: ActionResponse) => {
    try {
      unwrap(await supabase.from('action_responses').update({ is_archived: !r.is_archived }).eq('id', r.id));
      load();
    } catch (e) {
      toast(errorMessage(e), 'error');
    }
  };

  const toggleAnswered = async (r: ActionResponse) => {
    try {
      const current = r.payload.answered === 'true';
      const updatedPayload = { ...r.payload, answered: String(!current) };
      unwrap(await supabase.from('action_responses').update({ payload: updatedPayload }).eq('id', r.id));
      setResponses((prev) =>
        prev ? prev.map((item) => (item.id === r.id ? { ...item, payload: updatedPayload } : item)) : null,
      );
      toast(current ? 'Marked unanswered' : 'Marked answered');
    } catch (e) {
      toast(errorMessage(e), 'error');
    }
  };

  const remove = async (r: ActionResponse) => {
    try {
      unwrap(await supabase.from('action_responses').delete().eq('id', r.id));
      toast('Response deleted');
      load();
    } catch (e) {
      toast(errorMessage(e), 'error');
    }
  };

  // Build service time options for filter dropdown
  const serviceTimeOptions = useMemo(() => {
    const list: { key: string; label: string }[] = [{ key: 'all', label: 'All Service Times' }];
    for (const s of services) {
      for (const t of s.service_times || []) {
        const timeLabel = t.label ? `${s.name} (${t.label})` : `${s.name} (${t.start_time.slice(0, 5)})`;
        list.push({ key: t.id, label: timeLabel });
      }
    }
    list.push({ key: 'outside', label: 'Between / Outside Services' });
    return list;
  }, [services]);

  // Filtered responses & votes
  const filteredResponses = useMemo(() => {
    if (!responses) return [];
    return responses.filter((r) => {
      const act = actions.find((a) => a.id === r.action_id);
      const isQuestion = act?.type === 'question' || r.payload.question !== undefined;

      // Tab filter
      if (tab === 'questions' && !isQuestion) return false;
      if (tab === 'forms' && (isQuestion || act?.type === 'poll')) return false;
      if (tab === 'polls') return false;

      // Action dropdown filter
      if (selectedAction !== 'all' && r.action_id !== selectedAction) return false;

      // Service time filter
      if (selectedServiceTime !== 'all') {
        const match = getServiceMatch(r.created_at, services, church.timezone);
        if (match.key !== selectedServiceTime) return false;
      }

      return true;
    });
  }, [responses, tab, selectedAction, selectedServiceTime, actions, services, church.timezone]);

  const filteredPolls = useMemo(() => {
    if (tab === 'questions' || tab === 'forms') return [];
    return actions.filter((a) => {
      if (a.type !== 'poll') return false;
      if (selectedAction !== 'all' && a.id !== selectedAction) return false;
      return true;
    });
  }, [tab, actions, selectedAction]);

  const exportCsv = () => {
    if (tab === 'polls') {
      const header = ['Submitted At', 'Poll Title', 'Option Voted', 'Voter Token'];
      const rows = pollVotes.map((v) => {
        const act = actions.find((a) => a.id === v.action_id);
        const pollContent = act?.content as PollContent | undefined;
        const opt = pollContent?.options?.find((o) => o.id === v.option_id);
        return [v.created_at, act?.title || 'Poll', opt?.label || v.option_id, v.voter_token];
      });
      downloadCsv(`${church.slug}-poll-votes-${new Date().toISOString().slice(0, 10)}.csv`, [header, ...rows]);
      return;
    }

    if (!responses || responses.length === 0) return;
    const allKeys = Array.from(new Set(responses.flatMap((r) => Object.keys(r.payload))));
    const header = ['Submitted At', 'Service Time', 'Action Title', 'Type', ...allKeys];
    const rows = filteredResponses.map((r) => {
      const act = actions.find((a) => a.id === r.action_id);
      const match = getServiceMatch(r.created_at, services, church.timezone);
      return [
        r.created_at,
        match.label,
        act?.title || 'Unknown',
        act?.type || (r.payload.question ? 'question' : 'form'),
        ...allKeys.map((k) => r.payload[k] || ''),
      ];
    });
    downloadCsv(`${church.slug}-responses-${new Date().toISOString().slice(0, 10)}.csv`, [header, ...rows]);
  };

  if (!responses) return <PageLoader />;

  // Group responses by service time if groupByService is enabled
  const groupedResponses = (() => {
    if (!groupByService) return null;
    const groups: Record<string, { label: string; items: ActionResponse[] }> = {};
    for (const r of filteredResponses) {
      const m = getServiceMatch(r.created_at, services, church.timezone);
      if (!groups[m.key]) {
        groups[m.key] = { label: m.label, items: [] };
      }
      groups[m.key].items.push(r);
    }
    return Object.entries(groups);
  })();

  const questionCount = responses.filter(
    (r) => actions.find((a) => a.id === r.action_id)?.type === 'question' || r.payload.question,
  ).length;
  const formCount = responses.filter(
    (r) => actions.find((a) => a.id === r.action_id)?.type === 'form' && !r.payload.question,
  ).length;
  const pollCount = pollVotes.length;

  return (
    <>
      <PageHeader
        title="Responses & Feedback"
        description="Attendee questions, prayer requests, connect cards, and live poll results grouped by service times."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Select value={selectedAction} onChange={(e) => setSelectedAction(e.target.value)} className="w-auto">
              <option value="all">All Actions</option>
              {actions.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.title} ({a.type})
                </option>
              ))}
            </Select>

            <Select value={selectedServiceTime} onChange={(e) => setSelectedServiceTime(e.target.value)} className="w-auto">
              {serviceTimeOptions.map((opt) => (
                <option key={opt.key} value={opt.key}>
                  {opt.label}
                </option>
              ))}
            </Select>

            <Button variant="secondary" onClick={() => setGroupByService((v) => !v)}>
              {groupByService ? 'Ungroup' : 'Group by Service'}
            </Button>

            <Button variant="secondary" onClick={() => setShowArchived((v) => !v)}>
              {showArchived ? 'Show Active' : 'Show Archived'}
            </Button>

            <Button variant="secondary" onClick={exportCsv} disabled={filteredResponses.length === 0 && pollVotes.length === 0}>
              <Download className="h-4 w-4" /> Export CSV
            </Button>
          </div>
        }
      />

      {/* Navigation tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-3 mb-6 overflow-x-auto">
        <button
          type="button"
          onClick={() => setTab('all')}
          className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition ${
            tab === 'all'
              ? 'bg-brand text-white shadow-sm shadow-brand/20'
              : 'text-slate-600 hover:bg-slate-100 bg-white border border-slate-200/80'
          }`}
        >
          <Inbox className="h-4 w-4" /> All Submissions
        </button>

        <button
          type="button"
          onClick={() => setTab('questions')}
          className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition ${
            tab === 'questions'
              ? 'bg-brand text-white shadow-sm shadow-brand/20'
              : 'text-slate-600 hover:bg-slate-100 bg-white border border-slate-200/80'
          }`}
        >
          <HelpCircle className="h-4 w-4" /> Questions (Q&A)
          {questionCount > 0 && <span className="ml-1 rounded-full bg-brand-muted px-2 py-0.5 text-xs font-bold text-brand">{questionCount}</span>}
        </button>

        <button
          type="button"
          onClick={() => setTab('forms')}
          className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition ${
            tab === 'forms'
              ? 'bg-brand text-white shadow-sm shadow-brand/20'
              : 'text-slate-600 hover:bg-slate-100 bg-white border border-slate-200/80'
          }`}
        >
          <MessageSquare className="h-4 w-4" /> Form Cards
          {formCount > 0 && <span className="ml-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-700">{formCount}</span>}
        </button>

        <button
          type="button"
          onClick={() => setTab('polls')}
          className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition ${
            tab === 'polls'
              ? 'bg-brand text-white shadow-sm shadow-brand/20'
              : 'text-slate-600 hover:bg-slate-100 bg-white border border-slate-200/80'
          }`}
        >
          <BarChart3 className="h-4 w-4" /> Live Polls
          {pollCount > 0 && <span className="ml-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-700">{pollCount}</span>}
        </button>
      </div>

      {/* Live Polls Section */}
      {(tab === 'all' || tab === 'polls') && filteredPolls.length > 0 && (
        <div className="mb-8 space-y-4">
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-brand" /> Live Poll Results
          </h2>
          <div className="grid gap-4 md:grid-cols-2">
            {filteredPolls.map((poll) => {
              const c = poll.content as PollContent;
              const votes = pollVotes.filter((v) => v.action_id === poll.id);
              const total = votes.length;
              const options = c.options || [];

              return (
                <div key={poll.id} className="card p-5">
                  <div className="flex items-start justify-between gap-2 border-b border-slate-100 pb-3">
                    <div>
                      <h3 className="font-semibold text-slate-800">{poll.title}</h3>
                      {c.question && <p className="text-sm text-slate-600 mt-0.5">{c.question}</p>}
                    </div>
                    <Badge tone="brand">{total} {total === 1 ? 'vote' : 'votes'}</Badge>
                  </div>

                  <div className="mt-4 space-y-3">
                    {options.map((opt) => {
                      const count = votes.filter((v) => v.option_id === opt.id).length;
                      const pct = total > 0 ? Math.round((count / total) * 100) : 0;
                      return (
                        <div key={opt.id} className="space-y-1">
                          <div className="flex justify-between text-xs font-semibold text-slate-700">
                            <span>{opt.label}</span>
                            <span>{count} ({pct}%)</span>
                          </div>
                          <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
                            <div
                              className="h-full rounded-full bg-brand transition-all duration-500"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Main Submissions List */}
      {tab !== 'polls' && (
        <>
          {filteredResponses.length === 0 ? (
            <EmptyState
              icon={<Inbox className="h-10 w-10" />}
              title="No responses found"
              description={showArchived ? 'No archived responses.' : 'Submissions from attendees will appear here in real time.'}
            />
          ) : groupByService && groupedResponses ? (
            <div className="space-y-6">
              {groupedResponses.map(([groupKey, group]) => (
                <div key={groupKey} className="space-y-3">
                  <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
                    <Clock className="h-4 w-4 text-brand" />
                    <h3 className="text-sm font-bold uppercase tracking-wider text-slate-700">{group.label}</h3>
                    <span className="text-xs text-slate-400">({group.items.length})</span>
                  </div>
                  {group.items.map((r) => (
                    <ResponseCard
                      key={r.id}
                      response={r}
                      actions={actions}
                      church={church}
                      services={services}
                      canAdmin={canAdmin}
                      onToggleArchive={toggleArchive}
                      onToggleAnswered={toggleAnswered}
                      onRemove={remove}
                    />
                  ))}
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              {filteredResponses.map((r) => (
                <ResponseCard
                  key={r.id}
                  response={r}
                  actions={actions}
                  church={church}
                  services={services}
                  canAdmin={canAdmin}
                  onToggleArchive={toggleArchive}
                  onToggleAnswered={toggleAnswered}
                  onRemove={remove}
                />
              ))}
            </div>
          )}
        </>
      )}
    </>
  );
}

function ResponseCard({
  response: r,
  actions,
  church,
  services,
  canAdmin,
  onToggleArchive,
  onToggleAnswered,
  onRemove,
}: {
  response: ActionResponse;
  actions: Action[];
  church: { id: string; timezone: string };
  services: Service[];
  canAdmin: boolean;
  onToggleArchive: (r: ActionResponse) => void;
  onToggleAnswered: (r: ActionResponse) => void;
  onRemove: (r: ActionResponse) => void;
}) {
  const act = actions.find((a) => a.id === r.action_id);
  const isQuestion = act?.type === 'question' || r.payload.question !== undefined;
  const isAnswered = r.payload.answered === 'true';
  const serviceMatch = getServiceMatch(r.created_at, services, church.timezone);

  return (
    <div className={`card p-5 transition ${isAnswered ? 'bg-slate-50/80 border-slate-200/60' : 'bg-white'}`}>
      <div className="flex flex-wrap items-start justify-between gap-2 border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-semibold text-slate-900">{act?.title || (isQuestion ? 'Q&A Question' : 'Form response')}</span>
          {isQuestion && (
            <Badge tone={isAnswered ? 'slate' : 'brand'}>
              {isAnswered ? 'Answered' : 'Q&A Question'}
            </Badge>
          )}
          <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs text-slate-600 font-medium">
            <Clock className="h-3 w-3" /> {serviceMatch.label}
          </span>
          <span className="text-xs text-slate-400">
            {formatInZone(r.created_at, church.timezone, { dateStyle: 'medium', timeStyle: 'short' })}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {isQuestion && (
            <Button
              variant={isAnswered ? 'secondary' : 'primary'}
              size="sm"
              onClick={() => onToggleAnswered(r)}
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              {isAnswered ? 'Mark Unanswered' : 'Mark Answered'}
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={() => onToggleArchive(r)}>
            <Archive className="h-3.5 w-3.5" /> {r.is_archived ? 'Unarchive' : 'Archive'}
          </Button>
          {canAdmin && (
            <ConfirmButton variant="ghost" size="sm" message="Delete this submission?" onConfirm={() => onRemove(r)} aria-label="Delete">
              <Trash2 className="h-4 w-4 text-red-500" />
            </ConfirmButton>
          )}
        </div>
      </div>

      {isQuestion ? (
        <div className="mt-3 space-y-2">
          <div className="rounded-xl bg-slate-50 p-4 border border-slate-100">
            <p className="text-sm font-medium text-slate-900 whitespace-pre-wrap">{r.payload.question}</p>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span>Submitted by:</span>
            <span className="font-semibold text-slate-700">
              {r.payload.is_anonymous === 'true' || !r.payload.author_name ? 'Anonymous Attendee' : r.payload.author_name}
            </span>
          </div>
        </div>
      ) : (
        <dl className="mt-3 grid gap-2 sm:grid-cols-2">
          {Object.entries(r.payload)
            .filter(([k]) => k !== 'answered')
            .map(([k, v]) => (
              <div key={k} className="rounded-lg bg-slate-50 p-2.5">
                <dt className="text-xs font-semibold uppercase tracking-wider text-slate-500">{k}</dt>
                <dd className="mt-0.5 whitespace-pre-wrap text-sm text-slate-800">{v}</dd>
              </div>
            ))}
        </dl>
      )}
    </div>
  );
}
