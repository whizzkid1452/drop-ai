import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  CommandBatchExecutionError,
  type CommandBatchExecutionResult,
  type CommandExecutor,
} from '@/layers/commands/command-executor';
import { AudioCommandType, type AudioCommand } from '@/types/audioCommand.schema';
import { executeJsonCliCommandBatch } from './execute-json-cli-command-batch';

const mocks = vi.hoisted(() => ({
  downloadWebAudioCommandResults: vi.fn(),
}));

vi.mock('@/layers/apps/web/utils/execute-web-audio-command', () => ({
  downloadWebAudioCommandResults: mocks.downloadWebAudioCommandResults,
}));

const executeMany = vi.fn<(commands: readonly AudioCommand[]) => Promise<CommandBatchExecutionResult>>();
const commandExecutor: Pick<CommandExecutor, 'executeMany'> = { executeMany };

describe('Web JSON CLI 명령 묶음 실행', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('명령 배열을 한 번 실행하고 모든 명령을 성공 목록으로 반환한다', async () => {
    const exportedAudio = new Blob(['wav'], { type: 'audio/wav' });
    const commands: AudioCommand[] = [
      { type: AudioCommandType.SET_TEMPO, tempo: 140 },
      { type: AudioCommandType.EXPORT_AUDIO, filename: 'mix' },
    ];
    executeMany.mockResolvedValueOnce([undefined, exportedAudio]);

    const outcome = await executeJsonCliCommandBatch({ commandExecutor, commands });

    expect(executeMany).toHaveBeenCalledTimes(1);
    expect(executeMany).toHaveBeenCalledWith(commands);
    expect(outcome).toEqual({ completedCommands: commands, batchError: null });
    expect(mocks.downloadWebAudioCommandResults).toHaveBeenCalledWith({
      commands,
      results: [undefined, exportedAudio],
    });
  });

  it('중간 실패 전 명령과 Blob만 완료 결과로 처리한다', async () => {
    const exportedAudio = new Blob(['wav'], { type: 'audio/wav' });
    const commands: AudioCommand[] = [
      { type: AudioCommandType.EXPORT_AUDIO, filename: 'completed' },
      { type: AudioCommandType.PAUSE },
      { type: AudioCommandType.STOP },
    ];
    const batchError = new CommandBatchExecutionError({
      failedIndex: 1,
      failedCommand: commands[1],
      completedResults: [exportedAudio],
      cause: new Error('일시정지 실패'),
    });
    executeMany.mockRejectedValueOnce(batchError);

    const outcome = await executeJsonCliCommandBatch({ commandExecutor, commands });

    expect(outcome).toEqual({ completedCommands: [commands[0]], batchError });
    expect(mocks.downloadWebAudioCommandResults).toHaveBeenCalledWith({
      commands,
      results: [exportedAudio],
    });
  });

  it('실패 위치를 알 수 없는 오류는 호출자에게 전달한다', async () => {
    const executionError = new Error('알 수 없는 실행 오류');
    const commands: AudioCommand[] = [{ type: AudioCommandType.PLAY }];
    executeMany.mockRejectedValueOnce(executionError);

    await expect(executeJsonCliCommandBatch({ commandExecutor, commands })).rejects.toBe(executionError);
    expect(mocks.downloadWebAudioCommandResults).not.toHaveBeenCalled();
  });
});
