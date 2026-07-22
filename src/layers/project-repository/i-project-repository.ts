import type { ProjectDocument } from '../shared/types/project-document.schema';

export interface ProjectSummary {
  readonly projectId: string;
  readonly name: string;
  readonly revision: number;
  readonly savedAtEpochMilliseconds: number;
}

export interface SaveProjectRequest {
  readonly document: ProjectDocument;
  readonly expectedRevision: number;
}

export interface DeleteProjectRequest {
  readonly projectId: string;
  readonly expectedRevision: number;
}

export interface IProjectRepository {
  create(document: ProjectDocument): Promise<ProjectDocument>;
  save(request: SaveProjectRequest): Promise<ProjectDocument>;
  load(projectId: string): Promise<ProjectDocument | null>;
  list(): Promise<readonly ProjectSummary[]>;
  delete(request: DeleteProjectRequest): Promise<void>;
}
