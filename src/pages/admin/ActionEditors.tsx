import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react';
import type { ReactNode } from 'react';
import { Button, Field, Input, Select, Textarea, Toggle } from '../../components/ui';
import type {
  ActionType,
  AnnouncementContent,
  FormContent,
  FormField,
  LinkContent,
  OfferingContent,
  OfferingMethod,
  PollContent,
  SermonNotesContent,
} from '../../lib/types';
import { shortId } from '../../lib/utils';
import { ImageInput } from './ImageInput';

type C = Record<string, unknown>;

export function defaultContent(type: ActionType): C {
  switch (type) {
    case 'announcement':
      return { body: '' } satisfies AnnouncementContent;
    case 'sermon_notes':
      return { body: '## Main points\n\n1. \n2. \n3. ', allow_personal_notes: true } satisfies SermonNotesContent;
    case 'poll':
      return {
        question: '',
        options: [
          { id: shortId(), label: '' },
          { id: shortId(), label: '' },
        ],
        show_results: true,
        allow_change: true,
        closed: false,
      } satisfies PollContent as C;
    case 'offering':
      return {
        message: 'Thank you for your generosity.',
        methods: [{ id: shortId(), label: 'Give online', url: '' }],
      } satisfies OfferingContent as C;
    case 'form':
      return {
        intro: '',
        fields: [
          { id: 'name', label: 'Name', type: 'text', required: false },
          { id: 'request', label: 'Prayer request', type: 'textarea', required: true },
        ],
        submit_label: 'Send',
        success_message: 'Thank you! Our team will be praying for you.',
      } satisfies FormContent as C;
    case 'link':
      return { url: '', label: 'Open' } satisfies LinkContent;
  }
}

/** Templates for quick starts (form presets etc.) */
export const FORM_PRESETS: Record<string, { title: string; content: FormContent }> = {
  prayer: {
    title: 'Prayer requests',
    content: defaultContent('form') as FormContent,
  },
  connect: {
    title: 'Connect card',
    content: {
      intro: 'New here? We would love to get to know you.',
      fields: [
        { id: 'name', label: 'Full name', type: 'text', required: true },
        { id: 'email', label: 'Email', type: 'email', required: false },
        { id: 'phone', label: 'Phone', type: 'phone', required: false },
        { id: 'message', label: 'How can we help?', type: 'textarea', required: false },
      ],
      submit_label: 'Connect',
      success_message: 'Thanks for connecting! Someone from our team will reach out soon.',
    },
  },
};

export function validateContent(type: ActionType, c: C): string | null {
  if (type === 'poll') {
    const p = c as PollContent;
    const opts = (p.options || []).filter((o) => o.label.trim());
    if (!p.question?.trim()) return 'Poll needs a question';
    if (opts.length < 2) return 'Poll needs at least 2 options';
  }
  if (type === 'form') {
    const f = c as FormContent;
    if (!f.fields?.length) return 'Form needs at least one field';
    const ids = new Set(f.fields.map((x) => x.id));
    if (ids.size !== f.fields.length) return 'Form fields must have unique labels';
  }
  if (type === 'link' && !(c as LinkContent).url) return 'Link needs a URL';
  if (type === 'offering' && !(c as OfferingContent).methods?.length) return 'Add at least one giving method';
  return null;
}

/** Clean up content before saving (drop empty options etc.). */
export function normalizeContent(type: ActionType, c: C): C {
  if (type === 'poll') {
    const p = c as PollContent;
    return { ...p, options: (p.options || []).filter((o) => o.label.trim()).map((o) => ({ ...o, label: o.label.trim() })) };
  }
  return c;
}

export function ContentEditor({ type, value, onChange, churchId }: { type: ActionType; value: C; onChange: (c: C) => void; churchId: string }) {
  const set = (patch: C) => onChange({ ...value, ...patch });
  switch (type) {
    case 'announcement': {
      const v = value as AnnouncementContent;
      return (
        <div className="space-y-4">
          <ImageInput churchId={churchId} label="Image" value={v.image_url} onChange={(url) => set({ image_url: url })} />
          <Field label="Message" hint="Markdown supported: **bold**, _italic_, lists, [links](https://…)">
            <Textarea rows={6} value={v.body || ''} onChange={(e) => set({ body: e.target.value })} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Button label">
              <Input value={v.cta_label || ''} onChange={(e) => set({ cta_label: e.target.value })} placeholder="Register" />
            </Field>
            <Field label="Button URL">
              <Input type="url" value={v.cta_url || ''} onChange={(e) => set({ cta_url: e.target.value })} placeholder="https://" />
            </Field>
          </div>
        </div>
      );
    }
    case 'sermon_notes': {
      const v = value as SermonNotesContent;
      return (
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Speaker">
              <Input value={v.speaker || ''} onChange={(e) => set({ speaker: e.target.value })} />
            </Field>
            <Field label="Scripture">
              <Input value={v.scripture || ''} onChange={(e) => set({ scripture: e.target.value })} placeholder="John 3:16-21" />
            </Field>
          </div>
          <Field label="Outline / notes" hint="Markdown supported">
            <Textarea rows={10} className="font-mono" value={v.body || ''} onChange={(e) => set({ body: e.target.value })} />
          </Field>
          <Toggle
            checked={v.allow_personal_notes !== false}
            onChange={(b) => set({ allow_personal_notes: b })}
            label="Personal notes"
            description="Let attendees type their own notes (stored on their device)."
          />
        </div>
      );
    }
    case 'poll': {
      const v = value as PollContent;
      const options = v.options || [];
      return (
        <div className="space-y-4">
          <Field label="Question">
            <Input required value={v.question || ''} onChange={(e) => set({ question: e.target.value })} />
          </Field>
          <div>
            <span className="label">Options</span>
            <ListEditor
              items={options}
              onChange={(o) => set({ options: o })}
              create={() => ({ id: shortId(), label: '' })}
              addLabel="Add option"
              render={(o, update) => <Input value={o.label} onChange={(e) => update({ ...o, label: e.target.value })} placeholder="Option" />}
            />
          </div>
          <div className="space-y-3">
            <Toggle checked={v.show_results !== false} onChange={(b) => set({ show_results: b })} label="Show results to attendees" />
            <Toggle checked={v.allow_change !== false} onChange={(b) => set({ allow_change: b })} label="Allow changing vote" />
            <Toggle checked={Boolean(v.closed)} onChange={(b) => set({ closed: b })} label="Closed" description="Stop accepting votes, keep showing results." />
          </div>
        </div>
      );
    }
    case 'offering': {
      const v = value as OfferingContent;
      return (
        <div className="space-y-4">
          <Field label="Message" hint="Markdown supported">
            <Textarea rows={3} value={v.message || ''} onChange={(e) => set({ message: e.target.value })} />
          </Field>
          <div>
            <span className="label">Giving methods</span>
            <ListEditor<OfferingMethod>
              items={v.methods || []}
              onChange={(m) => set({ methods: m })}
              create={() => ({ id: shortId(), label: '' })}
              addLabel="Add method"
              render={(m, update) => (
                <div className="grid w-full gap-2 rounded-lg border border-slate-200 p-3">
                  <Input required value={m.label} onChange={(e) => update({ ...m, label: e.target.value })} placeholder="Label (e.g. Card / PayPal / Bank transfer)" />
                  <Input value={m.description || ''} onChange={(e) => update({ ...m, description: e.target.value })} placeholder="Short description (optional)" />
                  <Input type="url" value={m.url || ''} onChange={(e) => update({ ...m, url: e.target.value })} placeholder="Giving link https://… (optional)" />
                  <Textarea
                    rows={2}
                    className="min-h-0 font-mono"
                    value={m.details || ''}
                    onChange={(e) => update({ ...m, details: e.target.value })}
                    placeholder={'Copyable details, e.g.\nIBAN: DE00 0000 0000 0000\nReference: Offering'}
                  />
                </div>
              )}
            />
          </div>
        </div>
      );
    }
    case 'form': {
      const v = value as FormContent;
      return (
        <div className="space-y-4">
          <Field label="Intro" hint="Markdown supported">
            <Textarea rows={2} value={v.intro || ''} onChange={(e) => set({ intro: e.target.value })} />
          </Field>
          <div>
            <span className="label">Fields</span>
            <ListEditor<FormField>
              items={v.fields || []}
              onChange={(f) => set({ fields: f })}
              create={() => ({ id: `field_${shortId()}`, label: '', type: 'text' })}
              addLabel="Add field"
              render={(f, update) => (
                <div className="grid w-full grid-cols-[1fr_auto] gap-2 sm:grid-cols-[1fr_130px_auto]">
                  <Input required value={f.label} onChange={(e) => update({ ...f, label: e.target.value })} placeholder="Field label" />
                  <Select value={f.type} onChange={(e) => update({ ...f, type: e.target.value as FormField['type'] })}>
                    <option value="text">Short text</option>
                    <option value="textarea">Long text</option>
                    <option value="email">Email</option>
                    <option value="phone">Phone</option>
                  </Select>
                  <label className="flex items-center gap-1.5 text-sm text-slate-600">
                    <input type="checkbox" checked={Boolean(f.required)} onChange={(e) => update({ ...f, required: e.target.checked })} />
                    Required
                  </label>
                </div>
              )}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Submit button">
              <Input value={v.submit_label || ''} onChange={(e) => set({ submit_label: e.target.value })} placeholder="Submit" />
            </Field>
            <Field label="Success message">
              <Input value={v.success_message || ''} onChange={(e) => set({ success_message: e.target.value })} />
            </Field>
          </div>
        </div>
      );
    }
    case 'link': {
      const v = value as LinkContent;
      return (
        <div className="space-y-4">
          <Field label="URL">
            <Input type="url" required value={v.url || ''} onChange={(e) => set({ url: e.target.value })} placeholder="https://" />
          </Field>
          <Field label="Button label">
            <Input value={v.label || ''} onChange={(e) => set({ label: e.target.value })} />
          </Field>
          <Field label="Description" hint="Markdown supported">
            <Textarea rows={3} value={v.description || ''} onChange={(e) => set({ description: e.target.value })} />
          </Field>
          <ImageInput churchId={churchId} label="Image" value={v.image_url} onChange={(url) => set({ image_url: url })} />
        </div>
      );
    }
  }
}

function ListEditor<T>({
  items,
  onChange,
  create,
  render,
  addLabel,
}: {
  items: T[];
  onChange: (items: T[]) => void;
  create: () => T;
  render: (item: T, update: (v: T) => void) => ReactNode;
  addLabel: string;
}) {
  const move = (i: number, d: number) => {
    const next = [...items];
    const [x] = next.splice(i, 1);
    next.splice(i + d, 0, x);
    onChange(next);
  };
  return (
    <div className="space-y-2">
      {items.map((item, i) => (
        <div key={i} className="flex items-start gap-1">
          <div className="flex-1">{render(item, (v) => onChange(items.map((x, j) => (j === i ? v : x))))}</div>
          <div className="flex flex-col">
            <button type="button" disabled={i === 0} onClick={() => move(i, -1)} className="rounded p-1 text-slate-400 hover:bg-slate-100 disabled:opacity-30" aria-label="Move up">
              <ArrowUp className="h-3.5 w-3.5" />
            </button>
            <button type="button" disabled={i === items.length - 1} onClick={() => move(i, 1)} className="rounded p-1 text-slate-400 hover:bg-slate-100 disabled:opacity-30" aria-label="Move down">
              <ArrowDown className="h-3.5 w-3.5" />
            </button>
          </div>
          <button type="button" onClick={() => onChange(items.filter((_, j) => j !== i))} className="rounded p-2 text-slate-400 hover:bg-red-50 hover:text-red-500" aria-label="Remove">
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      ))}
      <Button type="button" variant="secondary" size="sm" onClick={() => onChange([...items, create()])}>
        <Plus className="h-3.5 w-3.5" /> {addLabel}
      </Button>
    </div>
  );
}
