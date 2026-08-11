import type { IProjectRepository, ProjectSummary } from '../project-repository/i-project-repository';
import { NoopProjectSyncService, type IProjectSyncService } from '../project-sync/i-project-sync';

export interface ProjectCatalogItem {
  readonly availability: 'local' | 'remote';
  readonly localRevision: number | null;
  readonly name: string;
  readonly projectId: string;
  readonly savedAtEpochMilliseconds: number;
}

export interface IProjectCatalogQuery {
  listProjects(): Promise<readonly ProjectCatalogItem[]>;
}

export class ProjectCatalogQuery implements IProjectCatalogQuery {
  constructor(
    private readonly projectRepository: IProjectRepository,
    private readonly projectSync: IProjectSyncService = new NoopProjectSyncService()
  ) {}

  readonly listProjects = async (): Promise<readonly ProjectCatalogItem[]> => {
    const [localProjects, remoteProjects] = await Promise.all([
      this.projectRepository.list(),
      this.projectSync.listRemoteProjects?.() ?? Promise.resolve([]),
    ]);
    const localProjectIds = new Set(localProjects.map(project => project.projectId));
    const localItems = localProjects.map(project => this.#createLocalItem(project));
    const remoteItems = remoteProjects
      .filter(project => !localProjectIds.has(project.projectId))
      .map(project => ({
        availability: 'remote' as const,
        localRevision: null,
        name: `원격 프로젝트 ${project.projectId.slice(0, 8)}`,
        projectId: project.projectId,
        savedAtEpochMilliseconds: project.updatedAtEpochMilliseconds,
      }));

    return [...localItems, ...remoteItems].sort(
      (left, right) => right.savedAtEpochMilliseconds - left.savedAtEpochMilliseconds
    );
  };

  #createLocalItem(project: ProjectSummary): ProjectCatalogItem {
    return {
      availability: 'local',
      localRevision: project.revision,
      name: project.name,
      projectId: project.projectId,
      savedAtEpochMilliseconds: project.savedAtEpochMilliseconds,
    };
  }
}
