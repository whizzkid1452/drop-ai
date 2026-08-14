import type { AudioCommand, AudioCommandType } from '../types/audioCommand.schema';
import { getAudioCommandFeatureRequirement } from './audio-command-feature-map';
import type { AudioRuntimeBlocker, AudioRuntimeCapabilities, AudioRuntimeFeature } from './audio-runtime-capabilities';

interface AssertAudioCommandCapabilityOptions {
  readonly capabilities: AudioRuntimeCapabilities;
  readonly command: AudioCommand;
}

export class UnsupportedAudioCommandError extends Error {
  readonly blockers: readonly AudioRuntimeBlocker[];
  readonly code = 'UNSUPPORTED_AUDIO_COMMAND' as const;
  readonly commandType: AudioCommandType;
  readonly feature: AudioRuntimeFeature;
  readonly status: 'blocked' | 'internal' | 'unsupported';

  constructor(options: {
    readonly blockers: readonly AudioRuntimeBlocker[];
    readonly commandType: AudioCommandType;
    readonly feature: AudioRuntimeFeature;
    readonly status: 'blocked' | 'internal' | 'unsupported';
  }) {
    super(
      options.status === 'blocked'
        ? `환경 전제조건이 없어 ${options.commandType} 명령을 실행할 수 없습니다.`
        : `현재 runtime이 ${options.commandType} 명령을 지원하지 않습니다.`
    );
    this.name = 'UnsupportedAudioCommandError';
    this.blockers = options.blockers;
    this.commandType = options.commandType;
    this.feature = options.feature;
    this.status = options.status;
  }
}

export function assertAudioCommandCapability({ capabilities, command }: AssertAudioCommandCapabilityOptions): void {
  const feature = getAudioCommandFeatureRequirement(command.type);
  if (feature === null) {
    return;
  }

  const capability = capabilities.features[feature];
  if (capability.status === 'available') {
    return;
  }

  throw new UnsupportedAudioCommandError({
    blockers: capability.blockers,
    commandType: command.type,
    feature,
    status: capability.status,
  });
}
