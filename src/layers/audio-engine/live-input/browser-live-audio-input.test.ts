import { afterEach, describe, expect, it, vi } from 'vitest';
import { BrowserLiveAudioInput } from './browser-live-audio-input';
import { LiveAudioInputError, LiveAudioInputErrorCode } from './live-audio-input-error';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('BrowserLiveAudioInput', () => {
  it('지정한 장치를 처리 효과 없이 열고 연결 종료 시 트랙을 정지한다', async () => {
    const stop = vi.fn();
    const stream = {
      getAudioTracks: () => [{ getSettings: () => ({ deviceId: 'resolved-input' }) }],
      getTracks: () => [{ stop }],
    } as unknown as MediaStream;
    const getUserMedia = vi.fn().mockResolvedValue(stream);
    vi.stubGlobal('navigator', { mediaDevices: { getUserMedia } });

    const connection = await new BrowserLiveAudioInput().open({ deviceId: 'preferred-input' });

    expect(getUserMedia).toHaveBeenCalledWith({
      audio: {
        autoGainControl: false,
        deviceId: { exact: 'preferred-input' },
        echoCancellation: false,
        noiseSuppression: false,
      },
      video: false,
    });
    expect(connection.deviceId).toBe('resolved-input');

    connection.close();
    expect(stop).toHaveBeenCalledOnce();
  });

  it('권한 거부를 분류된 입력 오류로 변환한다', async () => {
    const getUserMedia = vi.fn().mockRejectedValue(new DOMException('denied', 'NotAllowedError'));
    vi.stubGlobal('navigator', { mediaDevices: { getUserMedia } });

    await expect(new BrowserLiveAudioInput().open({})).rejects.toMatchObject({
      code: LiveAudioInputErrorCode.PERMISSION_DENIED,
    } satisfies Partial<LiveAudioInputError>);
  });

  it('MediaDevices API가 없으면 장치 접근을 시도하지 않는다', async () => {
    vi.stubGlobal('navigator', {});

    await expect(new BrowserLiveAudioInput().open({})).rejects.toMatchObject({
      code: LiveAudioInputErrorCode.API_UNAVAILABLE,
    } satisfies Partial<LiveAudioInputError>);
  });
});
