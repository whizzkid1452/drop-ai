import { describe, expect, it, vi } from 'vitest';
import { PlaybackClockQuery } from './playback-clock-query';

describe('PlaybackClockQuery', () => {
  it('AudioEngine의 현재 재생 시각만 읽는다', () => {
    const getCurrentTime = vi.fn().mockReturnValue(12.5);
    const query = new PlaybackClockQuery({ getCurrentTime });

    expect(query.getCurrentTime()).toBe(12.5);
    expect(getCurrentTime).toHaveBeenCalledTimes(1);
  });
});
