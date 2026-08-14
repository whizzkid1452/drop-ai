import type { ProjectLifecycleState } from './project-document.schema';

export function createDefaultProjectLifecycleState(): ProjectLifecycleState {
  return { snapshots: [], templates: [] };
}

export function cloneProjectLifecycleState(state: ProjectLifecycleState): ProjectLifecycleState {
  return structuredClone(state as unknown) as ProjectLifecycleState;
}
