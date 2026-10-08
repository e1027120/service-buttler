import {
  Copy,
  Layers,
  Maximize2,
  Pencil,
  Plus,
  Search,
  Trash2,
  Image as ImageIcon,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { SlideIcon } from '../../components/SlideIcon';
import {
  Badge,
  Button,
  ConfirmButton,
  EmptyState,
  Input,
  useToast,
} from '../../components/ui';
import { getDefaultSlideDefinition } from '../../lib/slides';
import { supabase, unwrap } from '../../lib/supabase';
import type { SlideDefinition } from '../../lib/types';
import { errorMessage, shortId } from '../../lib/utils';
import { ActionsSubNav } from './ActionsSubNav';
import { PageHeader } from './AdminLayout';
import { SlideEditorModal } from './SlideEditorModal';
import { useAdmin } from './context';

export default function SlidesLibrary() {
  const { church, reloadChurch, canAdmin } = useAdmin();
  const toast = useToast();

  const slides = useMemo<SlideDefinition[]>(() => {
    return (church.landing?.slides || []) as SlideDefinition[];
  }, [church.landing?.slides]);

  const [search, setSearch] = useState('');
  const [editingSlide, setEditingSlide] = useState<Partial<SlideDefinition> | null>(null);

  const filtered = slides.filter((s) => {
    const q = search.toLowerCase();
    return (
      s.name.toLowerCase().includes(q) ||
      s.text?.title?.toLowerCase().includes(q) ||
      s.text?.subtitle?.toLowerCase().includes(q) ||
      s.text?.body?.toLowerCase().includes(q)
    );
  });

  const saveSlide = async (saved: SlideDefinition) => {
    const isNew = !slides.some((s) => s.id === saved.id);
    const nextList = isNew
      ? [...slides, saved]
      : slides.map((s) => (s.id === saved.id ? saved : s));

    const nextLanding = {
      ...(church.landing || {}),
      slides: nextList,
    };

    unwrap(await supabase.from('churches').update({ landing: nextLanding }).eq('id', church.id));
    await reloadChurch();
    toast(isNew ? 'Slide created and added to library' : 'Slide saved');
  };

  const duplicateSlide = async (slide: SlideDefinition) => {
    try {
      const cloned: SlideDefinition = {
        ...slide,
        id: shortId(),
        name: `${slide.name} (Copy)`,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const nextList = [...slides, cloned];
      const nextLanding = {
        ...(church.landing || {}),
        slides: nextList,
      };

      unwrap(await supabase.from('churches').update({ landing: nextLanding }).eq('id', church.id));
      await reloadChurch();
      toast(`Duplicated "${slide.name}"`);
    } catch (err) {
      toast(errorMessage(err), 'error');
    }
  };

  const removeSlide = async (id: string) => {
    try {
      const nextList = slides.filter((s) => s.id !== id);
      const nextLanding = {
        ...(church.landing || {}),
        slides: nextList,
      };

      unwrap(await supabase.from('churches').update({ landing: nextLanding }).eq('id', church.id));
      await reloadChurch();
      toast('Slide deleted from library');
    } catch (err) {
      toast(errorMessage(err), 'error');
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
              onClick={() => setEditingSlide(getDefaultSlideDefinition())}
              className="gap-1.5"
            >
              <Plus className="h-4 w-4" /> New Slide
            </Button>
          )
        }
      />

      <ActionsSubNav current="slides" />

      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Slide Library ({slides.length})</h2>
          <p className="text-xs text-slate-500">
            Create and maintain reusable announcement slides with customizable image, text, and call-to-action blocks.
          </p>
        </div>

        {slides.length > 2 && (
          <div className="relative w-full max-w-xs">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search slides…"
              className="pl-9"
            />
          </div>
        )}
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={<Layers className="h-10 w-10" />}
          title={search ? 'No matching slides' : 'No slides in your library yet'}
          description={
            search
              ? 'Try adjusting your search query.'
              : 'Build reusable announcement slides here. You can pick and choose which slides appear in your announcements and configure slideshow intervals.'
          }
          action={
            canAdmin && !search && (
              <Button
                onClick={() => setEditingSlide(getDefaultSlideDefinition())}
                className="gap-1.5"
              >
                <Plus className="h-4 w-4" /> Create First Slide
              </Button>
            )
          }
        />
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((slide) => {
            const isFullImage = Boolean(slide.image?.enabled && slide.image?.is_full_image);
            return (
              <div
                key={slide.id}
                className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:border-slate-300 hover:shadow-md"
              >
                {/* Visual Header / Thumbnail */}
                <div className="relative aspect-[16/9] w-full overflow-hidden bg-slate-100 border-b border-slate-100">
                  {slide.image?.enabled && slide.image?.url ? (
                    <img
                      src={slide.image.url}
                      alt=""
                      className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                    />
                  ) : (
                    <div className="flex h-full w-full flex-col items-center justify-center gap-1.5 text-slate-300">
                      <ImageIcon className="h-8 w-8" />
                      <span className="text-xs font-medium text-slate-400">No Image Block</span>
                    </div>
                  )}

                  {/* Mode Badge in thumbnail */}
                  <div className="absolute top-2.5 left-2.5 flex items-center gap-1">
                    {isFullImage ? (
                      <span className="flex items-center gap-1 rounded-md bg-black/75 px-2 py-0.5 text-[11px] font-bold text-white backdrop-blur">
                        <Maximize2 className="h-3 w-3" /> Full Image
                      </span>
                    ) : slide.image?.enabled ? (
                      <span className="rounded-md bg-white/90 px-2 py-0.5 text-[11px] font-bold text-slate-800 shadow-sm backdrop-blur">
                        Image
                      </span>
                    ) : null}
                  </div>
                </div>

                {/* Content info */}
                <div className="flex-1 p-4 space-y-3">
                  <div>
                    <h3 className="font-bold text-slate-900 leading-snug line-clamp-1">
                      {slide.name}
                    </h3>
                    {slide.text?.enabled && !isFullImage && (
                      <p className="mt-0.5 text-xs text-slate-500 line-clamp-1">
                        {slide.text.title || slide.text.subtitle || slide.text.body || 'No headline'}
                      </p>
                    )}
                  </div>

                  {/* Active building blocks badges */}
                  <div className="flex flex-wrap items-center gap-1.5 pt-1">
                    {slide.image?.enabled && (
                      <Badge tone={isFullImage ? 'brand' : 'slate'}>
                        {isFullImage ? 'Full Image' : 'Image'}
                      </Badge>
                    )}
                    {slide.text?.enabled && !isFullImage && (
                      <Badge tone="slate">
                        Text
                      </Badge>
                    )}
                    {slide.cta?.enabled && (
                      <Badge tone="brand">
                        <SlideIcon name={slide.cta.icon} className="h-3 w-3" />
                        CTA: {slide.cta.style}
                      </Badge>
                    )}
                  </div>
                </div>

                {/* Footer Actions */}
                <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50/60 px-4 py-2.5">
                  <span className="text-[11px] text-slate-400">
                    {slide.cta?.enabled ? slide.cta.label : 'No button'}
                  </span>

                  {canAdmin && (
                    <div className="flex items-center gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => duplicateSlide(slide)}
                        title="Duplicate slide"
                        className="h-7 w-7 p-0"
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setEditingSlide(slide)}
                        title="Edit slide"
                        className="h-7 w-7 p-0"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <ConfirmButton
                        size="sm"
                        variant="ghost"
                        onConfirm={() => removeSlide(slide.id)}
                        message="Delete this slide from your library?"
                        title="Delete slide"
                        className="h-7 w-7 p-0 text-red-600 hover:bg-red-50 hover:text-red-700"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </ConfirmButton>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Slide Editor Modal */}
      <SlideEditorModal
        open={Boolean(editingSlide)}
        onClose={() => setEditingSlide(null)}
        slide={editingSlide}
        churchId={church.id}
        church={church}
        onSave={saveSlide}
      />
    </>
  );
}
