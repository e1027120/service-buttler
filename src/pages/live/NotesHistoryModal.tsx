import {
  BookOpen,
  Calendar,
  Check,
  ChevronDown,
  ChevronUp,
  Download,
  FileText,
  Library,
  PenLine,
  Search,
  Share2,
  Trash2,
  X,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { cx } from '../../components/ui';
import {
  clearAllSavedSermonNotes,
  deleteSavedSermonNote,
  getAllSavedSermonNotes,
  saveSermonNote,
  type SavedSermonNote,
} from '../../lib/notes';
import type { LandingConfig, SermonRecord } from '../../lib/types';

interface NotesHistoryModalProps {
  open: boolean;
  onClose: () => void;
  churchName?: string;
  churchSlug?: string;
  landingConfig?: LandingConfig;
}

export function NotesHistoryModal({
  open,
  onClose,
  churchName,
  churchSlug,
  landingConfig,
}: NotesHistoryModalProps) {
  const [activeTab, setActiveTab] = useState<'my_notes' | 'archive'>('my_notes');
  const [search, setSearch] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [version, setVersion] = useState(0); // For re-rendering after delete/clear/edit
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState('');

  // Load all saved sermon notes from localStorage
  const allNotes = useMemo(() => {
    return getAllSavedSermonNotes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version, open]);

  // Church sermons archive from landing config
  const churchSermons = useMemo<SermonRecord[]>(() => {
    return (landingConfig?.sermons || []) as SermonRecord[];
  }, [landingConfig?.sermons]);

  // Map notes by sermonId or actionId for quick linking
  const notesBySermonId = useMemo(() => {
    const map = new Map<string, SavedSermonNote>();
    for (const note of allNotes) {
      if (note.sermonId) {
        map.set(note.sermonId, note);
      }
      map.set(note.actionId, note);
    }
    return map;
  }, [allNotes]);

  // Filter personal notes based on search query
  const filteredNotes = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return allNotes;
    return allNotes.filter((n) => {
      const matchTitle = n.title?.toLowerCase().includes(q);
      const matchSpeaker = n.speaker?.toLowerCase().includes(q);
      const matchVerse = n.mainVerse?.toLowerCase().includes(q);
      const matchNotes = n.notes?.toLowerCase().includes(q);
      const matchChurch = n.churchName?.toLowerCase().includes(q);
      const matchService = n.serviceName?.toLowerCase().includes(q);
      return matchTitle || matchSpeaker || matchVerse || matchNotes || matchChurch || matchService;
    });
  }, [allNotes, search]);

  // Filter church archive sermons based on search query
  const filteredArchive = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return churchSermons;
    return churchSermons.filter((s) => {
      const matchTitle = s.title?.toLowerCase().includes(q);
      const matchSpeaker = s.speaker?.toLowerCase().includes(q);
      const matchVerse = s.main_verse?.toLowerCase().includes(q);
      const matchDesc = s.description?.toLowerCase().includes(q);
      const matchDate = s.date?.toLowerCase().includes(q);
      const matchSlides = s.slides?.some(
        (sl) =>
          sl.title?.toLowerCase().includes(q) ||
          sl.body?.toLowerCase().includes(q) ||
          sl.verse_reference?.toLowerCase().includes(q)
      );
      return matchTitle || matchSpeaker || matchVerse || matchDesc || matchDate || matchSlides;
    });
  }, [churchSermons, search]);

  if (!open) return null;

  // Share or copy a single note
  const handleShareNote = async (note: SavedSermonNote) => {
    const textLines = [
      note.title,
      note.speaker ? `Speaker: ${note.speaker}` : '',
      note.mainVerse ? `Scripture: ${note.mainVerse}` : '',
      note.date ? `Date: ${new Date(note.date).toLocaleDateString()}` : '',
      note.churchName ? `Church: ${note.churchName}` : '',
      '',
      '— Personal Notes —',
      note.notes,
    ].filter(Boolean);

    const shareContent = textLines.join('\n');

    if (navigator.share) {
      try {
        await navigator.share({
          title: note.title,
          text: shareContent,
        });
        return;
      } catch {
        /* share dismissed or unsupported, fall back to clipboard */
      }
    }

    try {
      await navigator.clipboard.writeText(shareContent);
      setCopiedId(note.actionId);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      alert('Could not copy to clipboard.');
    }
  };

  // Export / share ALL notes as a single structured document or file
  const handleExportAll = async () => {
    if (allNotes.length === 0) return;

    const sections = allNotes.map((note, idx) => {
      return [
        `========================================`,
        `NOTE ${idx + 1}: ${note.title.toUpperCase()}`,
        note.speaker ? `Speaker: ${note.speaker}` : '',
        note.mainVerse ? `Scripture: ${note.mainVerse}` : '',
        note.date ? `Date: ${new Date(note.date).toLocaleDateString()}` : '',
        note.churchName ? `Church: ${note.churchName}` : '',
        `----------------------------------------`,
        note.notes,
        `========================================\n`,
      ]
        .filter(Boolean)
        .join('\n');
    });

    const exportText = [
      `MY SERMON REFLECTIONS & NOTES`,
      `Exported on: ${new Date().toLocaleString()}`,
      `Total Notes: ${allNotes.length}`,
      '\n',
      ...sections,
    ].join('\n');

    // If native share is available with files or text
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'My Saved Sermon Notes',
          text: exportText,
        });
        return;
      } catch {
        /* share dismissed or not accepted */
      }
    }

    // Download as a .txt file fallback
    const blob = new Blob([exportText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sermon-notes-${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDelete = (actionId: string, title: string) => {
    if (confirm(`Delete your notes for "${title}" from this device?`)) {
      deleteSavedSermonNote(actionId);
      setVersion((v) => v + 1);
    }
  };

  const handleClearAll = () => {
    if (confirm('Are you sure you want to delete ALL saved notes from this device? This action cannot be undone.')) {
      clearAllSavedSermonNotes();
      setVersion((v) => v + 1);
    }
  };

  const handleStartEdit = (note: SavedSermonNote) => {
    setEditingNoteId(note.actionId);
    setEditingText(note.notes || '');
  };

  const handleSaveEdit = (note: SavedSermonNote) => {
    saveSermonNote(note.actionId, editingText, {
      sermonId: note.sermonId,
      churchSlug: note.churchSlug,
      churchName: note.churchName,
      serviceName: note.serviceName,
      title: note.title,
      speaker: note.speaker,
      mainVerse: note.mainVerse,
      slides: note.slides,
      fullSermonText: note.fullSermonText,
    });
    setEditingNoteId(null);
    setVersion((v) => v + 1);
  };

  // Add notes to an archive sermon
  const handleAddNoteToArchiveSermon = (sermon: SermonRecord) => {
    const existing = notesBySermonId.get(sermon.id);
    const actionId = existing?.actionId || `sermon_${sermon.id}`;
    const initialText = existing?.notes || '';

    // Build full outline text
    const fullOutline = [
      sermon.title,
      sermon.speaker ? `Speaker: ${sermon.speaker}` : '',
      sermon.main_verse ? `Scripture: ${sermon.main_verse}` : '',
      sermon.description || '',
      '',
      ...(sermon.slides || []).map((s, i) => {
        const prefix = s.show_number ? `${s.slide_number?.trim() || i + 1}. ` : '';
        return [
          s.title ? `${prefix}${s.title}` : (prefix ? `Point ${prefix.trim()}` : ''),
          s.verse_reference ? `Verse: ${s.verse_reference}` : '',
          s.body || '',
        ]
          .filter(Boolean)
          .join('\n');
      }),
    ]
      .filter(Boolean)
      .join('\n\n');

    saveSermonNote(actionId, initialText, {
      sermonId: sermon.id,
      churchSlug,
      churchName,
      title: sermon.title,
      speaker: sermon.speaker,
      mainVerse: sermon.main_verse,
      slides: sermon.slides,
      fullSermonText: fullOutline,
    });

    setActiveTab('my_notes');
    setEditingNoteId(actionId);
    setEditingText(initialText);
    setVersion((v) => v + 1);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/60 p-0 sm:items-center sm:p-4 backdrop-blur-sm animate-fade-in">
      <div className="flex max-h-[92vh] w-full max-w-xl flex-col rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand/10 text-brand">
              <BookOpen className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 leading-tight">Sermon & Personal Notes</h2>
              <p className="text-xs text-slate-500">
                {churchName ? `${churchName} · Stored privately on this device` : 'Stored privately on this browser / device'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-200 bg-slate-50/90 px-4 pt-2">
          <button
            type="button"
            onClick={() => setActiveTab('my_notes')}
            className={cx(
              'flex items-center gap-2 border-b-2 px-4 py-2.5 text-xs font-bold transition',
              activeTab === 'my_notes'
                ? 'border-brand text-brand'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            )}
          >
            <FileText className="h-3.5 w-3.5" />
            My Saved Notes ({allNotes.length})
          </button>
          {churchSermons.length > 0 && (
            <button
              type="button"
              onClick={() => setActiveTab('archive')}
              className={cx(
                'flex items-center gap-2 border-b-2 px-4 py-2.5 text-xs font-bold transition',
                activeTab === 'archive'
                  ? 'border-brand text-brand'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              )}
            >
              <Library className="h-3.5 w-3.5" />
              Sermon Archive ({churchSermons.length})
            </button>
          )}
        </div>

        {/* Search & Actions Bar */}
        <div className="border-b border-slate-100 bg-slate-50/70 p-3 space-y-2.5">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={
                activeTab === 'my_notes'
                  ? 'Search by sermon, scripture, speaker, notes…'
                  : 'Search sermon archive by title, speaker, passage…'
              }
              className="w-full rounded-xl border border-slate-200 bg-white pl-9 pr-8 py-2 text-sm text-slate-800 placeholder-slate-400 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-2.5 top-2.5 text-xs text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            )}
          </div>

          {activeTab === 'my_notes' && allNotes.length > 0 && (
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span>{filteredNotes.length} {filteredNotes.length === 1 ? 'note' : 'notes'} found</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleExportAll}
                  className="inline-flex items-center gap-1 font-semibold text-brand hover:underline"
                >
                  <Download className="h-3.5 w-3.5" /> Save / Export all
                </button>
                <span className="text-slate-300">·</span>
                <button
                  type="button"
                  onClick={handleClearAll}
                  className="inline-flex items-center gap-1 text-slate-400 hover:text-red-600"
                >
                  Clear all
                </button>
              </div>
            </div>
          )}

          {activeTab === 'archive' && churchSermons.length > 0 && (
            <div className="text-xs text-slate-500">
              <span>{filteredArchive.length} past sermon{filteredArchive.length === 1 ? '' : 's'} available to browse</span>
            </div>
          )}
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {activeTab === 'my_notes' ? (
            /* Tab 1: My Personal Notes */
            filteredNotes.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <FileText className="h-10 w-10 text-slate-300 stroke-[1.5]" />
                <p className="mt-3 text-sm font-semibold text-slate-700">
                  {search ? 'No notes matched your search' : 'No notes saved yet'}
                </p>
                <p className="mt-1 max-w-xs text-xs text-slate-500">
                  {search
                    ? 'Try searching for another keyword or clear the search field.'
                    : 'Whenever you write notes during sermon slides, they will automatically be saved and accessible here.'}
                </p>
                {churchSermons.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setActiveTab('archive')}
                    className="mt-4 rounded-xl bg-brand/10 px-4 py-2 text-xs font-semibold text-brand hover:bg-brand/20 transition"
                  >
                    Browse Church Sermon Archive
                  </button>
                )}
              </div>
            ) : (
              filteredNotes.map((note) => {
                const isExpanded = expandedId === note.actionId;
                const isCopied = copiedId === note.actionId;
                const isEditing = editingNoteId === note.actionId;
                const dateStr = note.date
                  ? new Date(note.date).toLocaleDateString(undefined, {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })
                  : null;

                return (
                  <div
                    key={note.actionId}
                    className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-slate-300 space-y-2.5"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h3 className="font-bold text-slate-900 text-sm leading-snug truncate">
                          {note.title}
                        </h3>
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-500 mt-0.5">
                          {dateStr && <span>{dateStr}</span>}
                          {note.speaker && (
                            <>
                              <span>·</span>
                              <span>{note.speaker}</span>
                            </>
                          )}
                          {note.mainVerse && (
                            <>
                              <span>·</span>
                              <span className="font-medium text-brand">{note.mainVerse}</span>
                            </>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleStartEdit(note)}
                          title="Edit my personal notes"
                          className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition"
                        >
                          <PenLine className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleShareNote(note)}
                          title="Share or copy this note"
                          className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition"
                        >
                          {isCopied ? (
                            <Check className="h-4 w-4 text-emerald-600" />
                          ) : (
                            <Share2 className="h-4 w-4" />
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(note.actionId, note.title)}
                          title="Delete note"
                          className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 transition"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>

                    {/* Inline Editing Form */}
                    {isEditing ? (
                      <div className="space-y-2 rounded-xl bg-slate-50 p-3 border border-slate-200">
                        <label className="text-xs font-semibold text-slate-700">Edit Personal Notes</label>
                        <textarea
                          rows={4}
                          value={editingText}
                          onChange={(e) => setEditingText(e.target.value)}
                          placeholder="Write your notes here..."
                          className="w-full rounded-lg border border-slate-200 bg-white p-2.5 text-xs text-slate-800 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
                        />
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => setEditingNoteId(null)}
                            className="rounded-lg px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-200 transition"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSaveEdit(note)}
                            className="rounded-lg bg-brand px-3 py-1 text-xs font-semibold text-white hover:opacity-90 transition"
                          >
                            Save changes
                          </button>
                        </div>
                      </div>
                    ) : (
                      /* Display Content */
                      <div className="space-y-2">
                        {note.fullSermonText && (
                          <div className="flex items-center gap-1 border-b border-slate-100 pb-1 text-[11px] font-semibold">
                            <button
                              type="button"
                              onClick={() => setExpandedId(isExpanded ? null : note.actionId)}
                              className={cx(
                                'rounded-md px-2 py-0.5 transition',
                                !isExpanded ? 'bg-slate-100 text-slate-700 font-bold' : 'text-slate-400 hover:text-slate-600'
                              )}
                            >
                              Personal Notes
                            </button>
                            <button
                              type="button"
                              onClick={() => setExpandedId(isExpanded ? null : note.actionId)}
                              className={cx(
                                'rounded-md px-2 py-0.5 transition',
                                isExpanded ? 'bg-brand/10 text-brand font-bold' : 'text-slate-400 hover:text-slate-600'
                              )}
                            >
                              Full Sermon Outline & Slides
                            </button>
                          </div>
                        )}

                        <div className="max-h-60 overflow-y-auto rounded-xl bg-slate-50 p-3 text-xs text-slate-700 leading-relaxed font-sans border border-slate-100">
                          {isExpanded && note.fullSermonText ? (
                            <div className="space-y-2 whitespace-pre-wrap text-slate-800">
                              <p className="font-semibold text-slate-900 border-b border-slate-200 pb-1 text-[11px] uppercase tracking-wide">
                                Sermon Outline & Slides
                              </p>
                              <p>{note.fullSermonText}</p>
                            </div>
                          ) : (
                            <div className="whitespace-pre-wrap">
                              {note.notes ? (
                                note.notes
                              ) : (
                                <span className="italic text-slate-400">No personal text written yet.</span>
                              )}
                            </div>
                          )}
                        </div>

                        <div className="flex items-center justify-between text-[11px]">
                          {note.fullSermonText ? (
                            <button
                              type="button"
                              onClick={() => setExpandedId(isExpanded ? null : note.actionId)}
                              className="inline-flex items-center gap-1 font-semibold text-brand hover:underline"
                            >
                              {isExpanded ? (
                                <>
                                  <ChevronUp className="h-3 w-3" /> Show my personal notes
                                </>
                              ) : (
                                <>
                                  <ChevronDown className="h-3 w-3" /> View full sermon outline & slides
                                </>
                              )}
                            </button>
                          ) : (
                            <span className="text-slate-400">Personal notes only</span>
                          )}

                          <span className="text-slate-400">
                            {note.notes ? `${note.notes.trim().split(/\s+/).filter(Boolean).length} words` : '0 words'}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )
          ) : (
            /* Tab 2: Church Sermon Archive */
            filteredArchive.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Library className="h-10 w-10 text-slate-300 stroke-[1.5]" />
                <p className="mt-3 text-sm font-semibold text-slate-700">
                  {search ? 'No sermons matched your search' : 'No past sermons in the archive yet'}
                </p>
                <p className="mt-1 max-w-xs text-xs text-slate-500">
                  {search
                    ? 'Try searching with a different keyword.'
                    : 'The church has not published past sermon notes to this library yet.'}
                </p>
              </div>
            ) : (
              filteredArchive.map((sermon) => {
                const userNote = notesBySermonId.get(sermon.id);
                const isExpanded = expandedId === sermon.id;

                return (
                  <div
                    key={sermon.id}
                    className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-slate-300 space-y-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="font-bold text-slate-900 text-sm leading-snug">
                          {sermon.title}
                        </h3>
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-500 mt-1">
                          {sermon.date && (
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3 w-3 text-slate-400" />
                              {new Date(sermon.date).toLocaleDateString(undefined, {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric',
                              })}
                            </span>
                          )}
                          {sermon.speaker && (
                            <>
                              <span>·</span>
                              <span>{sermon.speaker}</span>
                            </>
                          )}
                          {sermon.main_verse && (
                            <>
                              <span>·</span>
                              <span className="font-semibold text-brand">{sermon.main_verse}</span>
                            </>
                          )}
                        </div>
                        {sermon.description && (
                          <p className="text-xs text-slate-600 mt-1.5 line-clamp-2">
                            {sermon.description}
                          </p>
                        )}
                      </div>

                      <div className="shrink-0 flex flex-col items-end gap-1.5">
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
                          {sermon.slides?.length || 0} slides
                        </span>
                        {userNote ? (
                          <span className="rounded-full bg-emerald-50 text-emerald-700 px-2 py-0.5 text-[10px] font-bold">
                            Notes saved
                          </span>
                        ) : null}
                      </div>
                    </div>

                    {/* Sermon Slides preview */}
                    {isExpanded && sermon.slides && sermon.slides.length > 0 && (
                      <div className="space-y-2 border-t border-slate-100 pt-3">
                        <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                          Sermon Slides & Points ({sermon.slides.length})
                        </p>
                        <div className="max-h-72 overflow-y-auto space-y-2 pr-1">
                          {sermon.slides.map((sl, idx) => (
                            <div
                              key={sl.id || idx}
                              className="rounded-xl border border-slate-100 bg-slate-50/70 p-3 text-xs text-slate-700 space-y-1"
                            >
                              {sl.is_full_image && sl.image_url ? (
                                <div className="overflow-hidden rounded-lg">
                                  <img
                                    src={sl.image_url}
                                    alt={`Slide ${idx + 1}`}
                                    className="max-h-40 w-full object-cover"
                                  />
                                </div>
                              ) : (
                                <>
                                  <div className="flex items-center gap-1.5 font-bold text-slate-900">
                                    {sl.show_number && (
                                      <span className="flex h-4 min-w-[16px] px-1 items-center justify-center rounded-full bg-brand/10 text-[10px] text-brand">
                                        {sl.slide_number?.trim() || idx + 1}
                                      </span>
                                    )}
                                    <span>{sl.title || (sl.show_number ? `Point ${sl.slide_number?.trim() || idx + 1}` : 'Slide Point')}</span>
                                  </div>
                                  {sl.verse_reference && (
                                    <p className="font-semibold text-brand text-[11px]">
                                      {sl.verse_reference}
                                    </p>
                                  )}
                                  {sl.body && (
                                    <p className="whitespace-pre-wrap text-slate-600">
                                      {sl.body}
                                    </p>
                                  )}
                                  {sl.image_url && !sl.is_full_image && (
                                    <img
                                      src={sl.image_url}
                                      alt=""
                                      className="mt-1 h-24 w-full rounded-lg object-cover"
                                    />
                                  )}
                                </>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Actions on this sermon */}
                    <div className="flex items-center justify-between border-t border-slate-100 pt-2 text-xs">
                      <button
                        type="button"
                        onClick={() => setExpandedId(isExpanded ? null : sermon.id)}
                        className="inline-flex items-center gap-1 font-semibold text-brand hover:underline"
                      >
                        {isExpanded ? (
                          <>
                            <ChevronUp className="h-3 w-3" /> Hide slides outline
                          </>
                        ) : (
                          <>
                            <ChevronDown className="h-3 w-3" /> View sermon outline & slides
                          </>
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={() => handleAddNoteToArchiveSermon(sermon)}
                        className="inline-flex items-center gap-1 rounded-lg bg-brand/10 px-2.5 py-1 text-xs font-bold text-brand hover:bg-brand/20 transition"
                      >
                        <PenLine className="h-3.5 w-3.5" />
                        {userNote ? 'View / Edit My Notes' : 'Take Notes on this Sermon'}
                      </button>
                    </div>
                  </div>
                );
              })
            )
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-slate-100 bg-slate-50/50 px-5 py-3 flex justify-between items-center text-xs text-slate-500">
          <span>Notes are saved only in your device's browser</span>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl bg-slate-200 px-4 py-2 font-semibold text-slate-700 hover:bg-slate-300 transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
