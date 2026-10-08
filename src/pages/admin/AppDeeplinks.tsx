import {
  ExternalLink,
  Pencil,
  Plus,
  Search,
  Smartphone,
  Trash2,
} from 'lucide-react';
import { type FormEvent, useMemo, useState } from 'react';
import {
  Badge,
  Button,
  ConfirmButton,
  EmptyState,
  Field,
  Input,
  Modal,
  useToast,
} from '../../components/ui';
import { supabase, unwrap } from '../../lib/supabase';
import type { AppDeeplink } from '../../lib/types';
import { errorMessage, shortId } from '../../lib/utils';
import { ActionsSubNav } from './ActionsSubNav';
import { PageHeader } from './AdminLayout';
import { useAdmin } from './context';

export default function AppDeeplinks() {
  const { church, reloadChurch, canAdmin } = useAdmin();
  const toast = useToast();

  const deeplinks = useMemo<AppDeeplink[]>(() => {
    return (church.landing?.app_deeplinks || []) as AppDeeplink[];
  }, [church.landing?.app_deeplinks]);

  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<Partial<AppDeeplink> | null>(null);
  const [saving, setSaving] = useState(false);

  const filtered = deeplinks.filter((d) =>
    d.label.toLowerCase().includes(search.toLowerCase()) ||
    d.ios_url?.toLowerCase().includes(search.toLowerCase()) ||
    d.android_url?.toLowerCase().includes(search.toLowerCase()),
  );

  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    if (!editing.label?.trim()) {
      toast('Please enter an app name / label', 'error');
      return;
    }
    if (!editing.ios_url?.trim() && !editing.android_url?.trim()) {
      toast('Please enter at least an iOS or Android link', 'error');
      return;
    }

    setSaving(true);
    try {
      const isNew = !editing.id;
      const id = editing.id || shortId();
      const updatedItem: AppDeeplink = {
        id,
        label: editing.label.trim(),
        ios_url: (editing.ios_url || '').trim(),
        android_url: (editing.android_url || '').trim(),
        created_at: editing.created_at || new Date().toISOString(),
      };

      const nextList = isNew
        ? [...deeplinks, updatedItem]
        : deeplinks.map((d) => (d.id === id ? updatedItem : d));

      const nextLanding = {
        ...(church.landing || {}),
        app_deeplinks: nextList,
      };

      unwrap(await supabase.from('churches').update({ landing: nextLanding }).eq('id', church.id));
      await reloadChurch();
      toast(isNew ? 'App Deeplink created' : 'App Deeplink saved');
      setEditing(null);
    } catch (err) {
      toast(errorMessage(err), 'error');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    try {
      const nextList = deeplinks.filter((d) => d.id !== id);
      const nextLanding = {
        ...(church.landing || {}),
        app_deeplinks: nextList,
      };

      unwrap(await supabase.from('churches').update({ landing: nextLanding }).eq('id', church.id));
      await reloadChurch();
      toast('App Deeplink deleted');
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
              onClick={() =>
                setEditing({
                  label: '',
                  ios_url: '',
                  android_url: '',
                })
              }
              className="gap-1.5"
            >
              <Plus className="h-4 w-4" /> New App Deeplink
            </Button>
          )
        }
      />

      <ActionsSubNav current="deeplinks" />

      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Phone App Deeplinks ({deeplinks.length})</h2>
          <p className="text-xs text-slate-500">
            Configure mobile app links. iOS users will be directed to the Apple App Store, and Android users to Google Play.
          </p>
        </div>

        {deeplinks.length > 2 && (
          <div className="relative w-full max-w-xs">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search deeplinks…"
              className="pl-9"
            />
          </div>
        )}
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={<Smartphone className="h-10 w-10" />}
          title={search ? 'No matching app deeplinks' : 'No app deeplinks yet'}
          description={
            search
              ? 'Try adjusting your search query.'
              : 'Add an app link (like Church Center, your custom church app, or a Bible app) to use in slide call-to-actions.'
          }
          action={
            canAdmin && !search && (
              <Button
                onClick={() =>
                  setEditing({
                    label: '',
                    ios_url: '',
                    android_url: '',
                  })
                }
                className="gap-1.5"
              >
                <Plus className="h-4 w-4" /> Add First App Deeplink
              </Button>
            )
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((item) => (
            <div
              key={item.id}
              className="group relative flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-slate-300 hover:shadow-md"
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand/10 text-brand">
                      <Smartphone className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-900 leading-snug">{item.label}</h3>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        {item.ios_url && (
                          <Badge tone="brand">
                            iOS
                          </Badge>
                        )}
                        {item.android_url && (
                          <Badge tone="slate">
                            Android
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>

                  {canAdmin && (
                    <div className="flex items-center gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setEditing(item)}
                        title="Edit app deeplink"
                        className="h-8 w-8 p-0"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <ConfirmButton
                        size="sm"
                        variant="ghost"
                        onConfirm={() => remove(item.id)}
                        message="Delete this app deeplink?"
                        title="Delete app deeplink"
                        className="h-8 w-8 p-0 text-red-600 hover:bg-red-50 hover:text-red-700"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </ConfirmButton>
                    </div>
                  )}
                </div>

                <div className="space-y-1.5 rounded-xl bg-slate-50 p-2.5 text-xs text-slate-600">
                  <div className="flex items-center justify-between gap-1">
                    <span className="font-semibold text-slate-700">Apple App Store:</span>
                    {item.ios_url ? (
                      <a
                        href={item.ios_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 truncate text-brand hover:underline max-w-[170px]"
                        title={item.ios_url}
                      >
                        <span className="truncate">{item.ios_url}</span>
                        <ExternalLink className="h-3 w-3 shrink-0" />
                      </a>
                    ) : (
                      <span className="text-slate-400 italic">Not set</span>
                    )}
                  </div>
                  <div className="flex items-center justify-between gap-1">
                    <span className="font-semibold text-slate-700">Google Play:</span>
                    {item.android_url ? (
                      <a
                        href={item.android_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 truncate text-brand hover:underline max-w-[170px]"
                        title={item.android_url}
                      >
                        <span className="truncate">{item.android_url}</span>
                        <ExternalLink className="h-3 w-3 shrink-0" />
                      </a>
                    ) : (
                      <span className="text-slate-400 italic">Not set</span>
                    )}
                  </div>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
                <span>ID: {item.id}</span>
                <span className="text-slate-500">Ready for slide CTAs</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create / Edit Modal */}
      <Modal
        open={Boolean(editing)}
        onClose={() => setEditing(null)}
        title={editing?.id ? 'Edit App Deeplink' : 'New Phone App Deeplink'}
      >
        {editing && (
          <form onSubmit={save} className="space-y-4">
            <Field
              label="App Name / Label"
              hint="Shown in the admin slide editor when picking deeplinks"
            >
              <Input
                required
                value={editing.label || ''}
                onChange={(e) => setEditing({ ...editing, label: e.target.value })}
                placeholder="e.g. Church Center App, YouVersion Bible"
              />
            </Field>

            <Field
              label="Apple App Store link (iOS)"
              hint="App Store URL (https://apps.apple.com/...) or custom scheme (e.g. churchcenter://)"
            >
              <Input
                type="url"
                value={editing.ios_url || ''}
                onChange={(e) => setEditing({ ...editing, ios_url: e.target.value })}
                placeholder="https://apps.apple.com/..."
              />
            </Field>

            <Field
              label="Google Play Store link (Android)"
              hint="Play Store URL (https://play.google.com/store/apps/...) or app scheme"
            >
              <Input
                type="url"
                value={editing.android_url || ''}
                onChange={(e) => setEditing({ ...editing, android_url: e.target.value })}
                placeholder="https://play.google.com/store/apps/details?id=..."
              />
            </Field>

            <div className="rounded-xl bg-amber-50/70 border border-amber-200/80 p-3 text-xs text-amber-800 space-y-1">
              <span className="font-bold flex items-center gap-1.5">
                <Smartphone className="h-4 w-4 text-amber-600" /> Dynamic OS routing
              </span>
              <p>
                When an attendee clicks this slide CTA button on their mobile phone, the system detects their operating system and opens the matching store page or native app!
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <Button type="button" variant="secondary" onClick={() => setEditing(null)}>
                Cancel
              </Button>
              <Button type="submit" loading={saving}>
                {editing.id ? 'Save changes' : 'Create deeplink'}
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </>
  );
}
