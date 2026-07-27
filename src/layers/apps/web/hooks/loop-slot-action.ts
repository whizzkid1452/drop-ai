import type { LoopSlotState } from '../../../session/session';
import { AudioCommandType, type AudioCommand } from '../../../shared/types/audioCommand.schema';

export interface CreateLoopSlotActionOptions {
  readonly lengthBars: LoopSlotState['lengthBars'];
  readonly loopSlot: LoopSlotState;
  readonly quantizationBars: LoopSlotState['quantizationBars'];
  readonly trackId: string;
}

export function createLoopSlotAction({
  lengthBars,
  loopSlot,
  quantizationBars,
  trackId,
}: CreateLoopSlotActionOptions): AudioCommand {
  const address = { slotId: loopSlot.id, trackId };
  if (loopSlot.state === 'empty') {
    return { ...address, lengthBars, quantizationBars, type: AudioCommandType.ARM_LOOP_SLOT };
  }
  if (loopSlot.state === 'armed' || loopSlot.state === 'recording') {
    return { ...address, type: AudioCommandType.CANCEL_LOOP_SLOT };
  }
  if (loopSlot.state === 'playing') {
    return { ...address, type: AudioCommandType.STOP_LOOP_SLOT };
  }
  if (loopSlot.state === 'stopped') {
    return { ...address, type: AudioCommandType.TRIGGER_LOOP_SLOT };
  }
  return { ...address, type: AudioCommandType.CLEAR_LOOP_SLOT };
}

export function getLoopSlotActionLabel(state: LoopSlotState['state']): string {
  if (state === 'empty') {
    return 'REC';
  }
  if (state === 'armed' || state === 'recording') {
    return 'CANCEL';
  }
  if (state === 'playing') {
    return 'STOP';
  }
  if (state === 'stopped') {
    return 'PLAY';
  }
  return 'CLEAR';
}
