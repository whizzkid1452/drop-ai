import { afterEach, describe, expect, it, vi } from 'vitest';
import { readAudioRuntimeEnvironment } from './audio-runtime-environment';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('readAudioRuntimeEnvironment', () => {
  it('브라우저 전역 객체의 기능 노출 여부를 읽는다', () => {
    vi.stubGlobal('isSecureContext', true);
    vi.stubGlobal('crossOriginIsolated', true);
    vi.stubGlobal('SharedArrayBuffer', class SharedArrayBufferStub {});
    vi.stubGlobal('WebAssembly', {});
    vi.stubGlobal('AudioWorkletNode', class AudioWorkletNodeStub {});
    vi.stubGlobal(
      'AudioContext',
      class AudioContextStub {
        get audioWorklet(): object {
          return {};
        }
      }
    );

    expect(readAudioRuntimeEnvironment()).toEqual({
      crossOriginIsolated: true,
      hasAudioWorklet: true,
      hasSharedArrayBuffer: true,
      hasWebAssembly: true,
      isSecureContext: true,
    });
  });

  it('노출되지 않은 기능은 사용할 수 없는 환경으로 읽는다', () => {
    vi.stubGlobal('isSecureContext', undefined);
    vi.stubGlobal('crossOriginIsolated', undefined);
    vi.stubGlobal('SharedArrayBuffer', undefined);
    vi.stubGlobal('WebAssembly', undefined);
    vi.stubGlobal('AudioWorkletNode', undefined);
    vi.stubGlobal('AudioContext', undefined);

    expect(readAudioRuntimeEnvironment()).toEqual({
      crossOriginIsolated: false,
      hasAudioWorklet: false,
      hasSharedArrayBuffer: false,
      hasWebAssembly: false,
      isSecureContext: false,
    });
  });

  it('AudioWorkletNode만 있고 Context 접근점이 없으면 미지원으로 읽는다', () => {
    vi.stubGlobal('AudioWorkletNode', class AudioWorkletNodeStub {});
    vi.stubGlobal('AudioContext', class AudioContextStub {});

    expect(readAudioRuntimeEnvironment().hasAudioWorklet).toBe(false);
  });
});
