import { BookOpen, Layers, Smartphone, Sparkles } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { cx } from '../../components/ui';

export function ActionsSubNav({ current }: { current: 'actions' | 'slides' | 'sermons' | 'deeplinks' }) {
  const { churchId } = useParams();
  const tabs = [
    { id: 'actions', to: `/admin/${churchId}/actions`, label: 'All Actions', icon: Sparkles },
    { id: 'slides', to: `/admin/${churchId}/slides`, label: 'Slide Library', icon: Layers },
    { id: 'sermons', to: `/admin/${churchId}/sermons`, label: 'Sermon Notes', icon: BookOpen },
    { id: 'deeplinks', to: `/admin/${churchId}/deeplinks`, label: 'App Deeplinks', icon: Smartphone },
  ];

  return (
    <div className="flex items-center gap-2 border-b border-slate-200 pb-3 mb-6 overflow-x-auto">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const active = current === tab.id;
        return (
          <Link
            key={tab.id}
            to={tab.to}
            className={cx(
              'flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition shrink-0',
              active
                ? 'bg-brand text-white shadow-sm shadow-brand/20'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 bg-white border border-slate-200/80',
            )}
          >
            <Icon className="h-4 w-4" />
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
