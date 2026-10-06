import { Archive, Download, Inbox, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Button, ConfirmButton, EmptyState, PageLoader, Select, useToast } from '../../components/ui';
import { supabase, unwrap } from '../../lib/supabase';
import type { Action, ActionResponse } from '../../lib/types';
import { downloadCsv, errorMessage, formatInZone } from '../../lib/utils';
import { PageHeader } from './AdminLayout';
import { useAdmin } from './context';

export default function Responses() {
  const { church, canAdmin } = useAdmin();
  const toast = useToast();
  const [actions, setActions] = useState<Action[]>([]);
  const [selectedAction, setSelectedAction] = useState<string>('all');
  const [responses, setResponses] = useState<ActionResponse[] | null>(null);
  const [showArchived, setShowArchived] = useState(false);

  const load = useCallback(async () => {
    const [acts, resp] = await Promise.all([
      supabase.from('actions').select('*').eq('church_id', church.id).eq('type', 'form'),
      supabase
        .from('action_responses')
        .select('*')
        .eq('church_id', church.id)
        .eq('is_archived', showArchived)
        .order('created_at', { ascending: false }),
    ]);
    setActions(unwrap(acts) as Action[]);
    setResponses(unwrap(resp) as ActionResponse[]);
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

  const remove = async (r: ActionResponse) => {
    try {
      unwrap(await supabase.from('action_responses').delete().eq('id', r.id));
      toast('Response deleted');
      load();
    } catch (e) {
      toast(errorMessage(e), 'error');
    }
  };

  const exportCsv = () => {
    if (!responses || responses.length === 0) return;
    const allKeys = Array.from(new Set(responses.flatMap((r) => Object.keys(r.payload))));
    const header = ['Submitted At', 'Form', ...allKeys];
    const rows = responses.map((r) => {
      const act = actions.find((a) => a.id === r.action_id);
      return [r.created_at, act?.title || 'Unknown', ...allKeys.map((k) => r.payload[k] || '')];
    });
    downloadCsv(`${church.slug}-responses-${new Date().toISOString().slice(0, 10)}.csv`, [header, ...rows]);
  };

  if (!responses) return <PageLoader />;

  const filtered = responses.filter((r) => selectedAction === 'all' || r.action_id === selectedAction);

  return (
    <>
      <PageHeader
        title="Form responses"
        description="Prayer requests, connect cards and other submissions from attendees."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Select value={selectedAction} onChange={(e) => setSelectedAction(e.target.value)} className="w-auto">
              <option value="all">All forms</option>
              {actions.map((a) => (
                <option key={a.id} value={a.id}>{a.title}</option>
              ))}
            </Select>
            <Button variant="secondary" onClick={() => setShowArchived((v) => !v)}>
              {showArchived ? 'Show active' : 'Show archived'}
            </Button>
            <Button variant="secondary" onClick={exportCsv} disabled={filtered.length === 0}>
              <Download className="h-4 w-4" /> Export CSV
            </Button>
          </div>
        }
      />

      {filtered.length === 0 ? (
        <EmptyState
          icon={<Inbox className="h-10 w-10" />}
          title="No responses yet"
          description={showArchived ? 'No archived responses.' : 'Submissions from forms will appear here in real time.'}
        />
      ) : (
        <div className="space-y-3">
          {filtered.map((r) => {
            const act = actions.find((a) => a.id === r.action_id);
            return (
              <div key={r.id} className="card p-5">
                <div className="flex flex-wrap items-start justify-between gap-2 border-b border-slate-100 pb-3">
                  <div>
                    <span className="font-semibold text-slate-800">{act?.title || 'Form response'}</span>
                    <span className="ml-2 text-xs text-slate-500">
                      {formatInZone(r.created_at, church.timezone, { dateStyle: 'medium', timeStyle: 'short' })}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="ghost" size="sm" onClick={() => toggleArchive(r)}>
                      <Archive className="h-3.5 w-3.5" /> {r.is_archived ? 'Unarchive' : 'Archive'}
                    </Button>
                    {canAdmin && (
                      <ConfirmButton variant="ghost" size="sm" message="Delete this submission?" onConfirm={() => remove(r)} aria-label="Delete">
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </ConfirmButton>
                    )}
                  </div>
                </div>
                <dl className="mt-3 grid gap-2 sm:grid-cols-2">
                  {Object.entries(r.payload).map(([k, v]) => (
                    <div key={k} className="rounded-lg bg-slate-50 p-2.5">
                      <dt className="text-xs font-semibold uppercase tracking-wider text-slate-500">{k}</dt>
                      <dd className="mt-0.5 whitespace-pre-wrap text-sm text-slate-800">{v}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
