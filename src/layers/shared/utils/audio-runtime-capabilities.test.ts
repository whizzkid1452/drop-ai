import { describe, expect, it } from 'vitest';
import {
  AudioRuntimeBlocker,
  resolveAudioRuntimeCapabilities,
  type AudioRuntimeEnvironment,
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

describe('resolveAudioRuntimeCapabilities', () => {
  it('모든 조건이 있으면 세 기능을 각각 사용할 수 있다', () => {
    expect(resolveAudioRuntimeCapabilities(fullEnvironment)).toEqual({
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

    expect(capabilities).toEqual({
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
