import type { AppController } from '../controllers/app-controller';
import type { SessionState, SessionStore } from '../session/session';
import {
  AudioCommandBatchSchema,
  AudioCommandSchema,
  AudioCommandType,
  type AudioCommand,
} from '../shared/types/audioCommand.schema';
import type { ICommandHistory } from './command-history';
import type { RecordedTake } from '../shared/types/linear-recording';
import type { EditorRuntimeState } from '../shared/types/editor-runtime';
import { createCommandHistoryEntry } from './create-command-history-entry';
import { assertLiveOperationAllowed } from './live-operation-guard';

export type CommandExecutionResult = Blob | RecordedTake | void;
export type CommandBatchExecutionResult = readonly CommandExecutionResult[];

interface CommandBatchExecutionErrorOptions {
  failedIndex: number;
  failedCommand: AudioCommand;
  completedResults: CommandBatchExecutionResult;
  cause: unknown;
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export class CommandBatchExecutionError extends Error {
  readonly failedIndex: number;
  readonly failedCommand: AudioCommand;
  readonly completedResults: CommandBatchExecutionResult;

  constructor(options: CommandBatchExecutionErrorOptions) {
    super(getErrorMessage(options.cause), { cause: options.cause });
    this.name = 'CommandBatchExecutionError';
    this.failedIndex = options.failedIndex;
    this.failedCommand = options.failedCommand;
    this.completedResults = [...options.completedResults];
  }
}

function throwUnsupportedCommand(command: never): never {
  const commandType = (command as { type?: unknown }).type;
  throw new Error(`Unsupported audio command: ${String(commandType)}`);
}

export class CommandExecutor {
  private executionTail: Promise<void> = Promise.resolve();

  constructor(
    private readonly sessionStore: SessionStore,
    private readonly controller: AppController,
    private readonly commandHistory: ICommandHistory
  ) {}

  async execute(command: AudioCommand): Promise<CommandExecutionResult> {
    const validatedCommand = AudioCommandSchema.parse(command);
    return this.enqueue(() => this.executeAndPersist(validatedCommand));
  }

  async executeMany(commands: readonly AudioCommand[]): Promise<CommandBatchExecutionResult> {
    const validatedCommands = AudioCommandBatchSchema.parse(commands);
    return this.enqueue(() => this.executeValidatedBatch(validatedCommands));
  }

  private async executeValidatedBatch(
    validatedCommands: readonly AudioCommand[]
  ): Promise<CommandBatchExecutionResult> {
    const completedResults: CommandExecutionResult[] = [];

    for (const [failedIndex, failedCommand] of validatedCommands.entries()) {
      try {
        completedResults.push(await this.executeAndPersist(failedCommand));
      } catch (cause) {
        throw new CommandBatchExecutionError({ failedIndex, failedCommand, completedResults, cause });
      }
    }

    return completedResults;
  }

  private async executeAndPersist(validatedCommand: AudioCommand): Promise<CommandExecutionResult> {
    const result = await this.executeWithHistory(validatedCommand);
    if (shouldPersistProjectAfterCommand(validatedCommand)) {
      // 명령 완료를 로컬 commit 뒤로 미뤄 앱 종료 직전의 편집도 Outbox와 함께 남긴다.
      await this.controller.project.saveProject();
    }
    return result;
  }

  private async executeWithHistory(validatedCommand: AudioCommand): Promise<CommandExecutionResult> {
    if (validatedCommand.type === AudioCommandType.UNDO || validatedCommand.type === AudioCommandType.REDO) {
      return this.executeWithoutHistory(validatedCommand);
    }

    const beforeSession = this.sessionStore.getState();
    const beforeEditorRuntime = this.controller.editor.getState();
    const preparedCommand = this.prepareCommandForExecution(validatedCommand, beforeSession);
    let result: CommandExecutionResult;
    try {
      result = await this.executeWithoutHistory(preparedCommand);
    } catch (cause) {
      if (this.sessionStore.getState() !== beforeSession) {
        this.updateHistoryAfterCommittedCommand(preparedCommand, beforeSession, beforeEditorRuntime);
      }
      throw cause;
    }

    this.updateHistoryAfterCommittedCommand(preparedCommand, beforeSession, beforeEditorRuntime);
    return result;
  }

  private updateHistoryAfterCommittedCommand(
    command: AudioCommand,
    beforeSession: SessionState,
    beforeEditorRuntime: EditorRuntimeState
  ): void {
    if (this.isHistoryBoundary(command)) {
      this.commandHistory.clear();
      return;
    }
    const historyEntry = createCommandHistoryEntry({
      beforeSession,
      beforeEditorRuntime,
      afterSession: this.sessionStore.getState(),
      afterEditorRuntime: this.controller.editor.getState(),
      command,
      executeCommand: async command => {
        await this.executeWithoutHistory(AudioCommandSchema.parse(command));
      },
      replaceTrackRegions: request => this.controller.editor.restoreTrackRegions(request),
      restoreEditorRuntime: state => this.controller.editor.restoreRuntimeState(state),
    });
    if (historyEntry) {
      this.commandHistory.record(historyEntry);
    }
  }

  private async executeWithoutHistory(validatedCommand: AudioCommand): Promise<CommandExecutionResult> {
    assertLiveOperationAllowed({ command: validatedCommand, session: this.sessionStore.getState() });

    if (validatedCommand.type === AudioCommandType.UNDO) {
      await this.commandHistory.undo();
      return;
    }
    if (validatedCommand.type === AudioCommandType.REDO) {
      await this.commandHistory.redo();
      return;
    }

    // 연속 명령에서 앞 명령의 변경 상태를 다음 명령이 사용하도록 실행 직전에 Session을 읽는다.
    const session = this.sessionStore.getState();

    switch (validatedCommand.type) {
      case AudioCommandType.ADD_TRACK:
        await this.controller.track.addTrack(validatedCommand.trackId);
        return;

      case AudioCommandType.REMOVE_TRACK:
        this.controller.track.removeTrack(validatedCommand.trackId);
        this.controller.editor.reset();
        return;

      case AudioCommandType.PLAY:
        await this.controller.playback.handlePlay();
        return;

      case AudioCommandType.PAUSE:
        this.controller.playback.handlePause();
        return;

      case AudioCommandType.STOP:
        this.controller.playback.handleStop();
        return;

      case AudioCommandType.SET_AUDIO_INPUT_DEVICE:
        await this.controller.loop.setInputDevice(validatedCommand.deviceId);
        return;

      case AudioCommandType.SET_INPUT_MONITORING:
        await this.controller.loop.setMonitoring(validatedCommand);
        return;

      case AudioCommandType.SET_TRACK_RECORD_ARM:
        this.controller.recording.setTrackRecordArm(validatedCommand);
        return;

      case AudioCommandType.START_RECORDING:
        await this.controller.recording.startRecording(validatedCommand);
        return;

      case AudioCommandType.STOP_RECORDING:
        return this.controller.recording.stopRecording();

      case AudioCommandType.CANCEL_RECORDING:
        this.controller.recording.cancelRecording();
        return;

      case AudioCommandType.ARM_LOOP_SLOT:
        await this.controller.loop.arm(validatedCommand);
        return;

      case AudioCommandType.ARM_LOOP_OVERDUB:
        await this.controller.loop.overdub(validatedCommand);
        return;

      case AudioCommandType.CANCEL_LOOP_SLOT:
        this.controller.loop.cancel(validatedCommand);
        return;

      case AudioCommandType.TRIGGER_LOOP_SLOT:
        await this.controller.loop.trigger(validatedCommand);
        return;

      case AudioCommandType.STOP_LOOP_SLOT:
        this.controller.loop.stop(validatedCommand);
        return;

      case AudioCommandType.CLEAR_LOOP_SLOT:
        await this.controller.loop.clear(validatedCommand);
        return;

      case AudioCommandType.STOP_ALL_LOOPS:
        this.controller.loop.stopAll();
        return;

      case AudioCommandType.SET_TEMPO:
        this.controller.playback.handleSetTempo(validatedCommand.tempo);
        return;

      case AudioCommandType.SET_TIMELINE_MAP:
        this.controller.playback.handleSetTimelineMap(validatedCommand);
        return;

      case AudioCommandType.SET_TIMELINE_MARKERS:
        this.controller.timeline.setMarkers(validatedCommand.markers);
        return;

      case AudioCommandType.SET_LOOP_RANGE:
        this.controller.playback.handleSetLoopRange(
          {
            endTimeSeconds: validatedCommand.endTimeSeconds,
            startTimeSeconds: validatedCommand.startTimeSeconds,
          },
          validatedCommand.isEnabled
        );
        return;

      case AudioCommandType.CLEAR_LOOP_RANGE:
        this.controller.playback.handleSetLoopRange(null);
        return;

      case AudioCommandType.SET_LOOP_ENABLED:
        this.controller.playback.handleSetLoopEnabled(validatedCommand.isEnabled);
        return;

      case AudioCommandType.SET_METRONOME:
        this.controller.playback.handleSetMetronome(validatedCommand);
        return;

      case AudioCommandType.SET_MASTER_VOLUME:
        this.controller.mixer.setMasterVolume(validatedCommand.volume);
        return;

      case AudioCommandType.SET_TRACK_NAME:
        this.controller.track.setName(validatedCommand.trackId, validatedCommand.name);
        return;

      case AudioCommandType.SET_CURRENT_TIME:
        this.controller.playback.handleSeek(validatedCommand.time);
        return;

      case AudioCommandType.SET_TRACK_VOLUME:
        this.controller.track.setVolume(
          this.resolveTrackId(session, validatedCommand.trackId),
          validatedCommand.volume
        );
        return;

      case AudioCommandType.SET_TRACK_PAN:
        this.controller.track.setPan(this.resolveTrackId(session, validatedCommand.trackId), validatedCommand.pan);
        return;

      case AudioCommandType.SET_TRACK_MUTE:
        this.controller.track.setMute(validatedCommand.trackId, validatedCommand.muted);
        return;

      case AudioCommandType.SET_TRACK_SOLO:
        this.controller.track.setSolo(validatedCommand.trackId, validatedCommand.soloed);
        return;

      case AudioCommandType.INSTALL_PLUGIN:
        this.controller.plugin.installPlugin({
          trackId: validatedCommand.trackId,
          instanceId: validatedCommand.instanceId ?? crypto.randomUUID(),
          manifestId: validatedCommand.manifestId,
          isEnabled: validatedCommand.isEnabled,
          targetIndex: validatedCommand.targetIndex,
          parameterValues: validatedCommand.parameterValues ?? {},
        });
        return;

      case AudioCommandType.REMOVE_PLUGIN:
        this.controller.plugin.removePlugin(validatedCommand);
        return;

      case AudioCommandType.MOVE_PLUGIN:
        this.controller.plugin.movePlugin(validatedCommand);
        return;

      case AudioCommandType.SET_PLUGIN_ENABLED:
        this.controller.plugin.setPluginEnabled(validatedCommand);
        return;

      case AudioCommandType.SET_PLUGIN_PARAMETER:
        this.controller.plugin.setPluginParameter(validatedCommand);
        return;

      case AudioCommandType.LOAD_REGION: {
        const source = validatedCommand.sourceId ? { sourceId: validatedCommand.sourceId } : {};

        // Track 선택과 검증은 pending Source 수명까지 관리하는 Controller가 맡는다.
        await this.controller.region.addRegion(validatedCommand.trackId, {
          id: validatedCommand.regionId ?? crypto.randomUUID(),
          ...source,
          startTime: validatedCommand.startTime,
          sourceStartTime: validatedCommand.startOffset ?? 0,
          duration: validatedCommand.duration,
        });
        return;
      }

      case AudioCommandType.UNLOAD_REGION: {
        const trackId = this.resolveTrackId(session, validatedCommand.trackId);
        const regionId = validatedCommand.regionId ?? this.getFirstRegionId(session, trackId);
        this.controller.region.removeRegion(trackId, regionId);
        this.controller.editor.removeMissingSelections();
        return;
      }

      case AudioCommandType.SPLIT_REGION:
        await this.controller.region.splitRegionById({
          trackId: validatedCommand.trackId,
          regionId: validatedCommand.regionId,
          splitTime: validatedCommand.splitTime,
        });
        this.controller.editor.removeMissingSelections();
        return;

      case AudioCommandType.MOVE_REGION:
        this.controller.region.moveRegion({
          trackId: validatedCommand.trackId,
          regionId: validatedCommand.regionId,
          newStartTime: validatedCommand.newStartTime,
        });
        return;

      case AudioCommandType.SET_EDITOR_SELECTION:
        this.controller.editor.setSelection(validatedCommand);
        return;

      case AudioCommandType.COPY_SELECTED_REGIONS:
        this.controller.editor.copySelectedRegions();
        return;

      case AudioCommandType.CUT_SELECTED_REGIONS:
        await this.controller.editor.cutSelectedRegions();
        return;

      case AudioCommandType.PASTE_REGIONS:
        await this.controller.editor.pasteRegions();
        return;

      case AudioCommandType.DUPLICATE_SELECTED_REGIONS:
        await this.controller.editor.duplicateSelectedRegions(validatedCommand.offsetSeconds);
        return;

      case AudioCommandType.NUDGE_SELECTED_REGIONS:
        await this.controller.editor.nudgeSelectedRegions(validatedCommand.deltaSeconds);
        return;

      case AudioCommandType.ALIGN_SELECTED_REGIONS:
        await this.controller.editor.alignSelectedRegions(validatedCommand);
        return;

      case AudioCommandType.TRIM_REGION:
        await this.controller.editor.trimRegion(validatedCommand);
        return;

      case AudioCommandType.SLIP_REGION:
        await this.controller.editor.slipRegion(validatedCommand);
        return;

      case AudioCommandType.SET_REGION_PROCESSING:
        await this.controller.editor.setRegionProcessing(validatedCommand);
        return;

      case AudioCommandType.CREATE_REGION_CROSSFADE:
        await this.controller.editor.createRegionCrossfade(validatedCommand);
        return;

      case AudioCommandType.REMOVE_REGION_CROSSFADE:
        await this.controller.editor.removeRegionCrossfade(validatedCommand);
        return;

      case AudioCommandType.NORMALIZE_SELECTED_REGIONS:
        await this.controller.regionProcessing.normalizeSelectedRegions(validatedCommand.targetPeak);
        return;

      case AudioCommandType.REVERSE_SELECTED_REGIONS:
        await this.controller.regionProcessing.reverseSelectedRegions();
        return;

      case AudioCommandType.STRIP_SILENCE_SELECTED_REGIONS:
        await this.controller.regionProcessing.stripSilenceFromSelectedRegions(validatedCommand);
        return;

      case AudioCommandType.SET_EXPORT_RANGE:
        this.controller.export.setExportRange(validatedCommand.startTime, validatedCommand.endTime);
        return;

      case AudioCommandType.CLEAR_EXPORT_RANGE:
        this.controller.export.setExportRange(null, null);
        return;

      case AudioCommandType.EXPORT_AUDIO:
        return this.controller.export.exportProject();

      case AudioCommandType.SAVE_PROJECT:
        await this.controller.project.saveProject();
        return;

      case AudioCommandType.LOAD_PROJECT:
        await this.controller.project.loadProject(validatedCommand.projectId);
        this.controller.editor.reset();
        return;
    }

    return throwUnsupportedCommand(validatedCommand);
  }

  private prepareCommandForExecution(command: AudioCommand, session: SessionState): AudioCommand {
    switch (command.type) {
      case AudioCommandType.LOAD_REGION:
        return command.regionId ? command : { ...command, regionId: crypto.randomUUID() };

      case AudioCommandType.INSTALL_PLUGIN:
        return command.instanceId ? command : { ...command, instanceId: crypto.randomUUID() };

      case AudioCommandType.SET_TRACK_VOLUME:
        return { ...command, trackId: this.resolveTrackId(session, command.trackId) };

      case AudioCommandType.SET_TRACK_PAN:
        return { ...command, trackId: this.resolveTrackId(session, command.trackId) };

      case AudioCommandType.UNLOAD_REGION: {
        const trackId = this.resolveTrackId(session, command.trackId);
        return { ...command, trackId, regionId: command.regionId ?? this.getFirstRegionId(session, trackId) };
      }

      default:
        return command;
    }
  }

  private isHistoryBoundary(command: AudioCommand): boolean {
    return (
      command.type === AudioCommandType.REMOVE_TRACK ||
      command.type === AudioCommandType.SPLIT_REGION ||
      command.type === AudioCommandType.LOAD_PROJECT
    );
  }

  private enqueue<Result>(operation: () => Promise<Result>): Promise<Result> {
    const execution = this.executionTail.then(operation);
    this.executionTail = execution.then(
      () => undefined,
      () => undefined
    );
    return execution;
  }

  private resolveTrackId(session: SessionState, requestedTrackId?: string): string {
    if (requestedTrackId) {
      this.getTrack(session, requestedTrackId);
      return requestedTrackId;
    }

    const firstTrack = session.tracks.values().next().value;
    if (!firstTrack) {
      throw new Error('No tracks available. Please add an audio file first.');
    }
    return firstTrack.id;
  }

  private getFirstRegionId(session: SessionState, trackId: string): string {
    const track = this.getTrack(session, trackId);
    const firstRegion = track.regions[0];
    if (!firstRegion) {
      throw new Error(`No regions available in track ${trackId}. Please add a region first.`);
    }
    return firstRegion.id;
  }

  private getTrack(session: SessionState, trackId: string) {
    const track = session.tracks.get(trackId);
    if (!track) {
      throw new Error(`Track not found: ${trackId}`);
    }
    return track;
  }
}

function shouldPersistProjectAfterCommand(command: AudioCommand): boolean {
  switch (command.type) {
    case AudioCommandType.UNDO:
    case AudioCommandType.REDO:
    case AudioCommandType.ADD_TRACK:
    case AudioCommandType.REMOVE_TRACK:
    case AudioCommandType.ARM_LOOP_SLOT:
    case AudioCommandType.ARM_LOOP_OVERDUB:
    case AudioCommandType.CLEAR_LOOP_SLOT:
    case AudioCommandType.SET_TEMPO:
    case AudioCommandType.SET_TIMELINE_MAP:
    case AudioCommandType.SET_TIMELINE_MARKERS:
    case AudioCommandType.SET_LOOP_RANGE:
    case AudioCommandType.CLEAR_LOOP_RANGE:
    case AudioCommandType.SET_LOOP_ENABLED:
    case AudioCommandType.SET_METRONOME:
    case AudioCommandType.SET_MASTER_VOLUME:
    case AudioCommandType.SET_TRACK_NAME:
    case AudioCommandType.SET_TRACK_VOLUME:
    case AudioCommandType.SET_TRACK_PAN:
    case AudioCommandType.SET_TRACK_MUTE:
    case AudioCommandType.SET_TRACK_SOLO:
    case AudioCommandType.INSTALL_PLUGIN:
    case AudioCommandType.REMOVE_PLUGIN:
    case AudioCommandType.MOVE_PLUGIN:
    case AudioCommandType.SET_PLUGIN_ENABLED:
    case AudioCommandType.SET_PLUGIN_PARAMETER:
    case AudioCommandType.LOAD_REGION:
    case AudioCommandType.UNLOAD_REGION:
    case AudioCommandType.SPLIT_REGION:
    case AudioCommandType.MOVE_REGION:
    case AudioCommandType.CUT_SELECTED_REGIONS:
    case AudioCommandType.PASTE_REGIONS:
    case AudioCommandType.DUPLICATE_SELECTED_REGIONS:
    case AudioCommandType.NUDGE_SELECTED_REGIONS:
    case AudioCommandType.ALIGN_SELECTED_REGIONS:
    case AudioCommandType.TRIM_REGION:
    case AudioCommandType.SLIP_REGION:
    case AudioCommandType.SET_REGION_PROCESSING:
    case AudioCommandType.CREATE_REGION_CROSSFADE:
    case AudioCommandType.REMOVE_REGION_CROSSFADE:
    case AudioCommandType.NORMALIZE_SELECTED_REGIONS:
    case AudioCommandType.REVERSE_SELECTED_REGIONS:
    case AudioCommandType.STRIP_SILENCE_SELECTED_REGIONS:
    case AudioCommandType.SET_EXPORT_RANGE:
    case AudioCommandType.CLEAR_EXPORT_RANGE:
    case AudioCommandType.STOP_RECORDING:
      return true;

    case AudioCommandType.PLAY:
    case AudioCommandType.PAUSE:
    case AudioCommandType.STOP:
    case AudioCommandType.SET_AUDIO_INPUT_DEVICE:
    case AudioCommandType.SET_INPUT_MONITORING:
    case AudioCommandType.SET_TRACK_RECORD_ARM:
    case AudioCommandType.START_RECORDING:
    case AudioCommandType.CANCEL_RECORDING:
    case AudioCommandType.CANCEL_LOOP_SLOT:
    case AudioCommandType.TRIGGER_LOOP_SLOT:
    case AudioCommandType.STOP_LOOP_SLOT:
    case AudioCommandType.STOP_ALL_LOOPS:
    case AudioCommandType.SET_CURRENT_TIME:
    case AudioCommandType.SET_EDITOR_SELECTION:
    case AudioCommandType.COPY_SELECTED_REGIONS:
    case AudioCommandType.EXPORT_AUDIO:
    case AudioCommandType.SAVE_PROJECT:
    case AudioCommandType.LOAD_PROJECT:
      return false;
  }
}
