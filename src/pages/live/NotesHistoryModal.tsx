import {
  BookOpen,
  Check,
  ChevronDown,
  ChevronUp,
  Download,
  FileText,
  Search,
  Share2,
  Trash2,
  X,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import {
  clearAllSavedSermonNotes,
  deleteSavedSermonNote,
  getAllSavedSermonNotes,
  type SavedSermonNote,
} from '../../lib/notes';

interface NotesHistoryModalProps {
  open: boolean;
  onClose: () => void;
  churchName?: string;
}

export function NotesHistoryModal({
  open,
  onClose,
  churchName,
}: NotesHistoryModalProps) {
  const [search, setSearch] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [version, setVersion] = useState(0); // For re-rendering after delete/clear

  // Load all saved sermon notes from localStorage
  const allNotes = useMemo(() => {
    return getAllSavedSermonNotes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version, open]);

  // Filter notes based on search query
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

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/60 p-0 sm:items-center sm:p-4 backdrop-blur-sm animate-fade-in">
      <div className="flex max-h-[90vh] w-full max-w-lg flex-col rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand/10 text-brand">
              <BookOpen className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 leading-tight">My Saved Notes</h2>
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

        {/* Search & Actions Bar */}
        <div className="border-b border-slate-100 bg-slate-50/70 p-3 space-y-2.5">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by sermon, scripture, speaker, notes…"
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

          {allNotes.length > 0 && (
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
        </div>

        {/* Notes List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {filteredNotes.length === 0 ? (
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
            </div>
          ) : (
            filteredNotes.map((note) => {
              const isExpanded = expandedId === note.actionId;
              const isCopied = copiedId === note.actionId;
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
                  className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-slate-300 space-y-2"
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

                  {/* Notes Content */}
                  <div className="rounded-xl bg-slate-50 p-3 text-xs text-slate-700 leading-relaxed font-sans">
                    <p className={isExpanded ? 'whitespace-pre-wrap' : 'line-clamp-3 whitespace-pre-wrap'}>
                      {note.notes || <span className="italic text-slate-400">No personal text written.</span>}
                    </p>
                    {note.notes && note.notes.length > 150 && (
                      <button
                        type="button"
                        onClick={() => setExpandedId(isExpanded ? null : note.actionId)}
                        className="mt-2 inline-flex items-center gap-0.5 text-[11px] font-semibold text-brand hover:underline"
                      >
                        {isExpanded ? (
                          <>
                            Show less <ChevronUp className="h-3 w-3" />
                          </>
                        ) : (
                          <>
                            Read full note <ChevronDown className="h-3 w-3" />
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-slate-100 bg-slate-50/50 px-5 py-3 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl bg-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-300 transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
