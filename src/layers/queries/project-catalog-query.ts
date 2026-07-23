import type { IProjectRepository, ProjectSummary } from '../project-repository/i-project-repository';

export interface IProjectCatalogQuery {
  listProjects(): Promise<readonly ProjectSummary[]>;
}

export class ProjectCatalogQuery implements IProjectCatalogQuery {
  constructor(private readonly projectRepository: IProjectRepository) {}

  readonly listProjects = async (): Promise<readonly ProjectSummary[]> => {
    const projects = await this.projectRepository.list();
    return projects.map(project => ({ ...project }));
  };
}
