import type { AudioRuntimeEnvironment } from '../shared/utils/audio-runtime-capabilities';

function hasAudioWorkletApi(): boolean {
  if (typeof AudioWorkletNode === 'undefined' || typeof AudioContext === 'undefined') {
    return false;
  }

  return 'audioWorklet' in AudioContext.prototype;
}

export function readAudioRuntimeEnvironment(): AudioRuntimeEnvironment {
  const mediaDevices = typeof navigator === 'undefined' ? undefined : navigator.mediaDevices;

  return {
    crossOriginIsolated: globalThis.crossOriginIsolated === true,
    hasAudioWorklet: hasAudioWorkletApi(),
    hasGetUserMedia: typeof mediaDevices?.getUserMedia === 'function',
    hasMediaDevices: mediaDevices !== undefined,
    hasSharedArrayBuffer: typeof SharedArrayBuffer !== 'undefined',
    hasWebAssembly: typeof WebAssembly !== 'undefined',
    isSecureContext: globalThis.isSecureContext === true,
  };
}
