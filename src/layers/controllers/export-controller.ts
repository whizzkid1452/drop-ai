import {
  DEFAULT_EXPORT_SAMPLE_RATE,
  type ExportRange,
  type ExportRegion,
  type ExportRequest,
  type IAudioEngine,
  type StartRenderJobRequest,
} from '../audio-engine/i-audio-engine';
import { AudioEngineError, AudioEngineErrorCode, ERROR_MESSAGES } from '../audio-engine/errors';
import type { IAudioSourceResolver } from '../audio-source-registry/i-audio-source-registry';
import { type RegionState, type SessionStore } from '../session/session';
import { ValidatedProjectExportSettingsSchema } from '../shared/types/project-document.schema';
import type { ProjectExportState } from '../shared/types/export-state';
import type { RenderJobResult, RenderJobState, RenderJobStateListener } from '../shared/types/render-job';
import { ProjectStateError, ProjectStateErrorCode } from './project-state-error';

interface ExportControllerDependencies {
  sessionStore: SessionStore;
  audioEngine: IAudioEngine;
  audioSourceResolver: IAudioSourceResolver;
}

interface StoredExportRange {
  readonly startTime: number | null;
  readonly endTime: number | null;
}

export class ExportController {
  private readonly sessionStore: SessionStore;
  private readonly audioEngine: IAudioEngine;
  private readonly audioSourceResolver: IAudioSourceResolver;

  constructor({ sessionStore, audioEngine, audioSourceResolver }: ExportControllerDependencies) {
    this.sessionStore = sessionStore;
    this.audioEngine = audioEngine;
    this.audioSourceResolver = audioSourceResolver;
  }

  setExportRange(startTime: number | null, endTime: number | null): void {
    console.log(`[ExportController] Setting export range: ${startTime} - ${endTime}`);

    if (!this.isValidStoredExportRange({ startTime, endTime })) {
      throw new ProjectStateError(
        ProjectStateErrorCode.INVALID_EXPORT_RANGE,
        'Export 범위는 함께 비우거나 0 <= 시작 <= 끝 조건을 만족해야 합니다.',
        { startTime, endTime }
      );
    }

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

  setExportSettings(settings: ProjectExportState): void {
    const validatedSettings = ValidatedProjectExportSettingsSchema.parse(settings);
    this.sessionStore.getState().setExportSettings(validatedSettings);
  }

  async startRenderJob(): Promise<RenderJobResult> {
    const request = this.createRenderJobRequest();
    return this.audioEngine.startRenderJob(request);
  }

  cancelRenderJob(jobId: string): void {
    this.audioEngine.cancelRenderJob(jobId);
  }

  getRenderJobState(): RenderJobState {
    return this.audioEngine.getRenderJobState();
  }

  subscribeRenderJobState(listener: RenderJobStateListener): () => void {
    return this.audioEngine.subscribeRenderJobState(listener);
  }

  private createExportRequest(range: ExportRange): ExportRequest {
    const session = this.sessionStore.getState();
    const tracks = this.createExportTracks();

    this.assertExportable(tracks, range);

    return {
      tracks,
      masterVolume: session.masterVolume,
      range,
      routingGraph: session.routingGraph,
      sampleRate: DEFAULT_EXPORT_SAMPLE_RATE,
    };
  }

  private createExportTracks() {
    return Array.from(this.sessionStore.getState().tracks.values()).map(track => ({
      id: track.id,
      volume: track.volume,
      pan: track.pan,
      isMuted: track.isMuted,
      isSoloed: track.isSoloed,
      pluginInstances: track.pluginInstances.map(instance => ({
        instanceId: instance.id,
        manifestId: instance.manifestSummary.id,
        isEnabled: instance.isEnabled,
        parameterValues: new Map(instance.parameters.map(parameter => [parameter.id, parameter.value])),
      })),
      automationLanes: (track.automationLanes ?? []).map(lane => ({
        ...lane,
        points: lane.points.map(point => ({ ...point })),
        target: { ...lane.target },
      })),
      regions: track.regions.flatMap(region => {
        const url = this.resolveRegionSourceUrl(region);
        return region.duration <= 0 ? [] : [this.createExportRegion(region, url)];
      }),
    }));
  }

  private assertExportable(tracks: ReturnType<ExportController['createExportTracks']>, range: ExportRange): void {
    if (tracks.length === 0 || tracks.every(track => track.regions.length === 0)) {
      throw new AudioEngineError(AudioEngineErrorCode.EXPORT_NO_TRACKS, ERROR_MESSAGES.EXPORT_NO_TRACKS);
    }
    if (range.startTime < 0 || range.endTime <= range.startTime) {
      throw new AudioEngineError(AudioEngineErrorCode.EXPORT_ZERO_DURATION, ERROR_MESSAGES.EXPORT_ZERO_DURATION);
    }
  }

  private createRenderJobRequest(): StartRenderJobRequest {
    const session = this.sessionStore.getState();
    const tracks = this.createExportTracks();
    const preset = session.exportSettings.presets.find(
      candidate => candidate.id === session.exportSettings.activePresetId
    );
    if (!preset) {
      throw new ProjectStateError(ProjectStateErrorCode.INVALID_EXPORT_RANGE, '활성 Export preset을 찾을 수 없습니다.');
    }
    const ranges =
      session.exportSettings.ranges.length > 0
        ? session.exportSettings.ranges
        : [
            {
              endTimeSeconds: this.resolveExportRange().endTime,
              id: crypto.randomUUID(),
              name: 'Mix',
              startTimeSeconds: this.resolveExportRange().startTime,
            },
          ];
    ranges.forEach(range =>
      this.assertExportable(tracks, { endTime: range.endTimeSeconds, startTime: range.startTimeSeconds })
    );
    return {
      jobId: crypto.randomUUID(),
      masterVolume: session.masterVolume,
      preset,
      ranges,
      routingGraph: session.routingGraph,
      tracks,
    };
  }

  private isValidStoredExportRange({ startTime, endTime }: StoredExportRange): boolean {
    if (startTime === null || endTime === null) {
      return startTime === null && endTime === null;
    }

    return Number.isFinite(startTime) && Number.isFinite(endTime) && startTime >= 0 && endTime >= startTime;
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

  private resolveRegionSourceUrl(region: RegionState): string {
    const source = this.audioSourceResolver.resolve(region.sourceId);
    if (source?.regionIds.includes(region.id)) {
      return source.objectUrl;
    }

    throw new ProjectStateError(
      ProjectStateErrorCode.REGION_SOURCE_MISSING,
      `Export할 Region의 Source 연결을 찾을 수 없습니다: ${region.id}`,
      { regionId: region.id, sourceId: region.sourceId }
    );
  }

  private createExportRegion(region: RegionState, url: string): ExportRegion {
    return {
      fadeIn: { ...region.fadeIn },
      fadeOut: { ...region.fadeOut },
      gain: region.gain,
      id: region.id,
      isOpaque: region.isOpaque,
      layer: region.layer,
      url,
      startTime: region.startTime,
      sourceStartTime: region.sourceStartTime,
      duration: region.duration,
    };
  }
}
