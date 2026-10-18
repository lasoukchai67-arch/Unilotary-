import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { Loading } from '../components/ui';
import { can, type Permission } from '../lib/roles';
import { useAuth } from './AuthContext';

export function RequireAuth({ children }: { children: ReactNode }) {
  const { state } = useAuth();
  const location = useLocation();
  if (state.status === 'loading') {
    return (
      <div className="splash">
        <Loading label="ກຳລັງກວດສອບການເຂົ້າລະບົບ..." />
      </div>
    );
  }
  if (state.status === 'anonymous') {
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search, reason: state.reason }} />;
  }
  return <>{children}</>;
}

/** Renders children only when the current role has `permission` (hides actions). */
export function Can({ permission, children, fallback = null }: { permission: Permission; children: ReactNode; fallback?: ReactNode }) {
  const { user } = useAuth();
  return <>{can(user?.role, permission) ? children : fallback}</>;
}

export function useCan(permission: Permission): boolean {
  const { user } = useAuth();
  return can(user?.role, permission);
}
