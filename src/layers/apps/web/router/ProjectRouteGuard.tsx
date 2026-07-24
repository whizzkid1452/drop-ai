import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useSession } from '@/layers/apps/web/context/layer-hooks';
import { getProjectRouteRedirect } from './project-route-access';

interface ProjectRouteGuardProps {
  children: ReactNode;
}

export function ProjectRouteGuard({ children }: ProjectRouteGuardProps) {
  const hasProject = useSession(state => state.tracks.size > 0);
  const redirect = getProjectRouteRedirect({ hasProject });

  if (redirect) {
    return <Navigate to={redirect} replace />;
  }

  return children;
}
