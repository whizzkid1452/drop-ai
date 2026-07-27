import type { TrackState } from '../../../session/session';
import { AudioCommandType, type AudioCommand } from '../../../shared/types/audioCommand.schema';
import { createLoopSlotAction } from '../hooks/loop-slot-action';

interface CreateMidiLoopCommandOptions {
  readonly note: number;
  readonly track: TrackState;
}

const FIRST_LOOP_SLOT_NOTE = 36;
const LAST_LOOP_SLOT_NOTE = 39;
const STOP_ALL_LOOPS_NOTE = 40;

export function createMidiLoopCommand({ note, track }: CreateMidiLoopCommandOptions): AudioCommand | null {
  if (note === STOP_ALL_LOOPS_NOTE) {
    return { type: AudioCommandType.STOP_ALL_LOOPS };
  }
  if (note < FIRST_LOOP_SLOT_NOTE || note > LAST_LOOP_SLOT_NOTE) {
    return null;
  }

  const loopSlot = track.loopSlots?.[note - FIRST_LOOP_SLOT_NOTE];
  if (!loopSlot) {
    return null;
  }
  return createLoopSlotAction({
    lengthBars: loopSlot.lengthBars,
    loopSlot,
    quantizationBars: loopSlot.quantizationBars,
    trackId: track.id,
  });
}
