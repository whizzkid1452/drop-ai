import { useCallback, useSyncExternalStore } from 'react';
import { useStore } from 'zustand';
import type { IAudioSourceResolver, IAudioSourceStager } from '../../../audio-source-registry/i-audio-source-registry';
import type { CommandExecutor } from '../../../commands/command-executor';
import type { CommandHistorySnapshot } from '../../../commands/command-history';
import type { IPlaybackClockQuery } from '../../../queries/playback-clock-query';
import type { IMeterQuery } from '../../../queries/meter-query';
import type { ILiveInputQuery } from '../../../queries/live-input-query';
import type { LiveInputRuntimeState } from '../../../shared/types/live-input';
import type { IProjectCatalogQuery } from '../../../queries/project-catalog-query';
import type { IRecordingQuery } from '../../../queries/recording-query';
import type { SessionState } from '../../../session/session';
import type { RecordingRuntimeState } from '../../../shared/types/linear-recording';
import type { AudioRuntimeCapabilities } from '../../../shared/utils/audio-runtime-capabilities';
import type { IMidiInput } from '../../../midi-input/i-midi-input';
import type { AuthSnapshot, IAuthClient } from '../../../auth/i-auth-client';
import { useLayer } from './layer-context';
import type { IBillingClient } from '../../../billing/i-billing-client';
import type { IEditorQuery } from '../../../queries/editor-query';
import type { EditorRuntimeState } from '../../../shared/types/editor-runtime';

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

export function useLiveInputRuntimeState(): LiveInputRuntimeState {
  const liveInput = useLiveInputQuery();
  const subscribe = useCallback((listener: () => void) => liveInput.subscribe(listener), [liveInput]);
  const getSnapshot = useCallback(() => liveInput.readState(), [liveInput]);
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

export function useRecordingQuery(): IRecordingQuery {
  return useLayer().recording;
}

export function useRecordingRuntimeState(): RecordingRuntimeState {
  const recording = useRecordingQuery();
  const subscribe = useCallback((listener: () => void) => recording.subscribe(listener), [recording]);
  const getSnapshot = useCallback(() => recording.readState(), [recording]);
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

export function useEditorQuery(): IEditorQuery {
  return useLayer().editor;
}

export function useEditorRuntimeState(): EditorRuntimeState {
  const editor = useEditorQuery();
  const subscribe = useCallback((listener: () => void) => editor.subscribe(listener), [editor]);
  const getSnapshot = useCallback(() => editor.readState(), [editor]);
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

export function useProjectCatalog(): IProjectCatalogQuery {
  return useLayer().projectCatalog;
}

export function useSession<T>(selector: (state: SessionState) => T): T {
  return useStore(useLayer().session, selector);
}
