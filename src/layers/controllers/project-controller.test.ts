import { describe, expect, it, vi } from 'vitest';
import { AudioSourceRegistry } from '../audio-source-registry/audio-source-registry';
import type { IAudioSourceRepository } from '../audio-source-repository/i-audio-source-repository';
import { AudioSourceRepositoryError } from '../audio-source-repository/errors';
import type { IProjectRepository } from '../project-repository/i-project-repository';
import { ProjectRepositoryError } from '../project-repository/errors';
import { createProjectDocumentFromSession } from '../project-document-mapper/project-document-mapper';
import { createSessionStore } from '../session/session';
import type { ProjectAudioSource, ProjectDocument } from '../shared/types/project-document.schema';
import { ProjectController } from './project-controller';

const PROJECT_ID = '11111111-1111-4111-8111-111111111111';
const SOURCE_ID = '22222222-2222-4222-8222-222222222222';
const SECOND_SOURCE_ID = '33333333-3333-4333-8333-333333333333';
const INITIAL_PROJECT_METADATA = {
  id: PROJECT_ID,
  name: '테스트 프로젝트',
  revision: 0,
};

function createSourceRegistration(sourceId = SOURCE_ID) {
  const blob = new Blob(['test'], { type: 'audio/wav' });
  const metadata: ProjectAudioSource = {
    id: sourceId,
    fileName: 'source.wav',
    mimeType: blob.type,
    byteLength: blob.size,
    durationSeconds: 1,
  };

  return { metadata, blob };
}

function createTestContext() {
  const sessionStore = createSessionStore({ initialProjectMetadata: INITIAL_PROJECT_METADATA });
  const audioSourceRegistry = new AudioSourceRegistry({
    createObjectUrl: () => 'blob:project-source',
    revokeObjectUrl: vi.fn(),
  });
  const audioSourceRepository = {
    create: vi.fn<IAudioSourceRepository['create']>().mockResolvedValue(undefined),
    load: vi.fn<IAudioSourceRepository['load']>().mockResolvedValue(null),
    delete: vi.fn<IAudioSourceRepository['delete']>().mockResolvedValue(undefined),
  } satisfies IAudioSourceRepository;
  const projectRepository = {
    create: vi.fn<IProjectRepository['create']>().mockImplementation(async document => document),
    save: vi.fn<IProjectRepository['save']>().mockImplementation(async ({ document, expectedRevision }) => ({
      ...document,
      project: { ...document.project, revision: expectedRevision + 1 },
    })),
    load: vi.fn<IProjectRepository['load']>().mockResolvedValue(null),
    list: vi.fn<IProjectRepository['list']>().mockResolvedValue([]),
    delete: vi.fn<IProjectRepository['delete']>().mockResolvedValue(undefined),
  } satisfies IProjectRepository;
  const controller = new ProjectController({
    sessionStore,
    audioSourceReader: audioSourceRegistry,
    audioSourceRepository,
    projectRepository,
  });

  return {
    audioSourceRegistry,
    audioSourceRepository,
    controller,
    projectRepository,
    sessionStore,
  };
}

function createCurrentDocument(
  sessionStore: ReturnType<typeof createSessionStore>,
  audioSources: ProjectAudioSource[] = []
): ProjectDocument {
  return createProjectDocumentFromSession({ session: sessionStore.getState(), audioSources });
}

describe('ProjectController', () => {
  it('새 프로젝트는 Source를 먼저 보존한 뒤 문서를 생성하고 반환 metadata를 반영한다', async () => {
    const context = createTestContext();
    const registration = createSourceRegistration();
    context.audioSourceRegistry.restoreCommitted(registration);
    const replaceProjectMetadata = vi.spyOn(context.sessionStore.getState(), 'replaceProjectMetadata');

    await context.controller.saveProject();

    expect(context.audioSourceRepository.load).toHaveBeenCalledWith(registration.metadata);
    expect(context.audioSourceRepository.create).toHaveBeenCalledWith(registration);
    expect(context.projectRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        project: INITIAL_PROJECT_METADATA,
        audioSources: [registration.metadata],
      })
    );
    expect(context.audioSourceRepository.create.mock.invocationCallOrder[0]).toBeLessThan(
      context.projectRepository.load.mock.invocationCallOrder[0]
    );
    expect(context.audioSourceRepository.create.mock.invocationCallOrder[0]).toBeLessThan(
      context.projectRepository.create.mock.invocationCallOrder[0]
    );
    expect(replaceProjectMetadata).toHaveBeenCalledWith(INITIAL_PROJECT_METADATA);
  });

  it('저장된 revision 0 프로젝트는 create가 아니라 save로 교체하고 revision 1을 반영한다', async () => {
    const context = createTestContext();
    const existingDocument = createCurrentDocument(context.sessionStore);
    context.projectRepository.load.mockResolvedValue(existingDocument);

    await context.controller.saveProject();

    expect(context.projectRepository.create).not.toHaveBeenCalled();
    expect(context.projectRepository.save).toHaveBeenCalledWith({
      document: existingDocument,
      expectedRevision: 0,
    });
    expect(context.sessionStore.getState().project.revision).toBe(1);
  });

  it('이미 저장된 Source는 load로 검증하고 다시 만들지 않는다', async () => {
    const context = createTestContext();
    const registration = createSourceRegistration();
    context.audioSourceRegistry.restoreCommitted(registration);
    context.audioSourceRepository.load.mockResolvedValue(registration.blob);

    await context.controller.saveProject();

    expect(context.audioSourceRepository.load).toHaveBeenCalledWith(registration.metadata);
    expect(context.audioSourceRepository.create).not.toHaveBeenCalled();
    expect(context.projectRepository.create).toHaveBeenCalledTimes(1);
  });

  it('동시 생성으로 Source가 먼저 생기면 다시 load로 검증한 뒤 문서를 저장한다', async () => {
    const context = createTestContext();
    const registration = createSourceRegistration();
    context.audioSourceRegistry.restoreCommitted(registration);
    context.audioSourceRepository.load.mockResolvedValueOnce(null).mockResolvedValueOnce(registration.blob);
    context.audioSourceRepository.create.mockRejectedValueOnce(
      new AudioSourceRepositoryError({
        code: 'SOURCE_ALREADY_EXISTS',
        message: '동시에 저장됨',
      })
    );

    await context.controller.saveProject();

    expect(context.audioSourceRepository.load).toHaveBeenCalledTimes(2);
    expect(context.projectRepository.create).toHaveBeenCalledTimes(1);
  });

  it('Session을 문서로 변환할 수 없으면 저장소를 호출하지 않는다', async () => {
    const context = createTestContext();
    context.sessionStore.getState().setExportRange(0, null);

    await expect(context.controller.saveProject()).rejects.toMatchObject({
      code: 'INVALID_SESSION_PROJECT_STATE',
    });

    expect(context.audioSourceRepository.load).not.toHaveBeenCalled();
    expect(context.projectRepository.load).not.toHaveBeenCalled();
    expect(context.sessionStore.getState().project).toEqual(INITIAL_PROJECT_METADATA);
  });

  it('pending Source는 저장 대상과 ProjectDocument에서 제외한다', async () => {
    const context = createTestContext();
    context.audioSourceRegistry.stage(createSourceRegistration());

    await context.controller.saveProject();

    expect(context.audioSourceRepository.load).not.toHaveBeenCalled();
    expect(context.projectRepository.create).toHaveBeenCalledWith(expect.objectContaining({ audioSources: [] }));
  });

  it('Source 저장이 실패하면 ProjectDocument를 공개하지 않고 Session metadata를 유지한다', async () => {
    const context = createTestContext();
    context.audioSourceRegistry.restoreCommitted(createSourceRegistration());
    const sourceError = new AudioSourceRepositoryError({
      code: 'STORAGE_OPERATION_FAILED',
      message: 'Source 저장 실패',
    });
    context.audioSourceRepository.create.mockRejectedValueOnce(sourceError);

    await expect(context.controller.saveProject()).rejects.toBe(sourceError);

    expect(context.projectRepository.load).not.toHaveBeenCalled();
    expect(context.projectRepository.create).not.toHaveBeenCalled();
    expect(context.sessionStore.getState().project).toEqual(INITIAL_PROJECT_METADATA);
  });

  it('여러 Source 중 하나가 실패해도 먼저 만든 Source를 자동 삭제하지 않는다', async () => {
    const context = createTestContext();
    context.audioSourceRegistry.restoreCommitted(createSourceRegistration());
    context.audioSourceRegistry.restoreCommitted(createSourceRegistration(SECOND_SOURCE_ID));
    const sourceError = new AudioSourceRepositoryError({
      code: 'STORAGE_OPERATION_FAILED',
      message: '두 번째 Source 저장 실패',
    });
    context.audioSourceRepository.create.mockImplementation(async ({ metadata }) => {
      if (metadata.id === SECOND_SOURCE_ID) {
        throw sourceError;
      }
    });

    await expect(context.controller.saveProject()).rejects.toBe(sourceError);

    expect(context.audioSourceRepository.create).toHaveBeenCalledTimes(2);
    expect(context.audioSourceRepository.delete).not.toHaveBeenCalled();
    expect(context.projectRepository.load).not.toHaveBeenCalled();
  });

  it('ProjectDocument 저장이 실패하면 성공 revision을 추측하지 않는다', async () => {
    const context = createTestContext();
    const projectError = new ProjectRepositoryError({
      code: 'STORAGE_OPERATION_FAILED',
      message: '프로젝트 저장 실패',
    });
    context.projectRepository.create.mockRejectedValueOnce(projectError);

    await expect(context.controller.saveProject()).rejects.toBe(projectError);

    expect(context.sessionStore.getState().project).toEqual(INITIAL_PROJECT_METADATA);
  });

  it('revision 충돌을 그대로 전달하고 Session metadata를 유지한다', async () => {
    const context = createTestContext();
    context.projectRepository.load.mockResolvedValue(createCurrentDocument(context.sessionStore));
    const revisionConflict = new ProjectRepositoryError({
      code: 'REVISION_CONFLICT',
      message: '다른 탭에서 먼저 저장했습니다.',
    });
    context.projectRepository.save.mockRejectedValueOnce(revisionConflict);

    await expect(context.controller.saveProject()).rejects.toBe(revisionConflict);

    expect(context.sessionStore.getState().project).toEqual(INITIAL_PROJECT_METADATA);
  });
});
