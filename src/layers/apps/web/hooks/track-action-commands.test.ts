import { describe, expect, it, vi } from 'vitest';
import { AudioCommandType, type AudioCommand } from '@/types/audioCommand.schema';
import { createRemoveTrackCommand, executeConfirmedTrackRemoval } from './track-action-commands';

const trackId = '11111111-1111-4111-8111-111111111111';

describe('Track UI 명령 변환', () => {
  it('삭제 대상을 REMOVE_TRACK 명령으로 변환한다', () => {
    expect(createRemoveTrackCommand({ trackId })).toEqual({
      type: AudioCommandType.REMOVE_TRACK,
      trackId,
    });
  });

  it('삭제를 취소하면 명령을 실행하지 않는다', async () => {
    const executeCommand = vi.fn<(command: AudioCommand) => Promise<unknown>>();

    const result = await executeConfirmedTrackRemoval({
      trackId,
      confirmRemoval: () => false,
      executeCommand,
      notifyFailure: vi.fn(),
    });

    expect(result).toBe('cancelled');
    expect(executeCommand).not.toHaveBeenCalled();
  });

  it('삭제를 확인하면 정확한 명령을 한 번 실행한다', async () => {
    const executeCommand = vi.fn<(command: AudioCommand) => Promise<unknown>>().mockResolvedValue(undefined);

    const result = await executeConfirmedTrackRemoval({
      trackId,
      confirmRemoval: () => true,
      executeCommand,
      notifyFailure: vi.fn(),
    });

    expect(result).toBe('removed');
    expect(executeCommand).toHaveBeenCalledTimes(1);
    expect(executeCommand).toHaveBeenCalledWith(createRemoveTrackCommand({ trackId }));
  });

  it('삭제 실행이 실패하면 원인을 사용자 메시지로 전달한다', async () => {
    const notifyFailure = vi.fn();

    const result = await executeConfirmedTrackRemoval({
      trackId,
      confirmRemoval: () => true,
      executeCommand: vi.fn().mockRejectedValue(new Error('엔진 오류')),
      notifyFailure,
    });

    expect(result).toBe('failed');
    expect(notifyFailure).toHaveBeenCalledWith('Track을 삭제하지 못했습니다: 엔진 오류');
  });
});
