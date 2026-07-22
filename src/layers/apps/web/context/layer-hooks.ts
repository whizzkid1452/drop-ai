import { useStore } from 'zustand';
import type { IAudioSourceResolver } from '../../../audio-source-registry/i-audio-source-registry';
import type { CommandExecutor } from '../../../commands/command-executor';
import type { IPlaybackClockQuery } from '../../../queries/playback-clock-query';
import type { SessionState } from '../../../session/session';
import type { AudioRuntimeCapabilities } from '../../../shared/utils/audio-runtime-capabilities';
import { useLayer } from './layer-context';

export function useAudioRuntimeCapabilities(): AudioRuntimeCapabilities {
  return useLayer().audioRuntimeCapabilities;
}

export function useAudioSourceResolver(): IAudioSourceResolver {
  return useLayer().audioSourceResolver;
}

export function useCommandExecutor(): CommandExecutor {
  return useLayer().commandExecutor;
}

export function usePlaybackClock(): IPlaybackClockQuery {
  return useLayer().playbackClock;
}

export function useSession<T>(selector: (state: SessionState) => T): T {
  return useStore(useLayer().session, selector);
}
