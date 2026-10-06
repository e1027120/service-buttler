import { ArrowRight, Church as ChurchIcon } from 'lucide-react';
import { type ChangeEvent, type FormEvent, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button, Field, Input, useToast } from '../components/ui';
import { useAuth } from '../lib/auth';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import { errorMessage } from '../lib/utils';

export default function Login() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const toast = useToast();
  const next = params.get('next') || '/admin';

  const [mode, setMode] = useState<'signin' | 'signup' | 'magic'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [busy, setBusy] = useState(false);
  const [magicSent, setMagicSent] = useState(false);

  if (user) {
    navigate(next, { replace: true });
    return null;
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!isSupabaseConfigured) {
      toast('Supabase credentials not configured in .env', 'error');
      return;
    }
    setBusy(true);
    try {
      if (mode === 'magic') {
        const { error } = await supabase.auth.signInWithOtp({
          email: email.trim().toLowerCase(),
          options: { emailRedirectTo: `${window.location.origin}/admin` },
        });
        if (error) throw error;
        setMagicSent(true);
        toast('Magic link sent to your email');
      } else if (mode === 'signup') {
        const { error } = await supabase.auth.signUp({
          email: email.trim().toLowerCase(),
          password,
          options: { data: { full_name: fullName.trim() } },
        });
        if (error) throw error;
        toast('Account created! Logging you in…');
        navigate(next, { replace: true });
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim().toLowerCase(),
          password,
        });
        if (error) throw error;
        navigate(next, { replace: true });
      }
    } catch (err) {
      toast(errorMessage(err), 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
      <div className="card w-full max-w-md p-6 sm:p-8">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-brand text-white shadow-md shadow-brand/20">
            <ChurchIcon className="h-6 w-6" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Service Buttler</h1>
          <p className="mt-1 text-sm text-slate-500">Sign in to manage your church services and live actions.</p>
        </div>

        {!isSupabaseConfigured && (
          <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
            <strong>Supabase credentials not configured.</strong> Set <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code> in your <code>.env</code> file.
          </div>
        )}

        {magicSent ? (
          <div className="py-6 text-center">
            <h2 className="text-lg font-semibold">Check your inbox</h2>
            <p className="mt-2 text-sm text-slate-600">
              We sent a sign-in link to <strong>{email}</strong>. Click the link to access your dashboard.
            </p>
            <Button variant="secondary" className="mt-6" onClick={() => setMagicSent(false)}>
              Back to sign in
            </Button>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            {mode === 'signup' && (
              <Field label="Full name">
                <Input required value={fullName} onChange={(e: ChangeEvent<HTMLInputElement>) => setFullName(e.target.value)} placeholder="Pastor John" />
              </Field>
            )}
            <Field label="Email">
              <Input type="email" required value={email} onChange={(e: ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)} placeholder="you@church.org" />
            </Field>
            {mode !== 'magic' && (
              <Field label="Password">
                <Input
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)}
                  placeholder="••••••••"
                />
              </Field>
            )}

            <Button type="submit" loading={busy} className="w-full">
              {mode === 'signin' ? 'Sign in' : mode === 'signup' ? 'Create account' : 'Send magic link'}
              <ArrowRight className="h-4 w-4" />
            </Button>

            <div className="flex flex-col gap-2 pt-2 text-center text-xs text-slate-500">
              {mode === 'signin' ? (
                <>
                  <button type="button" onClick={() => setMode('signup')} className="hover:text-brand hover:underline">
                    Need an account? Sign up
                  </button>
                  <button type="button" onClick={() => setMode('magic')} className="hover:text-brand hover:underline">
                    Sign in with a magic link instead
                  </button>
                </>
              ) : (
                <button type="button" onClick={() => setMode('signin')} className="hover:text-brand hover:underline">
                  Already have an account? Sign in
                </button>
              )}
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
