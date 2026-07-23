import { describe, expect, it, vi } from 'vitest';
import { AudioCommandType, type AudioCommand } from '@/types/audioCommand.schema';
import {
  createSetMasterVolumeCommand,
  executeMasterVolumeChange,
  parseMasterVolumeInput,
} from './master-volume-command';

describe('Master Volume UI 명령 변환', () => {
  it('0부터 1까지의 유한한 숫자만 입력값으로 허용한다', () => {
    expect(parseMasterVolumeInput('0')).toBe(0);
    expect(parseMasterVolumeInput('0.4')).toBe(0.4);
    expect(parseMasterVolumeInput('1')).toBe(1);
    expect(parseMasterVolumeInput('')).toBeNull();
    expect(parseMasterVolumeInput('-0.1')).toBeNull();
    expect(parseMasterVolumeInput('1.1')).toBeNull();
    expect(parseMasterVolumeInput('Infinity')).toBeNull();
  });

  it('Master Volume을 SET_MASTER_VOLUME 명령으로 변환한다', () => {
    expect(createSetMasterVolumeCommand({ volume: 0.4 })).toEqual({
      type: AudioCommandType.SET_MASTER_VOLUME,
      volume: 0.4,
    });
  });

  it('SET_MASTER_VOLUME 명령을 정확히 한 번 실행한다', async () => {
    const executeCommand = vi.fn<(command: AudioCommand) => Promise<unknown>>().mockResolvedValue(undefined);

    const result = await executeMasterVolumeChange({
      volume: 0.4,
      executeCommand,
      notifyFailure: vi.fn(),
    });

    expect(result).toBe('updated');
    expect(executeCommand).toHaveBeenCalledTimes(1);
    expect(executeCommand).toHaveBeenCalledWith(createSetMasterVolumeCommand({ volume: 0.4 }));
  });

  it('실행 실패 원인을 사용자 메시지로 전달한다', async () => {
    const notifyFailure = vi.fn();

    const result = await executeMasterVolumeChange({
      volume: 0.4,
      executeCommand: vi.fn().mockRejectedValue(new Error('출력 오류')),
      notifyFailure,
    });

    expect(result).toBe('failed');
    expect(notifyFailure).toHaveBeenCalledWith('Master Volume을 변경하지 못했습니다: 출력 오류');
  });
});
