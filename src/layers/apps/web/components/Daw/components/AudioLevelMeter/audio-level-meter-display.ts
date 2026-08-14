import type { MeterFrame } from '@/layers/shared/types/meter-frame';

export const METER_FLOOR_DBFS = -60;
export const METER_CEILING_DBFS = 0;

export interface MeterDisplay {
  readonly isClipHeld: boolean;
  readonly peakDbfs: number;
  readonly peakPercent: number;
  readonly rmsDbfs: number;
  readonly rmsPercent: number;
}

export const SILENT_METER_DISPLAY: MeterDisplay = {
  isClipHeld: false,
  peakDbfs: Number.NEGATIVE_INFINITY,
  peakPercent: 0,
  rmsDbfs: Number.NEGATIVE_INFINITY,
  rmsPercent: 0,
};

function toMeterPercent(dbfs: number): number {
  if (!Number.isFinite(dbfs)) {
    return 0;
  }
  const clampedDbfs = Math.min(METER_CEILING_DBFS, Math.max(METER_FLOOR_DBFS, dbfs));
  return ((clampedDbfs - METER_FLOOR_DBFS) / (METER_CEILING_DBFS - METER_FLOOR_DBFS)) * 100;
}

export function resolveMeterDisplay(frame: MeterFrame): MeterDisplay {
  if (frame.channels.length === 0) {
    return SILENT_METER_DISPLAY;
  }

  const peakDbfs = Math.max(...frame.channels.map(channel => channel.peakDbfs));
  const rmsDbfs = Math.max(...frame.channels.map(channel => channel.rmsDbfs));
  return {
    isClipHeld: frame.channels.some(channel => channel.isClipHeld),
    peakDbfs,
    peakPercent: toMeterPercent(peakDbfs),
    rmsDbfs,
    rmsPercent: toMeterPercent(rmsDbfs),
  };
}
