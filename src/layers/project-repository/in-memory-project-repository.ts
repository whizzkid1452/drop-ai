import { ProjectDocumentSchema, type ProjectDocument } from '../shared/types/project-document.schema';
import { ProjectRepositoryError, ProjectRepositoryErrorCode } from './errors';
import type {
  DeleteProjectRequest,
  IProjectRepository,
  ProjectSummary,
  SaveProjectRequest,
} from './i-project-repository';

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
    const validatedDocument = this.cloneAndValidate(document);
    const { id: projectId, revision } = validatedDocument.project;

    if (revision !== 0) {
      throw new ProjectRepositoryError({
        code: ProjectRepositoryErrorCode.INVALID_INITIAL_REVISION,
        message: '새 프로젝트의 revision은 0이어야 합니다.',
        details: { projectId, revision },
      });
    }

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

    return this.cloneAndValidate(validatedDocument);
  }

  async save({ document, expectedRevision }: SaveProjectRequest): Promise<ProjectDocument> {
    this.validateSaveExpectedRevision(expectedRevision);
    const validatedDocument = this.cloneAndValidate(document);
    const projectId = validatedDocument.project.id;
    const storedProject = this.getStoredProject(projectId);

    this.throwIfRevisionConflict({
      projectId,
      expectedRevision,
      documentRevision: validatedDocument.project.revision,
      storedRevision: storedProject.document.project.revision,
    });

    const nextDocument = this.cloneAndValidate({
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

    return this.cloneAndValidate(nextDocument);
  }

  async load(projectId: string): Promise<ProjectDocument | null> {
    const storedProject = this.projects.get(projectId);
    return storedProject ? this.cloneAndValidate(storedProject.document) : null;
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
    this.validateExpectedRevision(expectedRevision);
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

  private cloneAndValidate(document: ProjectDocument): ProjectDocument {
    const result = ProjectDocumentSchema.safeParse(document);
    if (result.success) {
      return result.data;
    }

    throw new ProjectRepositoryError({
      code: ProjectRepositoryErrorCode.INVALID_DOCUMENT,
      message: '유효하지 않은 ProjectDocument입니다.',
      cause: result.error,
    });
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

  private validateExpectedRevision(expectedRevision: number): void {
    if (Number.isSafeInteger(expectedRevision) && expectedRevision >= 0) {
      return;
    }

    throw new ProjectRepositoryError({
      code: ProjectRepositoryErrorCode.INVALID_EXPECTED_REVISION,
      message: 'expectedRevision은 0 이상의 정수여야 합니다.',
      details: { expectedRevision },
    });
  }

  private validateSaveExpectedRevision(expectedRevision: number): void {
    this.validateExpectedRevision(expectedRevision);
    if (expectedRevision < Number.MAX_SAFE_INTEGER) {
      return;
    }

    throw new ProjectRepositoryError({
      code: ProjectRepositoryErrorCode.INVALID_EXPECTED_REVISION,
      message: '저장할 revision은 Number.MAX_SAFE_INTEGER보다 작아야 합니다.',
      details: { expectedRevision },
    });
  }

  private throwIfRevisionConflict({
    projectId,
    expectedRevision,
    documentRevision,
    storedRevision,
  }: {
    projectId: string;
    expectedRevision: number;
    documentRevision: number;
    storedRevision: number;
  }): void {
    if (documentRevision === expectedRevision && storedRevision === expectedRevision) {
      return;
    }

    throw new ProjectRepositoryError({
      code: ProjectRepositoryErrorCode.REVISION_CONFLICT,
      message: `프로젝트 revision이 변경되었습니다: ${projectId}`,
      details: { projectId, expectedRevision, documentRevision, storedRevision },
    });
  }
}
