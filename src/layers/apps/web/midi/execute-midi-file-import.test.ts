// @vitest-environment happy-dom

import { describe, expect, it, vi } from 'vitest';
import type { CommandExecutor } from '@/layers/commands/command-executor';
import { CommandBatchExecutionError } from '@/layers/commands/command-executor';
import { AudioCommandType, type AudioCommand } from '@/layers/shared/types/audioCommand.schema';
import { writeStandardMidiFile } from '@/layers/midi-file/midi-file-codec';
import { executeMidiFileImport, MidiFileImportCompensationError } from './execute-midi-file-import';

const TRACK_ID = '11111111-1111-4111-8111-111111111111';
const REGION_ID = '22222222-2222-4222-8222-222222222222';
const NOTE_ID = '33333333-3333-4333-8333-333333333333';

function createMidiFile(): File {
  const data = writeStandardMidiFile({
    tempoBpm: 120,
    tracks: [
      {
        midi: {
          instrumentId: 'builtin.poly-synth',
          regions: [
            {
              durationSeconds: 1,
              id: REGION_ID,
              name: 'Verse',
              notes: [
                {
                  channel: 1,
                  durationSeconds: 0.5,
                  id: NOTE_ID,
                  pitch: 60,
                  startOffsetSeconds: 0,
                  velocity: 100,
                },
              ],
              startTimeSeconds: 0,
            },
          ],
        },
        name: 'Keys',
      },
    ],
  });
  return new File([data], 'keys.mid', { type: 'audio/midi' });
}

describe('executeMidiFileImport', () => {
  it('SMF Track을 ADD, 이름, 상태 명령으로 가져온다', async () => {
    const execute = vi.fn<CommandExecutor['execute']>().mockResolvedValue(undefined);
    const executeMany = vi.fn<CommandExecutor['executeMany']>().mockResolvedValue([]);
    const ids = [NOTE_ID, REGION_ID, TRACK_ID];

    await executeMidiFileImport({
      commandExecutor: { execute, executeMany },
      createId: () => ids.shift() ?? crypto.randomUUID(),
      file: createMidiFile(),
    });

    expect(executeMany).toHaveBeenCalledWith([
      { trackId: TRACK_ID, type: AudioCommandType.ADD_MIDI_TRACK },
      { name: 'Keys', trackId: TRACK_ID, type: AudioCommandType.SET_TRACK_NAME },
      {
        midi: expect.objectContaining({ regions: [expect.objectContaining({ notes: [expect.any(Object)] })] }),
        trackId: TRACK_ID,
        type: AudioCommandType.SET_MIDI_TRACK_STATE,
      },
    ]);
  });

  it('중간 명령 실패 시 이미 추가된 MIDI Track을 제거한다', async () => {
    const execute = vi.fn<CommandExecutor['execute']>().mockResolvedValue(undefined);
    const executeMany = vi.fn<CommandExecutor['executeMany']>().mockImplementation(async commands => {
      const failedCommand = commands[1] as AudioCommand;
      throw new CommandBatchExecutionError({
        cause: new Error('이름 저장 실패'),
        completedResults: [undefined],
        failedCommand,
        failedIndex: 1,
      });
    });
    const ids = [NOTE_ID, REGION_ID, TRACK_ID];

    await expect(
      executeMidiFileImport({
        commandExecutor: { execute, executeMany },
        createId: () => ids.shift() ?? crypto.randomUUID(),
        file: createMidiFile(),
      })
    ).rejects.toThrow('이름 저장 실패');

    expect(execute).toHaveBeenCalledWith({ trackId: TRACK_ID, type: AudioCommandType.REMOVE_TRACK });
  });

  it('실패한 Track 제거도 실패하면 보상 실패를 구분해 반환한다', async () => {
    const execute = vi.fn<CommandExecutor['execute']>().mockRejectedValue(new Error('제거 실패'));
    const executeMany = vi.fn<CommandExecutor['executeMany']>().mockImplementation(async commands => {
      throw new CommandBatchExecutionError({
        cause: new Error('상태 저장 실패'),
        completedResults: [undefined],
        failedCommand: commands[1] as AudioCommand,
        failedIndex: 1,
      });
    });
    const ids = [NOTE_ID, REGION_ID, TRACK_ID];

    const execution = executeMidiFileImport({
      commandExecutor: { execute, executeMany },
      createId: () => ids.shift() ?? crypto.randomUUID(),
      file: createMidiFile(),
    });

    await expect(execution).rejects.toBeInstanceOf(MidiFileImportCompensationError);
    await expect(execution).rejects.toMatchObject({
      compensationFailures: [{ cause: expect.any(Error), step: `MIDI Track ${TRACK_ID} 제거` }],
    });
  });
});
