import { describe, expect, it } from 'vitest';
import { DawEngineAdapter } from './daw-engine-adapter';
import { MockAudioEngine } from './mock-audio-engine';

describe('DawEngineAdapter', () => {
  it('Track mixer 변경을 DAW domain과 기존 Tone runtime에 함께 반영한다', async () => {
    const runtime = new MockAudioEngine();
    const engine = new DawEngineAdapter({ runtime });

    await engine.addTrack('track-1');
    engine.setTrackVolume('track-1', 0.25);
    engine.setTrackPan('track-1', -0.5);
    engine.setTrackMute('track-1', true);
    engine.setTrackSolo('track-1', true);

    expect(engine.getTrackParams('track-1')).toEqual({ pan: -0.5, volume: 0.25 });
    expect(runtime.getTrackParams('track-1')).toEqual({ pan: -0.5, volume: 0.25 });
  });

  it('Transport 위치를 DAW Engine을 거쳐 runtime과 동기화한다', () => {
    const runtime = new MockAudioEngine();
    const engine = new DawEngineAdapter({ runtime });

    engine.setTime(3.5);

    expect(engine.getCurrentTime()).toBe(3.5);
    expect(runtime.getCurrentTime()).toBe(3.5);
  });

  it('Region 추가를 DAW playlist signal을 통해 runtime에 예약한다', async () => {
    const runtime = new MockAudioEngine();
    const engine = new DawEngineAdapter({ runtime });
    const region = {
      duration: 2,
      id: 'region-1',
      sourceStartTime: 0.25,
      startTime: 1,
      url: 'blob:region-1',
    };
    await engine.addTrack('track-1');

    await engine.addRegion('track-1', region);

    await expect(runtime.addRegion('track-1', region)).rejects.toMatchObject({ code: 'REGION_ID_CONFLICT' });
  });

  it('프로젝트 graph 활성화 뒤 DAW domain을 새 graph로 교체한다', async () => {
    const runtime = new MockAudioEngine();
    const engine = new DawEngineAdapter({ runtime });
    await engine.addTrack('old-track');
    const preparedGraph = await engine.prepareProjectGraph({
      masterVolume: 0.8,
      tracks: [
        {
          id: 'new-track',
          isMuted: false,
          isSoloed: false,
          pan: 0.2,
          pluginInstances: [],
          regions: [],
          volume: 0.5,
        },
      ],
    });

    preparedGraph.activate();
    engine.setTrackVolume('new-track', 0.4);

    expect(engine.getTrackParams('old-track')).toBeNull();
    expect(engine.getTrackParams('new-track')).toEqual({ pan: 0.2, volume: 0.4 });
    expect(runtime.getTrackParams('new-track')).toEqual({ pan: 0.2, volume: 0.4 });
  });
});
