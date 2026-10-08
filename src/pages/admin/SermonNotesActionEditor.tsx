import {
  ArrowDown,
  ArrowUp,
  BookmarkPlus,
  BookOpen,
  Copy,
  Image as ImageIcon,
  Pencil,
  Plus,
  Trash2,
  User,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import {
  Badge,
  Button,
  cx,
  Field,
  Input,
  Select,
  Toggle,
  useToast,
} from '../../components/ui';
import { getDefaultSermonSlide } from '../../lib/sermons';
import { supabase, unwrap } from '../../lib/supabase';
import type {
  Church,
  SermonNotesContent,
  SermonRecord,
  SermonSlide,
} from '../../lib/types';
import { errorMessage, shortId } from '../../lib/utils';
import { SermonSlideEditorModal } from './SermonSlideEditorModal';

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
  const toast = useToast();

  const librarySermons = useMemo<SermonRecord[]>(() => {
    return (church?.landing?.sermons || []) as SermonRecord[];
  }, [church?.landing?.sermons]);

  const slides: SermonSlide[] = useMemo(() => {
    if (value.slides && value.slides.length > 0) return value.slides;
    if (value.body) {
      return [
        {
          id: shortId(),
          title: 'Message outline',
          body: value.body,
        },
      ];
    }
    return [getDefaultSermonSlide('1. ')];
  }, [value.slides, value.body]);

  const [editingSlideIdx, setEditingSlideIdx] = useState<number | null>(null);

  const update = (patch: Partial<SermonNotesContent>) => {
    onChange({ ...value, ...patch });
  };

  const updateSlide = (idx: number, patch: Partial<SermonSlide>) => {
    const next = slides.map((s, i) => (i === idx ? { ...s, ...patch } : s));
    update({ slides: next });
  };

  const addSlide = () => {
    const next = [...slides, getDefaultSermonSlide(`${slides.length + 1}. `)];
    update({ slides: next });
    setEditingSlideIdx(next.length - 1);
  };

  const duplicateSlide = (idx: number) => {
    const target = slides[idx];
    if (!target) return;
    const cloned: SermonSlide = { ...target, id: shortId() };
    const next = [...slides];
    next.splice(idx + 1, 0, cloned);
    update({ slides: next });
  };

  const removeSlide = (idx: number) => {
    if (slides.length <= 1) {
      toast('Sermon must have at least one slide', 'error');
      return;
    }
    const next = slides.filter((_, i) => i !== idx);
    update({ slides: next });
  };

  const moveSlide = (idx: number, dir: -1 | 1) => {
    const target = idx + dir;
    if (target < 0 || target >= slides.length) return;
    const next = [...slides];
    const [moved] = next.splice(idx, 1);
    next.splice(target, 0, moved);
    update({ slides: next });
  };

  // Load from an archived sermon
  const selectFromArchive = (sermonId: string) => {
    const match = librarySermons.find((s) => s.id === sermonId);
    if (!match) return;
    update({
      sermon_id: match.id,
      speaker: match.speaker,
      main_verse: match.main_verse,
      slides: match.slides,
      allow_personal_notes: match.allow_personal_notes,
    });
    toast(`Loaded sermon "${match.title}"`);
  };

  // Archive current action sermon to church library
  const archiveCurrentSermon = async () => {
    if (!church) return;
    try {
      const isExisting = librarySermons.some((s) => s.id === value.sermon_id);
      const sermonId = value.sermon_id || shortId();

      const newRecord: SermonRecord = {
        id: sermonId,
        title: value.main_verse ? `Sermon on ${value.main_verse}` : 'Sermon Notes',
        speaker: value.speaker,
        date: new Date().toISOString().split('T')[0],
        main_verse: value.main_verse,
        slides,
        allow_personal_notes: value.allow_personal_notes ?? true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const nextList = isExisting
        ? librarySermons.map((s) => (s.id === sermonId ? newRecord : s))
        : [newRecord, ...librarySermons];

      const nextLanding = {
        ...(church.landing || {}),
        sermons: nextList,
      };

      unwrap(await supabase.from('churches').update({ landing: nextLanding }).eq('id', church.id));

      if (church.landing) {
        church.landing.sermons = nextList;
      }

      update({ sermon_id: sermonId });
      toast('Archived to Church Sermon Notes Library');
    } catch (err) {
      toast(errorMessage(err), 'error');
    }
  };

  return (
    <div className="space-y-6">
      {/* Archive Selector */}
      {librarySermons.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
          <div className="flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-brand" />
            <span className="text-xs font-bold text-slate-900">
              Link with Sermon Archive:
            </span>
          </div>

          <div className="flex items-center gap-2">
            <Select
              value={value.sermon_id || ''}
              onChange={(e) => selectFromArchive(e.target.value)}
              className="text-xs w-auto min-w-[200px]"
            >
              <option value="">-- Custom / Pick from Archive --</option>
              {librarySermons.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.title} {s.date ? `(${s.date})` : ''}
                </option>
              ))}
            </Select>

            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={archiveCurrentSermon}
              title="Save current notes to church archive"
              className="gap-1.5 text-xs text-amber-700 hover:border-amber-400"
            >
              <BookmarkPlus className="h-3.5 w-3.5" /> Save to Archive
            </Button>
          </div>
        </div>
      )}

      {/* Speaker and Main Verse */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Speaker / Preacher" hint="e.g. Pastor David Mitchell">
          <div className="relative">
            <User className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <Input
              value={value.speaker || ''}
              onChange={(e) => update({ speaker: e.target.value })}
              placeholder="e.g. Pastor David Mitchell"
              className="pl-9"
            />
          </div>
        </Field>

        <Field label="Main Verse / Scripture" hint="Primary passage, e.g. Romans 8:18–28">
          <div className="relative">
            <BookOpen className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <Input
              value={value.main_verse || value.scripture || ''}
              onChange={(e) => update({ main_verse: e.target.value, scripture: e.target.value })}
              placeholder="Romans 8:18–28"
              className="pl-9"
            />
          </div>
        </Field>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-3.5">
        <Toggle
          checked={value.allow_personal_notes ?? true}
          onChange={(checked) => update({ allow_personal_notes: checked })}
          label="Allow Personal Note-Taking"
          description="Attendees can write personal notes alongside the sermon slides, saved to their device history."
        />
      </div>

      {/* Slides Section */}
      <div className="space-y-3 pt-2 border-t border-slate-200">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-slate-900">
              Sermon Slides ({slides.length})
            </h3>
            <p className="text-xs text-slate-500">
              Slides appear sequentially down the live page. Create modular Image and Text building blocks.
            </p>
          </div>

          <Button
            type="button"
            size="sm"
            onClick={addSlide}
            className="gap-1.5 text-xs"
          >
            <Plus className="h-3.5 w-3.5" /> Add Slide
          </Button>
        </div>

        <div className="space-y-2.5">
          {slides.map((slide, idx) => {
            const isFull = Boolean(slide.is_full_image);
            return (
              <div
                key={slide.id || idx}
                className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm transition hover:border-slate-300"
              >
                {/* Index */}
                <span
                  title={slide.show_number ? `Displaying as: ${slide.slide_number || idx + 1}` : 'Number hidden in frontend'}
                  className={cx(
                    'flex h-6 min-w-[24px] px-1.5 shrink-0 items-center justify-center rounded-full text-xs font-bold transition',
                    slide.show_number
                      ? 'bg-brand/10 text-brand'
                      : 'bg-slate-100 text-slate-400 opacity-60'
                  )}
                >
                  {slide.show_number ? (slide.slide_number?.trim() || idx + 1) : `${idx + 1}•`}
                </span>

                {/* Thumbnail */}
                <div className="relative h-12 w-20 shrink-0 overflow-hidden rounded-xl bg-slate-100 border border-slate-100">
                  {slide.image_url ? (
                    <img src={slide.image_url} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-slate-300">
                      <ImageIcon className="h-4 w-4" />
                    </div>
                  )}
                  {isFull && (
                    <div className="absolute top-1 left-1 rounded bg-black/75 px-1 py-0.5 text-[9px] font-bold text-white backdrop-blur">
                      Full
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="min-w-0 flex-1 space-y-0.5">
                  <div className="flex items-center gap-2">
                    <h4 className="font-bold text-xs text-slate-900 truncate">
                      {slide.title || (isFull ? 'Full Image Graphic' : 'Untitled Slide')}
                    </h4>
                    {isFull && (
                      <Badge tone="slate">
                        Full Image
                      </Badge>
                    )}
                    {slide.verse_reference && (
                      <Badge tone="brand">
                        {slide.verse_reference}
                      </Badge>
                    )}
                  </div>
                  {slide.body && (
                    <p className="text-[11px] text-slate-500 truncate line-clamp-1">
                      {slide.body}
                    </p>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => moveSlide(idx, -1)}
                    disabled={idx === 0}
                    title="Move up"
                    className="h-8 w-8 p-0"
                  >
                    <ArrowUp className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => moveSlide(idx, 1)}
                    disabled={idx === slides.length - 1}
                    title="Move down"
                    className="h-8 w-8 p-0"
                  >
                    <ArrowDown className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => duplicateSlide(idx)}
                    title="Duplicate slide"
                    className="h-8 w-8 p-0"
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => setEditingSlideIdx(idx)}
                    title="Edit slide with building blocks"
                    className="h-8 w-8 p-0 text-brand"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  {slides.length > 1 && (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => removeSlide(idx)}
                      title="Remove slide"
                      className="h-8 w-8 p-0 text-red-600 hover:bg-red-50 hover:text-red-700"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Block-based Slide Builder Modal */}
      {editingSlideIdx !== null && slides[editingSlideIdx] && (
        <SermonSlideEditorModal
          open={editingSlideIdx !== null}
          onClose={() => setEditingSlideIdx(null)}
          slide={slides[editingSlideIdx]}
          churchId={churchId}
          church={church}
          onSave={(saved) => updateSlide(editingSlideIdx, saved)}
        />
      )}
    </div>
  );
}
