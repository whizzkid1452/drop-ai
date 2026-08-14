import { describe, expect, it } from 'vitest';
import { MockAudioEngine } from '../audio-engine/mock-audio-engine';
import { MeterQuery } from './meter-query';

describe('MeterQuery', () => {
  it('AudioEngine의 Track MeterFrame을 읽기 전용 복사본으로 반환한다', () => {
    const audioEngine = new MockAudioEngine();
    audioEngine.setMockMeterFrame(
      { kind: 'track', trackId: 'track-1' },
      {
        capturedAtSeconds: 1,
        channels: [{ isClipHeld: false, peakDbfs: -6, rmsDbfs: -12 }],
      }
    );
    const query = new MeterQuery(audioEngine);

    const first = query.read({ kind: 'track', trackId: 'track-1' });
    const second = query.read({ kind: 'track', trackId: 'track-1' });

    expect(first).toEqual({
      capturedAtSeconds: 1,
      channels: [{ isClipHeld: false, peakDbfs: -6, rmsDbfs: -12 }],
    });
    expect(first).not.toBe(second);
    expect(first.channels).not.toBe(second.channels);
  });
});
