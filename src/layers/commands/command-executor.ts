import type { AppController } from '../controllers/app-controller';
import type { SessionState, SessionStore } from '../session/session';
import {
  AudioCommandBatchSchema,
  AudioCommandSchema,
  AudioCommandType,
  type AudioCommand,
} from '../shared/types/audioCommand.schema';

export type CommandExecutionResult = Blob | void;
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
    private readonly controller: AppController
  ) {}

  async execute(command: AudioCommand): Promise<CommandExecutionResult> {
    const validatedCommand = AudioCommandSchema.parse(command);
    return this.enqueue(() => this.executeValidated(validatedCommand));
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
        completedResults.push(await this.executeValidated(failedCommand));
      } catch (cause) {
        throw new CommandBatchExecutionError({ failedIndex, failedCommand, completedResults, cause });
      }
    }

    return completedResults;
  }

  private async executeValidated(validatedCommand: AudioCommand): Promise<CommandExecutionResult> {
    // 연속 명령에서 앞 명령의 변경 상태를 다음 명령이 사용하도록 실행 직전에 Session을 읽는다.
    const session = this.sessionStore.getState();

    switch (validatedCommand.type) {
      case AudioCommandType.ADD_TRACK:
        await this.controller.track.addTrack(validatedCommand.trackId);
        return;

      case AudioCommandType.REMOVE_TRACK:
        this.controller.track.removeTrack(validatedCommand.trackId);
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

      case AudioCommandType.SET_TEMPO:
        this.controller.playback.handleSetTempo(validatedCommand.tempo);
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
        return;
      }

      case AudioCommandType.SPLIT_REGION:
        await this.controller.region.splitRegionById({
          trackId: validatedCommand.trackId,
          regionId: validatedCommand.regionId,
          splitTime: validatedCommand.splitTime,
        });
        return;

      case AudioCommandType.MOVE_REGION:
        this.controller.region.moveRegion({
          trackId: validatedCommand.trackId,
          regionId: validatedCommand.regionId,
          newStartTime: validatedCommand.newStartTime,
        });
        return;

      case AudioCommandType.SET_EXPORT_RANGE:
        this.controller.export.setExportRange(validatedCommand.startTime, validatedCommand.endTime);
        return;

      case AudioCommandType.CLEAR_EXPORT_RANGE:
        this.controller.export.setExportRange(null, null);
        return;

      case AudioCommandType.EXPORT_AUDIO:
        return this.controller.export.exportProject();
    }

    return throwUnsupportedCommand(validatedCommand);
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
