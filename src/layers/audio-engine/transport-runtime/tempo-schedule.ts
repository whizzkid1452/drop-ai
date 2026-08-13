import type { AudioTempoChange } from '../i-audio-engine';

export interface TempoScheduleEntry {
  readonly atTimeSeconds: number;
  readonly bpm: number;
}

export function createTempoSchedule(changes: readonly AudioTempoChange[]): TempoScheduleEntry[] {
  if (changes[0]?.quarterNotePosition !== 0) {
    throw new RangeError('Tempo Map은 quarter note 0에서 시작해야 합니다.');
  }

  return changes.map((change, index) => {
    assertTempoChange(changes, index);
    return {
      atTimeSeconds: calculateTempoChangeTime(changes, index),
      bpm: change.bpm,
    };
  });
}

function assertTempoChange(changes: readonly AudioTempoChange[], index: number): void {
  const change = changes[index];
  const previousChange = changes[index - 1];
  if (!change || !Number.isFinite(change.bpm) || change.bpm <= 0) {
    throw new RangeError('Tempo BPM은 0보다 큰 유한수여야 합니다.');
  }
  if (!Number.isFinite(change.quarterNotePosition) || change.quarterNotePosition < 0) {
    throw new RangeError('Tempo 위치는 0 이상의 유한수여야 합니다.');
  }
  if (previousChange && change.quarterNotePosition <= previousChange.quarterNotePosition) {
    throw new RangeError('Tempo 위치는 오름차순이어야 합니다.');
  }
}

function calculateTempoChangeTime(changes: readonly AudioTempoChange[], targetIndex: number): number {
  let timeSeconds = 0;
  for (let index = 1; index <= targetIndex; index += 1) {
    const previousChange = changes[index - 1];
    const change = changes[index];
    if (!previousChange || !change) {
      throw new RangeError('Tempo Map 변경을 찾을 수 없습니다.');
    }
    const quarterNoteDurationSeconds = 60 / previousChange.bpm;
    timeSeconds += (change.quarterNotePosition - previousChange.quarterNotePosition) * quarterNoteDurationSeconds;
  }
  return timeSeconds;
}
