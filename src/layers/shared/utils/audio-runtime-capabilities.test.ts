import { describe, expect, it } from 'vitest';
import {
  AudioRuntimeBlocker,
  AudioRuntimeFeature,
  resolveAudioRuntimeCapabilities,
  type AudioRuntimeEnvironment,
  type AudioRuntimeFeatureSupport,
} from './audio-runtime-capabilities';

const fullEnvironment: AudioRuntimeEnvironment = {
  crossOriginIsolated: true,
  hasAudioWorklet: true,
  hasGetUserMedia: true,
  hasMediaDevices: true,
  hasSharedArrayBuffer: true,
  hasWebAssembly: true,
  isSecureContext: true,
};

const currentRuntimeSupport: AudioRuntimeFeatureSupport = {
  [AudioRuntimeFeature.ADVANCED_EXPORT]: false,
  [AudioRuntimeFeature.AUTOMATION]: false,
  [AudioRuntimeFeature.BUILT_IN_PLUGINS]: true,
  [AudioRuntimeFeature.LINEAR_RECORDING]: false,
  [AudioRuntimeFeature.LIVE_INPUT]: true,
  [AudioRuntimeFeature.LIVE_LOOP]: true,
  [AudioRuntimeFeature.METERING]: true,
  [AudioRuntimeFeature.MIDI]: false,
  [AudioRuntimeFeature.PROJECT_EXPORT]: true,
  [AudioRuntimeFeature.REGION_PROCESSING]: true,
  [AudioRuntimeFeature.ROUTING]: false,
  [AudioRuntimeFeature.TEMPO_LOOP_METRONOME]: false,
  [AudioRuntimeFeature.TIMELINE_PLAYBACK]: true,
};

describe('resolveAudioRuntimeCapabilities', () => {
  it('현재 runtime은 Meter 기능을 사용 가능으로 공개한다', () => {
    const capabilities = resolveAudioRuntimeCapabilities(fullEnvironment);

    expect(capabilities.features[AudioRuntimeFeature.METERING]).toEqual({ blockers: [], status: 'available' });
  });

  it('현재 runtime은 Automation 기능을 사용 가능으로 공개한다', () => {
    const capabilities = resolveAudioRuntimeCapabilities(fullEnvironment);

    expect(capabilities.features[AudioRuntimeFeature.AUTOMATION]).toEqual({ blockers: [], status: 'available' });
  });

  it('모든 조건이 있으면 세 기능을 각각 사용할 수 있다', () => {
    expect(resolveAudioRuntimeCapabilities(fullEnvironment, currentRuntimeSupport)).toEqual({
      blockers: {
        audioWorklet: [],
        liveInput: [],
        sharedMemory: [],
        wasm: [],
      },
      meetsAudioWorkletPreconditions: true,
      meetsLiveInputPreconditions: true,
      meetsSharedMemoryPreconditions: true,
      meetsWasmPreconditions: true,
      features: {
        [AudioRuntimeFeature.ADVANCED_EXPORT]: { blockers: [], status: 'unsupported' },
        [AudioRuntimeFeature.AUTOMATION]: { blockers: [], status: 'unsupported' },
        [AudioRuntimeFeature.BUILT_IN_PLUGINS]: { blockers: [], status: 'available' },
        [AudioRuntimeFeature.LINEAR_RECORDING]: { blockers: [], status: 'unsupported' },
        [AudioRuntimeFeature.LIVE_INPUT]: { blockers: [], status: 'available' },
        [AudioRuntimeFeature.LIVE_LOOP]: { blockers: [], status: 'available' },
        [AudioRuntimeFeature.METERING]: { blockers: [], status: 'available' },
        [AudioRuntimeFeature.MIDI]: { blockers: [], status: 'unsupported' },
        [AudioRuntimeFeature.PROJECT_EXPORT]: { blockers: [], status: 'available' },
        [AudioRuntimeFeature.REGION_PROCESSING]: { blockers: [], status: 'available' },
        [AudioRuntimeFeature.ROUTING]: { blockers: [], status: 'unsupported' },
        [AudioRuntimeFeature.TEMPO_LOOP_METRONOME]: { blockers: [], status: 'unsupported' },
        [AudioRuntimeFeature.TIMELINE_PLAYBACK]: { blockers: [], status: 'available' },
      },
    });
  });

  it('환경 전제조건과 runtime 구현 여부를 분리해 기능 상태를 계산한다', () => {
    const capabilities = resolveAudioRuntimeCapabilities(
      { ...fullEnvironment, hasGetUserMedia: false },
      currentRuntimeSupport
    );

    expect(capabilities.features[AudioRuntimeFeature.LIVE_INPUT]).toEqual({
      blockers: [AudioRuntimeBlocker.GET_USER_MEDIA_API_UNAVAILABLE],
      status: 'blocked',
    });
    expect(capabilities.features[AudioRuntimeFeature.METERING]).toEqual({ blockers: [], status: 'available' });
    expect(capabilities.features[AudioRuntimeFeature.TIMELINE_PLAYBACK]).toEqual({
      blockers: [],
      status: 'available',
    });
  });

  it('MediaDevices 또는 getUserMedia가 없으면 실시간 입력만 차단한다', () => {
    const capabilities = resolveAudioRuntimeCapabilities({
      ...fullEnvironment,
      hasGetUserMedia: false,
      hasMediaDevices: false,
    });

    expect(capabilities.meetsAudioWorkletPreconditions).toBe(true);
    expect(capabilities.meetsLiveInputPreconditions).toBe(false);
    expect(capabilities.blockers.liveInput).toEqual([
      AudioRuntimeBlocker.MEDIA_DEVICES_API_UNAVAILABLE,
      AudioRuntimeBlocker.GET_USER_MEDIA_API_UNAVAILABLE,
    ]);
  });

  it('격리가 없어도 AudioWorklet과 단일 스레드 WASM은 사용할 수 있다', () => {
    const capabilities = resolveAudioRuntimeCapabilities({
      ...fullEnvironment,
      crossOriginIsolated: false,
      hasSharedArrayBuffer: false,
    });

    expect(capabilities).toMatchObject({
      blockers: {
        audioWorklet: [],
        liveInput: [],
        sharedMemory: [
          AudioRuntimeBlocker.CROSS_ORIGIN_ISOLATION_UNAVAILABLE,
          AudioRuntimeBlocker.SHARED_ARRAY_BUFFER_UNAVAILABLE,
        ],
        wasm: [],
      },
      meetsAudioWorkletPreconditions: true,
      meetsLiveInputPreconditions: true,
      meetsSharedMemoryPreconditions: false,
      meetsWasmPreconditions: true,
    });
  });

  it('안전한 컨텍스트가 아니면 AudioWorklet과 공유 메모리를 차단한다', () => {
    const capabilities = resolveAudioRuntimeCapabilities({
      ...fullEnvironment,
      isSecureContext: false,
    });

    expect(capabilities.meetsAudioWorkletPreconditions).toBe(false);
    expect(capabilities.meetsSharedMemoryPreconditions).toBe(false);
    expect(capabilities.meetsWasmPreconditions).toBe(true);
    expect(capabilities.blockers.audioWorklet).toEqual([AudioRuntimeBlocker.INSECURE_CONTEXT]);
    expect(capabilities.blockers.sharedMemory).toEqual([AudioRuntimeBlocker.INSECURE_CONTEXT]);
  });

  it('WASM API가 없어도 공유 메모리 조건은 독립적으로 계산한다', () => {
    const capabilities = resolveAudioRuntimeCapabilities({
      ...fullEnvironment,
      hasWebAssembly: false,
    });

    expect(capabilities.meetsWasmPreconditions).toBe(false);
    expect(capabilities.meetsSharedMemoryPreconditions).toBe(true);
    expect(capabilities.blockers.wasm).toEqual([AudioRuntimeBlocker.WEBASSEMBLY_API_UNAVAILABLE]);
  });
});
