import {
  ArrowDown,
  ArrowUp,
  BookmarkPlus,
  Clock,
  Layers,
  Pencil,
  Plus,
  Trash2,
  Image as ImageIcon,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { SlideIcon } from '../../components/SlideIcon';
import { Badge, Button, useToast } from '../../components/ui';
import {
  announcementSlideToSlideDefinition,
  getDefaultSlideDefinition,
  slideDefinitionToAnnouncementSlide,
} from '../../lib/slides';
import { supabase, unwrap } from '../../lib/supabase';
import type {
  AnnouncementContent,
  AnnouncementSlide,
  AppDeeplink,
  Church,
  SlideDefinition,
} from '../../lib/types';
import { errorMessage, shortId } from '../../lib/utils';
import { SlideEditorModal } from './SlideEditorModal';

interface Props {
  value: AnnouncementContent;
  onChange: (patch: AnnouncementContent) => void;
  churchId: string;
  church?: Church;
}

export function AnnouncementEditor({ value, onChange, churchId, church }: Props) {
  const toast = useToast();

  const librarySlides = useMemo<SlideDefinition[]>(() => {
    return (church?.landing?.slides || []) as SlideDefinition[];
  }, [church?.landing?.slides]);

  const deeplinks = useMemo<AppDeeplink[]>(() => {
    return (church?.landing?.app_deeplinks || []) as AppDeeplink[];
  }, [church?.landing?.app_deeplinks]);

  // Current slides in this announcement
  const slides = useMemo<AnnouncementSlide[]>(() => {
    if (value.slides && value.slides.length > 0) {
      return value.slides;
    }
    // Normalize legacy single-slide format
    if (value.body || value.image_url || value.cta_url) {
      return [
        {
          id: shortId(),
          title: '',
          body: value.body || '',
          image_url: value.image_url || '',
          cta_label: value.cta_label || '',
          cta_url: value.cta_url || '',
        },
      ];
    }
    return [];
  }, [value.slides, value.body, value.image_url, value.cta_url]);

  const [editingSlide, setEditingSlide] = useState<Partial<SlideDefinition> | null>(null);

  // Helper to update announcement content
  const updateAnnouncement = (nextSlides: AnnouncementSlide[], autoAdvance?: number) => {
    onChange({
      ...value,
      slides: nextSlides,
      selected_slide_ids: nextSlides.map((s) => s.slide_id || s.id),
      auto_advance_seconds: autoAdvance !== undefined ? autoAdvance : (value.auto_advance_seconds ?? 0),
    });
  };

  const moveSlide = (idx: number, dir: -1 | 1) => {
    const target = idx + dir;
    if (target < 0 || target >= slides.length) return;
    const next = [...slides];
    const [moved] = next.splice(idx, 1);
    next.splice(target, 0, moved);
    updateAnnouncement(next);
  };

  const removeSlide = (idx: number) => {
    const next = slides.filter((_, i) => i !== idx);
    updateAnnouncement(next);
  };

  // Add an existing library slide to the current slideshow
  const addLibrarySlide = (libSlide: SlideDefinition) => {
    const converted = slideDefinitionToAnnouncementSlide(libSlide, deeplinks);
    const next = [...slides, converted];
    updateAnnouncement(next);
    toast(`Added "${libSlide.name}" to slideshow`);
  };

  // Save a slide definition (from modal) into church library and include in this announcement
  const handleSaveSlideDefinition = async (saved: SlideDefinition) => {
    if (!church) return;

    // 1. Update church library
    const isNew = !librarySlides.some((s) => s.id === saved.id);
    const nextLibrary = isNew
      ? [...librarySlides, saved]
      : librarySlides.map((s) => (s.id === saved.id ? saved : s));

    const nextLanding = {
      ...(church.landing || {}),
      slides: nextLibrary,
    };

    unwrap(await supabase.from('churches').update({ landing: nextLanding }).eq('id', church.id));

    // Update in church object locally
    if (church.landing) {
      church.landing.slides = nextLibrary;
    }

    // 2. Sync into current announcement slides
    const converted = slideDefinitionToAnnouncementSlide(saved, deeplinks);
    const existingIdx = slides.findIndex((s) => s.slide_id === saved.id || s.id === saved.id);
    let nextSlides: AnnouncementSlide[];
    if (existingIdx >= 0) {
      nextSlides = slides.map((s, i) => (i === existingIdx ? converted : s));
    } else {
      nextSlides = [...slides, converted];
    }

    updateAnnouncement(nextSlides);
    toast(`Slide "${saved.name}" saved and updated in announcement`);
  };

  // Promote a custom/legacy slide into church library
  const saveCustomSlideToLibrary = async (slide: AnnouncementSlide) => {
    if (!church) return;
    try {
      const def = announcementSlideToSlideDefinition(slide);
      const nextLibrary = [...librarySlides, def];
      const nextLanding = {
        ...(church.landing || {}),
        slides: nextLibrary,
      };

      unwrap(await supabase.from('churches').update({ landing: nextLanding }).eq('id', church.id));

      if (church.landing) {
        church.landing.slides = nextLibrary;
      }

      // Link slide_id
      const nextSlides = slides.map((s) => (s.id === slide.id ? { ...s, slide_id: def.id } : s));
      updateAnnouncement(nextSlides);
      toast(`Saved "${def.name}" to Slide Library`);
    } catch (err) {
      toast(errorMessage(err), 'error');
    }
  };

  // Open editor for a slide
  const openSlideEditor = (slide: AnnouncementSlide) => {
    // If it links to a library slide, load library definition
    const libMatch = librarySlides.find((l) => l.id === slide.slide_id || l.id === slide.id);
    if (libMatch) {
      setEditingSlide(libMatch);
    } else {
      setEditingSlide(announcementSlideToSlideDefinition(slide));
    }
  };

  // Set of included slide library IDs
  const includedSlideIds = new Set(slides.map((s) => s.slide_id || s.id));
  const availableLibrarySlides = librarySlides.filter((s) => !includedSlideIds.has(s.id));

  return (
    <div className="space-y-6">
      {/* Slideshow Top Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
        <div>
          <h3 className="text-sm font-bold text-slate-900">Announcement Slideshow</h3>
          <p className="text-xs text-slate-500">
            Pick slides from your Slide Library and set the rotation interval.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-xs font-semibold text-slate-700">
            <Clock className="h-3.5 w-3.5 text-slate-400" />
            <span>Interval:</span>
            <select
              value={value.auto_advance_seconds || 0}
              onChange={(e) => updateAnnouncement(slides, Number(e.target.value))}
              className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs text-slate-800 focus:border-brand focus:outline-none"
            >
              <option value={0}>Manual only</option>
              <option value={4}>Every 4 seconds</option>
              <option value={6}>Every 6 seconds</option>
              <option value={8}>Every 8 seconds</option>
              <option value={10}>Every 10 seconds</option>
              <option value={12}>Every 12 seconds</option>
              <option value={15}>Every 15 seconds</option>
            </select>
          </label>

          <Button
            type="button"
            size="sm"
            onClick={() => setEditingSlide(getDefaultSlideDefinition())}
            className="gap-1.5 text-xs"
          >
            <Plus className="h-3.5 w-3.5" /> Create New Slide
          </Button>
        </div>
      </div>

      {/* ----------------------------------------------------------------- */}
      {/* 1. INCLUDED SLIDES LIST */}
      {/* ----------------------------------------------------------------- */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-600">
            Slides in this announcement ({slides.length})
          </span>
          {slides.length > 1 && (
            <span className="text-[11px] text-slate-400">Order determines playback sequence</span>
          )}
        </div>

        {slides.length === 0 ? (
          <div className="rounded-2xl border-2 border-dashed border-slate-200 bg-white p-6 text-center space-y-3">
            <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-400">
              <Layers className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-800">No slides selected</p>
              <p className="text-xs text-slate-500">
                Add slides from your library below or create a new slide to include in this announcement.
              </p>
            </div>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => setEditingSlide(getDefaultSlideDefinition())}
              className="gap-1.5"
            >
              <Plus className="h-3.5 w-3.5" /> Create Slide
            </Button>
          </div>
        ) : (
          <div className="space-y-2.5">
            {slides.map((slide, idx) => {
              const isFull = Boolean(slide.is_full_image);
              const isFromLibrary = Boolean(
                slide.slide_id && librarySlides.some((l) => l.id === slide.slide_id),
              );

              return (
                <div
                  key={slide.id || idx}
                  className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm transition hover:border-slate-300"
                >
                  {/* Sequence number */}
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand/10 text-xs font-bold text-brand">
                    {idx + 1}
                  </span>

                  {/* Thumbnail */}
                  <div className="relative h-14 w-24 shrink-0 overflow-hidden rounded-xl bg-slate-100 border border-slate-100">
                    {slide.image_url ? (
                      <img src={slide.image_url} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-slate-300">
                        <ImageIcon className="h-5 w-5" />
                      </div>
                    )}
                    {isFull && (
                      <div className="absolute top-1 left-1 rounded bg-black/75 px-1 py-0.5 text-[9px] font-bold text-white backdrop-blur">
                        Full
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      <h4 className="font-bold text-sm text-slate-900 truncate">
                        {slide.title || 'Untitled Slide'}
                      </h4>
                      {isFromLibrary && (
                        <Badge tone="brand">
                          Library
                        </Badge>
                      )}
                      {isFull && (
                        <Badge tone="slate">
                          Full Image
                        </Badge>
                      )}
                    </div>
                    {slide.subtitle && (
                      <p className="text-xs text-slate-500 truncate">{slide.subtitle}</p>
                    )}
                    {slide.cta_label && (
                      <div className="flex items-center gap-1 text-[11px] text-slate-600">
                        <SlideIcon name={slide.cta_icon} className="h-3 w-3 text-brand" />
                        <span className="font-medium truncate">{slide.cta_label}</span>
                        {slide.cta_action_type && (
                          <span className="text-slate-400">({slide.cta_action_type})</span>
                        )}
                      </div>
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
                      onClick={() => openSlideEditor(slide)}
                      title="Edit slide in builder"
                      className="h-8 w-8 p-0 text-slate-600 hover:text-brand"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    {!isFromLibrary && (
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => saveCustomSlideToLibrary(slide)}
                        title="Save to church slide library"
                        className="h-8 w-8 p-0 text-amber-600 hover:bg-amber-50"
                      >
                        <BookmarkPlus className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => removeSlide(idx)}
                      title="Remove from this announcement"
                      className="h-8 w-8 p-0 text-red-600 hover:bg-red-50 hover:text-red-700"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ----------------------------------------------------------------- */}
      {/* 2. AVAILABLE SLIDES FROM LIBRARY */}
      {/* ----------------------------------------------------------------- */}
      {availableLibrarySlides.length > 0 && (
        <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
              <Layers className="h-3.5 w-3.5 text-brand" />
              Available from Slide Library ({availableLibrarySlides.length})
            </span>
            <span className="text-xs text-slate-400">Click to include in this slideshow</span>
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            {availableLibrarySlides.map((libSlide) => {
              const isFull = Boolean(libSlide.image?.enabled && libSlide.image?.is_full_image);
              return (
                <div
                  key={libSlide.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-slate-200/90 bg-white p-2.5 transition hover:border-brand/40 hover:shadow-sm"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="h-10 w-14 shrink-0 overflow-hidden rounded-lg bg-slate-100 border border-slate-100">
                      {libSlide.image?.url ? (
                        <img src={libSlide.image.url} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-slate-300">
                          <ImageIcon className="h-4 w-4" />
                        </div>
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="font-bold text-xs text-slate-900 truncate">{libSlide.name}</p>
                      <p className="text-[11px] text-slate-500 truncate">
                        {libSlide.text?.title || (isFull ? 'Full image' : 'No headline')}
                      </p>
                    </div>
                  </div>

                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={() => addLibrarySlide(libSlide)}
                    className="shrink-0 gap-1 text-xs"
                  >
                    <Plus className="h-3 w-3" /> Add
                  </Button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Slide Builder Modal */}
      {editingSlide && (
        <SlideEditorModal
          open={Boolean(editingSlide)}
          onClose={() => setEditingSlide(null)}
          slide={editingSlide}
          churchId={churchId}
          church={church!}
          onSave={handleSaveSlideDefinition}
        />
      )}
    </div>
  );
}
