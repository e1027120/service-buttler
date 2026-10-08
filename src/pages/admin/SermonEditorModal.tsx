import {
  ArrowDown,
  ArrowUp,
  BookOpen,
  Calendar,
  Copy,
  Image as ImageIcon,
  Pencil,
  Plus,
  Trash2,
  User,
} from 'lucide-react';
import { type FormEvent, useEffect, useState } from 'react';
import {
  Badge,
  Button,
  cx,
  Field,
  Input,
  Modal,
  Textarea,
  Toggle,
  useToast,
} from '../../components/ui';
import { getDefaultSermonSlide } from '../../lib/sermons';
import type { Church, SermonRecord, SermonSlide } from '../../lib/types';
import { errorMessage, shortId } from '../../lib/utils';
import { SermonSlideEditorModal } from './SermonSlideEditorModal';

interface Props {
  open: boolean;
  onClose: () => void;
  sermon: Partial<SermonRecord> | null;
  churchId: string;
  church: Church;
  onSave: (saved: SermonRecord) => Promise<void> | void;
}

export function SermonEditorModal({
  open,
  onClose,
  sermon,
  churchId,
  church,
  onSave,
}: Props) {
  const toast = useToast();
  const [data, setData] = useState<SermonRecord | null>(null);
  const [editingSlideIdx, setEditingSlideIdx] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!sermon) {
      setData(null);
      return;
    }

    setData({
      id: sermon.id || shortId(),
      title: sermon.title || '',
      speaker: sermon.speaker || '',
      date: sermon.date || new Date().toISOString().split('T')[0],
      main_verse: sermon.main_verse || '',
      description: sermon.description || '',
      slides: sermon.slides && sermon.slides.length > 0 ? sermon.slides : [getDefaultSermonSlide('1. ')],
      allow_personal_notes: sermon.allow_personal_notes ?? true,
      service_id: sermon.service_id ?? null,
      created_at: sermon.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
  }, [sermon]);

  if (!data) return null;

  const slides = data.slides || [];

  const updateSlide = (idx: number, patch: Partial<SermonSlide>) => {
    const next = slides.map((s, i) => (i === idx ? { ...s, ...patch } : s));
    setData({ ...data, slides: next });
  };

  const addSlide = () => {
    const next = [...slides, getDefaultSermonSlide(`${slides.length + 1}. `)];
    setData({ ...data, slides: next });
    setEditingSlideIdx(next.length - 1);
  };

  const duplicateSlide = (idx: number) => {
    const target = slides[idx];
    if (!target) return;
    const cloned: SermonSlide = {
      ...target,
      id: shortId(),
    };
    const next = [...slides];
    next.splice(idx + 1, 0, cloned);
    setData({ ...data, slides: next });
  };

  const removeSlide = (idx: number) => {
    if (slides.length <= 1) {
      toast('A sermon must have at least one slide', 'error');
      return;
    }
    const next = slides.filter((_, i) => i !== idx);
    setData({ ...data, slides: next });
  };

  const moveSlide = (idx: number, dir: -1 | 1) => {
    const target = idx + dir;
    if (target < 0 || target >= slides.length) return;
    const next = [...slides];
    const [moved] = next.splice(idx, 1);
    next.splice(target, 0, moved);
    setData({ ...data, slides: next });
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!data.title?.trim()) {
      toast('Please enter a sermon title', 'error');
      return;
    }

    setSaving(true);
    try {
      await onSave({
        ...data,
        updated_at: new Date().toISOString(),
      });
      onClose();
    } catch (err) {
      toast(errorMessage(err), 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Modal
        open={open}
        onClose={onClose}
        title={sermon?.id ? `Edit Sermon: ${sermon.title || 'Untitled'}` : 'New Sermon Notes'}
        wide
      >
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Top metadata */}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Sermon Title" hint="Title of the sermon / message">
              <Input
                required
                value={data.title}
                onChange={(e) => setData({ ...data, title: e.target.value })}
                placeholder="e.g. Life in the Spirit, Hope in the Dark"
                className="font-semibold text-slate-900"
              />
            </Field>

            <Field label="Preacher / Speaker (optional)">
              <div className="relative">
                <User className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <Input
                  value={data.speaker || ''}
                  onChange={(e) => setData({ ...data, speaker: e.target.value })}
                  placeholder="e.g. Pastor John Doe"
                  className="pl-9"
                />
              </div>
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Sermon Date">
              <div className="relative">
                <Calendar className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <Input
                  type="date"
                  value={data.date || ''}
                  onChange={(e) => setData({ ...data, date: e.target.value })}
                  className="pl-9"
                />
              </div>
            </Field>

            <Field label="Primary Scripture / Main Verse" hint="e.g. Romans 8:18–28">
              <div className="relative">
                <BookOpen className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <Input
                  value={data.main_verse || ''}
                  onChange={(e) => setData({ ...data, main_verse: e.target.value })}
                  placeholder="e.g. Romans 8:18–28"
                  className="pl-9"
                />
              </div>
            </Field>
          </div>

          <Field label="Description / Summary (optional)">
            <Textarea
              rows={2}
              value={data.description || ''}
              onChange={(e) => setData({ ...data, description: e.target.value })}
              placeholder="Brief overview or series information..."
            />
          </Field>

          <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5">
            <Toggle
              checked={data.allow_personal_notes ?? true}
              onChange={(checked) => setData({ ...data, allow_personal_notes: checked })}
              label="Allow Personal Note-Taking"
              description="Attendees can write, save locally on their device, and access personal notes anytime from history."
            />
          </div>

          {/* Slides List Section */}
          <div className="space-y-3 pt-2 border-t border-slate-200/80">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h4 className="text-sm font-bold text-slate-900">
                  Sermon Slides ({slides.length})
                </h4>
                <p className="text-xs text-slate-500">
                  Each slide can have an Image block and a Text block (Main Point, Scripture, and Body Text).
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
                    {/* Number */}
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

                    {/* Slide details */}
                    <div className="min-w-0 flex-1 space-y-0.5">
                      <div className="flex items-center gap-2">
                        <h5 className="font-bold text-xs text-slate-900 truncate">
                          {slide.title || (isFull ? 'Full Image Graphic' : 'No Headline')}
                        </h5>
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

                    {/* Controls */}
                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => moveSlide(idx, -1)}
                        disabled={idx === 0}
                        title="Move slide up"
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
                        title="Move slide down"
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
                        title="Edit slide"
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
                          title="Delete slide"
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

          <div className="flex items-center justify-between border-t border-slate-200/80 pt-4">
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" loading={saving}>
              Save Sermon Notes
            </Button>
          </div>
        </form>
      </Modal>

      {/* Slide Builder Modal */}
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
    </>
  );
}
