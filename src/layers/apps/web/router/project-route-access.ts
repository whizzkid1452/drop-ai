interface ProjectRouteAccess {
  hasProject: boolean;
  requiresAgentResult: boolean;
  hasSuccessfulAgentResult: boolean;
}

export type ProjectRouteRedirect = '/' | '/preview' | null;

export function getProjectRouteRedirect({
  hasProject,
  requiresAgentResult,
  hasSuccessfulAgentResult,
}: ProjectRouteAccess): ProjectRouteRedirect {
  if (!hasProject) {
    return '/';
  }

  if (requiresAgentResult && !hasSuccessfulAgentResult) {
    return '/preview';
  }

  return null;
}
