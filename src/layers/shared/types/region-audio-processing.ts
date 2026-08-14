export interface AudioRegionSourceRange {
  readonly blob: Blob;
  readonly durationSeconds: number;
  readonly sourceStartTimeSeconds: number;
}

export type AnalyzeAudioRegionPeakRequest = AudioRegionSourceRange;

export type DerivedAudioRegionOperation = 'reverse' | 'stripSilence';

export interface RenderDerivedAudioRegionRequest extends AudioRegionSourceRange {
  readonly operation: DerivedAudioRegionOperation;
  readonly minimumSilenceSeconds?: number;
  readonly thresholdDb?: number;
}

export interface RenderedDerivedAudioRegion {
  readonly blob: Blob;
  readonly durationSeconds: number;
}
