import type { ReactNode } from 'react';
import { useGetIdentity } from '@refinedev/core';
import { Navigate } from 'react-router-dom';
import { Spinner } from '@/components/ui/spinner';

interface Identity {
  id: string;
  name?: string;
  role?: string;
}

/**
 * The signed-in account's role, as `authProvider.getIdentity` reports it.
 * `ready` is false until the profile lands — treat "not admin yet" as unknown
 * rather than as denied, or the first paint bounces an admin to /bookings.
 */
export function useRole(): { role?: string; isAdmin: boolean; ready: boolean } {
  const { data, isLoading } = useGetIdentity<Identity>();
  return { role: data?.role, isAdmin: data?.role === 'admin', ready: !isLoading };
}

/**
 * Keeps a sale out of the admin-only screens. This is convenience, not
 * security: RLS is what actually refuses the writes (0009_role_permissions).
 */
export function RequireAdmin({ children }: { children: ReactNode }) {
  const { isAdmin, ready } = useRole();

  if (!ready) {
    return (
      <div className="flex items-center justify-center gap-2 p-12 text-muted-foreground">
        <Spinner /> Đang tải…
      </div>
    );
  }

  return isAdmin ? <>{children}</> : <Navigate to="/bookings" replace />;
}
