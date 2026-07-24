interface ProjectRouteAccess {
  hasProject: boolean;
}

export type ProjectRouteRedirect = '/' | null;

export function getProjectRouteRedirect({ hasProject }: ProjectRouteAccess): ProjectRouteRedirect {
  if (!hasProject) {
    return '/';
  }

  return null;
}
