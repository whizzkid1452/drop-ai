export const AudioRuntimeBlocker = {
  AUDIO_WORKLET_API_UNAVAILABLE: 'AUDIO_WORKLET_API_UNAVAILABLE',
  CROSS_ORIGIN_ISOLATION_UNAVAILABLE: 'CROSS_ORIGIN_ISOLATION_UNAVAILABLE',
  GET_USER_MEDIA_API_UNAVAILABLE: 'GET_USER_MEDIA_API_UNAVAILABLE',
  INSECURE_CONTEXT: 'INSECURE_CONTEXT',
  MEDIA_DEVICES_API_UNAVAILABLE: 'MEDIA_DEVICES_API_UNAVAILABLE',
  SHARED_ARRAY_BUFFER_UNAVAILABLE: 'SHARED_ARRAY_BUFFER_UNAVAILABLE',
  WEBASSEMBLY_API_UNAVAILABLE: 'WEBASSEMBLY_API_UNAVAILABLE',
} as const;

export type AudioRuntimeBlocker = (typeof AudioRuntimeBlocker)[keyof typeof AudioRuntimeBlocker];

export const AudioRuntimeFeature = {
  ADVANCED_EXPORT: 'advancedExport',
  AUTOMATION: 'automation',
  BUILT_IN_PLUGINS: 'builtInPlugins',
  LINEAR_RECORDING: 'linearRecording',
  LIVE_INPUT: 'liveInput',
  LIVE_LOOP: 'liveLoop',
  METERING: 'metering',
  MIDI: 'midi',
  PROJECT_EXPORT: 'projectExport',
  REGION_PROCESSING: 'regionProcessing',
  ROUTING: 'routing',
  TEMPO_LOOP_METRONOME: 'tempoLoopMetronome',
  TIMELINE_PLAYBACK: 'timelinePlayback',
} as const;

export type AudioRuntimeFeature = (typeof AudioRuntimeFeature)[keyof typeof AudioRuntimeFeature];

export type AudioRuntimeFeatureStatus = 'available' | 'blocked' | 'unsupported';

export type AudioRuntimeFeatureSupport = Readonly<Record<AudioRuntimeFeature, boolean>>;

export interface AudioRuntimeFeatureCapability {
  readonly blockers: readonly AudioRuntimeBlocker[];
  readonly status: AudioRuntimeFeatureStatus;
}

export const CURRENT_AUDIO_RUNTIME_FEATURE_SUPPORT: AudioRuntimeFeatureSupport = {
  [AudioRuntimeFeature.ADVANCED_EXPORT]: false,
  [AudioRuntimeFeature.AUTOMATION]: false,
  [AudioRuntimeFeature.BUILT_IN_PLUGINS]: true,
  [AudioRuntimeFeature.LINEAR_RECORDING]: false,
  [AudioRuntimeFeature.LIVE_INPUT]: true,
  [AudioRuntimeFeature.LIVE_LOOP]: true,
  [AudioRuntimeFeature.METERING]: false,
  [AudioRuntimeFeature.MIDI]: false,
  [AudioRuntimeFeature.PROJECT_EXPORT]: true,
  [AudioRuntimeFeature.REGION_PROCESSING]: false,
  [AudioRuntimeFeature.ROUTING]: false,
  [AudioRuntimeFeature.TEMPO_LOOP_METRONOME]: false,
  [AudioRuntimeFeature.TIMELINE_PLAYBACK]: true,
};

export interface AudioRuntimeEnvironment {
  readonly crossOriginIsolated: boolean;
  readonly hasAudioWorklet: boolean;
  readonly hasGetUserMedia: boolean;
  readonly hasMediaDevices: boolean;
  readonly hasSharedArrayBuffer: boolean;
  readonly hasWebAssembly: boolean;
  readonly isSecureContext: boolean;
}

export interface AudioRuntimeCapabilities {
  readonly blockers: {
    readonly audioWorklet: readonly AudioRuntimeBlocker[];
    readonly liveInput: readonly AudioRuntimeBlocker[];
    readonly sharedMemory: readonly AudioRuntimeBlocker[];
    readonly wasm: readonly AudioRuntimeBlocker[];
  };
  readonly meetsAudioWorkletPreconditions: boolean;
  readonly meetsLiveInputPreconditions: boolean;
  readonly meetsSharedMemoryPreconditions: boolean;
  readonly meetsWasmPreconditions: boolean;
  readonly features: Readonly<Record<AudioRuntimeFeature, AudioRuntimeFeatureCapability>>;
}

const featureEnvironmentRequirements: Readonly<
  Record<AudioRuntimeFeature, readonly (keyof AudioRuntimeCapabilities['blockers'])[]>
> = {
  [AudioRuntimeFeature.ADVANCED_EXPORT]: [],
  [AudioRuntimeFeature.AUTOMATION]: [],
  [AudioRuntimeFeature.BUILT_IN_PLUGINS]: [],
  [AudioRuntimeFeature.LINEAR_RECORDING]: ['liveInput', 'audioWorklet'],
  [AudioRuntimeFeature.LIVE_INPUT]: ['liveInput'],
  [AudioRuntimeFeature.LIVE_LOOP]: ['liveInput', 'audioWorklet'],
  [AudioRuntimeFeature.METERING]: [],
  [AudioRuntimeFeature.MIDI]: [],
  [AudioRuntimeFeature.PROJECT_EXPORT]: [],
  [AudioRuntimeFeature.REGION_PROCESSING]: [],
  [AudioRuntimeFeature.ROUTING]: [],
  [AudioRuntimeFeature.TEMPO_LOOP_METRONOME]: [],
  [AudioRuntimeFeature.TIMELINE_PLAYBACK]: [],
};

function resolveLiveInputBlockers(environment: AudioRuntimeEnvironment): AudioRuntimeBlocker[] {
  const blockers: AudioRuntimeBlocker[] = [];

  if (!environment.isSecureContext) {
    blockers.push(AudioRuntimeBlocker.INSECURE_CONTEXT);
  }
  if (!environment.hasMediaDevices) {
    blockers.push(AudioRuntimeBlocker.MEDIA_DEVICES_API_UNAVAILABLE);
  }
  if (!environment.hasGetUserMedia) {
    blockers.push(AudioRuntimeBlocker.GET_USER_MEDIA_API_UNAVAILABLE);
  }

  return blockers;
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

export function resolveAudioRuntimeCapabilities(
  environment: AudioRuntimeEnvironment,
  runtimeSupport: AudioRuntimeFeatureSupport = CURRENT_AUDIO_RUNTIME_FEATURE_SUPPORT
): AudioRuntimeCapabilities {
  const audioWorkletBlockers = resolveAudioWorkletBlockers(environment);
  const liveInputBlockers = resolveLiveInputBlockers(environment);
  const wasmBlockers = resolveWasmBlockers(environment);
  const sharedMemoryBlockers = resolveSharedMemoryBlockers(environment);

  const blockers = {
    audioWorklet: audioWorkletBlockers,
    liveInput: liveInputBlockers,
    sharedMemory: sharedMemoryBlockers,
    wasm: wasmBlockers,
  };

  return {
    blockers,
    features: resolveFeatureCapabilities(blockers, runtimeSupport),
    meetsAudioWorkletPreconditions: audioWorkletBlockers.length === 0,
    meetsLiveInputPreconditions: liveInputBlockers.length === 0,
    meetsSharedMemoryPreconditions: sharedMemoryBlockers.length === 0,
    meetsWasmPreconditions: wasmBlockers.length === 0,
  };
}

function resolveFeatureCapabilities(
  blockers: AudioRuntimeCapabilities['blockers'],
  runtimeSupport: AudioRuntimeFeatureSupport
): Readonly<Record<AudioRuntimeFeature, AudioRuntimeFeatureCapability>> {
  return Object.fromEntries(
    Object.values(AudioRuntimeFeature).map(feature => {
      if (!runtimeSupport[feature]) {
        return [feature, { blockers: [], status: 'unsupported' as const }];
      }

      const featureBlockers = [
        ...new Set(featureEnvironmentRequirements[feature].flatMap(requirement => blockers[requirement])),
      ];
      return [
        feature,
        {
          blockers: featureBlockers,
          status: featureBlockers.length === 0 ? ('available' as const) : ('blocked' as const),
        },
      ];
    })
  ) as Record<AudioRuntimeFeature, AudioRuntimeFeatureCapability>;
}
