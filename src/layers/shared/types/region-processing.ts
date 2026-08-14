export type RegionFadeCurve = 'linear' | 'equalPower';

export interface RegionFadeState {
  readonly crossfadeId: string | null;
  readonly curve: RegionFadeCurve;
  readonly durationSeconds: number;
}

export interface RegionProcessingState {
  readonly fadeIn: RegionFadeState;
  readonly fadeOut: RegionFadeState;
  readonly gain: number;
  readonly isOpaque: boolean;
  readonly layer: number;
}

export function createDefaultRegionProcessingState(layer = 0): RegionProcessingState {
  return {
    fadeIn: { crossfadeId: null, curve: 'linear', durationSeconds: 0 },
    fadeOut: { crossfadeId: null, curve: 'linear', durationSeconds: 0 },
    gain: 1,
    isOpaque: false,
    layer,
  };
}
