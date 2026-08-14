import { useCallback, useSyncExternalStore } from 'react';
import type { IAudioSourceResolver, IAudioSourceStager } from '../../../audio-source-registry/i-audio-source-registry';
import type { CommandExecutor } from '../../../commands/command-executor';
import type { IAgentRuntimeCommandExecutor } from '../../../commands/agent-runtime-command-executor';
import type { CommandHistorySnapshot } from '../../../commands/command-history';
import type { IPlaybackClockQuery } from '../../../queries/playback-clock-query';
import type { IMeterQuery } from '../../../queries/meter-query';
import type { ILiveInputQuery } from '../../../queries/live-input-query';
import type { LiveInputRuntimeState } from '../../../shared/types/live-input';
import type { IProjectCatalogQuery } from '../../../queries/project-catalog-query';
import type { IRecordingQuery } from '../../../queries/recording-query';
import type { SessionSnapshot } from '../../../session/session-query';
import type { RecordingRuntimeState } from '../../../shared/types/linear-recording';
import type { AudioRuntimeCapabilities } from '../../../shared/utils/audio-runtime-capabilities';
import type { IMidiInput } from '../../../midi-input/i-midi-input';
import type { AuthSnapshot, IAuthClient } from '../../../auth/i-auth-client';
import { useLayer } from './layer-context';
import type { IBillingClient } from '../../../billing/i-billing-client';
import type { IEditorQuery } from '../../../queries/editor-query';
import type { EditorRuntimeState } from '../../../shared/types/editor-runtime';
import type { IAudioMonitorQuery } from '../../../queries/audio-monitor-query';
import type { AudioMonitorState } from '../../../shared/types/audio-monitor-state';
import type { IMidiRecordingQuery } from '../../../queries/midi-recording-query';
import type { MidiRecordingRuntimeState } from '../../../shared/types/midi-recording';
import type { IPluginRuntimeQuery } from '../../../queries/plugin-runtime-query';
import type { IMediaSourceQuery } from '../../../queries/media-source-query';
import type { IRenderJobQuery } from '../../../queries/render-job-query';
import type { RenderJobState } from '../../../shared/types/render-job';
import type { ISessionRecoveryQuery, SessionRecoveryCheckpoint } from '../../../queries/session-recovery-query';
import type { IRuntimeDiagnosticsQuery } from '../../../queries/runtime-diagnostics-query';
import type { RuntimeDiagnosticsState } from '../../../shared/types/runtime-diagnostics';

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

export function useAgentRuntimeCommands(): IAgentRuntimeCommandExecutor {
  return useLayer().agentRuntimeCommands;
}

export function useMidiInput(): IMidiInput {
  return useLayer().midiInput;
}

export function useMidiRecordingQuery(): IMidiRecordingQuery {
  return useLayer().midiRecording;
}

export function useMidiRecordingRuntimeState(): MidiRecordingRuntimeState {
  const midiRecording = useMidiRecordingQuery();
  const subscribe = useCallback((listener: () => void) => midiRecording.subscribe(listener), [midiRecording]);
  const getSnapshot = useCallback(() => midiRecording.readState(), [midiRecording]);
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

export function useCommandHistory(): CommandHistorySnapshot {
  const commandHistory = useLayer().commandHistory;
  return useSyncExternalStore(commandHistory.subscribe, commandHistory.getSnapshot, commandHistory.getSnapshot);
}

const unavailableSessionRecoveryQuery: ISessionRecoveryQuery = {
  getSnapshot: () => null,
  subscribe: () => () => undefined,
};

export function useSessionRecoveryCheckpoint(): SessionRecoveryCheckpoint | null {
  const sessionRecovery = useLayer().sessionRecovery ?? unavailableSessionRecoveryQuery;
  return useSyncExternalStore(sessionRecovery.subscribe, sessionRecovery.getSnapshot, sessionRecovery.getSnapshot);
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

export function useAudioMonitorQuery(): IAudioMonitorQuery {
  return useLayer().audioMonitor;
}

export function useAudioMonitorState(): AudioMonitorState {
  const audioMonitor = useAudioMonitorQuery();
  const subscribe = useCallback((listener: () => void) => audioMonitor.subscribe(listener), [audioMonitor]);
  const getSnapshot = useCallback(() => audioMonitor.readState(), [audioMonitor]);
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

export function useProjectCatalog(): IProjectCatalogQuery {
  return useLayer().projectCatalog;
}

export function usePluginRuntimeQuery(): IPluginRuntimeQuery {
  return useLayer().pluginRuntime;
}

export function useMediaSourceQuery(): IMediaSourceQuery {
  return useLayer().mediaSource;
}

export function useRenderJobQuery(): IRenderJobQuery {
  return useLayer().renderJob;
}

export function useRenderJobState(): RenderJobState {
  const renderJob = useRenderJobQuery();
  const subscribe = useCallback((listener: () => void) => renderJob.subscribe(listener), [renderJob]);
  const getSnapshot = useCallback(() => renderJob.readState(), [renderJob]);
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

export function useRuntimeDiagnosticsQuery(): IRuntimeDiagnosticsQuery {
  return useLayer().runtimeDiagnostics;
}

export function useRuntimeDiagnosticsState(): RuntimeDiagnosticsState {
  const runtimeDiagnostics = useRuntimeDiagnosticsQuery();
  return useSyncExternalStore(runtimeDiagnostics.subscribe, runtimeDiagnostics.readState, runtimeDiagnostics.readState);
}

export function useSession<T>(selector: (state: SessionSnapshot) => T): T {
  const session = useLayer().session;
  const snapshot = useSyncExternalStore(session.subscribe, session.getState, session.getState);
  return selector(snapshot);
}
