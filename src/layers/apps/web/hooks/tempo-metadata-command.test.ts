import { describe, expect, it, vi } from 'vitest';
import { AudioCommandType, type AudioCommand } from '@/types/audioCommand.schema';
import { createSetTempoCommand, executeTempoChange, parseTempoInput } from './tempo-metadata-command';

describe('Tempo UI 명령 변환', () => {
  it('0보다 큰 유한 숫자만 입력값으로 허용한다', () => {
    expect(parseTempoInput('128.5')).toBe(128.5);
    expect(parseTempoInput('')).toBeNull();
    expect(parseTempoInput('0')).toBeNull();
    expect(parseTempoInput('-1')).toBeNull();
    expect(parseTempoInput('Infinity')).toBeNull();
  });

  it('Tempo를 SET_TEMPO 명령으로 변환한다', () => {
    expect(createSetTempoCommand({ tempo: 128.5 })).toEqual({
      type: AudioCommandType.SET_TEMPO,
      tempo: 128.5,
    });
  });

  it('SET_TEMPO 명령을 정확히 한 번 실행한다', async () => {
    const executeCommand = vi.fn<(command: AudioCommand) => Promise<unknown>>().mockResolvedValue(undefined);

    const result = await executeTempoChange({
      tempo: 128.5,
      executeCommand,
      notifyFailure: vi.fn(),
    });

    expect(result).toBe('updated');
    expect(executeCommand).toHaveBeenCalledTimes(1);
    expect(executeCommand).toHaveBeenCalledWith(createSetTempoCommand({ tempo: 128.5 }));
  });

  it('실행 실패 원인을 사용자 메시지로 전달한다', async () => {
    const notifyFailure = vi.fn();

    const result = await executeTempoChange({
      tempo: 128.5,
      executeCommand: vi.fn().mockRejectedValue(new Error('저장 오류')),
      notifyFailure,
    });

    expect(result).toBe('failed');
    expect(notifyFailure).toHaveBeenCalledWith('Tempo를 변경하지 못했습니다: 저장 오류');
  });
});
