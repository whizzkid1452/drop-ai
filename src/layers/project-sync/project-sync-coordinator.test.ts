import { describe, expect, it, vi } from 'vitest';
import { ProjectCrdtDocument } from '../project-crdt/project-crdt-document';
import { encodeProjectCrdtUpdate } from '../project-crdt/project-crdt-update-codec';
import { InMemoryProjectRepository } from '../project-repository/in-memory-project-repository';
import type { ProjectDocument } from '../shared/types/project-document.schema';
import type { IProjectMediaSync, IProjectSyncGateway } from './i-project-sync';
import { ProjectSyncCoordinator } from './project-sync-coordinator';
import { ProjectSyncError, ProjectSyncErrorCode } from './project-sync-error';

const PROJECT_ID = '11111111-1111-4111-8111-111111111111';
const SECOND_PROJECT_ID = '22222222-2222-4222-8222-222222222222';
const OPERATION_ID = '33333333-3333-4333-8333-333333333333';
const SECOND_OPERATION_ID = '44444444-4444-4444-8444-444444444444';

function createProjectDocument(projectId: string): ProjectDocument {
  return {
    documentType: 'drop-ai-project',
    schemaVersion: 1,
    project: { id: projectId, name: '새 프로젝트', revision: 0 },
    timeline: { timeUnit: 'seconds', tempoBpm: 120 },
    mixer: { masterVolume: 1 },
    exportRange: null,
    audioSources: [],
    tracks: [],
  };
}

function createDeferred<Result>() {
  let resolve!: (result: Result) => void;
  const promise = new Promise<Result>(resolvePromise => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

function createInitialRemoteUpdate(projectId: string) {
  const crdtDocument = ProjectCrdtDocument.create(createProjectDocument(projectId));
  try {
    return {
      operationId: OPERATION_ID,
      sequenceId: 1,
      updateBase64: encodeProjectCrdtUpdate(crdtDocument.encodeStateAsUpdate()),
    };
  } finally {
    crdtDocument.destroy();
  }
}

describe('ProjectSyncCoordinator', () => {
  it('프로젝트 문서보다 참조 미디어를 먼저 동기화한다', async () => {
    const repository = new InMemoryProjectRepository({ now: () => 1_000 });
    await repository.commitLocal({
      document: createProjectDocument(PROJECT_ID),
      expectedRevision: 0,
      operationId: OPERATION_ID,
    });
    const callOrder: string[] = [];
    const mediaSync: IProjectMediaSync = {
      ensureProjectMedia: vi.fn(async () => {
        callOrder.push('media');
      }),
    };
    const coordinator = new ProjectSyncCoordinator({
      gateway: {
        pullProjectUpdates: vi.fn().mockResolvedValue([]),
        pushProjectChange: vi.fn(async () => {
          callOrder.push('document');
          return {
            kind: 'snapshot' as const,
            operationId: OPERATION_ID,
            serverRevision: 0,
            status: 'applied' as const,
          };
        }),
      },
      mediaSync,
      repository,
      now: () => 1_000,
    });

    coordinator.activateProject(PROJECT_ID);

    await vi.waitFor(() => expect(callOrder).toEqual(['media', 'document']));
  });

  it('미디어 업로드가 실패하면 프로젝트 문서를 전송하지 않고 재시도를 예약한다', async () => {
    const repository = new InMemoryProjectRepository({ now: () => 1_000 });
    await repository.commitLocal({
      document: createProjectDocument(PROJECT_ID),
      expectedRevision: 0,
      operationId: OPERATION_ID,
    });
    const pushProjectChange = vi.fn();
    const schedule = vi.fn(() => () => undefined);
    const coordinator = new ProjectSyncCoordinator({
      gateway: { pullProjectUpdates: vi.fn().mockResolvedValue([]), pushProjectChange },
      mediaSync: {
        ensureProjectMedia: vi.fn().mockRejectedValue(
          new ProjectSyncError({
            code: ProjectSyncErrorCode.NETWORK_ERROR,
            message: '미디어 업로드 네트워크 오류',
            retryable: true,
          })
        ),
      },
      repository,
      now: () => 1_000,
      schedule,
    });

    coordinator.activateProject(PROJECT_ID);

    await vi.waitFor(() => expect(schedule).toHaveBeenCalledWith(expect.any(Function), 1_000));
    expect(pushProjectChange).not.toHaveBeenCalled();
  });

  it('미디어 업로드 중 프로젝트가 바뀌면 이전 프로젝트 문서를 전송하지 않는다', async () => {
    const repository = new InMemoryProjectRepository({ now: () => 1_000 });
    await repository.commitLocal({
      document: createProjectDocument(PROJECT_ID),
      expectedRevision: 0,
      operationId: OPERATION_ID,
    });
    const mediaUpload = createDeferred<void>();
    const pushProjectChange = vi.fn();
    const coordinator = new ProjectSyncCoordinator({
      gateway: { pullProjectUpdates: vi.fn().mockResolvedValue([]), pushProjectChange },
      mediaSync: { ensureProjectMedia: () => mediaUpload.promise },
      repository,
      now: () => 1_000,
    });

    coordinator.activateProject(PROJECT_ID);
    await vi.waitFor(() => expect(coordinator.hasInFlightSync(PROJECT_ID)).toBe(true));
    coordinator.activateProject(SECOND_PROJECT_ID);
    mediaUpload.resolve();

    await vi.waitFor(() => expect(coordinator.hasInFlightSync(PROJECT_ID)).toBe(false));
    expect(pushProjectChange).not.toHaveBeenCalled();
  });

  it('활성 프로젝트의 전송 완료 변경을 Outbox에서 확인 처리한다', async () => {
    const repository = new InMemoryProjectRepository({ now: () => 1_000 });
    const committed = await repository.commitLocal({
      document: createProjectDocument(PROJECT_ID),
      expectedRevision: 0,
      operationId: OPERATION_ID,
    });
    const gateway: IProjectSyncGateway = {
      pullProjectUpdates: vi.fn().mockResolvedValue([]),
      pushProjectChange: vi.fn().mockResolvedValue({
        kind: 'snapshot',
        operationId: OPERATION_ID,
        serverRevision: 0,
        status: 'applied',
      }),
    };
    const coordinator = new ProjectSyncCoordinator({ gateway, repository, now: () => 1_000 });

    coordinator.activateProject(PROJECT_ID);

    await vi.waitFor(() => expect(gateway.pushProjectChange).toHaveBeenCalledWith(committed.outboxEntry));
    await vi.waitFor(async () => {
      await expect(repository.listPendingChanges({ dueAtEpochMilliseconds: 1_000 })).resolves.toEqual([]);
    });
  });

  it('같은 프로젝트의 중복 동기화 요청을 하나의 진행 중 요청으로 합친다', async () => {
    const repository = new InMemoryProjectRepository({ now: () => 1_000 });
    await repository.commitLocal({
      document: createProjectDocument(PROJECT_ID),
      expectedRevision: 0,
      operationId: OPERATION_ID,
    });
    const deferred = createDeferred<{
      readonly kind: 'snapshot';
      readonly operationId: string;
      readonly serverRevision: number;
      readonly status: 'applied';
    }>();
    const pushProjectChange = vi.fn().mockReturnValue(deferred.promise);
    const coordinator = new ProjectSyncCoordinator({
      gateway: { pullProjectUpdates: vi.fn().mockResolvedValue([]), pushProjectChange },
      repository,
      now: () => 1_000,
    });

    coordinator.activateProject(PROJECT_ID);
    coordinator.notifyProjectChanged(PROJECT_ID);
    coordinator.notifyProjectChanged(PROJECT_ID);

    await vi.waitFor(() => expect(pushProjectChange).toHaveBeenCalledOnce());
    deferred.resolve({ kind: 'snapshot', operationId: OPERATION_ID, serverRevision: 0, status: 'applied' });
    await vi.waitFor(async () => {
      await expect(repository.listPendingChanges({ dueAtEpochMilliseconds: 1_000 })).resolves.toEqual([]);
    });
    expect(pushProjectChange).toHaveBeenCalledOnce();
  });

  it('프로젝트 전환 전에 시작한 응답은 이전 프로젝트 Outbox를 변경하지 않는다', async () => {
    const repository = new InMemoryProjectRepository({ now: () => 1_000 });
    await repository.commitLocal({
      document: createProjectDocument(PROJECT_ID),
      expectedRevision: 0,
      operationId: OPERATION_ID,
    });
    const deferred = createDeferred<{
      readonly kind: 'snapshot';
      readonly operationId: string;
      readonly serverRevision: number;
      readonly status: 'applied';
    }>();
    const coordinator = new ProjectSyncCoordinator({
      gateway: {
        pullProjectUpdates: vi.fn().mockResolvedValue([]),
        pushProjectChange: () => deferred.promise,
      },
      repository,
      now: () => 1_000,
    });

    coordinator.activateProject(PROJECT_ID);
    await vi.waitFor(() => expect(coordinator.hasInFlightSync(PROJECT_ID)).toBe(true));
    coordinator.activateProject(SECOND_PROJECT_ID);
    deferred.resolve({ kind: 'snapshot', operationId: OPERATION_ID, serverRevision: 0, status: 'applied' });

    await vi.waitFor(() => expect(coordinator.hasInFlightSync(PROJECT_ID)).toBe(false));
    await expect(repository.listPendingChanges({ dueAtEpochMilliseconds: 1_000 })).resolves.toHaveLength(1);
  });

  it('일시적 실패를 지수 지연으로 예약하고 예약 시각에 자동 재시도한다', async () => {
    let currentTime = 1_000;
    const repository = new InMemoryProjectRepository({ now: () => currentTime });
    await repository.commitLocal({
      document: createProjectDocument(PROJECT_ID),
      expectedRevision: 0,
      operationId: OPERATION_ID,
    });
    const pushProjectChange = vi
      .fn()
      .mockRejectedValueOnce(
        new ProjectSyncError({
          code: ProjectSyncErrorCode.NETWORK_ERROR,
          message: '네트워크 오류',
          retryable: true,
        })
      )
      .mockResolvedValueOnce({
        kind: 'snapshot',
        operationId: OPERATION_ID,
        serverRevision: 0,
        status: 'applied',
      });
    let scheduledRetry: (() => void) | undefined;
    const coordinator = new ProjectSyncCoordinator({
      gateway: { pullProjectUpdates: vi.fn().mockResolvedValue([]), pushProjectChange },
      repository,
      now: () => currentTime,
      schedule: callback => {
        scheduledRetry = callback;
        return () => undefined;
      },
    });

    coordinator.activateProject(PROJECT_ID);

    await vi.waitFor(async () => {
      await expect(repository.listPendingChanges({ dueAtEpochMilliseconds: 2_000 })).resolves.toEqual([
        expect.objectContaining({ attemptCount: 1, nextAttemptAtEpochMilliseconds: 2_000 }),
      ]);
    });
    currentTime = 2_000;
    scheduledRetry?.();
    await vi.waitFor(() => expect(pushProjectChange).toHaveBeenCalledTimes(2));
    await vi.waitFor(async () => {
      await expect(repository.listPendingChanges({ dueAtEpochMilliseconds: 2_000 })).resolves.toEqual([]);
    });
  });

  it('앞선 revision의 재시도 시각 전에는 뒤 revision을 먼저 전송하지 않는다', async () => {
    const repository = new InMemoryProjectRepository({ now: () => 1_000 });
    await repository.commitLocal({
      document: createProjectDocument(PROJECT_ID),
      expectedRevision: 0,
      operationId: OPERATION_ID,
    });
    await repository.schedulePendingChangeRetry({
      operationId: OPERATION_ID,
      nextAttemptAtEpochMilliseconds: 2_000,
    });
    await repository.commitLocal({
      document: createProjectDocument(PROJECT_ID),
      expectedRevision: 0,
      operationId: SECOND_OPERATION_ID,
    });
    const pushProjectChange = vi.fn();
    const schedule = vi.fn(() => () => undefined);
    const coordinator = new ProjectSyncCoordinator({
      gateway: { pullProjectUpdates: vi.fn().mockResolvedValue([]), pushProjectChange },
      repository,
      now: () => 1_000,
      schedule,
    });

    coordinator.activateProject(PROJECT_ID);

    await vi.waitFor(() => expect(schedule).toHaveBeenCalledWith(expect.any(Function), 1_000));
    expect(pushProjectChange).not.toHaveBeenCalled();
  });

  it('로컬 시계가 뒤로 이동해도 프로젝트 revision 순서로 전송한다', async () => {
    let currentTime = 2_000;
    const repository = new InMemoryProjectRepository({ now: () => currentTime });
    await repository.commitLocal({
      document: createProjectDocument(PROJECT_ID),
      expectedRevision: 0,
      operationId: OPERATION_ID,
    });
    currentTime = 1_000;
    await repository.commitLocal({
      document: createProjectDocument(PROJECT_ID),
      expectedRevision: 0,
      operationId: SECOND_OPERATION_ID,
    });
    const pushedRevisions: number[] = [];
    const coordinator = new ProjectSyncCoordinator({
      gateway: {
        pullProjectUpdates: vi.fn().mockResolvedValue([]),
        pushProjectChange: async change => {
          pushedRevisions.push(change.localRevision);
          return {
            kind: 'snapshot',
            operationId: change.operationId,
            serverRevision: change.localRevision,
            status: 'applied',
          };
        },
      },
      repository,
      now: () => 3_000,
    });

    coordinator.activateProject(PROJECT_ID);

    await vi.waitFor(() => expect(pushedRevisions).toEqual([0, 1]));
  });

  it('활성 프로젝트의 마지막 sequence 이후 update를 로컬 저장소에 반영한다', async () => {
    const repository = new InMemoryProjectRepository({ now: () => 1_000 });
    const remoteUpdate = createInitialRemoteUpdate(PROJECT_ID);
    const pullProjectUpdates = vi.fn().mockResolvedValueOnce([remoteUpdate]).mockResolvedValueOnce([]);
    const coordinator = new ProjectSyncCoordinator({
      gateway: {
        pullProjectUpdates,
        pushProjectChange: vi.fn(),
      },
      repository,
      now: () => 1_000,
    });

    coordinator.activateProject(PROJECT_ID);

    await vi.waitFor(async () => {
      await expect(repository.load(PROJECT_ID)).resolves.toEqual(createProjectDocument(PROJECT_ID));
    });
    expect(pullProjectUpdates).toHaveBeenNthCalledWith(1, {
      afterSequenceId: 0,
      limit: 100,
      projectId: PROJECT_ID,
    });
    await expect(repository.getLastAppliedRemoteSequenceId(PROJECT_ID)).resolves.toBe(1);
  });

  it('프로젝트 전환 전에 조회한 원격 update를 이전 프로젝트에 반영하지 않는다', async () => {
    const repository = new InMemoryProjectRepository({ now: () => 1_000 });
    const firstProjectUpdates = createDeferred<ReturnType<typeof createInitialRemoteUpdate>[]>();
    const pullProjectUpdates = vi.fn(request => {
      if (request.projectId === PROJECT_ID) {
        return firstProjectUpdates.promise;
      }
      return Promise.resolve([]);
    });
    const coordinator = new ProjectSyncCoordinator({
      gateway: { pullProjectUpdates, pushProjectChange: vi.fn() },
      repository,
      now: () => 1_000,
    });

    coordinator.activateProject(PROJECT_ID);
    await vi.waitFor(() =>
      expect(pullProjectUpdates).toHaveBeenCalledWith(expect.objectContaining({ projectId: PROJECT_ID }))
    );
    coordinator.activateProject(SECOND_PROJECT_ID);
    firstProjectUpdates.resolve([createInitialRemoteUpdate(PROJECT_ID)]);

    await vi.waitFor(() => expect(coordinator.hasInFlightSync(PROJECT_ID)).toBe(false));
    await expect(repository.load(PROJECT_ID)).resolves.toBeNull();
    await expect(repository.getLastAppliedRemoteSequenceId(PROJECT_ID)).resolves.toBe(0);
  });

  it('원격 update가 조회 한도만큼 있으면 저장한 cursor로 다음 페이지를 조회한다', async () => {
    const repository = new InMemoryProjectRepository({ now: () => 1_000 });
    const initialUpdate = createInitialRemoteUpdate(PROJECT_ID);
    const firstPage = Array.from({ length: 100 }, (_, index) => ({
      ...initialUpdate,
      operationId: `00000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
      sequenceId: index + 1,
    }));
    const pullProjectUpdates = vi.fn(({ afterSequenceId }: { readonly afterSequenceId: number }) =>
      Promise.resolve(afterSequenceId === 0 ? firstPage : [])
    );
    const coordinator = new ProjectSyncCoordinator({
      gateway: { pullProjectUpdates, pushProjectChange: vi.fn() },
      repository,
      now: () => 1_000,
    });

    coordinator.activateProject(PROJECT_ID);

    await vi.waitFor(() =>
      expect(pullProjectUpdates).toHaveBeenCalledWith({
        afterSequenceId: 100,
        limit: 100,
        projectId: PROJECT_ID,
      })
    );
    await expect(repository.getLastAppliedRemoteSequenceId(PROJECT_ID)).resolves.toBe(100);
  });

  it('원격 update 조회의 일시적 실패를 지수 지연으로 재시도한다', async () => {
    let currentTime = 1_000;
    const repository = new InMemoryProjectRepository({ now: () => currentTime });
    const pullProjectUpdates = vi.fn().mockRejectedValue(
      new ProjectSyncError({
        code: ProjectSyncErrorCode.NETWORK_ERROR,
        message: '원격 update 조회 실패',
        retryable: true,
      })
    );
    const scheduledCallbacks: Array<() => void> = [];
    const schedule = vi.fn((callback: () => void) => {
      scheduledCallbacks.push(callback);
      return () => undefined;
    });
    const coordinator = new ProjectSyncCoordinator({
      gateway: { pullProjectUpdates, pushProjectChange: vi.fn() },
      repository,
      now: () => currentTime,
      schedule,
    });

    coordinator.activateProject(PROJECT_ID);
    await vi.waitFor(() => expect(schedule).toHaveBeenNthCalledWith(1, expect.any(Function), 1_000));
    currentTime = 2_000;
    scheduledCallbacks[0]?.();

    await vi.waitFor(() => expect(schedule).toHaveBeenNthCalledWith(2, expect.any(Function), 2_000));
  });
});
