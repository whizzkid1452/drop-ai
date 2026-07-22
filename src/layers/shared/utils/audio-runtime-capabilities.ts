export const AudioRuntimeBlocker = {
  AUDIO_WORKLET_API_UNAVAILABLE: 'AUDIO_WORKLET_API_UNAVAILABLE',
  CROSS_ORIGIN_ISOLATION_UNAVAILABLE: 'CROSS_ORIGIN_ISOLATION_UNAVAILABLE',
  INSECURE_CONTEXT: 'INSECURE_CONTEXT',
  SHARED_ARRAY_BUFFER_UNAVAILABLE: 'SHARED_ARRAY_BUFFER_UNAVAILABLE',
  WEBASSEMBLY_API_UNAVAILABLE: 'WEBASSEMBLY_API_UNAVAILABLE',
} as const;

export type AudioRuntimeBlocker = (typeof AudioRuntimeBlocker)[keyof typeof AudioRuntimeBlocker];

export interface AudioRuntimeEnvironment {
  readonly crossOriginIsolated: boolean;
  readonly hasAudioWorklet: boolean;
  readonly hasSharedArrayBuffer: boolean;
  readonly hasWebAssembly: boolean;
  readonly isSecureContext: boolean;
}

export interface AudioRuntimeCapabilities {
  readonly blockers: {
    readonly audioWorklet: readonly AudioRuntimeBlocker[];
    readonly sharedMemory: readonly AudioRuntimeBlocker[];
    readonly wasm: readonly AudioRuntimeBlocker[];
  };
  readonly meetsAudioWorkletPreconditions: boolean;
  readonly meetsSharedMemoryPreconditions: boolean;
  readonly meetsWasmPreconditions: boolean;
}

function resolveAudioWorkletBlockers(environment: AudioRuntimeEnvironment): AudioRuntimeBlocker[] {
  const blockers: AudioRuntimeBlocker[] = [];

  if (!environment.isSecureContext) {
    blockers.push(AudioRuntimeBlocker.INSECURE_CONTEXT);
  }
  if (!environment.hasAudioWorklet) {
    blockers.push(AudioRuntimeBlocker.AUDIO_WORKLET_API_UNAVAILABLE);
  }

  return blockers;
}

function resolveWasmBlockers(environment: AudioRuntimeEnvironment): AudioRuntimeBlocker[] {
  return environment.hasWebAssembly ? [] : [AudioRuntimeBlocker.WEBASSEMBLY_API_UNAVAILABLE];
}

function resolveSharedMemoryBlockers(environment: AudioRuntimeEnvironment): AudioRuntimeBlocker[] {
  const blockers: AudioRuntimeBlocker[] = [];

  if (!environment.isSecureContext) {
    blockers.push(AudioRuntimeBlocker.INSECURE_CONTEXT);
  }
  if (!environment.crossOriginIsolated) {
    blockers.push(AudioRuntimeBlocker.CROSS_ORIGIN_ISOLATION_UNAVAILABLE);
  }
  if (!environment.hasSharedArrayBuffer) {
    blockers.push(AudioRuntimeBlocker.SHARED_ARRAY_BUFFER_UNAVAILABLE);
  }

  return blockers;
}

export function resolveAudioRuntimeCapabilities(environment: AudioRuntimeEnvironment): AudioRuntimeCapabilities {
  const audioWorkletBlockers = resolveAudioWorkletBlockers(environment);
  const wasmBlockers = resolveWasmBlockers(environment);
  const sharedMemoryBlockers = resolveSharedMemoryBlockers(environment);

  return {
    blockers: {
      audioWorklet: audioWorkletBlockers,
      sharedMemory: sharedMemoryBlockers,
      wasm: wasmBlockers,
    },
    meetsAudioWorkletPreconditions: audioWorkletBlockers.length === 0,
    meetsSharedMemoryPreconditions: sharedMemoryBlockers.length === 0,
    meetsWasmPreconditions: wasmBlockers.length === 0,
  };
}
