import {
  ArrowRight,
  BookOpen,
  Calendar,
  Check,
  Download,
  ExternalLink,
  Heart,
  Info,
  Mail,
  MapPin,
  Phone,
  Share2,
  Smartphone,
  Sparkles,
  Users,
} from 'lucide-react';
import type { ComponentType } from 'react';

export interface IconOption {
  id: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
}

export const SLIDE_ICONS: IconOption[] = [
  { id: 'external-link', label: 'External link', icon: ExternalLink },
  { id: 'arrow-right', label: 'Arrow right', icon: ArrowRight },
  { id: 'calendar', label: 'Calendar / Event', icon: Calendar },
  { id: 'heart', label: 'Heart / Giving', icon: Heart },
  { id: 'mail', label: 'Email / Mail', icon: Mail },
  { id: 'phone', label: 'Phone call', icon: Phone },
  { id: 'download', label: 'Download file', icon: Download },
  { id: 'smartphone', label: 'Smartphone / App', icon: Smartphone },
  { id: 'sparkles', label: 'Sparkles / New', icon: Sparkles },
  { id: 'map-pin', label: 'Map / Location', icon: MapPin },
  { id: 'share', label: 'Share', icon: Share2 },
  { id: 'book-open', label: 'Bible / Notes', icon: BookOpen },
  { id: 'users', label: 'Community / Team', icon: Users },
  { id: 'check', label: 'Check / Done', icon: Check },
  { id: 'info', label: 'Information', icon: Info },
];

export function SlideIcon({ name, className = 'h-4 w-4' }: { name?: string; className?: string }) {
  if (!name) return <ExternalLink className={className} />;
  const match = SLIDE_ICONS.find((i) => i.id === name);
  const IconComponent = match ? match.icon : ExternalLink;
  return <IconComponent className={className} />;
}
