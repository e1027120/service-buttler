import { useOutletContext } from 'react-router-dom';
import type { Church, MemberRole } from '../../lib/types';

export interface AdminContext {
  church: Church;
  role: MemberRole;
  reloadChurch: () => Promise<void>;
  canAdmin: boolean;
}

export const useAdmin = () => useOutletContext<AdminContext>();
