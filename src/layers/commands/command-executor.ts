import type { AppController } from '../controllers/app-controller';
import type { SessionState, SessionStore } from '../session/session';
import { AudioCommandSchema, AudioCommandType, type AudioCommand } from '../shared/types/audioCommand.schema';

export type CommandExecutionResult = Blob | void;

export class CommandExecutor {
  constructor(
    private readonly sessionStore: SessionStore,
    private readonly controller: AppController
  ) {}

  async execute(command: AudioCommand): Promise<CommandExecutionResult> {
    const validatedCommand = AudioCommandSchema.parse(command);
    // 연속 명령에서 앞 명령의 변경 상태를 다음 명령이 사용하도록 실행 직전에 Session을 읽는다.
    const session = this.sessionStore.getState();

    switch (validatedCommand.type) {
      case AudioCommandType.ADD_TRACK:
        await this.controller.track.addTrack(validatedCommand.url, validatedCommand.trackId);
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

      case AudioCommandType.LOAD_REGION: {
        const trackId = this.resolveTrackId(session, validatedCommand.trackId);
        const url = validatedCommand.url ?? this.getFirstRegionUrl(session, trackId);

        await this.controller.region.addRegion(trackId, {
          id: validatedCommand.regionId ?? crypto.randomUUID(),
          url,
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

      case AudioCommandType.SET_EXPORT_RANGE:
        this.controller.export.setExportRange(validatedCommand.startTime, validatedCommand.endTime);
        return;

      case AudioCommandType.CLEAR_EXPORT_RANGE:
        this.controller.export.setExportRange(null, null);
        return;

      case AudioCommandType.EXPORT_AUDIO:
        return this.controller.export.exportProject();
    }

    throw new Error(`Unsupported audio command: ${validatedCommand.type}`);
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

  private getFirstRegionUrl(session: SessionState, trackId: string): string {
    const track = this.getTrack(session, trackId);
    const firstRegionUrl = track.regions[0]?.audioFileUrl;
    if (!firstRegionUrl) {
      throw new Error(`No URL available in track ${trackId}. Please add a region first.`);
    }
    return firstRegionUrl;
  }

  private getTrack(session: SessionState, trackId: string) {
    const track = session.tracks.get(trackId);
    if (!track) {
      throw new Error(`Track not found: ${trackId}`);
    }
    return track;
  }
}
