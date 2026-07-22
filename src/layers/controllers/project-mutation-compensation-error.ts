export interface ProjectMutationCompensationFailure {
  readonly step: string;
  readonly cause: unknown;
}

interface ProjectMutationCompensationErrorOptions {
  readonly operation: string;
  readonly failedPhase: string;
  readonly cause: unknown;
  readonly compensationFailures: readonly ProjectMutationCompensationFailure[];
}

export class ProjectMutationCompensationError extends Error {
  public readonly operation: string;
  public readonly failedPhase: string;
  public readonly compensationFailures: readonly ProjectMutationCompensationFailure[];

  constructor({ operation, failedPhase, cause, compensationFailures }: ProjectMutationCompensationErrorOptions) {
    super(`${operation} 실패 후 ${failedPhase} 보상을 완료하지 못했습니다.`, { cause });
    this.name = 'ProjectMutationCompensationError';
    this.operation = operation;
    this.failedPhase = failedPhase;
    this.compensationFailures = [...compensationFailures];
  }
}
