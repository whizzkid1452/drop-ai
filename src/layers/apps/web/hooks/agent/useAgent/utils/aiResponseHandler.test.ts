import { beforeEach, describe, expect, it, vi } from 'vitest';
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
const execute = vi.fn(async (command: AudioCommand): Promise<void> => {
  void command;
});

function handleResponse(fullResponse: string) {
  mocks.queryToLLM.mockResolvedValueOnce({ fullResponse, error: null });
  return handleAIResponse({ engine, tracks: [], userInput: '요청', execute });
}

describe('Agent 응답 명령 검증', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('유효하지 않은 명령이 섞이면 명령을 하나도 실행하지 않는다', async () => {
    const result = await handleResponse('[{"type":"PLAY"},{"type":"SET_TEMPO","tempo":0}]');

    expect(execute).not.toHaveBeenCalled();
    expect(result.status).toBe('error');
    expect(result.parsedCommands).toBeNull();
  });

  it('추가 필드가 있는 명령을 실행하지 않는다', async () => {
    const result = await handleResponse('[{"type":"EXPORT_AUDIO","startTime":1}]');

    expect(execute).not.toHaveBeenCalled();
    expect(result.status).toBe('error');
  });

  it('빈 배열은 오류가 아닌 명령 없음으로 처리한다', async () => {
    const result = await handleResponse('[]');

    expect(execute).not.toHaveBeenCalled();
    expect(result.status).toBe('idle');
    expect(result.parsedCommands).toEqual([]);
  });

  it('유효한 명령 배열은 입력 순서대로 실행한다', async () => {
    const result = await handleResponse('[{"type":"SET_TEMPO","tempo":140},{"type":"PLAY"}]');

    expect(execute).toHaveBeenNthCalledWith(1, { type: AudioCommandType.SET_TEMPO, tempo: 140 });
    expect(execute).toHaveBeenNthCalledWith(2, { type: AudioCommandType.PLAY });
    expect(result.status).toBe('idle');
  });

  it('SET_EXPORT_RANGE만 응답하면 EXPORT_AUDIO를 임의로 추가하지 않는다', async () => {
    const result = await handleResponse('[{"type":"SET_EXPORT_RANGE","startTime":2,"endTime":8}]');

    expect(execute).toHaveBeenCalledTimes(1);
    expect(execute).toHaveBeenCalledWith({ type: AudioCommandType.SET_EXPORT_RANGE, startTime: 2, endTime: 8 });
    expect(result.parsedCommands).toEqual([{ type: AudioCommandType.SET_EXPORT_RANGE, startTime: 2, endTime: 8 }]);
  });
});
