import { describe, expect, it } from 'vitest';
import { createDefaultLoopSlots, createSessionStore, type LoopSlotState } from '../session/session';
import { AudioCommandType, type AudioCommand } from '../shared/types/audioCommand.schema';
import { assertLiveOperationAllowed, LiveOperationConflictError } from './live-operation-guard';

const TRACK_ID = '11111111-1111-4111-8111-111111111111';
const SLOT_ID = '22222222-2222-4222-8222-222222222222';
const PROJECT_ID = '33333333-3333-4333-8333-333333333333';
const PLUGIN_INSTANCE_ID = '44444444-4444-4444-8444-444444444444';

function createSessionWithLoop(loopSlot: LoopSlotState) {
  const session = createSessionStore({
    initialProjectMetadata: { id: PROJECT_ID, name: '라이브 프로젝트', revision: 0 },
  });
  session.getState().addTrack({
    id: TRACK_ID,
    isMuted: false,
    isSoloed: false,
    loopSlots: [loopSlot],
    name: '라이브 트랙',
    pan: 0,
    pluginInstances: [],
    regions: [],
    status: [],
    volume: 1,
  });
  return session;
}

function createLoopSlot(overrides: Partial<LoopSlotState>): LoopSlotState {
  const [loopSlot] = createDefaultLoopSlots({ count: 1, createId: () => SLOT_ID });
  return { ...loopSlot, ...overrides };
}

const conflictCommands: readonly AudioCommand[] = [
  { type: AudioCommandType.SET_TEMPO, tempo: 128 },
  { type: AudioCommandType.REMOVE_TRACK, trackId: TRACK_ID },
  { type: AudioCommandType.INSTALL_PLUGIN, trackId: TRACK_ID, manifestId: 'gain' },
  { type: AudioCommandType.REMOVE_PLUGIN, trackId: TRACK_ID, instanceId: PLUGIN_INSTANCE_ID },
  {
    type: AudioCommandType.MOVE_PLUGIN,
    trackId: TRACK_ID,
    instanceId: PLUGIN_INSTANCE_ID,
    targetIndex: 0,
  },
  {
    type: AudioCommandType.SET_PLUGIN_ENABLED,
    trackId: TRACK_ID,
    instanceId: PLUGIN_INSTANCE_ID,
    isEnabled: false,
  },
  {
    type: AudioCommandType.SET_PLUGIN_PARAMETER,
    trackId: TRACK_ID,
    instanceId: PLUGIN_INSTANCE_ID,
    parameterId: 'gain',
    value: 0.5,
  },
  { type: AudioCommandType.EXPORT_AUDIO },
  { type: AudioCommandType.START_RENDER_JOB },
  { type: AudioCommandType.LOAD_PROJECT, projectId: PROJECT_ID },
];

describe('assertLiveOperationAllowed', () => {
  it.each(['armed', 'recording', 'playing'] as const)('%s 슬롯이 있으면 충돌 명령을 거부한다', state => {
    const session = createSessionWithLoop(createLoopSlot({ state }));

    expect(() => assertLiveOperationAllowed({ command: conflictCommands[0], session: session.getState() })).toThrow(
      LiveOperationConflictError
    );
  });

  it('정지 예약 시각 전에는 슬롯을 활성 상태로 판정한다', () => {
    const session = createSessionWithLoop(
      createLoopSlot({ scheduledTimeSeconds: 12, sourceId: PROJECT_ID, state: 'stopped' })
    );
    session.getState().setCurrentTime(11.5);

    expect(() => assertLiveOperationAllowed({ command: conflictCommands[0], session: session.getState() })).toThrow(
      LiveOperationConflictError
    );
  });

  it.each(conflictCommands)('$type 명령을 활성 슬롯이 있으면 거부한다', command => {
    const session = createSessionWithLoop(createLoopSlot({ sourceId: PROJECT_ID, state: 'playing' }));

    expect(() => assertLiveOperationAllowed({ command, session: session.getState() })).toThrow(
      LiveOperationConflictError
    );
  });

  it('오류에 충돌 명령과 활성 슬롯 주소를 보존한다', () => {
    const session = createSessionWithLoop(createLoopSlot({ sourceId: PROJECT_ID, state: 'recording' }));

    try {
      assertLiveOperationAllowed({ command: conflictCommands[0], session: session.getState() });
    } catch (error) {
      expect(error).toBeInstanceOf(LiveOperationConflictError);
      expect(error).toMatchObject({
        activeLoopSlots: [{ slotId: SLOT_ID, state: 'recording', trackId: TRACK_ID }],
        code: 'LIVE_LOOP_OPERATION_CONFLICT',
        commandType: AudioCommandType.SET_TEMPO,
      });
      return;
    }

    throw new Error('라이브 작업 충돌 오류가 발생하지 않았습니다.');
  });

  it.each([
    createLoopSlot({ state: 'empty' }),
    createLoopSlot({ state: 'error' }),
    createLoopSlot({ scheduledTimeSeconds: null, sourceId: PROJECT_ID, state: 'stopped' }),
    createLoopSlot({ scheduledTimeSeconds: 12, sourceId: PROJECT_ID, state: 'stopped' }),
  ])('$state 슬롯에서 충돌 명령을 허용할 수 있다', loopSlot => {
    const session = createSessionWithLoop(loopSlot);
    session.getState().setCurrentTime(12);

    expect(() =>
      assertLiveOperationAllowed({ command: conflictCommands[0], session: session.getState() })
    ).not.toThrow();
  });

  it.each([
    { type: AudioCommandType.STOP_ALL_LOOPS },
    { type: AudioCommandType.SAVE_PROJECT },
    { type: AudioCommandType.SET_MASTER_VOLUME, volume: 0.5 },
  ] as const)('$type 명령은 활성 슬롯이 있어도 허용한다', command => {
    const session = createSessionWithLoop(createLoopSlot({ sourceId: PROJECT_ID, state: 'playing' }));

    expect(() => assertLiveOperationAllowed({ command, session: session.getState() })).not.toThrow();
  });
});
