import {
  CalendarClock,
  ChevronDown,
  ExternalLink,
  Inbox,
  LayoutDashboard,
  LogOut,
  Menu,
  Palette,
  QrCode,
  Sparkles,
  Users,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useNavigate, useParams } from 'react-router-dom';
import { PageLoader, cx } from '../../components/ui';
import { useAuth } from '../../lib/auth';
import { supabase } from '../../lib/supabase';
import type { Church, MemberRole, Membership } from '../../lib/types';
import { brandStyle } from '../../lib/utils';
import type { AdminContext } from './context';

const NAV = [
  { to: '', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: 'services', label: 'Services & times', icon: CalendarClock },
  { to: 'actions', label: 'Actions', icon: Sparkles },
  { to: 'responses', label: 'Responses', icon: Inbox },
  { to: 'branding', label: 'Branding & landing', icon: Palette },
  { to: 'share', label: 'QR & NFC', icon: QrCode },
  { to: 'team', label: 'Team', icon: Users },
];

export default function AdminLayout() {
  const { churchId } = useParams();
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [church, setChurch] = useState<Church | null>(null);
  const [role, setRole] = useState<MemberRole | null>(null);
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [loading, setLoading] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [switcherOpen, setSwitcherOpen] = useState(false);

  const userId = user?.id;

  const load = useCallback(async (isInitial = false) => {
    if (!userId) return;
    if (isInitial) setLoading(true);
    try {
      const { data, error } = await supabase
        .from('church_members')
        .select('church_id, role, churches(*)')
        .eq('user_id', userId);
      if (error) throw error;
      const list = (data as unknown as Membership[]).filter((m) => m.churches);
      setMemberships(list.sort((a, b) => a.churches.name.localeCompare(b.churches.name)));
      const current = list.find((m) => m.church_id === churchId);
      if (!current) {
        navigate('/admin', { replace: true });
        return;
      }
      setChurch(current.churches);
      setRole(current.role);
    } catch {
      navigate('/admin', { replace: true });
    } finally {
      setLoading(false);
    }
  }, [churchId, userId, navigate]);

  useEffect(() => {
    load(true);
  }, [churchId, userId, load]);

  useEffect(() => setMobileOpen(false), [churchId]);

  if (loading || !church || !role) return <PageLoader />;

  const ctx: AdminContext = {
    church,
    role,
    reloadChurch: () => load(false),
    canAdmin: role === 'owner' || role === 'admin',
  };

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="relative border-b border-slate-200 p-3">
        <button
          onClick={() => setSwitcherOpen((v) => !v)}
          className="flex w-full items-center gap-3 rounded-lg p-2 text-left hover:bg-slate-100"
          aria-expanded={switcherOpen}
        >
          {church.logo_url ? (
            <img src={church.logo_url} alt="" className="h-9 w-9 rounded-lg object-contain" />
          ) : (
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand font-bold text-white">{church.name.charAt(0)}</span>
          )}
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold">{church.name}</span>
            <span className="block text-xs capitalize text-slate-500">{role}</span>
          </span>
          <ChevronDown className="h-4 w-4 text-slate-400" />
        </button>
        {switcherOpen && (
          <div className="absolute left-3 right-3 top-full z-20 mt-1 rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
            {memberships.map((m) => (
              <button
                key={m.church_id}
                onClick={() => {
                  setSwitcherOpen(false);
                  navigate(`/admin/${m.church_id}`);
                }}
                className={cx('block w-full truncate px-3 py-2 text-left text-sm hover:bg-slate-50', m.church_id === churchId && 'font-semibold text-brand')}
              >
                {m.churches.name}
              </button>
            ))}
            <div className="my-1 border-t border-slate-100" />
            <Link to="/admin" className="block px-3 py-2 text-sm text-slate-600 hover:bg-slate-50" onClick={() => setSwitcherOpen(false)}>
              + New church / all churches
            </Link>
          </div>
        )}
      </div>

      <nav className="flex-1 space-y-0.5 p-3">
        {NAV.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              cx(
                'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition',
                isActive ? 'bg-brand/10 text-brand' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
              )
            }
          >
            <Icon className="h-4 w-4" />
            {label}
          </NavLink>
        ))}
        <a
          href={`/c/${church.slug}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
        >
          <ExternalLink className="h-4 w-4" /> Open landing page
        </a>
      </nav>

      <div className="border-t border-slate-200 p-3">
        <div className="truncate px-3 pb-2 text-xs text-slate-500">{user?.email}</div>
        <button
          onClick={async () => {
            await signOut();
            navigate('/login');
          }}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
        >
          <LogOut className="h-4 w-4" /> Sign out
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50" style={brandStyle(church.primary_color, church.accent_color)}>
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 hidden w-64 border-r border-slate-200 bg-white lg:block">{sidebar}</aside>

      {/* Mobile */}
      <div className="sticky top-0 z-30 flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 lg:hidden">
        <span className="truncate font-semibold">{church.name}</span>
        <button onClick={() => setMobileOpen(true)} aria-label="Open menu" className="rounded p-1 hover:bg-slate-100">
          <Menu className="h-6 w-6" />
        </button>
      </div>
      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-slate-900/40" onClick={() => setMobileOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-72 bg-white shadow-xl">
            <button onClick={() => setMobileOpen(false)} className="absolute right-2 top-2 rounded p-1 hover:bg-slate-100" aria-label="Close menu">
              <X className="h-5 w-5" />
            </button>
            <div onClick={(e) => (e.target as HTMLElement).closest('a') && setMobileOpen(false)} className="h-full">
              {sidebar}
            </div>
          </aside>
        </div>
      )}

      <main className="lg:pl-64">
        <div className="mx-auto max-w-6xl p-4 sm:p-6 lg:p-8">
          <Outlet context={ctx} />
        </div>
      </main>
    </div>
  );
}

export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
        {description && <p className="mt-1 text-sm text-slate-500">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}
