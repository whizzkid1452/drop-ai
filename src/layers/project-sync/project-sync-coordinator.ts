import type { ILocalFirstProjectRepository } from '../project-repository/i-project-repository';
import type { IProjectSyncGateway, IProjectSyncService } from './i-project-sync';
import { isRetryableProjectSyncError, ProjectSyncError, ProjectSyncErrorCode } from './project-sync-error';

const DEFAULT_RETRY_BASE_DELAY_MILLISECONDS = 1_000;
const DEFAULT_RETRY_MAX_DELAY_MILLISECONDS = 60_000;
const MAXIMUM_DUE_AT_EPOCH_MILLISECONDS = Number.MAX_SAFE_INTEGER;

type CancelScheduledTask = () => void;
type ScheduleTask = (callback: () => void, delayMilliseconds: number) => CancelScheduledTask;

interface ProjectSyncCoordinatorOptions {
  readonly gateway: IProjectSyncGateway;
  readonly now?: () => number;
  readonly reportFailure?: (cause: unknown) => void;
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
  readonly #now: () => number;
  readonly #reportFailure: (cause: unknown) => void;
  readonly #repository: ILocalFirstProjectRepository;
  readonly #retryBaseDelayMilliseconds: number;
  readonly #retryMaxDelayMilliseconds: number;
  readonly #schedule: ScheduleTask;
  readonly #projectFlights = new Map<string, ProjectSyncFlight>();
  #activeProjectId: string | null = null;
  #generation = 0;
  #cancelPendingRetry: CancelScheduledTask | null = null;

  constructor({
    gateway,
    now = Date.now,
    reportFailure = cause => console.error('[ProjectSyncCoordinator] 프로젝트 동기화 실패', cause),
    repository,
    retryBaseDelayMilliseconds = DEFAULT_RETRY_BASE_DELAY_MILLISECONDS,
    retryMaxDelayMilliseconds = DEFAULT_RETRY_MAX_DELAY_MILLISECONDS,
    schedule = scheduleWithTimeout,
  }: ProjectSyncCoordinatorOptions) {
    this.#gateway = gateway;
    this.#now = now;
    this.#reportFailure = reportFailure;
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

  notifyProjectChanged(projectId: string): void {
    if (projectId === this.#activeProjectId) {
      this.#requestProjectSync(projectId, false);
    }
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
    void this.#drainProjectOutbox({ force, generation, projectId })
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
