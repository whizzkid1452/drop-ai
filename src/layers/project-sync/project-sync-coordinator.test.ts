import { describe, expect, it, vi } from 'vitest';
import { InMemoryProjectRepository } from '../project-repository/in-memory-project-repository';
import type { ProjectDocument } from '../shared/types/project-document.schema';
import type { IProjectSyncGateway } from './i-project-sync';
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

describe('ProjectSyncCoordinator', () => {
  it('활성 프로젝트의 전송 완료 변경을 Outbox에서 확인 처리한다', async () => {
    const repository = new InMemoryProjectRepository({ now: () => 1_000 });
    const committed = await repository.commitLocal({
      document: createProjectDocument(PROJECT_ID),
      expectedRevision: 0,
      operationId: OPERATION_ID,
    });
    const gateway: IProjectSyncGateway = {
      pushProjectChange: vi.fn().mockResolvedValue({
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
      readonly operationId: string;
      readonly serverRevision: number;
      readonly status: 'applied';
    }>();
    const pushProjectChange = vi.fn().mockReturnValue(deferred.promise);
    const coordinator = new ProjectSyncCoordinator({
      gateway: { pushProjectChange },
      repository,
      now: () => 1_000,
    });

    coordinator.activateProject(PROJECT_ID);
    coordinator.notifyProjectChanged(PROJECT_ID);
    coordinator.notifyProjectChanged(PROJECT_ID);

    await vi.waitFor(() => expect(pushProjectChange).toHaveBeenCalledOnce());
    deferred.resolve({ operationId: OPERATION_ID, serverRevision: 0, status: 'applied' });
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
      readonly operationId: string;
      readonly serverRevision: number;
      readonly status: 'applied';
    }>();
    const coordinator = new ProjectSyncCoordinator({
      gateway: { pushProjectChange: () => deferred.promise },
      repository,
      now: () => 1_000,
    });

    coordinator.activateProject(PROJECT_ID);
    await vi.waitFor(() => expect(coordinator.hasInFlightSync(PROJECT_ID)).toBe(true));
    coordinator.activateProject(SECOND_PROJECT_ID);
    deferred.resolve({ operationId: OPERATION_ID, serverRevision: 0, status: 'applied' });

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
      .mockResolvedValueOnce({ operationId: OPERATION_ID, serverRevision: 0, status: 'applied' });
    let scheduledRetry: (() => void) | undefined;
    const coordinator = new ProjectSyncCoordinator({
      gateway: { pushProjectChange },
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
      gateway: { pushProjectChange },
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
        pushProjectChange: async change => {
          pushedRevisions.push(change.localRevision);
          return { operationId: change.operationId, serverRevision: change.localRevision, status: 'applied' };
        },
      },
      repository,
      now: () => 3_000,
    });

    coordinator.activateProject(PROJECT_ID);

    await vi.waitFor(() => expect(pushedRevisions).toEqual([0, 1]));
  });
});
