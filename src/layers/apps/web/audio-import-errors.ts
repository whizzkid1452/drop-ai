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
