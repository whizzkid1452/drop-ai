export interface AudioRegionSourceRange {
  readonly blob: Blob;
  readonly durationSeconds: number;
  readonly sourceStartTimeSeconds: number;
}

export type AnalyzeAudioRegionPeakRequest = AudioRegionSourceRange;

export type DerivedAudioRegionOperation =
  | 'bounce'
  | 'freeze'
  | 'pitchShift'
  | 'reverse'
  | 'stripSilence'
  | 'timeStretch'
  | 'transientAnalysis';

export interface RenderDerivedAudioRegionRequest extends AudioRegionSourceRange {
  readonly operation: DerivedAudioRegionOperation;
  readonly minimumSilenceSeconds?: number;
  readonly pitchSemitones?: number;
  readonly stretchRatio?: number;
  readonly thresholdDb?: number;
  readonly transientSensitivity?: number;
}

export interface RenderedDerivedAudioRegion {
  readonly blob: Blob;
  readonly durationSeconds: number;
  readonly transientPositionsSeconds?: readonly number[];
}
