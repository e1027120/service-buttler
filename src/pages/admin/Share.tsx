import { Check, Copy, Download, ExternalLink, Smartphone } from 'lucide-react';
import QRCode from 'qrcode';
import { useCallback, useEffect, useState } from 'react';
import { Button, Field, Select, useToast } from '../../components/ui';
import { supabase } from '../../lib/supabase';
import type { Service } from '../../lib/types';
import { landingUrl } from '../../lib/utils';
import { PageHeader } from './AdminLayout';
import { useAdmin } from './context';

export default function Share() {
  const { church } = useAdmin();
  const toast = useToast();
  const [services, setServices] = useState<Service[]>([]);
  const [target, setTarget] = useState<string>('church');
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    supabase
      .from('services')
      .select('*')
      .eq('church_id', church.id)
      .order('name')
      .then(({ data }) => setServices((data as Service[]) || []));
  }, [church.id]);

  const selectedService = services.find((s) => s.id === target);
  const targetUrl = landingUrl(church.slug, selectedService?.slug);

  const renderQr = useCallback(async () => {
    try {
      const dataUrl = await QRCode.toDataURL(targetUrl, {
        width: 1024,
        margin: 2,
        color: {
          dark: church.primary_color || '#000000',
          light: '#ffffff',
        },
      });
      setQrDataUrl(dataUrl);
    } catch {
      /* ignore */
    }
  }, [targetUrl, church.primary_color]);

  useEffect(() => {
    renderQr();
  }, [renderQr]);

  const copyUrl = async () => {
    await navigator.clipboard.writeText(targetUrl);
    setCopied(true);
    toast('Link copied to clipboard');
    setTimeout(() => setCopied(false), 2000);
  };

  const downloadQr = () => {
    const a = document.createElement('a');
    a.href = qrDataUrl;
    a.download = `${church.slug}${selectedService ? `-${selectedService.slug}` : ''}-qr.png`;
    a.click();
  };

  return (
    <>
      <PageHeader
        title="QR Code & NFC Setup"
        description="Print QR codes on seat backs or program bulletins, and program NFC tags at church entrances."
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          <section className="card p-5 space-y-4">
            <h2 className="text-base font-semibold">1. Choose destination URL</h2>
            <Field label="Target">
              <Select value={target} onChange={(e) => setTarget(e.target.value)}>
                <option value="church">Church general (auto-resolves whatever service is live)</option>
                {services.map((s) => (
                  <option key={s.id} value={s.id}>Specific service: {s.name}</option>
                ))}
              </Select>
            </Field>

            <div className="flex items-center gap-2">
              <input readOnly value={targetUrl} className="input font-mono text-xs" />
              <Button variant="secondary" onClick={copyUrl}>
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {copied ? 'Copied' : 'Copy'}
              </Button>
              <a href={targetUrl} target="_blank" rel="noopener noreferrer" className="btn btn-ghost rounded p-2 text-slate-500 hover:bg-slate-100">
                <ExternalLink className="h-4 w-4" />
              </a>
            </div>
          </section>

          <section className="card p-5 space-y-3">
            <div className="flex items-center gap-2">
              <Smartphone className="h-5 w-5 text-brand" />
              <h2 className="text-base font-semibold">2. Programming NFC tags</h2>
            </div>
            <p className="text-sm text-slate-600">
              Any NTAG213 / NTAG215 / NTAG216 sticker will work. On your phone:
            </p>
            <ol className="list-decimal space-y-2 pl-5 text-sm text-slate-700">
              <li>Install a free app such as <strong>NFC Tools</strong> (iOS and Android).</li>
              <li>Tap <strong>Write → Add a record → URL / URI</strong>.</li>
              <li>
                Paste your destination link: <code className="rounded bg-slate-100 px-1 py-0.5 text-xs font-mono">{targetUrl}</code>
              </li>
              <li>Tap <strong>Write</strong> and hold the tag against the back of your phone.</li>
              <li>(Recommended) In NFC Tools, choose <strong>Other → Lock tag</strong> so attendees cannot overwrite the link.</li>
            </ol>
            <div className="rounded-xl bg-amber-50 p-3 text-xs text-amber-900">
              Tip: Place NFC stickers on pew backs, welcome desk signage, or name badge lanyards.
            </div>
          </section>
        </div>

        {/* QR Code preview & download */}
        <aside>
          <section className="card p-5 text-center space-y-4">
            <h2 className="text-base font-semibold">QR Code preview</h2>
            {qrDataUrl ? (
              <img src={qrDataUrl} alt="QR Code" className="mx-auto aspect-square w-64 rounded-xl border border-slate-200 p-2 shadow-sm" />
            ) : (
              <div className="mx-auto flex aspect-square w-64 items-center justify-center rounded-xl bg-slate-100 text-slate-400">
                Generating…
              </div>
            )}
            <p className="text-xs text-slate-500">
              Coloured with your church's primary brand color. High-res (1024×1024) PNG suitable for printing.
            </p>
            <Button onClick={downloadQr} className="w-full">
              <Download className="h-4 w-4" /> Download high-res PNG
            </Button>
          </section>
        </aside>
      </div>
    </>
  );
}
