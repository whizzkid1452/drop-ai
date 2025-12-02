import { useCallback } from 'react';
import * as styles from '../TrackTimeline/TrackTimeline.css';

interface PanKnobProps {
  value: number; // -100..100
  onChange: (value: number) => void;
}

export function PanKnob({ value, onChange }: PanKnobProps) {
  const startPanDrag = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      e.preventDefault();
      const knob = e.currentTarget;
      const rect = knob.getBoundingClientRect();

      const handleMove = (ev: MouseEvent) => {
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        const dx = ev.clientX - cx;
        const dy = ev.clientY - cy;
        let angle = Math.atan2(dy, dx); // -PI..PI
        let deg = (angle * 180) / Math.PI; // -180..180
        deg = deg + 90; // make top be 0
        if (deg > 180) deg -= 360; // normalize
        const clampedDeg = Math.max(-135, Math.min(135, deg));
        const newValue = Math.round((clampedDeg / 135) * 100);
        onChange(newValue);
      };

      const handleUp = () => {
        window.removeEventListener('mousemove', handleMove);
        window.removeEventListener('mouseup', handleUp);
      };

      window.addEventListener('mousemove', handleMove);
      window.addEventListener('mouseup', handleUp);
    },
    [onChange]
  );

  return (
    <div className={styles.panKnobWrap}>
      <div className={styles.panKnob} onMouseDown={startPanDrag}>
        <div
          className={styles.panKnobIndicator}
          style={{ transform: `rotate(${(value / 100) * 135}deg)` }}
        />
      </div>
    </div>
  );
}
