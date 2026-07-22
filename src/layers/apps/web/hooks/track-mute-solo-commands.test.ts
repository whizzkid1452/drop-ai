import { describe, expect, it, vi } from 'vitest';
import { AudioCommandType, type AudioCommand } from '@/types/audioCommand.schema';
import {
  createSetTrackMuteCommand,
  createSetTrackSoloCommand,
  executeTrackMuteChange,
  executeTrackSoloChange,
} from './track-mute-solo-commands';

const trackId = '11111111-1111-4111-8111-111111111111';

describe('Track Mute·Solo UI 명령 변환', () => {
  it('Mute 상태를 SET_TRACK_MUTE 명령으로 변환한다', () => {
    expect(createSetTrackMuteCommand({ trackId, muted: true })).toEqual({
      type: AudioCommandType.SET_TRACK_MUTE,
      trackId,
      muted: true,
    });
  });

  it('Solo 상태를 SET_TRACK_SOLO 명령으로 변환한다', () => {
    expect(createSetTrackSoloCommand({ trackId, soloed: true })).toEqual({
      type: AudioCommandType.SET_TRACK_SOLO,
      trackId,
      soloed: true,
    });
  });

  it('Mute 변경 명령을 정확히 한 번 실행한다', async () => {
    const executeCommand = vi.fn<(command: AudioCommand) => Promise<unknown>>().mockResolvedValue(undefined);

    const result = await executeTrackMuteChange({
      trackId,
      muted: true,
      executeCommand,
      notifyFailure: vi.fn(),
    });

    expect(result).toBe('updated');
    expect(executeCommand).toHaveBeenCalledTimes(1);
    expect(executeCommand).toHaveBeenCalledWith(createSetTrackMuteCommand({ trackId, muted: true }));
  });

  it('Solo 변경 명령을 정확히 한 번 실행한다', async () => {
    const executeCommand = vi.fn<(command: AudioCommand) => Promise<unknown>>().mockResolvedValue(undefined);

    const result = await executeTrackSoloChange({
      trackId,
      soloed: true,
      executeCommand,
      notifyFailure: vi.fn(),
    });

    expect(result).toBe('updated');
    expect(executeCommand).toHaveBeenCalledTimes(1);
    expect(executeCommand).toHaveBeenCalledWith(createSetTrackSoloCommand({ trackId, soloed: true }));
  });

  it('Mute 변경 실패 원인을 사용자 메시지로 전달한다', async () => {
    const notifyFailure = vi.fn();

    const result = await executeTrackMuteChange({
      trackId,
      muted: true,
      executeCommand: vi.fn().mockRejectedValue(new Error('엔진 오류')),
      notifyFailure,
    });

    expect(result).toBe('failed');
    expect(notifyFailure).toHaveBeenCalledWith('Track Mute를 변경하지 못했습니다: 엔진 오류');
  });

  it('Solo 변경 실패 원인을 사용자 메시지로 전달한다', async () => {
    const notifyFailure = vi.fn();

    const result = await executeTrackSoloChange({
      trackId,
      soloed: true,
      executeCommand: vi.fn().mockRejectedValue(new Error('엔진 오류')),
      notifyFailure,
    });

    expect(result).toBe('failed');
    expect(notifyFailure).toHaveBeenCalledWith('Track Solo를 변경하지 못했습니다: 엔진 오류');
  });
});
