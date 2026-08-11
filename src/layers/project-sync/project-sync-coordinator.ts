import type { ILocalFirstProjectRepository, RemoteProjectCrdtUpdate } from '../project-repository/i-project-repository';
import {
  NoopProjectMediaSync,
  NoopRemoteProjectDocumentApplicator,
  type IProjectMediaSync,
  type IProjectSyncGateway,
  type IProjectSyncService,
  type IRemoteProjectDocumentApplicator,
  type RemoteProjectReference,
} from './i-project-sync';
import { isRetryableProjectSyncError, ProjectSyncError, ProjectSyncErrorCode } from './project-sync-error';

const DEFAULT_RETRY_BASE_DELAY_MILLISECONDS = 1_000;
const DEFAULT_RETRY_MAX_DELAY_MILLISECONDS = 60_000;
const MAXIMUM_DUE_AT_EPOCH_MILLISECONDS = Number.MAX_SAFE_INTEGER;
const REMOTE_UPDATE_PAGE_SIZE = 100;

type CancelScheduledTask = () => void;
type ScheduleTask = (callback: () => void, delayMilliseconds: number) => CancelScheduledTask;

interface ProjectSyncCoordinatorOptions {
  readonly gateway: IProjectSyncGateway;
  readonly mediaSync?: IProjectMediaSync;
  readonly now?: () => number;
  readonly reportFailure?: (cause: unknown) => void;
  readonly remoteProjectDocumentApplicator?: IRemoteProjectDocumentApplicator;
  readonly repository: ILocalFirstProjectRepository;
  readonly retryBaseDelayMilliseconds?: number;
  readonly retryMaxDelayMilliseconds?: number;
  readonly schedule?: ScheduleTask;
}

interface ProjectSyncFlight {
  force: boolean;
  rerunRequested: boolean;
}

function scheduleWithTimeout(callback: () => void, delayMilliseconds: number): CancelScheduledTask {
  const timeout = globalThis.setTimeout(callback, delayMilliseconds);
  return () => globalThis.clearTimeout(timeout);
}

export class ProjectSyncCoordinator implements IProjectSyncService {
  readonly #gateway: IProjectSyncGateway;
  readonly #mediaSync: IProjectMediaSync;
  readonly #now: () => number;
  readonly #reportFailure: (cause: unknown) => void;
  readonly #remoteProjectDocumentApplicator: IRemoteProjectDocumentApplicator;
  readonly #repository: ILocalFirstProjectRepository;
  readonly #retryBaseDelayMilliseconds: number;
  readonly #retryMaxDelayMilliseconds: number;
  readonly #schedule: ScheduleTask;
  readonly #projectFlights = new Map<string, ProjectSyncFlight>();
  readonly #remotePullAttemptCounts = new Map<string, number>();
  readonly #runtimeAppliedSequenceIds = new Map<string, number>();
  #activeProjectId: string | null = null;
  #generation = 0;
  #cancelPendingRetry: CancelScheduledTask | null = null;

  constructor({
    gateway,
    mediaSync = new NoopProjectMediaSync(),
    now = Date.now,
    reportFailure = cause => console.error('[ProjectSyncCoordinator] 프로젝트 동기화 실패', cause),
    remoteProjectDocumentApplicator = new NoopRemoteProjectDocumentApplicator(),
    repository,
    retryBaseDelayMilliseconds = DEFAULT_RETRY_BASE_DELAY_MILLISECONDS,
    retryMaxDelayMilliseconds = DEFAULT_RETRY_MAX_DELAY_MILLISECONDS,
    schedule = scheduleWithTimeout,
  }: ProjectSyncCoordinatorOptions) {
    this.#gateway = gateway;
    this.#mediaSync = mediaSync;
    this.#now = now;
    this.#reportFailure = reportFailure;
    this.#remoteProjectDocumentApplicator = remoteProjectDocumentApplicator;
    this.#repository = repository;
    this.#retryBaseDelayMilliseconds = retryBaseDelayMilliseconds;
    this.#retryMaxDelayMilliseconds = retryMaxDelayMilliseconds;
    this.#schedule = schedule;
  }

  activateProject(projectId: string): void {
    if (this.#activeProjectId !== projectId) {
      this.#activeProjectId = projectId;
      this.#generation += 1;
      this.#cancelScheduledRetry();
    }
    this.#requestProjectSync(projectId, false);
  }

  async ensureLocalProject(projectId: string): Promise<boolean> {
    const localDocument = await this.#repository.load(projectId);
    if (localDocument) {
      return true;
    }

    // 원격 문서만 로컬에 구성하고 Runtime 교체는 ProjectController의 load 절차에 맡긴다.
    let afterSequenceId = await this.#repository.getLastAppliedRemoteSequenceId(projectId);
    while (true) {
      const updates = await this.#gateway.pullProjectUpdates({
        afterSequenceId,
        limit: REMOTE_UPDATE_PAGE_SIZE,
        projectId,
      });
      if (updates.length === 0) {
        return (await this.#repository.load(projectId)) !== null;
      }

      const result = await this.#applyRemoteProjectUpdates({ afterSequenceId, projectId, updates });
      afterSequenceId = result.lastSequenceId;
      if (updates.length < REMOTE_UPDATE_PAGE_SIZE) {
        return (await this.#repository.load(projectId)) !== null;
      }
    }
  }

  async listRemoteProjects(): Promise<readonly RemoteProjectReference[]> {
    if (!this.#gateway.listRemoteProjects) {
      return [];
    }
    try {
      return await this.#gateway.listRemoteProjects();
    } catch (cause) {
      if (cause instanceof ProjectSyncError && cause.code === ProjectSyncErrorCode.AUTH_REQUIRED) {
        return [];
      }
      if (isRetryableProjectSyncError(cause)) {
        this.#reportFailure(cause);
        return [];
      }
      throw cause;
    }
  }

  notifyProjectChanged(projectId: string): void {
    if (projectId === this.#activeProjectId) {
      this.#requestProjectSync(projectId, false);
    }
  }

  ensureLocalProjectMedia(document: Parameters<IProjectMediaSync['ensureLocalProjectMedia']>[0]): Promise<void> {
    return this.#mediaSync.ensureLocalProjectMedia(document);
  }

  resume(): void {
    if (this.#activeProjectId) {
      this.#requestProjectSync(this.#activeProjectId, true);
    }
  }

  hasInFlightSync(projectId: string): boolean {
    return this.#projectFlights.has(projectId);
  }

  #requestProjectSync(projectId: string, force: boolean): void {
    if (!this.#isActiveProject(projectId, this.#generation)) {
      return;
    }

    const existingFlight = this.#projectFlights.get(projectId);
    if (existingFlight) {
      existingFlight.rerunRequested = true;
      existingFlight.force ||= force;
      return;
    }

    this.#cancelScheduledRetry();
    const generation = this.#generation;
    const flight: ProjectSyncFlight = {
      force,
      rerunRequested: false,
    };
    this.#projectFlights.set(projectId, flight);
    void this.#synchronizeProject({ force, generation, projectId })
      .catch(cause => this.#reportFailure(cause))
      .finally(() => {
        if (this.#projectFlights.get(projectId) !== flight) {
          return;
        }
        this.#projectFlights.delete(projectId);
        if (flight.rerunRequested && this.#isActiveProject(projectId, generation)) {
          this.#requestProjectSync(projectId, flight.force);
        }
      });
  }

  async #synchronizeProject({
    force,
    generation,
    projectId,
  }: {
    readonly force: boolean;
    readonly generation: number;
    readonly projectId: string;
  }): Promise<void> {
    await this.#drainProjectOutbox({ force, generation, projectId });
    if (!this.#isActiveProject(projectId, generation)) {
      return;
    }
    try {
      await this.#reconcileRemoteProjectRuntime({ generation, projectId });
      await this.#pullRemoteProjectUpdates({ generation, projectId });
      this.#remotePullAttemptCounts.delete(projectId);
    } catch (cause) {
      this.#handleRemoteSyncFailure({ cause, generation, projectId });
    }
  }

  async #drainProjectOutbox({
    force,
    generation,
    projectId,
  }: {
    readonly force: boolean;
    readonly generation: number;
    readonly projectId: string;
  }): Promise<void> {
    while (this.#isActiveProject(projectId, generation)) {
      const [change] = await this.#repository.listPendingChanges({
        projectId,
        dueAtEpochMilliseconds: MAXIMUM_DUE_AT_EPOCH_MILLISECONDS,
        limit: 1,
      });
      if (!change) {
        return;
      }
      if (!force && change.nextAttemptAtEpochMilliseconds > this.#now()) {
        this.#scheduleRetry({
          generation,
          nextAttemptAtEpochMilliseconds: change.nextAttemptAtEpochMilliseconds,
          projectId,
        });
        return;
      }

      try {
        await this.#mediaSync.ensureProjectMedia(change.document);
        // 업로드 중 프로젝트가 바뀌면 이전 문서가 새 활성 범위의 응답보다 늦게 적용될 수 있어 전송하지 않는다.
        if (!this.#isActiveProject(projectId, generation)) {
          return;
        }
        const result = await this.#gateway.pushProjectChange(change);
        if (result.operationId !== change.operationId) {
          throw new ProjectSyncError({
            code: ProjectSyncErrorCode.INVALID_RESPONSE,
            message: '서버가 다른 operation ID를 확인했습니다.',
            retryable: false,
            details: { expectedOperationId: change.operationId, receivedOperationId: result.operationId },
          });
        }
      } catch (cause) {
        if (!this.#isActiveProject(projectId, generation)) {
          return;
        }
        if (cause instanceof ProjectSyncError && cause.code === ProjectSyncErrorCode.AUTH_REQUIRED) {
          return;
        }
        if (!isRetryableProjectSyncError(cause)) {
          this.#reportFailure(cause);
          return;
        }

        const nextAttemptAtEpochMilliseconds = this.#now() + this.#calculateRetryDelay(change.attemptCount);
        await this.#repository.schedulePendingChangeRetry({
          operationId: change.operationId,
          nextAttemptAtEpochMilliseconds,
        });
        this.#scheduleRetry({ generation, nextAttemptAtEpochMilliseconds, projectId });
        return;
      }

      // 프로젝트가 바뀐 뒤 도착한 응답은 로컬 Outbox에도 적용하지 않고 서버 idempotency로 재확인한다.
      if (!this.#isActiveProject(projectId, generation)) {
        return;
      }
      await this.#repository.acknowledgePendingChange(change.operationId);
    }
  }

  async #pullRemoteProjectUpdates({
    generation,
    projectId,
  }: {
    readonly generation: number;
    readonly projectId: string;
  }): Promise<void> {
    let afterSequenceId = await this.#repository.getLastAppliedRemoteSequenceId(projectId);
    while (this.#isActiveProject(projectId, generation)) {
      const updates: readonly RemoteProjectCrdtUpdate[] = await this.#gateway.pullProjectUpdates({
        afterSequenceId,
        limit: REMOTE_UPDATE_PAGE_SIZE,
        projectId,
      });
      if (!this.#isActiveProject(projectId, generation) || updates.length === 0) {
        return;
      }

      const result = await this.#applyRemoteProjectUpdates({ afterSequenceId, projectId, updates });
      afterSequenceId = result.lastSequenceId;
      await this.#reconcileRemoteProjectRuntime({ generation, projectId });
      if (updates.length < REMOTE_UPDATE_PAGE_SIZE) {
        return;
      }
    }
  }

  async #applyRemoteProjectUpdates({
    afterSequenceId,
    projectId,
    updates,
  }: {
    readonly afterSequenceId: number;
    readonly projectId: string;
    readonly updates: readonly RemoteProjectCrdtUpdate[];
  }) {
    const result = await this.#repository.applyRemoteProjectUpdates({ projectId, updates });
    if (result.lastSequenceId <= afterSequenceId) {
      throw new ProjectSyncError({
        code: ProjectSyncErrorCode.INVALID_RESPONSE,
        message: '원격 프로젝트 update sequence가 조회 cursor보다 크지 않습니다.',
        retryable: false,
        details: { afterSequenceId, lastSequenceId: result.lastSequenceId, projectId },
      });
    }
    return result;
  }

  async #reconcileRemoteProjectRuntime({
    generation,
    projectId,
  }: {
    readonly generation: number;
    readonly projectId: string;
  }): Promise<void> {
    // 저장 cursor는 Runtime 반영보다 먼저 커밋되므로 둘을 분리해 실패한 Runtime 반영을 다시 시도한다.
    const repositorySequenceId = await this.#repository.getLastAppliedRemoteSequenceId(projectId);
    const runtimeSequenceId = this.#runtimeAppliedSequenceIds.get(projectId) ?? 0;
    if (repositorySequenceId <= runtimeSequenceId || !this.#isActiveProject(projectId, generation)) {
      return;
    }

    const document = await this.#repository.load(projectId);
    if (!document) {
      throw new ProjectSyncError({
        code: ProjectSyncErrorCode.INVALID_RESPONSE,
        message: '원격 update cursor에 대응하는 프로젝트 문서가 없습니다.',
        retryable: false,
        details: { projectId, repositorySequenceId },
      });
    }

    await this.#mediaSync.ensureLocalProjectMedia(document);
    if (!this.#isActiveProject(projectId, generation)) {
      return;
    }

    const applied = await this.#remoteProjectDocumentApplicator.applyRemoteProjectDocument(document);
    if (!this.#isActiveProject(projectId, generation)) {
      return;
    }
    if (!applied) {
      throw new ProjectSyncError({
        code: ProjectSyncErrorCode.RUNTIME_NOT_CURRENT,
        message: '원격 문서를 준비하는 동안 활성 프로젝트 상태가 변경됐습니다.',
        retryable: true,
        details: { projectId, repositorySequenceId },
      });
    }
    this.#runtimeAppliedSequenceIds.set(projectId, repositorySequenceId);
  }

  #handleRemoteSyncFailure({
    cause,
    generation,
    projectId,
  }: {
    readonly cause: unknown;
    readonly generation: number;
    readonly projectId: string;
  }): void {
    if (!this.#isActiveProject(projectId, generation)) {
      return;
    }
    if (cause instanceof ProjectSyncError && cause.code === ProjectSyncErrorCode.AUTH_REQUIRED) {
      this.#remotePullAttemptCounts.delete(projectId);
      return;
    }
    if (!isRetryableProjectSyncError(cause)) {
      this.#remotePullAttemptCounts.delete(projectId);
      throw cause;
    }
    const attemptCount = this.#remotePullAttemptCounts.get(projectId) ?? 0;
    this.#remotePullAttemptCounts.set(projectId, attemptCount + 1);
    this.#scheduleRetry({
      generation,
      nextAttemptAtEpochMilliseconds: this.#now() + this.#calculateRetryDelay(attemptCount),
      projectId,
    });
  }

  #scheduleRetry({
    generation,
    nextAttemptAtEpochMilliseconds,
    projectId,
  }: {
    readonly generation: number;
    readonly nextAttemptAtEpochMilliseconds: number;
    readonly projectId: string;
  }): void {
    this.#cancelScheduledRetry();
    const delayMilliseconds = Math.max(0, nextAttemptAtEpochMilliseconds - this.#now());
    const cancel = this.#schedule(() => {
      if (this.#isActiveProject(projectId, generation)) {
        this.#requestProjectSync(projectId, false);
      }
    }, delayMilliseconds);
    this.#cancelPendingRetry = cancel;
  }

  #calculateRetryDelay(attemptCount: number): number {
    const exponentialDelay = this.#retryBaseDelayMilliseconds * 2 ** attemptCount;
    return Math.min(exponentialDelay, this.#retryMaxDelayMilliseconds);
  }

  #isActiveProject(projectId: string, generation: number): boolean {
    return this.#activeProjectId === projectId && this.#generation === generation;
  }

  #cancelScheduledRetry(): void {
    this.#cancelPendingRetry?.();
    this.#cancelPendingRetry = null;
  }
}
