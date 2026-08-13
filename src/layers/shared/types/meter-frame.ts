export type MeterTarget =
  | { readonly kind: 'input' }
  | { readonly kind: 'master' }
  | { readonly kind: 'track'; readonly trackId: string };

export interface MeterChannelFrame {
  readonly isClipHeld: boolean;
  readonly peakDbfs: number;
  readonly rmsDbfs: number;
}

export interface MeterFrame {
  readonly capturedAtSeconds: number;
  readonly channels: readonly MeterChannelFrame[];
}
