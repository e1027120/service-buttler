import {
  BookOpen,
  Calendar,
  Copy,
  Layers,
  Pencil,
  Plus,
  Radio,
  Search,
  Trash2,
  User,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import {
  Badge,
  Button,
  ConfirmButton,
  EmptyState,
  Input,
  useToast,
} from '../../components/ui';
import { getDefaultSermonRecord } from '../../lib/sermons';
import { supabase, unwrap } from '../../lib/supabase';
import type { Action, SermonNotesContent, SermonRecord } from '../../lib/types';
import { errorMessage, shortId } from '../../lib/utils';
import { ActionsSubNav } from './ActionsSubNav';
import { PageHeader } from './AdminLayout';
import { SermonEditorModal } from './SermonEditorModal';
import { useAdmin } from './context';

export default function SermonNotesLibrary() {
  const { church, reloadChurch, canAdmin } = useAdmin();
  const toast = useToast();

  const sermons = useMemo<SermonRecord[]>(() => {
    return (church.landing?.sermons || []) as SermonRecord[];
  }, [church.landing?.sermons]);

  const [search, setSearch] = useState('');
  const [editingSermon, setEditingSermon] = useState<Partial<SermonRecord> | null>(null);
  const [pushingId, setPushingId] = useState<string | null>(null);

  const filtered = sermons.filter((s) => {
    const q = search.toLowerCase();
    return (
      s.title.toLowerCase().includes(q) ||
      s.speaker?.toLowerCase().includes(q) ||
      s.main_verse?.toLowerCase().includes(q) ||
      s.date?.toLowerCase().includes(q)
    );
  });

  const saveSermon = async (saved: SermonRecord) => {
    const isNew = !sermons.some((s) => s.id === saved.id);
    const nextList = isNew
      ? [saved, ...sermons]
      : sermons.map((s) => (s.id === saved.id ? saved : s));

    const nextLanding = {
      ...(church.landing || {}),
      sermons: nextList,
    };

    unwrap(await supabase.from('churches').update({ landing: nextLanding }).eq('id', church.id));
    await reloadChurch();
    toast(isNew ? 'Sermon notes created and archived' : 'Sermon notes updated');
  };

  const duplicateSermon = async (sermon: SermonRecord) => {
    try {
      const cloned: SermonRecord = {
        ...sermon,
        id: shortId(),
        title: `${sermon.title} (Copy)`,
        slides: (sermon.slides || []).map((sl) => ({ ...sl, id: shortId() })),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const nextList = [cloned, ...sermons];
      const nextLanding = {
        ...(church.landing || {}),
        sermons: nextList,
      };

      unwrap(await supabase.from('churches').update({ landing: nextLanding }).eq('id', church.id));
      await reloadChurch();
      toast(`Duplicated "${sermon.title}"`);
    } catch (err) {
      toast(errorMessage(err), 'error');
    }
  };

  const removeSermon = async (id: string) => {
    try {
      const nextList = sermons.filter((s) => s.id !== id);
      const nextLanding = {
        ...(church.landing || {}),
        sermons: nextList,
      };

      unwrap(await supabase.from('churches').update({ landing: nextLanding }).eq('id', church.id));
      await reloadChurch();
      toast('Sermon deleted from archive');
    } catch (err) {
      toast(errorMessage(err), 'error');
    }
  };

  // Push sermon as a live Action
  const pushToActions = async (sermon: SermonRecord) => {
    setPushingId(sermon.id);
    try {
      const content: SermonNotesContent = {
        speaker: sermon.speaker,
        main_verse: sermon.main_verse,
        slides: sermon.slides,
        allow_personal_notes: sermon.allow_personal_notes,
        sermon_id: sermon.id,
      };

      // Check if there's already an existing action linked to this sermon
      const { data: existingActions } = await supabase
        .from('actions')
        .select('*')
        .eq('church_id', church.id)
        .eq('type', 'sermon_notes');

      const existing = (existingActions as Action[] | null)?.find(
        (a) => (a.content as SermonNotesContent)?.sermon_id === sermon.id,
      );

      if (existing) {
        unwrap(
          await supabase
            .from('actions')
            .update({
              title: sermon.title,
              content: content as Record<string, unknown>,
              updated_at: new Date().toISOString(),
            })
            .eq('id', existing.id),
        );
        toast(`Updated existing Live Action "${sermon.title}"`);
      } else {
        unwrap(
          await supabase.from('actions').insert({
            church_id: church.id,
            service_id: null,
            type: 'sermon_notes',
            title: sermon.title,
            content: content as Record<string, unknown>,
            is_active: true,
            priority: 50,
            sort_order: 10,
          }),
        );
        toast(`Created new Live Action for "${sermon.title}"!`);
      }
    } catch (err) {
      toast(errorMessage(err), 'error');
    } finally {
      setPushingId(null);
    }
  };

  return (
    <>
      <PageHeader
        title="Actions"
        description="Manage live interactive elements, reusable slides, and app deeplinks"
        actions={
          canAdmin && (
            <Button
              size="sm"
              onClick={() => setEditingSermon(getDefaultSermonRecord())}
              className="gap-1.5"
            >
              <Plus className="h-4 w-4" /> New Sermon Notes
            </Button>
          )
        }
      />

      <ActionsSubNav current="sermons" />

      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900">
            Sermon Notes Archive ({sermons.length})
          </h2>
          <p className="text-xs text-slate-500">
            Create and maintain your church's sermon notes archive. Attendees can browse past sermon outlines and connect their personal notes.
          </p>
        </div>

        {sermons.length > 2 && (
          <div className="relative w-full max-w-xs">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search sermons by title, speaker, scripture…"
              className="pl-9"
            />
          </div>
        )}
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={<BookOpen className="h-10 w-10" />}
          title={search ? 'No matching sermon notes found' : 'No sermon notes in the archive yet'}
          description={
            search
              ? 'Try searching with another keyword.'
              : 'Add sermon notes here with modular image and text slides. Stored sermons build your church history so attendees can revisit past outlines and notes anytime.'
          }
          action={
            canAdmin && !search && (
              <Button
                onClick={() => setEditingSermon(getDefaultSermonRecord())}
                className="gap-1.5"
              >
                <Plus className="h-4 w-4" /> Create First Sermon Notes
              </Button>
            )
          }
        />
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((sermon) => {
            const slideCount = sermon.slides?.length || 0;
            const dateStr = sermon.date
              ? new Date(sermon.date).toLocaleDateString(undefined, {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })
              : null;

            return (
              <div
                key={sermon.id}
                className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-slate-300 hover:shadow-md"
              >
                <div className="space-y-3.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1 min-w-0">
                      <h3 className="font-bold text-base text-slate-900 leading-snug line-clamp-1">
                        {sermon.title}
                      </h3>
                      <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
                        {dateStr && (
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3 text-slate-400" />
                            {dateStr}
                          </span>
                        )}
                        {sermon.speaker && (
                          <span className="flex items-center gap-1">
                            · <User className="h-3 w-3 text-slate-400" />
                            {sermon.speaker}
                          </span>
                        )}
                      </div>
                    </div>

                    {canAdmin && (
                      <div className="flex items-center gap-1 shrink-0">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => duplicateSermon(sermon)}
                          title="Duplicate sermon"
                          className="h-8 w-8 p-0"
                        >
                          <Copy className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setEditingSermon(sermon)}
                          title="Edit sermon"
                          className="h-8 w-8 p-0"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <ConfirmButton
                          size="sm"
                          variant="ghost"
                          onConfirm={() => removeSermon(sermon.id)}
                          message="Delete this sermon from your church archive?"
                          title="Delete sermon"
                          className="h-8 w-8 p-0 text-red-600 hover:bg-red-50 hover:text-red-700"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </ConfirmButton>
                      </div>
                    )}
                  </div>

                  {sermon.description && (
                    <p className="text-xs text-slate-600 line-clamp-2">
                      {sermon.description}
                    </p>
                  )}

                  {/* Badges */}
                  <div className="flex flex-wrap items-center gap-1.5 pt-1">
                    {sermon.main_verse && (
                      <Badge tone="brand">
                        <BookOpen className="h-3 w-3" />
                        {sermon.main_verse}
                      </Badge>
                    )}
                    <Badge tone="slate">
                      <Layers className="h-3 w-3" />
                      {slideCount} {slideCount === 1 ? 'Slide' : 'Slides'}
                    </Badge>
                    {sermon.allow_personal_notes && (
                      <Badge tone="green">
                        Personal Notes Active
                      </Badge>
                    )}
                  </div>

                  {/* Slides Preview strip */}
                  {slideCount > 0 && (
                    <div className="flex items-center gap-1.5 overflow-hidden rounded-xl bg-slate-50 p-2 border border-slate-100">
                      {sermon.slides.slice(0, 4).map((sl, i) => (
                        <div
                          key={sl.id || i}
                          className="relative h-10 w-14 shrink-0 overflow-hidden rounded-lg bg-white border border-slate-200"
                          title={sl.title || `Slide ${i + 1}`}
                        >
                          {sl.image_url ? (
                            <img src={sl.image_url} alt="" className="h-full w-full object-cover" />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-[10px] font-bold text-slate-400">
                              #{i + 1}
                            </div>
                          )}
                        </div>
                      ))}
                      {slideCount > 4 && (
                        <span className="text-[11px] font-bold text-slate-400 pl-1">
                          +{slideCount - 4}
                        </span>
                      )}
                    </div>
                  )}
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-[11px] text-slate-400">
                    ID: {sermon.id}
                  </span>

                  {canAdmin && (
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => pushToActions(sermon)}
                      loading={pushingId === sermon.id}
                      className="gap-1.5 text-xs text-brand hover:border-brand/40"
                    >
                      <Radio className="h-3.5 w-3.5 text-emerald-600" />
                      Make Live Action
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Sermon Editor Modal */}
      <SermonEditorModal
        open={Boolean(editingSermon)}
        onClose={() => setEditingSermon(null)}
        sermon={editingSermon}
        churchId={church.id}
        church={church}
        onSave={saveSermon}
      />
    </>
  );
}
