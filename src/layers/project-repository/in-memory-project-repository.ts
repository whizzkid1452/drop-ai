import type { ProjectDocument } from '../shared/types/project-document.schema';
import { ProjectRepositoryError, ProjectRepositoryErrorCode } from './errors';
import type {
  DeleteProjectRequest,
  IProjectRepository,
  ProjectSummary,
  SaveProjectRequest,
} from './i-project-repository';
import {
  cloneAndValidateProjectDocument,
  throwIfRevisionConflict,
  validateExpectedRevision,
  validateInitialRevision,
  validateSaveExpectedRevision,
} from './project-repository-validation';

interface InMemoryProjectRepositoryOptions {
  now?: () => number;
}

interface StoredProject {
  document: ProjectDocument;
  savedAtEpochMilliseconds: number;
}

export class InMemoryProjectRepository implements IProjectRepository {
  private readonly projects = new Map<string, StoredProject>();
  private readonly now: () => number;

  constructor({ now = Date.now }: InMemoryProjectRepositoryOptions = {}) {
    this.now = now;
  }

  async create(document: ProjectDocument): Promise<ProjectDocument> {
    const validatedDocument = cloneAndValidateProjectDocument(document);
    validateInitialRevision(validatedDocument);
    const { id: projectId } = validatedDocument.project;

    if (this.projects.has(projectId)) {
      throw new ProjectRepositoryError({
        code: ProjectRepositoryErrorCode.PROJECT_ALREADY_EXISTS,
        message: `이미 존재하는 프로젝트입니다: ${projectId}`,
        details: { projectId },
      });
    }

    this.projects.set(projectId, {
      document: validatedDocument,
      savedAtEpochMilliseconds: this.now(),
    });

    return cloneAndValidateProjectDocument(validatedDocument);
  }

  async save({ document, expectedRevision }: SaveProjectRequest): Promise<ProjectDocument> {
    validateSaveExpectedRevision(expectedRevision);
    const validatedDocument = cloneAndValidateProjectDocument(document);
    const projectId = validatedDocument.project.id;
    const storedProject = this.getStoredProject(projectId);

    throwIfRevisionConflict({
      projectId,
      expectedRevision,
      documentRevision: validatedDocument.project.revision,
      storedRevision: storedProject.document.project.revision,
    });

    const nextDocument = cloneAndValidateProjectDocument({
      ...validatedDocument,
      project: {
        ...validatedDocument.project,
        revision: expectedRevision + 1,
      },
    });
    this.projects.set(projectId, {
      document: nextDocument,
      savedAtEpochMilliseconds: this.now(),
    });

    return cloneAndValidateProjectDocument(nextDocument);
  }

  async load(projectId: string): Promise<ProjectDocument | null> {
    const storedProject = this.projects.get(projectId);
    return storedProject ? cloneAndValidateProjectDocument(storedProject.document) : null;
  }

  async list(): Promise<readonly ProjectSummary[]> {
    return [...this.projects.values()].map(({ document, savedAtEpochMilliseconds }) => ({
      projectId: document.project.id,
      name: document.project.name,
      revision: document.project.revision,
      savedAtEpochMilliseconds,
    }));
  }

  async delete({ projectId, expectedRevision }: DeleteProjectRequest): Promise<void> {
    validateExpectedRevision(expectedRevision);
    const storedProject = this.getStoredProject(projectId);
    const storedRevision = storedProject.document.project.revision;

    if (storedRevision !== expectedRevision) {
      throw new ProjectRepositoryError({
        code: ProjectRepositoryErrorCode.REVISION_CONFLICT,
        message: `프로젝트 revision이 변경되었습니다: ${projectId}`,
        details: { projectId, expectedRevision, storedRevision },
      });
    }

    this.projects.delete(projectId);
  }

  private getStoredProject(projectId: string): StoredProject {
    const storedProject = this.projects.get(projectId);
    if (storedProject) {
      return storedProject;
    }

    throw new ProjectRepositoryError({
      code: ProjectRepositoryErrorCode.PROJECT_NOT_FOUND,
      message: `프로젝트를 찾을 수 없습니다: ${projectId}`,
      details: { projectId },
    });
  }
}
