import { useEffect, useState } from 'react';
import { useMeterQuery } from '@/layers/apps/web/context/layer-hooks';
import type { MeterTarget } from '@/layers/shared/types/meter-frame';
import {
  METER_CEILING_DBFS,
  METER_FLOOR_DBFS,
  resolveMeterDisplay,
  SILENT_METER_DISPLAY,
  type MeterDisplay,
} from './audio-level-meter-display';
import * as styles from './AudioLevelMeter.css.ts';

const METER_REFRESH_INTERVAL_MS = 50;

export function AudioLevelMeter({ label, target }: { readonly label: string; readonly target: MeterTarget }) {
  const meterQuery = useMeterQuery();
  const [display, setDisplay] = useState<MeterDisplay>(SILENT_METER_DISPLAY);
  const targetKind = target.kind;
  const targetTrackId = target.kind === 'track' ? target.trackId : null;

  useEffect(() => {
    const queryTarget: MeterTarget =
      targetKind === 'track' ? { kind: 'track', trackId: targetTrackId ?? '' } : { kind: targetKind };
    const readMeter = () => {
      try {
        setDisplay(resolveMeterDisplay(meterQuery.read(queryTarget)));
      } catch {
        setDisplay(SILENT_METER_DISPLAY);
      }
    };

    readMeter();
    const intervalId = window.setInterval(readMeter, METER_REFRESH_INTERVAL_MS);
    return () => window.clearInterval(intervalId);
  }, [meterQuery, targetKind, targetTrackId]);

  const accessiblePeak = Number.isFinite(display.peakDbfs) ? display.peakDbfs : METER_FLOOR_DBFS;

  return (
    <div
      aria-label={label}
      aria-valuemax={METER_CEILING_DBFS}
      aria-valuemin={METER_FLOOR_DBFS}
      aria-valuenow={accessiblePeak}
      className={styles.meter}
      data-clipped={display.isClipHeld}
      data-peak-dbfs={String(display.peakDbfs)}
      data-rms-dbfs={String(display.rmsDbfs)}
      role="meter"
      title={`${label}: ${Number.isFinite(display.peakDbfs) ? display.peakDbfs.toFixed(1) : '-∞'} dBFS`}
    >
      <span className={styles.label}>{label}</span>
      <span className={styles.scale} aria-hidden="true">
        <span className={styles.peakBar} style={{ width: `${display.peakPercent}%` }} />
        <span className={styles.rmsBar} style={{ width: `${display.rmsPercent}%` }} />
      </span>
      <span className={styles.clip} aria-hidden="true">
        CLIP
      </span>
    </div>
  );
}
