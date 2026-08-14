export const RENDER_JOB_STATUSES = ['idle', 'running', 'completed', 'cancelled', 'failed'] as const;
export const RENDER_JOB_STAGES = ['idle', 'preparing', 'rendering', 'analyzing', 'encoding'] as const;

export type RenderJobStatus = (typeof RENDER_JOB_STATUSES)[number];
export type RenderJobStage = (typeof RENDER_JOB_STAGES)[number];

export interface RenderAnalysis {
  readonly integratedLufs: number;
  readonly loudnessRangeLu: number;
  readonly normalizationGainDb: number;
  readonly samplePeakDbfs: number;
  readonly truePeakDbtp: number;
}

export interface RenderJobFile {
  readonly analysis: RenderAnalysis;
  readonly blob: Blob;
  readonly fileName: string;
  readonly rangeId: string;
  readonly trackId: string | null;
}

export interface RenderJobResult {
  readonly files: readonly RenderJobFile[];
  readonly jobId: string;
}

export interface RenderJobState {
  readonly completedFileCount: number;
  readonly errorMessage: string | null;
  readonly jobId: string | null;
  readonly outputFileCount: number;
  readonly progress: number;
  readonly stage: RenderJobStage;
  readonly status: RenderJobStatus;
}

export type RenderJobStateListener = (state: RenderJobState) => void;

export function createIdleRenderJobState(): RenderJobState {
  return {
    completedFileCount: 0,
    errorMessage: null,
    jobId: null,
    outputFileCount: 0,
    progress: 0,
    stage: 'idle',
    status: 'idle',
  };
}

export function isTerminalRenderJobStatus(status: RenderJobStatus): boolean {
  return status === 'completed' || status === 'cancelled' || status === 'failed';
}
