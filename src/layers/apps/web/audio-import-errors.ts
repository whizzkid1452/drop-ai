export interface AudioImportCompensationFailure {
  readonly step: string;
  readonly cause: unknown;
}

type AudioImportOperation = 'audio-file-import' | 'track-region-import';

interface AudioImportCompensationErrorOptions {
  readonly operation: AudioImportOperation;
  readonly failedPhase: string;
  readonly cause: unknown;
  readonly compensationFailures: readonly AudioImportCompensationFailure[];
}

interface AudioImportPostCommitErrorOptions {
  readonly operation: AudioImportOperation;
  readonly failedStep: string;
  readonly cause: unknown;
}

export class AudioImportCompensationError extends Error {
  public readonly operation: AudioImportOperation;
  public readonly failedPhase: string;
  public readonly compensationFailures: readonly AudioImportCompensationFailure[];

  constructor({ operation, failedPhase, cause, compensationFailures }: AudioImportCompensationErrorOptions) {
    super(`${operation} 실패 후 ${failedPhase} 보상을 완료하지 못했습니다.`, { cause });
    this.name = 'AudioImportCompensationError';
    this.operation = operation;
    this.failedPhase = failedPhase;
    this.compensationFailures = [...compensationFailures];
  }
}

export class AudioImportPostCommitError extends Error {
  public readonly operation: AudioImportOperation;
  public readonly failedStep: string;

  constructor({ operation, failedStep, cause }: AudioImportPostCommitErrorOptions) {
    super(`${operation}은 완료됐지만 ${failedStep}에 실패했습니다.`, { cause });
    this.name = 'AudioImportPostCommitError';
    this.operation = operation;
    this.failedStep = failedStep;
  }
}
