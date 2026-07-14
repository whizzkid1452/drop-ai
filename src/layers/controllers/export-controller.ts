import {
  DEFAULT_EXPORT_SAMPLE_RATE,
  type ExportRange,
  type ExportRequest,
  type IAudioEngine,
} from '../audio-engine/i-audio-engine';
import { AudioEngineError, AudioEngineErrorCode, ERROR_MESSAGES } from '../audio-engine/errors';
import { type SessionStore } from '../session/session';

export class ExportController {
  constructor(
    private sessionStore: SessionStore,
    private audioEngine: IAudioEngine
  ) {}

  setExportRange(startTime: number | null, endTime: number | null): void {
    console.log(`[ExportController] Setting export range: ${startTime} - ${endTime}`);

    this.sessionStore.getState().setExportRange(startTime, endTime);
  }

  async exportProject(): Promise<Blob> {
    console.log('[ExportController] Exporting entire project');

    return this.audioEngine.exportProject(this.createExportRequest(this.resolveExportRange()));
  }

  async exportRange(startTime: number, endTime: number): Promise<Blob> {
    console.log(`[ExportController] Exporting range: ${startTime} - ${endTime}`);

    return this.audioEngine.exportProject(this.createExportRequest({ startTime, endTime }));
  }

  private createExportRequest(range: ExportRange): ExportRequest {
    const session = this.sessionStore.getState();
    const tracks = Array.from(session.tracks.values()).map(track => ({
      id: track.id,
      volume: track.volume,
      pan: track.pan,
      isMuted: track.isMuted,
      isSoloed: track.isSoloed,
      regions: track.regions.flatMap(region =>
        region.audioFileUrl && region.duration > 0
          ? [
              {
                id: region.id,
                url: region.audioFileUrl,
                startTime: region.startTime,
                sourceStartTime: region.sourceStartTime,
                duration: region.duration,
              },
            ]
          : []
      ),
    }));

    if (tracks.length === 0 || tracks.every(track => track.regions.length === 0)) {
      throw new AudioEngineError(AudioEngineErrorCode.EXPORT_NO_TRACKS, ERROR_MESSAGES.EXPORT_NO_TRACKS);
    }
    if (range.startTime < 0 || range.endTime <= range.startTime) {
      throw new AudioEngineError(AudioEngineErrorCode.EXPORT_ZERO_DURATION, ERROR_MESSAGES.EXPORT_ZERO_DURATION);
    }

    return {
      tracks,
      masterVolume: session.masterVolume,
      range,
      sampleRate: DEFAULT_EXPORT_SAMPLE_RATE,
    };
  }

  private getProjectEndTime(): number {
    const endTimes = Array.from(this.sessionStore.getState().tracks.values()).flatMap(track =>
      track.regions.map(region => region.endTime)
    );
    return Math.max(0, ...endTimes);
  }

  private resolveExportRange(): ExportRange {
    const { exportStartTime, exportEndTime } = this.sessionStore.getState();
    if (exportStartTime !== null && exportEndTime !== null) {
      return { startTime: exportStartTime, endTime: exportEndTime };
    }
    return { startTime: 0, endTime: this.getProjectEndTime() };
  }
}
