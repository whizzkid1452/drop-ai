import { useSyncExternalStore } from 'react';
import { useStore } from 'zustand';
import type { IAudioSourceResolver, IAudioSourceStager } from '../../../audio-source-registry/i-audio-source-registry';
import type { CommandExecutor } from '../../../commands/command-executor';
import type { CommandHistorySnapshot } from '../../../commands/command-history';
import type { IPlaybackClockQuery } from '../../../queries/playback-clock-query';
import type { IMeterQuery } from '../../../queries/meter-query';
import type { ILiveInputQuery } from '../../../queries/live-input-query';
import type { IProjectCatalogQuery } from '../../../queries/project-catalog-query';
import type { SessionState } from '../../../session/session';
import type { AudioRuntimeCapabilities } from '../../../shared/utils/audio-runtime-capabilities';
import type { IMidiInput } from '../../../midi-input/i-midi-input';
import type { AuthSnapshot, IAuthClient } from '../../../auth/i-auth-client';
import { useLayer } from './layer-context';
import type { IBillingClient } from '../../../billing/i-billing-client';

export function useAudioRuntimeCapabilities(): AudioRuntimeCapabilities {
  return useLayer().audioRuntimeCapabilities;
}

export function useAuthClient(): IAuthClient {
  return useLayer().authClient;
}

export function useBillingClient(): IBillingClient {
  return useLayer().billingClient;
}

export function useAuthSnapshot(): AuthSnapshot {
  const authClient = useAuthClient();
  return useSyncExternalStore(authClient.subscribe, authClient.getSnapshot, authClient.getSnapshot);
}

export function useAudioSourceResolver(): IAudioSourceResolver {
  return useLayer().audioSourceResolver;
}

export function useAudioSourceStager(): IAudioSourceStager {
  return useLayer().audioSourceStager;
}

export function useCommandExecutor(): CommandExecutor {
  return useLayer().commandExecutor;
}

export function useMidiInput(): IMidiInput {
  return useLayer().midiInput;
}

export function useCommandHistory(): CommandHistorySnapshot {
  const commandHistory = useLayer().commandHistory;
  return useSyncExternalStore(commandHistory.subscribe, commandHistory.getSnapshot, commandHistory.getSnapshot);
}

export function usePlaybackClock(): IPlaybackClockQuery {
  return useLayer().playbackClock;
}

export function useMeterQuery(): IMeterQuery {
  return useLayer().meter;
}

export function useLiveInputQuery(): ILiveInputQuery {
  return useLayer().liveInput;
}

export function useProjectCatalog(): IProjectCatalogQuery {
  return useLayer().projectCatalog;
}

export function useSession<T>(selector: (state: SessionState) => T): T {
  return useStore(useLayer().session, selector);
}
