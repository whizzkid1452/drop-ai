import { describe, expect, it, vi } from 'vitest';
import { DAW_AUDIO_PROVIDER_SUPPORT, DawAudioProviderBridge, DawEngineAdapter } from './daw-engine-adapter';
import { AudioEngineErrorCode, UnsupportedAudioFeatureError } from './errors';
import { MockAudioEngine } from './mock-audio-engine';

describe('DawEngineAdapter', () => {
  it('AudioProvider 메서드를 runtime 위임, adapter 처리, 미지원으로 분류한다', () => {
    expect(new Set(Object.values(DAW_AUDIO_PROVIDER_SUPPORT))).toEqual(
      new Set(['adapter-handled', 'runtime-delegated', 'unsupported'])
    );
    expect(DAW_AUDIO_PROVIDER_SUPPORT.start).toBe('runtime-delegated');
    expect(DAW_AUDIO_PROVIDER_SUPPORT.connectIO).toBe('adapter-handled');
    expect(DAW_AUDIO_PROVIDER_SUPPORT.getMeterData).toBe('unsupported');
    expect(DAW_AUDIO_PROVIDER_SUPPORT.scheduleMidiRegion).toBe('adapter-handled');
  });

  it('미지원 Provider 메서드를 기능 식별자가 있는 오류로 거부한다', () => {
    const provider = new DawAudioProviderBridge(new MockAudioEngine()).audioProvider;

    expect(() => provider.getMeterData('track-1')).toThrowError(UnsupportedAudioFeatureError);

    try {
      provider.getMeterData('track-1');
    } catch (error) {
      expect(error).toMatchObject({
        code: AudioEngineErrorCode.UNSUPPORTED_FEATURE,
        details: { feature: 'metering', method: 'getMeterData' },
      });
    }
  });

  it('Adapter가 소유한 route와 tempo projection은 오류 없이 처리한다', () => {
    const provider = new DawAudioProviderBridge(new MockAudioEngine()).audioProvider;

    expect(() => provider.connectIO('route-output', 'master-input')).not.toThrow();
    expect(() => provider.disconnectIO('route-output', 'master-input')).not.toThrow();
    expect(() => provider.setTempo(120)).not.toThrow();
  });

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

  it('Tempo Map·Loop·Metronome을 제품 runtime에 위임한다', () => {
    const runtime = new MockAudioEngine();
    const engine = new DawEngineAdapter({ runtime });
    const changes = [
      { bpm: 120, quarterNotePosition: 0 },
      { bpm: 90, quarterNotePosition: 4 },
    ];

    engine.setTempoMap({ changes });
    engine.setLoopRange({ endTimeSeconds: 8, startTimeSeconds: 2 });
    engine.setLoopEnabled(true);
    engine.setMetronomeVolume(0.5);
    engine.setMetronomeEnabled(true);

    expect(runtime.getMockTransportState()).toEqual({
      isLoopEnabled: true,
      isMetronomeEnabled: true,
      loopRange: { endTimeSeconds: 8, startTimeSeconds: 2 },
      metronomeVolume: 0.5,
      tempoChanges: changes,
    });
  });

  it('MIDI Track과 Region 상태를 DAW domain과 제품 runtime에 함께 반영한다', async () => {
    const runtime = new MockAudioEngine();
    const engine = new DawEngineAdapter({ runtime });
    const midi = {
      instrumentId: 'builtin.poly-synth',
      recordMode: 'replace' as const,
      regions: [
        {
          controlLanes: [],
          durationSeconds: 2,
          id: '11111111-1111-4111-8111-111111111111',
          name: 'Verse',
          notes: [
            {
              channel: 1,
              durationSeconds: 0.5,
              id: '22222222-2222-4222-8222-222222222222',
              pitch: 60,
              startOffsetSeconds: 0.25,
              velocity: 100,
            },
          ],
          startTimeSeconds: 1,
        },
      ],
    };
    const panic = vi.spyOn(runtime, 'midiPanic');

    await engine.addMidiTrack('midi-track-1');
    engine.setMidiTrackState({ midi, trackId: 'midi-track-1' });
    engine.midiPanic();

    expect(runtime.getMockMidiTrackState('midi-track-1')).toEqual(midi);
    expect(panic).toHaveBeenCalledTimes(1);
  });

  it('Region 추가를 DAW playlist signal을 통해 runtime에 예약한다', async () => {
    const runtime = new MockAudioEngine();
    const engine = new DawEngineAdapter({ runtime });
    const region = {
      duration: 2,
      fadeIn: { crossfadeId: null, curve: 'linear' as const, durationSeconds: 0 },
      fadeOut: { crossfadeId: null, curve: 'linear' as const, durationSeconds: 0 },
      gain: 1,
      id: 'region-1',
      isOpaque: false,
      layer: 0,
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
