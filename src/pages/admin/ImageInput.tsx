import { ImagePlus, Trash2 } from 'lucide-react';
import { useRef, useState } from 'react';
import { Button, Input, useToast } from '../../components/ui';
import { uploadChurchAsset } from '../../lib/supabase';
import { errorMessage } from '../../lib/utils';

export function ImageInput({ churchId, label, value, onChange }: { churchId: string; label: string; value?: string | null; onChange: (url: string | undefined) => void }) {
  const toast = useToast();
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const upload = async (file?: File) => {
    if (!file) return;
    setBusy(true);
    try {
      onChange(await uploadChurchAsset(churchId, file));
    } catch (e) {
      toast(errorMessage(e), 'error');
    } finally {
      setBusy(false);
      if (ref.current) ref.current.value = '';
    }
  };

  return (
    <div>
      <span className="label">{label}</span>
      <div className="flex items-center gap-3">
        {value ? (
          <img src={value} alt="" className="h-16 w-16 rounded-lg border border-slate-200 bg-slate-50 object-contain" />
        ) : (
          <div className="flex h-16 w-16 items-center justify-center rounded-lg border-2 border-dashed border-slate-200 text-slate-300">
            <ImagePlus className="h-6 w-6" />
          </div>
        )}
        <div className="flex flex-1 flex-col gap-2">
          <Input value={value || ''} onChange={(e) => onChange(e.target.value || undefined)} placeholder="https://… or upload" />
          <div className="flex gap-2">
            <Button type="button" variant="secondary" size="sm" loading={busy} onClick={() => ref.current?.click()}>
              Upload
            </Button>
            {value && (
              <Button type="button" variant="ghost" size="sm" onClick={() => onChange(undefined)}>
                <Trash2 className="h-3.5 w-3.5" /> Remove
              </Button>
            )}
          </div>
        </div>
      </div>
      <input ref={ref} type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml,image/gif" className="hidden" onChange={(e) => upload(e.target.files?.[0])} />
    </div>
  );
}
