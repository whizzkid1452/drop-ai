import type { ProjectDocumentSnapshot } from '../shared/types/project-document.schema';

export interface ProjectSummary {
  readonly projectId: string;
  readonly name: string;
  readonly revision: number;
  readonly savedAtEpochMilliseconds: number;
}

export interface SaveProjectRequest {
  readonly document: ProjectDocumentSnapshot;
  readonly expectedRevision: number;
}

export interface DeleteProjectRequest {
  readonly projectId: string;
  readonly expectedRevision: number;
}

export interface IProjectRepository {
  create(document: ProjectDocumentSnapshot): Promise<ProjectDocumentSnapshot>;
  save(request: SaveProjectRequest): Promise<ProjectDocumentSnapshot>;
  load(projectId: string): Promise<ProjectDocumentSnapshot | null>;
  list(): Promise<readonly ProjectSummary[]>;
  delete(request: DeleteProjectRequest): Promise<void>;
}
