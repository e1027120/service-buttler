import {
  Bold,
  BookOpen,
  Heading,
  Image as ImageIcon,
  Info,
  Italic,
  Link as LinkIcon,
  List,
  ListOrdered,
  Maximize2,
  Quote,
  Sparkles,
  Type,
} from 'lucide-react';
import { type FormEvent, useEffect, useRef, useState } from 'react';
import { Markdown } from '../../components/Markdown';
import {
  Badge,
  Button,
  Field,
  Input,
  Modal,
  Textarea,
  Toggle,
  cx,
  useToast,
} from '../../components/ui';
import { fetchBibleVerse, type VerseResult } from '../../lib/bible';
import { sermonDefinitionToSlide, sermonSlideToDefinition } from '../../lib/sermons';
import type { Church, SermonSlide, SermonSlideDefinition } from '../../lib/types';
import { errorMessage } from '../../lib/utils';
import { ImageInput } from './ImageInput';

interface Props {
  open: boolean;
  onClose: () => void;
  slide: SermonSlide | null;
  churchId: string;
  church?: Church;
  onSave: (saved: SermonSlide) => void;
}

export function SermonSlideEditorModal({
  open,
  onClose,
  slide,
  churchId,
  onSave,
}: Props) {
  const toast = useToast();
  const [data, setData] = useState<SermonSlideDefinition | null>(null);
  const [activeTab, setActiveTab] = useState<'editor' | 'preview'>('editor');
  const [versePreview, setVersePreview] = useState<VerseResult | null>(null);
  const [loadingVerse, setLoadingVerse] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!slide) {
      setData(null);
      return;
    }
    const def = sermonSlideToDefinition(slide);
    if (def.image.enabled && def.image.is_full_image) {
      def.text.enabled = false;
    }
    setData(def);
    setActiveTab('editor');
  }, [slide]);

  // Lookup bible verse when user enters reference
  useEffect(() => {
    const ref = data?.text?.verse_reference?.trim();
    if (!ref || ref.length < 3) {
      setVersePreview(null);
      return;
    }
    let active = true;
    const timer = setTimeout(() => {
      setLoadingVerse(true);
      fetchBibleVerse(ref)
        .then((res) => {
          if (active) setVersePreview(res);
        })
        .catch(() => {
          if (active) setVersePreview(null);
        })
        .finally(() => {
          if (active) setLoadingVerse(false);
        });
    }, 600);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [data?.text?.verse_reference]);

  if (!data) return null;

  const isFullImage = Boolean(data.image.enabled && data.image.is_full_image);

  const updateImage = (patch: Partial<SermonSlideDefinition['image']>) => {
    setData((prev) => {
      if (!prev) return prev;
      const nextImage = { ...prev.image, ...patch };
      let nextText = { ...prev.text };
      if (nextImage.enabled && nextImage.is_full_image) {
        nextText.enabled = false;
      }
      return { ...prev, image: nextImage, text: nextText };
    });
  };

  const updateText = (patch: Partial<SermonSlideDefinition['text']>) => {
    setData((prev) => {
      if (!prev) return prev;
      return { ...prev, text: { ...prev.text, ...patch } };
    });
  };

  const insertFormatting = (prefix: string, suffix = '') => {
    const el = textareaRef.current;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const current = data.text.body || '';
    const selected = current.substring(start, end);
    const replacement = `${prefix}${selected || 'notes'}${suffix}`;
    const nextBody = current.substring(0, start) + replacement + current.substring(end);
    updateText({ body: nextBody });

    setTimeout(() => {
      el.focus();
      el.setSelectionRange(start + prefix.length, start + prefix.length + (selected ? selected.length : 5));
    }, 10);
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!data.image.enabled && !data.text.enabled) {
      toast('Please enable either the Image Block or Text Block', 'error');
      return;
    }
    if (data.image.enabled && !data.image.url?.trim()) {
      toast('Image Block is enabled but no image was uploaded or entered', 'error');
      return;
    }

    try {
      const converted = sermonDefinitionToSlide(data);
      onSave(converted);
      onClose();
    } catch (err) {
      toast(errorMessage(err), 'error');
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Sermon Slide Builder"
      wide
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Tab switch */}
        <div className="flex items-center justify-between border-b border-slate-200/80 pb-3">
          <p className="text-xs text-slate-500">
            Customize the slide using modular Image and Text building blocks.
          </p>

          <div className="flex items-center gap-1 rounded-xl bg-slate-100 p-1">
            <button
              type="button"
              onClick={() => setActiveTab('editor')}
              className={cx(
                'rounded-lg px-3 py-1.5 text-xs font-semibold transition',
                activeTab === 'editor'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900',
              )}
            >
              Building Blocks
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('preview')}
              className={cx(
                'rounded-lg px-3 py-1.5 text-xs font-semibold transition flex items-center gap-1.5',
                activeTab === 'preview'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900',
              )}
            >
              <Sparkles className="h-3.5 w-3.5 text-amber-500" />
              Live Preview
            </button>
          </div>
        </div>

        {activeTab === 'editor' ? (
          <div className="space-y-6">
            {/* ------------------------------------------------------------- */}
            {/* BLOCK 1: IMAGE BLOCK */}
            {/* ------------------------------------------------------------- */}
            <div
              className={cx(
                'rounded-2xl border p-4 sm:p-5 transition-all',
                data.image.enabled
                  ? 'border-brand/40 bg-brand/[0.02]'
                  : 'border-slate-200 bg-slate-50/50 opacity-90',
              )}
            >
              <div className="flex items-center justify-between border-b border-slate-200/80 pb-3">
                <div className="flex items-center gap-2.5">
                  <div
                    className={cx(
                      'flex h-9 w-9 items-center justify-center rounded-xl',
                      data.image.enabled ? 'bg-brand/10 text-brand' : 'bg-slate-200 text-slate-500',
                    )}
                  >
                    <ImageIcon className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">1. Image Block</h3>
                    <p className="text-xs text-slate-500">
                      Upload a background photo, graphic, or full slide image
                    </p>
                  </div>
                </div>
                <Toggle
                  checked={data.image.enabled}
                  onChange={(checked) => updateImage({ enabled: checked })}
                  label="Enable Image Block"
                />
              </div>

              {data.image.enabled && (
                <div className="mt-4 space-y-4 animate-fade-in">
                  <ImageInput
                    churchId={churchId}
                    label="Slide Image"
                    value={data.image.url}
                    onChange={(url) => updateImage({ url: url || '' })}
                  />

                  <div className="rounded-xl border border-dashed border-slate-300 bg-white p-3.5 space-y-2">
                    <label className="flex items-start gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={data.image.is_full_image}
                        onChange={(e) => updateImage({ is_full_image: e.target.checked })}
                        className="mt-1 h-4 w-4 rounded border-slate-300 text-brand focus:ring-brand"
                      />
                      <div className="text-xs">
                        <span className="font-bold text-slate-900 flex items-center gap-1.5">
                          <Maximize2 className="h-3.5 w-3.5 text-brand" /> Full Image Option
                        </span>
                        <p className="text-slate-500 mt-0.5">
                          Make image fill the whole slide. When enabled, all text blocks are disabled.
                        </p>
                      </div>
                    </label>
                  </div>
                </div>
              )}
            </div>

            {/* ------------------------------------------------------------- */}
            {/* BLOCK 2: TEXT BLOCK */}
            {/* ------------------------------------------------------------- */}
            <div
              className={cx(
                'rounded-2xl border p-4 sm:p-5 transition-all',
                isFullImage
                  ? 'border-slate-200 bg-slate-100/70 opacity-60'
                  : data.text.enabled
                  ? 'border-brand/40 bg-brand/[0.02]'
                  : 'border-slate-200 bg-slate-50/50 opacity-90',
              )}
            >
              <div className="flex items-center justify-between border-b border-slate-200/80 pb-3">
                <div className="flex items-center gap-2.5">
                  <div
                    className={cx(
                      'flex h-9 w-9 items-center justify-center rounded-xl',
                      data.text.enabled && !isFullImage ? 'bg-brand/10 text-brand' : 'bg-slate-200 text-slate-500',
                    )}
                  >
                    <Type className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-bold text-slate-900">2. Text Block</h3>
                      {isFullImage && (
                        <Badge tone="slate">
                          Disabled by Full Image
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-slate-500">
                      Main Point, Bible Verse, and Body Text (all optional)
                    </p>
                  </div>
                </div>
                {!isFullImage && (
                  <Toggle
                    checked={data.text.enabled}
                    onChange={(checked) => updateText({ enabled: checked })}
                    label="Enable Text Block"
                  />
                )}
              </div>

              {isFullImage ? (
                <div className="mt-3 flex items-center gap-2 rounded-xl bg-amber-50/80 p-3 text-xs text-amber-800">
                  <Info className="h-4 w-4 shrink-0 text-amber-600" />
                  <span>
                    Text Block is disabled because <strong>Full Image Option</strong> is enabled. Uncheck Full Image to edit text.
                  </span>
                </div>
              ) : data.text.enabled ? (
                <div className="mt-4 space-y-4 animate-fade-in">
                  {/* Number Control Option */}
                  <div className="rounded-xl border border-slate-200 bg-white p-3.5 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-xs font-bold text-slate-900">Display Point / Slide Number</span>
                        <p className="text-[11px] text-slate-500">
                          Control whether a number badge is shown next to the headline in the frontend.
                        </p>
                      </div>
                      <Toggle
                        checked={Boolean(data.text.show_number)}
                        onChange={(checked) => updateText({ show_number: checked })}
                        label="Show Number Badge"
                      />
                    </div>

                    {data.text.show_number && (
                      <div className="pt-2 border-t border-slate-100">
                        <Field
                          label="Custom Number / Label (optional)"
                          hint="e.g. 1, 2, A, B, or Part 1. Leave blank for automatic position number."
                        >
                          <Input
                            value={data.text.slide_number || ''}
                            onChange={(e) => updateText({ slide_number: e.target.value })}
                            placeholder="e.g. 1 (or leave blank for automatic)"
                            className="max-w-xs"
                          />
                        </Field>
                      </div>
                    )}
                  </div>

                  <Field label="Main Point / Headline (optional)" hint="e.g. Present struggles are temporary">
                    <Input
                      value={data.text.title || ''}
                      onChange={(e) => updateText({ title: e.target.value })}
                      placeholder="e.g. Hope anchors our soul"
                    />
                  </Field>

                  <Field label="Bible Verse Reference (optional)" hint="e.g. Romans 8:18 or John 3:16">
                    <Input
                      value={data.text.verse_reference || ''}
                      onChange={(e) => updateText({ verse_reference: e.target.value })}
                      placeholder="e.g. Romans 8:18"
                    />
                  </Field>

                  {/* Live Bible verse preview card if available */}
                  {data.text.verse_reference && (
                    <div className="rounded-xl border border-brand/20 bg-brand/5 p-3 text-xs space-y-1">
                      <div className="flex items-center justify-between text-brand font-bold">
                        <span className="flex items-center gap-1.5">
                          <BookOpen className="h-3.5 w-3.5" />
                          {versePreview?.reference || data.text.verse_reference}
                        </span>
                        {versePreview?.translation_name && (
                          <span className="text-[10px] text-slate-500">{versePreview.translation_name}</span>
                        )}
                      </div>
                      {loadingVerse ? (
                        <p className="italic text-slate-400">Looking up verse scripture…</p>
                      ) : versePreview?.text ? (
                        <p className="italic text-slate-700 font-serif">“{versePreview.text}”</p>
                      ) : (
                        <p className="text-slate-500">Will be fetched automatically for attendees</p>
                      )}
                    </div>
                  )}

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="block text-xs font-semibold text-slate-700">
                        Body Text / Notes (optional RTE Editor)
                      </label>
                      <span className="text-[11px] text-slate-400">Markdown formatting supported</span>
                    </div>

                    {/* RTE formatting toolbar */}
                    <div className="flex flex-wrap items-center gap-1 rounded-t-xl border border-b-0 border-slate-300 bg-slate-50 p-1.5">
                      <button
                        type="button"
                        onClick={() => insertFormatting('**', '**')}
                        title="Bold"
                        className="rounded p-1 text-slate-600 hover:bg-slate-200"
                      >
                        <Bold className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => insertFormatting('*', '*')}
                        title="Italic"
                        className="rounded p-1 text-slate-600 hover:bg-slate-200"
                      >
                        <Italic className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => insertFormatting('### ')}
                        title="Heading"
                        className="rounded p-1 text-slate-600 hover:bg-slate-200"
                      >
                        <Heading className="h-3.5 w-3.5" />
                      </button>
                      <span className="mx-1 h-3.5 w-px bg-slate-300" />
                      <button
                        type="button"
                        onClick={() => insertFormatting('- ')}
                        title="Bullet list"
                        className="rounded p-1 text-slate-600 hover:bg-slate-200"
                      >
                        <List className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => insertFormatting('1. ')}
                        title="Numbered list"
                        className="rounded p-1 text-slate-600 hover:bg-slate-200"
                      >
                        <ListOrdered className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => insertFormatting('> ')}
                        title="Quote"
                        className="rounded p-1 text-slate-600 hover:bg-slate-200"
                      >
                        <Quote className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => insertFormatting('[', '](https://)')}
                        title="Link"
                        className="rounded p-1 text-slate-600 hover:bg-slate-200"
                      >
                        <LinkIcon className="h-3.5 w-3.5" />
                      </button>
                    </div>

                    <Textarea
                      ref={textareaRef}
                      rows={4}
                      value={data.text.body || ''}
                      onChange={(e) => updateText({ body: e.target.value })}
                      placeholder="Bullet points, explanatory notes, or quotes for this point..."
                      className="rounded-t-none"
                    />
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        ) : (
          /* Live preview tab */
          <div className="space-y-4">
            <p className="text-xs text-slate-500">Live preview of how this slide renders:</p>
            <div className="mx-auto max-w-sm overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl">
              {isFullImage ? (
                <div className="relative aspect-[16/9] w-full bg-slate-900">
                  {data.image.url ? (
                    <img src={data.image.url} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-xs text-slate-400">
                      [Full Image Slide]
                    </div>
                  )}
                </div>
              ) : (
                <div className="relative">
                  {data.image.enabled && data.image.url && (
                    <div className="aspect-[16/9] w-full overflow-hidden bg-slate-100">
                      <img src={data.image.url} alt="" className="h-full w-full object-cover" />
                    </div>
                  )}
                  <div className="space-y-3.5 p-5">
                    {data.text.title && (
                      <div className="flex items-start gap-2.5">
                        {data.text.show_number && (
                          <span className="flex h-6 min-w-[24px] px-1.5 shrink-0 items-center justify-center rounded-full bg-brand/10 text-xs font-bold text-brand">
                            {data.text.slide_number?.trim() || '1'}
                          </span>
                        )}
                        <h4 className="font-bold text-base leading-snug text-slate-900">
                          {data.text.title}
                        </h4>
                      </div>
                    )}

                    {data.text.verse_reference && (
                      <div className="rounded-xl border border-brand/20 bg-brand/5 p-3 text-xs">
                        <div className="flex items-center gap-1.5 font-bold uppercase tracking-wider text-brand mb-1">
                          <BookOpen className="h-3.5 w-3.5" />
                          {data.text.verse_reference}
                        </div>
                        {versePreview?.text && (
                          <p className="italic text-slate-700 font-serif">“{versePreview.text}”</p>
                        )}
                      </div>
                    )}

                    {data.text.body && (
                      <div className="text-xs text-slate-600">
                        <Markdown>{data.text.body}</Markdown>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        <div className="flex items-center justify-between border-t border-slate-200/80 pt-4">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit">
            Done
          </Button>
        </div>
      </form>
    </Modal>
  );
}
