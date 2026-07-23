import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CommandBatchExecutionError, type CommandBatchExecutionResult } from '@/layers/commands/command-executor';
import type { MLCEngine } from '@/types/webllm.types';
import { AudioCommandType, type AudioCommand } from '@/types/audioCommand.schema';
import { handleAIResponse } from './aiResponseHandler';

const mocks = vi.hoisted(() => ({
  queryToLLM: vi.fn(),
  trackAudioCommandExecuted: vi.fn(),
}));

vi.mock('./queryToLLM', () => ({ queryToLLM: mocks.queryToLLM }));
vi.mock('@/utils/analytics', () => ({
  trackAudioCommandExecuted: mocks.trackAudioCommandExecuted,
}));

const engine = {} as MLCEngine;
const executeMany = vi.fn(
  async (commands: readonly AudioCommand[]): Promise<CommandBatchExecutionResult> => commands.map(() => undefined)
);

function handleResponse(fullResponse: string) {
  mocks.queryToLLM.mockResolvedValueOnce({ fullResponse, error: null });
  return handleAIResponse({ engine, plugins: [], tracks: [], userInput: '요청', executeMany });
}

describe('Agent 응답 명령 검증', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('유효하지 않은 명령이 섞이면 명령을 하나도 실행하지 않는다', async () => {
    const result = await handleResponse('[{"type":"PLAY"},{"type":"SET_TEMPO","tempo":0}]');

    expect(executeMany).not.toHaveBeenCalled();
    expect(result.status).toBe('error');
    expect(result.parsedCommands).toBeNull();
  });

  it('Plugin context를 LLM 요청에 그대로 전달한다', async () => {
    const plugins = [
      {
        id: 'builtin.gain',
        name: 'Gain',
        version: '1.0.0',
        parameters: [{ id: 'gain', name: 'Gain', type: 'number' as const, minValue: 0, maxValue: 2, defaultValue: 1 }],
      },
    ];
    mocks.queryToLLM.mockResolvedValueOnce({ fullResponse: '[]', error: null });

    await handleAIResponse({ engine, plugins, tracks: [], userInput: 'Plugin 추가', executeMany });

    expect(mocks.queryToLLM).toHaveBeenCalledWith(
      expect.objectContaining({ engine, plugins, tracks: [], userInput: 'Plugin 추가' })
    );
  });

  it('응답 생성 중 취소되면 명령을 실행하지 않는다', async () => {
    const abortController = new AbortController();
    const onGenerationFinished = vi.fn();
    mocks.queryToLLM.mockImplementationOnce(async () => {
      abortController.abort();
      return { fullResponse: '[{"type":"PLAY"}]', error: null };
    });

    await expect(
      handleAIResponse({
        engine,
        plugins: [],
        tracks: [],
        userInput: '재생',
        executeMany,
        signal: abortController.signal,
        onGenerationFinished,
      })
    ).rejects.toMatchObject({ name: 'AgentRequestCancelledError' });

    expect(onGenerationFinished).not.toHaveBeenCalled();
    expect(executeMany).not.toHaveBeenCalled();
  });

  it('응답 생성이 끝나면 명령 실행 전에 알린다', async () => {
    const onGenerationFinished = vi.fn();
    mocks.queryToLLM.mockResolvedValueOnce({ fullResponse: '[{"type":"PLAY"}]', error: null });

    await handleAIResponse({
      engine,
      plugins: [],
      tracks: [],
      userInput: '재생',
      executeMany,
      onGenerationFinished,
    });

    expect(onGenerationFinished).toHaveBeenCalledOnce();
    expect(onGenerationFinished.mock.invocationCallOrder[0]).toBeLessThan(executeMany.mock.invocationCallOrder[0]);
  });

  it('추가 필드가 있는 명령을 실행하지 않는다', async () => {
    const result = await handleResponse('[{"type":"EXPORT_AUDIO","startTime":1}]');

    expect(executeMany).not.toHaveBeenCalled();
    expect(result.status).toBe('error');
  });

  it('빈 배열은 오류가 아닌 명령 없음으로 처리한다', async () => {
    const result = await handleResponse('[]');

    expect(executeMany).not.toHaveBeenCalled();
    expect(result.status).toBe('idle');
    expect(result.parsedCommands).toEqual([]);
  });

  it('유효한 명령 배열을 입력 순서 그대로 한 번 실행한다', async () => {
    const result = await handleResponse('[{"type":"SET_TEMPO","tempo":140},{"type":"PLAY"}]');

    expect(executeMany).toHaveBeenCalledTimes(1);
    expect(executeMany).toHaveBeenCalledWith([
      { type: AudioCommandType.SET_TEMPO, tempo: 140 },
      { type: AudioCommandType.PLAY },
    ]);
    expect(result.executionResults).toEqual([
      { commandType: AudioCommandType.SET_TEMPO, success: true },
      { commandType: AudioCommandType.PLAY, success: true },
    ]);
    expect(mocks.trackAudioCommandExecuted).toHaveBeenCalledTimes(2);
    expect(result.status).toBe('idle');
  });

  it('SAVE_PROJECT 응답을 공통 명령 묶음으로 실행한다', async () => {
    const result = await handleResponse('[{"type":"SAVE_PROJECT"}]');

    expect(executeMany).toHaveBeenCalledWith([{ type: AudioCommandType.SAVE_PROJECT }]);
    expect(result.executionResults).toEqual([{ commandType: AudioCommandType.SAVE_PROJECT, success: true }]);
  });

  it('SET_EXPORT_RANGE만 응답하면 EXPORT_AUDIO를 임의로 추가하지 않는다', async () => {
    const result = await handleResponse('[{"type":"SET_EXPORT_RANGE","startTime":2,"endTime":8}]');

    expect(executeMany).toHaveBeenCalledTimes(1);
    expect(executeMany).toHaveBeenCalledWith([{ type: AudioCommandType.SET_EXPORT_RANGE, startTime: 2, endTime: 8 }]);
    expect(result.parsedCommands).toEqual([{ type: AudioCommandType.SET_EXPORT_RANGE, startTime: 2, endTime: 8 }]);
  });

  it('중간 명령이 실패하면 앞선 성공과 실패 명령만 기록한다', async () => {
    const commands: AudioCommand[] = [
      { type: AudioCommandType.PLAY },
      { type: AudioCommandType.PAUSE },
      { type: AudioCommandType.STOP },
    ];
    executeMany.mockRejectedValueOnce(
      new CommandBatchExecutionError({
        failedIndex: 1,
        failedCommand: commands[1],
        completedResults: [undefined],
        cause: new Error('일시정지 실패'),
      })
    );

    const result = await handleResponse(JSON.stringify(commands));

    expect(result.executionResults).toEqual([
      { commandType: AudioCommandType.PLAY, success: true },
      { commandType: AudioCommandType.PAUSE, success: false },
    ]);
    expect(mocks.trackAudioCommandExecuted).toHaveBeenNthCalledWith(1, {
      commandType: AudioCommandType.PLAY,
      success: true,
    });
    expect(mocks.trackAudioCommandExecuted).toHaveBeenNthCalledWith(2, {
      commandType: AudioCommandType.PAUSE,
      success: false,
    });
    expect(mocks.trackAudioCommandExecuted).toHaveBeenCalledTimes(2);
    expect(result.commandOutputs).toEqual([undefined]);
  });

  it('오류 전에 생성한 Blob 결과를 반환한다', async () => {
    const exportedAudio = new Blob(['wav'], { type: 'audio/wav' });
    const commands: AudioCommand[] = [
      { type: AudioCommandType.EXPORT_AUDIO, filename: 'first' },
      { type: AudioCommandType.PAUSE },
    ];
    executeMany.mockRejectedValueOnce(
      new CommandBatchExecutionError({
        failedIndex: 1,
        failedCommand: commands[1],
        completedResults: [exportedAudio],
        cause: new Error('일시정지 실패'),
      })
    );

    const result = await handleResponse(JSON.stringify(commands));

    expect(result.commandOutputs?.[0]).toBe(exportedAudio);
  });

  it('실패 위치를 알 수 없는 실행 오류는 호출자에게 전달한다', async () => {
    const executionError = new Error('알 수 없는 실행 오류');
    executeMany.mockRejectedValueOnce(executionError);

    await expect(handleResponse('[{"type":"PLAY"}]')).rejects.toBe(executionError);
    expect(mocks.trackAudioCommandExecuted).not.toHaveBeenCalled();
  });
});
