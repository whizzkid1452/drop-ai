import type { LoopSlotState, SessionState } from '../session/session';
import { AudioCommandType, type AudioCommand } from '../shared/types/audioCommand.schema';

export interface ActiveLoopSlotReference {
  readonly slotId: string;
  readonly state: LoopSlotState['state'];
  readonly trackId: string;
}

interface AssertLiveOperationAllowedOptions {
  readonly command: AudioCommand;
  readonly session: SessionState;
}

const LIVE_OPERATION_CONFLICT_COMMAND_TYPES = new Set<AudioCommand['type']>([
  AudioCommandType.EXPORT_AUDIO,
  AudioCommandType.INSTALL_PLUGIN,
  AudioCommandType.LOAD_PROJECT,
  AudioCommandType.MOVE_PLUGIN,
  AudioCommandType.REMOVE_PLUGIN,
  AudioCommandType.REMOVE_TRACK,
  AudioCommandType.SET_PLUGIN_ENABLED,
  AudioCommandType.SET_PLUGIN_PARAMETER,
  AudioCommandType.SET_TEMPO,
  AudioCommandType.SET_TIMELINE_MAP,
  AudioCommandType.SET_LOOP_RANGE,
  AudioCommandType.CLEAR_LOOP_RANGE,
]);

export class LiveOperationConflictError extends Error {
  readonly activeLoopSlots: readonly ActiveLoopSlotReference[];
  readonly code = 'LIVE_LOOP_OPERATION_CONFLICT' as const;
  readonly commandType: AudioCommand['type'];

  constructor(commandType: AudioCommand['type'], activeLoopSlots: readonly ActiveLoopSlotReference[]) {
    super(`활성 루프가 있어 ${commandType} 명령을 실행할 수 없습니다. 루프를 먼저 멈춰 주세요.`);
    this.name = 'LiveOperationConflictError';
    this.activeLoopSlots = activeLoopSlots;
    this.commandType = commandType;
  }
}

export function assertLiveOperationAllowed({ command, session }: AssertLiveOperationAllowedOptions): void {
  if (!LIVE_OPERATION_CONFLICT_COMMAND_TYPES.has(command.type)) {
    return;
  }

  const activeLoopSlots = collectActiveLoopSlots(session);
  if (activeLoopSlots.length > 0) {
    throw new LiveOperationConflictError(command.type, activeLoopSlots);
  }
}

function collectActiveLoopSlots(session: SessionState): ActiveLoopSlotReference[] {
  return [...session.tracks.values()].flatMap(track =>
    (track.loopSlots ?? [])
      .filter(loopSlot => isActiveLoopSlot(loopSlot, session.currentTime))
      .map(loopSlot => ({ slotId: loopSlot.id, state: loopSlot.state, trackId: track.id }))
  );
}

function isActiveLoopSlot(loopSlot: LoopSlotState, currentTimeSeconds: number): boolean {
  if (loopSlot.state === 'armed' || loopSlot.state === 'recording' || loopSlot.state === 'playing') {
    return true;
  }
  return (
    loopSlot.state === 'stopped' &&
    loopSlot.scheduledTimeSeconds !== null &&
    loopSlot.scheduledTimeSeconds > currentTimeSeconds
  );
}
