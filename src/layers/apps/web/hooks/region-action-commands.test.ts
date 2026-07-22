import { describe, expect, it, vi } from 'vitest';
import { AudioCommandType, type AudioCommand } from '@/types/audioCommand.schema';
import { createUnloadRegionCommand, executeConfirmedRegionRemoval } from './region-action-commands';

const target = {
  trackId: '11111111-1111-4111-8111-111111111111',
  regionId: '22222222-2222-4222-8222-222222222222',
};

describe('Region UI 명령 변환', () => {
  it('삭제 대상을 UNLOAD_REGION 명령으로 변환한다', () => {
    const command = createUnloadRegionCommand(target);

    expect(command).toEqual({
      type: AudioCommandType.UNLOAD_REGION,
      trackId: '11111111-1111-4111-8111-111111111111',
      regionId: '22222222-2222-4222-8222-222222222222',
    });
  });

  it('사용자가 삭제를 취소하면 명령을 실행하지 않는다', async () => {
    const executeCommand = vi.fn<(command: AudioCommand) => Promise<unknown>>();

    const result = await executeConfirmedRegionRemoval({
      ...target,
      confirmRemoval: () => false,
      executeCommand,
      notifyFailure: vi.fn(),
    });

    expect(result).toBe('cancelled');
    expect(executeCommand).not.toHaveBeenCalled();
  });

  it('사용자가 삭제를 확인하면 정확한 명령을 한 번 실행한다', async () => {
    const executeCommand = vi.fn<(command: AudioCommand) => Promise<unknown>>().mockResolvedValue(undefined);

    const result = await executeConfirmedRegionRemoval({
      ...target,
      confirmRemoval: () => true,
      executeCommand,
      notifyFailure: vi.fn(),
    });

    expect(result).toBe('removed');
    expect(executeCommand).toHaveBeenCalledTimes(1);
    expect(executeCommand).toHaveBeenCalledWith(createUnloadRegionCommand(target));
  });

  it('삭제 실행이 실패하면 원인을 사용자 메시지로 전달한다', async () => {
    const executeCommand = vi
      .fn<(command: AudioCommand) => Promise<unknown>>()
      .mockRejectedValue(new Error('엔진 오류'));
    const notifyFailure = vi.fn();

    const result = await executeConfirmedRegionRemoval({
      ...target,
      confirmRemoval: () => true,
      executeCommand,
      notifyFailure,
    });

    expect(result).toBe('failed');
    expect(notifyFailure).toHaveBeenCalledWith('Region을 삭제하지 못했습니다: 엔진 오류');
  });
});
