import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useSession } from '@/layers/apps/web/context/layer-hooks';
import { getProjectRouteRedirect } from './project-route-access';

interface ProjectRouteGuardProps {
  children: ReactNode;
  requiresAgentResult?: boolean;
}

export function ProjectRouteGuard({ children, requiresAgentResult = false }: ProjectRouteGuardProps) {
  const hasProject = useSession(state => state.tracks.size > 0);
  const hasSuccessfulAgentResult = useSession(state => state.hasSuccessfulAgentResult);
  const redirect = getProjectRouteRedirect({ hasProject, requiresAgentResult, hasSuccessfulAgentResult });

  if (redirect) {
    return <Navigate to={redirect} replace />;
  }

  return children;
}
