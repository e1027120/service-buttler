import {
  ArrowRight,
  BookOpen,
  Calendar,
  CheckCircle2,
  ExternalLink,
  Layers,
} from 'lucide-react';
import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { cx, Field, Select } from '../../components/ui';
import type { Church, SermonNotesContent, SermonRecord } from '../../lib/types';

interface Props {
  value: SermonNotesContent;
  onChange: (patch: SermonNotesContent) => void;
  churchId: string;
  church?: Church;
}

export function SermonNotesActionEditor({
  value,
  onChange,
  churchId,
  church,
}: Props) {
  const librarySermons = useMemo<SermonRecord[]>(() => {
    return (church?.landing?.sermons || []) as SermonRecord[];
  }, [church?.landing?.sermons]);

  const selectedSermon = useMemo(() => {
    if (!value.sermon_id) return null;
    return librarySermons.find((s) => String(s.id) === String(value.sermon_id)) || null;
  }, [librarySermons, value.sermon_id]);

  const selectSermon = (sermonId: string) => {
    const match = librarySermons.find((s) => String(s.id) === String(sermonId));
    onChange({
      sermon_id: sermonId,
      speaker: match?.speaker,
      main_verse: match?.main_verse,
      slides: match?.slides || [],
      allow_personal_notes: match ? match.allow_personal_notes : (value.allow_personal_notes ?? true),
    });
  };

  return (
    <div className="space-y-6">
      {/* Information Header */}
      <div className="rounded-2xl border border-brand/20 bg-brand/[0.03] p-4 text-xs text-slate-700 space-y-2">
        <div className="flex items-center gap-2 font-bold text-slate-900 text-sm">
          <BookOpen className="h-4 w-4 text-brand" />
          <span>Linked to Sermon Notes Library</span>
        </div>
        <p className="leading-relaxed">
          Actions link directly to your central <strong>Sermon Notes Library</strong>. Any edits made in the library immediately reflect here on live attendee devices, keeping all notes in sync.
        </p>
      </div>

      {/* Sermon Picker */}
      <Field
        label="Select Sermon Notes"
        hint="Choose which sermon notes from your library attendees will see for this action"
      >
        <Select
          value={value.sermon_id || ''}
          onChange={(e) => selectSermon(e.target.value)}
          className="w-full text-sm font-medium"
        >
          <option value="">-- Choose a sermon from the library --</option>
          {librarySermons.map((s) => (
            <option key={s.id} value={s.id}>
              {s.title} {s.date ? `(${s.date})` : ''} {s.speaker ? `· ${s.speaker}` : ''} ({s.slides?.length || 0} slides)
            </option>
          ))}
        </Select>
      </Field>

      {/* Selected Sermon Details Card */}
      {selectedSermon ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
          <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
                  <CheckCircle2 className="h-4 w-4" />
                </span>
                <h4 className="font-bold text-sm text-slate-900">
                  {selectedSermon.title}
                </h4>
              </div>

              <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-slate-500 mt-1 pl-7">
                {selectedSermon.date && (
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3.5 w-3.5 text-slate-400" />
                    {selectedSermon.date}
                  </span>
                )}
                {selectedSermon.speaker && (
                  <>
                    <span>·</span>
                    <span>{selectedSermon.speaker}</span>
                  </>
                )}
                {selectedSermon.main_verse && (
                  <>
                    <span>·</span>
                    <span className="font-semibold text-brand">
                      {selectedSermon.main_verse}
                    </span>
                  </>
                )}
              </div>
            </div>

            <Link
              to={`/admin/${churchId}/sermons`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand hover:underline shrink-0"
            >
              <span>Edit in Library</span>
              <ExternalLink className="h-3.5 w-3.5" />
            </Link>
          </div>

          {/* Slides Preview */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-600">
              <span className="flex items-center gap-1.5">
                <Layers className="h-3.5 w-3.5 text-slate-400" />
                Included Slides ({selectedSermon.slides?.length || 0})
              </span>
              <span className="text-[11px] text-slate-400 font-normal">
                Auto-synced with library
              </span>
            </div>

            <div className="grid gap-2 sm:grid-cols-2 max-h-56 overflow-y-auto pr-1">
              {(selectedSermon.slides || []).map((slide, idx) => (
                <div
                  key={slide.id || idx}
                  className="flex items-center gap-2.5 rounded-xl border border-slate-100 bg-slate-50/70 p-2.5 text-xs"
                >
                  <span
                    className={cx(
                      'flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold',
                      slide.show_number !== false
                        ? 'bg-brand/10 text-brand'
                        : 'bg-slate-200 text-slate-400'
                    )}
                  >
                    {slide.show_number !== false ? (slide.slide_number?.trim() || idx + 1) : '•'}
                  </span>
                  <div className="min-w-0 flex-1 truncate">
                    <p className="font-semibold text-slate-800 truncate">
                      {slide.title || (slide.is_full_image ? 'Full Image Slide' : `Slide ${idx + 1}`)}
                    </p>
                    {slide.verse_reference && (
                      <p className="text-[10px] text-brand truncate font-medium">
                        {slide.verse_reference}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : librarySermons.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 p-6 text-center space-y-3 bg-slate-50/50">
          <BookOpen className="h-8 w-8 text-slate-300 mx-auto" />
          <div>
            <h4 className="text-sm font-bold text-slate-800">No Sermons in Library Yet</h4>
            <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
              Create and manage sermon outlines in your central Sermon Notes Library, then select them here for live services.
            </p>
          </div>
          <Link
            to={`/admin/${churchId}/sermons`}
            className="inline-flex items-center gap-1.5 rounded-xl bg-brand px-3.5 py-2 text-xs font-semibold text-white shadow-sm hover:opacity-95"
          >
            <span>Go to Sermon Notes Library</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      ) : null}
    </div>
  );
}
