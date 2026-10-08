import {
  Bold,
  Heading,
  Image as ImageIcon,
  Info,
  Italic,
  Link as LinkIcon,
  List,
  ListOrdered,
  Maximize2,
  MousePointerClick,
  Quote,
  Sparkles,
  Type,
} from 'lucide-react';
import { type FormEvent, useEffect, useRef, useState } from 'react';
import { Markdown } from '../../components/Markdown';
import { SLIDE_ICONS, SlideIcon } from '../../components/SlideIcon';
import {
  Badge,
  Button,
  Field,
  Input,
  Modal,
  Select,
  Textarea,
  Toggle,
  cx,
  useToast,
} from '../../components/ui';
import type {
  AppDeeplink,
  Church,
  SlideCtaActionType,
  SlideCtaStyle,
  SlideDefinition,
} from '../../lib/types';
import { errorMessage, shortId } from '../../lib/utils';
import { PlanningCenterPicker } from './ActionEditors';
import { ImageInput } from './ImageInput';

interface Props {
  open: boolean;
  onClose: () => void;
  slide: Partial<SlideDefinition> | null;
  churchId: string;
  church: Church;
  onSave: (saved: SlideDefinition) => Promise<void> | void;
}

export function SlideEditorModal({
  open,
  onClose,
  slide,
  churchId,
  church,
  onSave,
}: Props) {
  const toast = useToast();
  const [data, setData] = useState<SlideDefinition | null>(null);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'editor' | 'preview'>('editor');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const deeplinks = (church.landing?.app_deeplinks || []) as AppDeeplink[];

  useEffect(() => {
    if (!slide) {
      setData(null);
      return;
    }

    const initial: SlideDefinition = {
      id: slide.id || shortId(),
      name: slide.name || 'New Slide',
      image: {
        enabled: slide.image?.enabled ?? false,
        url: slide.image?.url ?? '',
        is_full_image: slide.image?.is_full_image ?? false,
      },
      text: {
        enabled: slide.text?.enabled ?? true,
        title: slide.text?.title ?? '',
        subtitle: slide.text?.subtitle ?? '',
        body: slide.text?.body ?? '',
      },
      cta: {
        enabled: slide.cta?.enabled ?? false,
        style: slide.cta?.style ?? 'button',
        icon: slide.cta?.icon ?? 'external-link',
        label: slide.cta?.label ?? 'Learn More',
        action_type: slide.cta?.action_type ?? 'url',
        target_url: slide.cta?.target_url ?? '',
        deeplink_id: slide.cta?.deeplink_id ?? '',
        mailto_email: slide.cta?.mailto_email ?? '',
        mailto_subject: slide.cta?.mailto_subject ?? '',
      },
      created_at: slide.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    // If full image is enabled, force text block to disabled
    if (initial.image.enabled && initial.image.is_full_image) {
      initial.text.enabled = false;
    }

    setData(initial);
    setActiveTab('editor');
  }, [slide]);

  if (!data) return null;

  const isFullImage = Boolean(data.image.enabled && data.image.is_full_image);

  const updateImage = (patch: Partial<SlideDefinition['image']>) => {
    setData((prev) => {
      if (!prev) return prev;
      const nextImage = { ...prev.image, ...patch };
      let nextText = { ...prev.text };
      if (nextImage.enabled && nextImage.is_full_image) {
        // Enforce rule: full image disables all other blocks except CTA
        nextText.enabled = false;
      }
      return { ...prev, image: nextImage, text: nextText };
    });
  };

  const updateText = (patch: Partial<SlideDefinition['text']>) => {
    setData((prev) => {
      if (!prev) return prev;
      return { ...prev, text: { ...prev.text, ...patch } };
    });
  };

  const updateCta = (patch: Partial<SlideDefinition['cta']>) => {
    setData((prev) => {
      if (!prev) return prev;
      return { ...prev, cta: { ...prev.cta, ...patch } };
    });
  };

  // RTE formatting helpers for the body text area
  const insertFormatting = (prefix: string, suffix = '') => {
    const el = textareaRef.current;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const current = data.text.body || '';
    const selected = current.substring(start, end);
    const replacement = `${prefix}${selected || 'text'}${suffix}`;
    const nextBody = current.substring(0, start) + replacement + current.substring(end);
    updateText({ body: nextBody });

    setTimeout(() => {
      el.focus();
      el.setSelectionRange(start + prefix.length, start + prefix.length + (selected ? selected.length : 4));
    }, 10);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!data.name?.trim()) {
      toast('Please provide a name for this slide', 'error');
      return;
    }

    if (!data.image.enabled && !data.text.enabled && !data.cta.enabled) {
      toast('Please enable at least one building block (Image, Text, or CTA)', 'error');
      return;
    }

    if (data.image.enabled && !data.image.url?.trim()) {
      toast('Image block is enabled but no image URL or file was provided', 'error');
      return;
    }

    if (data.text.enabled && !data.text.title?.trim() && !data.text.body?.trim()) {
      toast('Text block is enabled but title and message are empty', 'error');
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
    <Modal
      open={open}
      onClose={onClose}
      title={slide?.id ? `Edit Slide: ${slide.name || 'Untitled'}` : 'New Slide Builder'}
      wide
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Slide Identification */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200/80 pb-4">
          <div className="flex-1 min-w-[240px]">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
              Slide Name (Library reference)
            </label>
            <Input
              required
              value={data.name}
              onChange={(e) => setData({ ...data, name: e.target.value })}
              placeholder="e.g. Next Steps Class, Youth Night, Camp 2026"
              className="font-semibold text-slate-900"
            />
          </div>

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
                    <p className="text-xs text-slate-500">Add a header photo, graphic banner, or full slide image</p>
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
                          Display image full-bleed without text headers. When enabled, the Text Block is disabled and CTA can be overlaid at the bottom.
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
                    <p className="text-xs text-slate-500">Title, subtitle, and formatted announcement body</p>
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
                    Text Block is disabled because <strong>Full Image Option</strong> is checked in the Image Block. Uncheck Full Image to enable title and text.
                  </span>
                </div>
              ) : data.text.enabled ? (
                <div className="mt-4 space-y-4 animate-fade-in">
                  <Field label="Title / Headline" hint="Prominent headline for this slide">
                    <Input
                      value={data.text.title || ''}
                      onChange={(e) => updateText({ title: e.target.value })}
                      placeholder="e.g. Next Steps Class"
                    />
                  </Field>

                  <Field label="Subtitle (optional)" hint="Secondary line or date, e.g. 'Starting Sunday, Oct 12 · 11:30 AM'">
                    <Input
                      value={data.text.subtitle || ''}
                      onChange={(e) => updateText({ subtitle: e.target.value })}
                      placeholder="e.g. This Sunday at 11:30 AM · Room 204"
                    />
                  </Field>

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="block text-xs font-semibold text-slate-700">
                        Body text (RTE / Markdown editor)
                      </label>
                      <span className="text-[11px] text-slate-400">Formatting toolbar supported</span>
                    </div>

                    {/* RTE Toolbar */}
                    <div className="flex flex-wrap items-center gap-1 rounded-t-xl border border-b-0 border-slate-300 bg-slate-50 p-1.5">
                      <button
                        type="button"
                        onClick={() => insertFormatting('**', '**')}
                        title="Bold (**text**)"
                        className="rounded p-1 text-slate-600 hover:bg-slate-200"
                      >
                        <Bold className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => insertFormatting('*', '*')}
                        title="Italic (*text*)"
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
                      placeholder="Share details, descriptions, instructions, or bullet points here..."
                      className="rounded-t-none"
                    />
                  </div>
                </div>
              ) : null}
            </div>

            {/* ------------------------------------------------------------- */}
            {/* BLOCK 3: CTA BLOCK */}
            {/* ------------------------------------------------------------- */}
            <div
              className={cx(
                'rounded-2xl border p-4 sm:p-5 transition-all',
                data.cta.enabled
                  ? 'border-brand/40 bg-brand/[0.02]'
                  : 'border-slate-200 bg-slate-50/50 opacity-90',
              )}
            >
              <div className="flex items-center justify-between border-b border-slate-200/80 pb-3">
                <div className="flex items-center gap-2.5">
                  <div
                    className={cx(
                      'flex h-9 w-9 items-center justify-center rounded-xl',
                      data.cta.enabled ? 'bg-brand/10 text-brand' : 'bg-slate-200 text-slate-500',
                    )}
                  >
                    <MousePointerClick className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">3. Call to Action (CTA) Block</h3>
                    <p className="text-xs text-slate-500">
                      Button, link, or icon directing attendees to an app, sign-up, email, or website
                    </p>
                  </div>
                </div>
                <Toggle
                  checked={data.cta.enabled}
                  onChange={(checked) => updateCta({ enabled: checked })}
                  label="Enable CTA Block"
                />
              </div>

              {data.cta.enabled && (
                <div className="mt-4 space-y-4 animate-fade-in">
                  {/* Button style selector */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Button Style
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {(
                        [
                          { id: 'button', label: 'Solid Button', desc: 'Prominent high-contrast button' },
                          { id: 'link', label: 'Link Text', desc: 'Subtle text link with arrow' },
                          { id: 'icon', label: 'Icon with Text', desc: 'Badge with chosen icon' },
                        ] as const
                      ).map((s) => (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => updateCta({ style: s.id as SlideCtaStyle })}
                          className={cx(
                            'rounded-xl border p-2.5 text-left transition',
                            data.cta.style === s.id
                              ? 'border-brand bg-brand/10 ring-1 ring-brand'
                              : 'border-slate-200 bg-white hover:border-slate-300',
                          )}
                        >
                          <span className="block text-xs font-bold text-slate-900">{s.label}</span>
                          <span className="block text-[11px] text-slate-500 mt-0.5">{s.desc}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Icon Selector */}
                  <div className="space-y-1.5">
                    <label className="block text-xs font-semibold text-slate-700">
                      Icon
                    </label>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {SLIDE_ICONS.map((ico) => {
                        const isSelected = data.cta.icon === ico.id;
                        return (
                          <button
                            key={ico.id}
                            type="button"
                            onClick={() => updateCta({ icon: ico.id })}
                            title={ico.label}
                            className={cx(
                              'flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs transition',
                              isSelected
                                ? 'border-brand bg-brand text-white font-semibold shadow-sm'
                                : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300',
                            )}
                          >
                            <SlideIcon name={ico.id} className="h-3.5 w-3.5" />
                            <span>{ico.label.split(' / ')[0]}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Button text */}
                  <Field label="Button Text / Label" hint="e.g. Register Now, Download App, Get in Touch">
                    <Input
                      required
                      value={data.cta.label || ''}
                      onChange={(e) => updateCta({ label: e.target.value })}
                      placeholder="e.g. Register Now"
                    />
                  </Field>

                  {/* Action Link Type */}
                  <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-3.5">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Action Link Target
                      </label>
                      <Select
                        value={data.cta.action_type || 'url'}
                        onChange={(e) =>
                          updateCta({ action_type: e.target.value as SlideCtaActionType })
                        }
                      >
                        <option value="url">Web URL (https://…)</option>
                        <option value="deeplink">Phone App Deeplink (iOS & Android dynamic)</option>
                        <option value="pco">Planning Center Online (Form / Event)</option>
                        <option value="mailto">Email Contact (mailto:)</option>
                      </Select>
                    </div>

                    {/* Web URL */}
                    {data.cta.action_type === 'url' && (
                      <Field label="Web Link URL" hint="Opens in new tab">
                        <Input
                          type="url"
                          value={data.cta.target_url || ''}
                          onChange={(e) => updateCta({ target_url: e.target.value })}
                          placeholder="https://example.com/register"
                        />
                      </Field>
                    )}

                    {/* Phone App Deeplink */}
                    {data.cta.action_type === 'deeplink' && (
                      <div className="space-y-2">
                        <label className="block text-xs font-semibold text-slate-700">
                          Select App Deeplink
                        </label>
                        {deeplinks.length > 0 ? (
                          <Select
                            value={data.cta.deeplink_id || ''}
                            onChange={(e) => updateCta({ deeplink_id: e.target.value })}
                          >
                            <option value="">-- Choose an App Deeplink --</option>
                            {deeplinks.map((d) => (
                              <option key={d.id} value={d.id}>
                                {d.label} {d.ios_url ? '(iOS)' : ''} {d.android_url ? '(Android)' : ''}
                              </option>
                            ))}
                          </Select>
                        ) : (
                          <div className="rounded-xl bg-amber-50 p-3 text-xs text-amber-800 space-y-1">
                            <p className="font-semibold">No Phone App Deeplinks configured yet.</p>
                            <p>
                              Create your app links in <a href="deeplinks" className="text-brand underline">Actions &gt; App Deeplinks</a> to choose them here.
                            </p>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Planning Center Picker */}
                    {data.cta.action_type === 'pco' && (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-slate-700">Planning Center Link</span>
                          <PlanningCenterPicker
                            church={church}
                            onSelect={(item) =>
                              updateCta({
                                label: data.cta.label || (item.type === 'signup' ? 'Register' : 'Sign Up'),
                                target_url: item.url,
                              })
                            }
                          />
                        </div>
                        <Input
                          value={data.cta.target_url || ''}
                          onChange={(e) => updateCta({ target_url: e.target.value })}
                          placeholder="https://churchcenter.com/registrations/..."
                        />
                      </div>
                    )}

                    {/* Mailto */}
                    {data.cta.action_type === 'mailto' && (
                      <div className="space-y-3">
                        <Field label="Recipient Email Address">
                          <Input
                            type="email"
                            value={data.cta.mailto_email || ''}
                            onChange={(e) => updateCta({ mailto_email: e.target.value })}
                            placeholder="pastor@church.org"
                          />
                        </Field>
                        <Field label="Email Subject (optional)">
                          <Input
                            value={data.cta.mailto_subject || ''}
                            onChange={(e) => updateCta({ mailto_subject: e.target.value })}
                            placeholder="e.g. Inquiry about Next Steps"
                          />
                        </Field>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          /* Live preview tab */
          <div className="space-y-4">
            <p className="text-xs text-slate-500">
              Live preview rendered using your church's color scheme and styling:
            </p>
            <SlidePreviewCard slide={data} church={church} deeplinks={deeplinks} />
          </div>
        )}

        <div className="flex items-center justify-between border-t border-slate-200/80 pt-4">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={saving} className="gap-2">
            Save Slide to Library
          </Button>
        </div>
      </form>
    </Modal>
  );
}

export function SlidePreviewCard({
  slide,
}: {
  slide: SlideDefinition;
  church?: Church;
  deeplinks?: AppDeeplink[];
}) {
  const isFullImage = Boolean(slide.image?.enabled && slide.image?.is_full_image);

  return (
    <div className="mx-auto max-w-sm overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl transition">
      {/* Full image presentation */}
      {isFullImage ? (
        <div className="relative aspect-[16/9] w-full bg-slate-900">
          {slide.image.url ? (
            <img src={slide.image.url} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-xs text-slate-400">
              [Full Image Placeholder]
            </div>
          )}

          {slide.cta?.enabled && (
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-4 pt-8">
              {slide.cta.style === 'button' ? (
                <div className="flex items-center justify-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-sm font-bold text-white shadow-lg shadow-black/30">
                  <SlideIcon name={slide.cta.icon} className="h-4 w-4" />
                  <span>{slide.cta.label || 'Learn More'}</span>
                </div>
              ) : slide.cta.style === 'link' ? (
                <div className="flex items-center justify-center gap-1.5 text-sm font-semibold text-white drop-shadow">
                  <span>{slide.cta.label || 'Learn More'}</span>
                  <SlideIcon name={slide.cta.icon} className="h-4 w-4" />
                </div>
              ) : (
                <div className="flex items-center justify-center gap-2 rounded-xl bg-white/90 backdrop-blur px-4 py-2 text-sm font-semibold text-slate-900 shadow">
                  <SlideIcon name={slide.cta.icon} className="h-4 w-4 text-brand" />
                  <span>{slide.cta.label || 'Learn More'}</span>
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        /* Normal layout */
        <div>
          {slide.image.enabled && slide.image.url && (
            <div className="aspect-[16/9] w-full overflow-hidden bg-slate-100">
              <img src={slide.image.url} alt="" className="h-full w-full object-cover" />
            </div>
          )}

          <div className="space-y-4 p-5">
            {slide.text.enabled && (
              <div className="space-y-1">
                {slide.text.subtitle && (
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                    {slide.text.subtitle}
                  </p>
                )}
                {slide.text.title && (
                  <h3 className="text-xl font-bold leading-tight text-slate-900">
                    {slide.text.title}
                  </h3>
                )}
                {slide.text.body && (
                  <div className="pt-1 text-sm text-slate-600">
                    <Markdown>{slide.text.body}</Markdown>
                  </div>
                )}
              </div>
            )}

            {slide.cta?.enabled && (
              <div>
                {slide.cta.style === 'button' ? (
                  <div className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand px-5 py-3 text-sm font-bold text-white shadow-md shadow-brand/20">
                    <SlideIcon name={slide.cta.icon} className="h-4 w-4" />
                    <span>{slide.cta.label || 'Learn More'}</span>
                  </div>
                ) : slide.cta.style === 'link' ? (
                  <div className="flex items-center gap-1.5 text-sm font-bold text-brand hover:underline">
                    <span>{slide.cta.label || 'Learn More'}</span>
                    <SlideIcon name={slide.cta.icon} className="h-4 w-4" />
                  </div>
                ) : (
                  <div className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-semibold text-slate-800">
                    <SlideIcon name={slide.cta.icon} className="h-4 w-4 text-brand" />
                    <span>{slide.cta.label || 'Learn More'}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
