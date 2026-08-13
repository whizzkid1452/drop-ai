import { describe, expect, it, vi } from 'vitest';
import { LiveInputQuery } from './live-input-query';

describe('LiveInputQuery', () => {
  it('장치 목록과 runtime 상태를 읽기 전용 복사본으로 반환한다', async () => {
    const source = {
      getLiveInputState: vi.fn(() => ({ deviceId: 'mic-1', monitoringTrackId: 'track-1' })),
      listLiveInputDevices: vi.fn(async () => [{ deviceId: 'mic-1', label: 'Mic' }]),
    };
    const query = new LiveInputQuery(source);

    await expect(query.listDevices()).resolves.toEqual([{ deviceId: 'mic-1', label: 'Mic' }]);
    expect(query.readState()).toEqual({ deviceId: 'mic-1', monitoringTrackId: 'track-1' });
    expect(query.readState()).not.toBe(query.readState());
  });
});
