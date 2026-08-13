import type { MouseEvent } from 'react';
import type { MidiRegionState } from '@/layers/shared/types/midi-state';
import type { TimelineCoordinateMapper } from '@/layers/shared/timeline-coordinate-mapper';
import * as styles from './MidiRegionComponent.css.ts';

export function MidiRegionComponent({
  coordinateMapper,
  onSelect,
  region,
  selected,
}: {
  readonly coordinateMapper: TimelineCoordinateMapper;
  readonly onSelect: () => void;
  readonly region: MidiRegionState;
  readonly selected: boolean;
}) {
  const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    onSelect();
  };

  return (
    <button
      type="button"
      aria-label={`MIDI Region ${region.name}`}
      aria-pressed={selected}
      className={selected ? styles.regionSelected : styles.region}
      onClick={handleClick}
      style={{
        left: coordinateMapper.secondsToPixels(region.startTimeSeconds),
        width: coordinateMapper.durationToPixels({
          durationSeconds: region.durationSeconds,
          startSeconds: region.startTimeSeconds,
        }),
      }}
    >
      <span className={styles.name}>{region.name}</span>
      <span className={styles.notes} aria-hidden="true">
        {region.notes.map(note => (
          <i
            key={note.id}
            className={styles.noteBar}
            style={{
              bottom: `${(note.pitch / 127) * 76}%`,
              left: `${(note.startOffsetSeconds / region.durationSeconds) * 100}%`,
              width: `${Math.max(1, (note.durationSeconds / region.durationSeconds) * 100)}%`,
            }}
          />
        ))}
      </span>
    </button>
  );
}
