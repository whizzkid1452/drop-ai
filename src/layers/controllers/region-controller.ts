import type { IAudioEngine, RegionData } from '../audio-engine/i-audio-engine';
import type { IAudioSourceRegistry, RuntimeAudioSource } from '../audio-source-registry/i-audio-source-registry';
import type { RegionState, SessionStore, TrackState } from '../session/session';
import { isRegionSourceRangeWithinDuration } from '../shared/audio-source-range';
import { ProjectMutationCompensationError } from './project-mutation-compensation-error';
import { ProjectStateError, ProjectStateErrorCode } from './project-state-error';
import { calculateSplitRegions } from './utils/split-region';

interface RegionPlacementFields {
  id: string;
  startTime: number;
  sourceStartTime: number;
  duration?: number;
}

interface RegionSourceSelection {
  sourceId?: string;
}

export type AddRegionData = RegionPlacementFields & RegionSourceSelection;

interface PreparedRegionSource {
  sourceId: string;
  url: string;
  wasCommitted: boolean;
  duration: number;
}

interface SplitRegionByIdOptions {
  trackId: string;
  regionId: string;
  splitTime: number;
}

interface MoveRegionOptions {
  trackId: string;
  regionId: string;
  newStartTime: number;
}

interface RegionControllerDependencies {
  sessionStore: SessionStore;
  audioEngine: IAudioEngine;
  audioSourceRegistry: IAudioSourceRegistry;
}

export class RegionController {
  private readonly sessionStore: SessionStore;
  private readonly audioEngine: IAudioEngine;
  private readonly audioSourceRegistry: IAudioSourceRegistry;

  constructor({ sessionStore, audioEngine, audioSourceRegistry }: RegionControllerDependencies) {
    this.sessionStore = sessionStore;
    this.audioEngine = audioEngine;
    this.audioSourceRegistry = audioSourceRegistry;
  }

  async addRegion(requestedTrackId: string | undefined, regionData: AddRegionData): Promise<void> {
    console.log(`[RegionController] Adding region to track: ${String(requestedTrackId)}`, regionData);

    let track: TrackState;
    try {
      track = this.resolveAddRegionTrack(requestedTrackId);
      this.throwIfRegionExists(track, regionData.id);
    } catch (cause) {
      this.cleanupExplicitPendingSourceAfterPreflightFailure({ regionData, cause });
      throw cause;
    }

    const trackId = track.id;
    const source = this.prepareAddSource(track, regionData);
    this.attachAddedSource({ source, regionId: regionData.id });

    let isEngineRegionAdded = false;
    try {
      await this.audioEngine.addRegion(trackId, this.toEngineRegionData(regionData, source));
      isEngineRegionAdded = true;

      const latestTrack = this.getTrackOrThrow(trackId);
      this.throwIfRegionExists(latestTrack, regionData.id);
      const newRegion = this.createSessionRegion(regionData, source);
      this.sessionStore.getState().updateTrack(trackId, { regions: [...latestTrack.regions, newRegion] });
    } catch (cause) {
      if (isEngineRegionAdded) {
        try {
          this.audioEngine.removeRegion(trackId, regionData.id);
        } catch (compensationCause) {
          throw new ProjectMutationCompensationError({
            operation: 'add-region',
            failedPhase: 'AudioEngine 추가 취소',
            cause,
            compensationFailures: [{ step: 'AudioEngine Region 제거', cause: compensationCause }],
          });
        }
      }

      this.rollbackAddedSource({ source, regionId: regionData.id, cause });
      throw cause;
    }
  }

  removeRegion(trackId: string, regionId: string): void {
    console.log(`[RegionController] Removing region ${regionId} from track ${trackId}`);

    const track = this.getTrackOrThrow(trackId);
    const region = this.getRegionOrThrow(track, regionId);
    const attachment = { sourceId: region.sourceId, regionId: region.id };
    this.assertRegisteredSource({ sourceId: attachment.sourceId, regionId: attachment.regionId });
    this.audioSourceRegistry.detach(attachment);

    try {
      this.audioEngine.removeRegion(trackId, regionId);
    } catch (cause) {
      try {
        this.audioSourceRegistry.attach(attachment);
      } catch (compensationCause) {
        throw new ProjectMutationCompensationError({
          operation: 'remove-region',
          failedPhase: 'Source 연결 복원',
          cause,
          compensationFailures: [{ step: `Source 연결 복원: ${regionId}`, cause: compensationCause }],
        });
      }
      throw cause;
    }

    this.sessionStore.getState().updateTrack(trackId, {
      regions: track.regions.filter(region => region.id !== regionId),
    });
  }

  async splitRegion(trackId: string, splitTime: number): Promise<void> {
    console.log(`[RegionController] Splitting region at ${splitTime} on track ${trackId}`);

    const track = this.getTrackOrThrow(trackId);
    const [regionToSplit, ...additionalRegions] = track.regions.filter(
      region => splitTime > region.startTime && splitTime < region.endTime
    );
    if (!regionToSplit) {
      throw new ProjectStateError(
        ProjectStateErrorCode.INVALID_SPLIT_POSITION,
        `분할할 수 없는 위치입니다: ${splitTime}`,
        { trackId, splitTime }
      );
    }
    if (additionalRegions.length > 0) {
      throw new ProjectStateError(
        ProjectStateErrorCode.AMBIGUOUS_REGION_TARGET,
        '겹친 Region은 Region ID를 지정해서 분할해야 합니다.',
        {
          trackId,
          splitTime,
          regionIds: [regionToSplit, ...additionalRegions].map(region => region.id),
        }
      );
    }

    await this.splitRegionById({ trackId, regionId: regionToSplit.id, splitTime });
  }

  async splitRegionById({ trackId, regionId, splitTime }: SplitRegionByIdOptions): Promise<void> {
    const track = this.getTrackOrThrow(trackId);
    const regionToSplit = this.getRegionOrThrow(track, regionId);

    if (splitTime <= regionToSplit.startTime || splitTime >= regionToSplit.endTime) {
      throw new ProjectStateError(
        ProjectStateErrorCode.INVALID_SPLIT_POSITION,
        `Region 내부에서만 분할할 수 있습니다: ${splitTime}`,
        { trackId, regionId, splitTime }
      );
    }

    const sourceUrl = this.resolveRegionSourceUrl(regionToSplit);

    const splitRegions = calculateSplitRegions({ region: regionToSplit, splitTime });
    if (!splitRegions) {
      throw new ProjectStateError(
        ProjectStateErrorCode.INVALID_SPLIT_POSITION,
        `Region 내부에서만 분할할 수 있습니다: ${splitTime}`,
        { trackId, regionId, splitTime }
      );
    }

    const { left: leftRegion, right: rightRegion } = splitRegions;

    this.prepareSplitSourceAttachments({
      sourceId: regionToSplit.sourceId,
      original: regionToSplit,
      leftRegion,
      rightRegion,
    });

    try {
      await this.audioEngine.replaceRegion({
        trackId,
        regionId,
        replacements: [this.toRegionData(leftRegion, sourceUrl), this.toRegionData(rightRegion, sourceUrl)],
      });
    } catch (cause) {
      this.rollbackPreparedSplitSourceAttachments({
        sourceId: regionToSplit.sourceId,
        leftRegion,
        rightRegion,
        cause,
      });
      throw cause;
    }

    let latestTrack: TrackState;
    try {
      latestTrack = this.getTrackOrThrow(trackId);
      this.getRegionOrThrow(latestTrack, regionId);
    } catch (cause) {
      this.rollbackCommittedSplit({
        trackId,
        original: regionToSplit,
        leftRegion,
        rightRegion,
        sourceId: regionToSplit.sourceId,
        cause,
      });
      throw cause;
    }

    try {
      this.assertRegisteredSource({ sourceId: regionToSplit.sourceId, regionId: regionToSplit.id });
      this.audioSourceRegistry.detach({ sourceId: regionToSplit.sourceId, regionId: regionToSplit.id });
    } catch (cause) {
      await this.rollbackSplitToOriginal({
        trackId,
        original: regionToSplit,
        leftRegion,
        rightRegion,
        sourceId: regionToSplit.sourceId,
        sourceUrl,
        cause,
      });
      throw cause;
    }

    const regions = latestTrack.regions.flatMap(region =>
      region.id === regionId ? [leftRegion, rightRegion] : [region]
    );
    this.sessionStore.getState().updateTrack(trackId, { regions });
  }

  moveRegion({ trackId, regionId, newStartTime }: MoveRegionOptions): void {
    console.log(`[RegionController] Moving region ${regionId} to ${newStartTime}`);

    const track = this.getTrackOrThrow(trackId);
    this.getRegionOrThrow(track, regionId);
    if (newStartTime < 0) {
      throw new ProjectStateError(
        ProjectStateErrorCode.INVALID_REGION_POSITION,
        `Region 시작 위치는 0 이상이어야 합니다: ${newStartTime}`,
        { trackId, regionId, newStartTime }
      );
    }
    this.audioEngine.rescheduleRegion({ trackId, regionId, startTime: newStartTime });

    const regions = track.regions.map(region =>
      region.id === regionId ? { ...region, startTime: newStartTime, endTime: newStartTime + region.duration } : region
    );
    this.sessionStore.getState().updateTrack(trackId, { regions });
  }

  private getTrackOrThrow(trackId: string): TrackState {
    const track = this.sessionStore.getState().tracks.get(trackId);
    if (track) {
      return track;
    }

    throw new ProjectStateError(ProjectStateErrorCode.TRACK_NOT_FOUND, `트랙을 찾을 수 없습니다: ${trackId}`, {
      trackId,
    });
  }

  private resolveAddRegionTrack(requestedTrackId?: string): TrackState {
    if (requestedTrackId) {
      return this.getTrackOrThrow(requestedTrackId);
    }

    const firstTrack = this.sessionStore.getState().tracks.values().next().value;
    if (firstTrack) {
      return firstTrack;
    }

    throw new ProjectStateError(ProjectStateErrorCode.TRACK_NOT_FOUND, 'Region을 추가할 Track이 없습니다.');
  }

  private getRegionOrThrow(track: TrackState, regionId: string): RegionState {
    const region = track.regions.find(candidate => candidate.id === regionId);
    if (region) {
      return region;
    }

    throw new ProjectStateError(ProjectStateErrorCode.REGION_NOT_FOUND, `Region을 찾을 수 없습니다: ${regionId}`, {
      trackId: track.id,
      regionId,
    });
  }

  private throwIfRegionExists(track: TrackState, regionId: string): void {
    if (!track.regions.some(region => region.id === regionId)) {
      return;
    }

    throw new ProjectStateError(
      ProjectStateErrorCode.REGION_ID_CONFLICT,
      `이미 사용 중인 Region ID입니다: ${regionId}`,
      { trackId: track.id, regionId }
    );
  }

  private prepareAddSource(track: TrackState, regionData: AddRegionData): PreparedRegionSource {
    if (typeof regionData.sourceId === 'string') {
      return this.prepareRegisteredSource({ sourceId: regionData.sourceId, regionData });
    }

    const firstRegion = track.regions[0];
    if (!firstRegion) {
      throw new ProjectStateError(
        ProjectStateErrorCode.REGION_SOURCE_MISSING,
        `재사용할 Region 소스를 찾을 수 없습니다: ${track.id}`,
        { trackId: track.id }
      );
    }

    return this.prepareRegisteredSource({
      sourceId: firstRegion.sourceId,
      attachedRegionId: firstRegion.id,
      regionData,
    });
  }

  private assertRegisteredSource({ sourceId, regionId }: { sourceId: string; regionId?: string }): RuntimeAudioSource {
    const source = this.audioSourceRegistry.resolve(sourceId);
    if (source && (regionId === undefined || source.regionIds.includes(regionId))) {
      return source;
    }

    throw new ProjectStateError(
      ProjectStateErrorCode.REGION_SOURCE_MISSING,
      `Region의 오디오 Source를 찾을 수 없습니다: ${sourceId}`,
      { regionId, sourceId }
    );
  }

  private createSessionRegion(regionData: RegionPlacementFields, source: PreparedRegionSource): RegionState {
    const commonRegion = {
      id: regionData.id,
      startTime: regionData.startTime,
      endTime: regionData.startTime + source.duration,
      sourceStartTime: regionData.sourceStartTime,
      duration: source.duration,
      status: [],
    };

    return { ...commonRegion, sourceId: source.sourceId };
  }

  private prepareRegisteredSource({
    sourceId,
    attachedRegionId,
    regionData,
  }: {
    sourceId: string;
    attachedRegionId?: string;
    regionData: RegionPlacementFields;
  }): PreparedRegionSource {
    const source = this.assertRegisteredSource({ sourceId, regionId: attachedRegionId });

    try {
      return {
        sourceId,
        url: source.objectUrl,
        wasCommitted: source.isCommitted,
        duration: this.resolveRegisteredRegionDuration({ source, regionData }),
      };
    } catch (cause) {
      this.cleanupPendingSourceAfterPreparationFailure({ source, cause });
      throw cause;
    }
  }

  private resolveRegisteredRegionDuration({
    source,
    regionData,
  }: {
    source: RuntimeAudioSource;
    regionData: RegionPlacementFields;
  }): number {
    const sourceDurationSeconds = source.metadata.durationSeconds;
    if (sourceDurationSeconds === null) {
      if (regionData.duration !== undefined) {
        return regionData.duration;
      }

      throw new ProjectStateError(
        ProjectStateErrorCode.REGION_DURATION_REQUIRED,
        `길이를 알 수 없는 Source에는 Region 길이가 필요합니다: ${source.metadata.id}`,
        { sourceId: source.metadata.id, sourceStartTime: regionData.sourceStartTime }
      );
    }

    const duration = regionData.duration ?? Math.max(0, sourceDurationSeconds - regionData.sourceStartTime);
    if (
      isRegionSourceRangeWithinDuration({
        sourceDurationSeconds,
        sourceStartTimeSeconds: regionData.sourceStartTime,
        regionDurationSeconds: duration,
      })
    ) {
      return duration;
    }

    throw new ProjectStateError(
      ProjectStateErrorCode.REGION_SOURCE_RANGE_EXCEEDED,
      `Region이 Source 길이를 넘습니다: ${source.metadata.id}`,
      {
        duration,
        sourceDurationSeconds,
        sourceId: source.metadata.id,
        sourceStartTime: regionData.sourceStartTime,
      }
    );
  }

  private cleanupPendingSourceAfterPreparationFailure({
    source,
    cause,
  }: {
    source: RuntimeAudioSource;
    cause: unknown;
  }): void {
    if (source.isCommitted) {
      return;
    }

    try {
      this.audioSourceRegistry.discardPending(source.metadata.id);
    } catch (compensationCause) {
      throw new ProjectMutationCompensationError({
        operation: 'add-region',
        failedPhase: 'Source 검증 실패 후 pending Source 정리',
        cause,
        compensationFailures: [{ step: `pending Source 정리: ${source.metadata.id}`, cause: compensationCause }],
      });
    }
  }

  private cleanupExplicitPendingSourceAfterPreflightFailure({
    regionData,
    cause,
  }: {
    regionData: AddRegionData;
    cause: unknown;
  }): void {
    if (typeof regionData.sourceId !== 'string') {
      return;
    }

    try {
      const source = this.audioSourceRegistry.resolve(regionData.sourceId);
      if (!source || source.isCommitted) {
        return;
      }

      this.audioSourceRegistry.discardPending(regionData.sourceId);
    } catch (compensationCause) {
      throw new ProjectMutationCompensationError({
        operation: 'add-region',
        failedPhase: 'Region 추가 사전 검증 후 pending Source 정리',
        cause,
        compensationFailures: [{ step: `pending Source 정리: ${regionData.sourceId}`, cause: compensationCause }],
      });
    }
  }

  private attachAddedSource({ source, regionId }: { source: PreparedRegionSource; regionId: string }): void {
    try {
      this.audioSourceRegistry.attach({ sourceId: source.sourceId, regionId });
    } catch (cause) {
      if (source.wasCommitted) {
        throw cause;
      }

      try {
        this.audioSourceRegistry.discardPending(source.sourceId);
      } catch (compensationCause) {
        throw new ProjectMutationCompensationError({
          operation: 'add-region',
          failedPhase: 'Source 연결 준비',
          cause,
          compensationFailures: [{ step: `pending Source 정리: ${source.sourceId}`, cause: compensationCause }],
        });
      }
      throw cause;
    }
  }

  private toEngineRegionData(regionData: RegionPlacementFields, source: PreparedRegionSource): RegionData {
    return {
      id: regionData.id,
      url: source.url,
      startTime: regionData.startTime,
      sourceStartTime: regionData.sourceStartTime,
      duration: source.duration,
    };
  }

  private rollbackAddedSource({
    source,
    regionId,
    cause,
  }: {
    source: PreparedRegionSource;
    regionId: string;
    cause: unknown;
  }): void {
    const compensationFailures: Array<{ step: string; cause: unknown }> = [];
    let isDetached = false;

    try {
      this.audioSourceRegistry.detach({ sourceId: source.sourceId, regionId });
      isDetached = true;
    } catch (compensationCause) {
      compensationFailures.push({ step: `Source 연결 해제: ${regionId}`, cause: compensationCause });
    }

    if (isDetached && !source.wasCommitted) {
      try {
        this.audioSourceRegistry.purgeUnused(source.sourceId);
      } catch (compensationCause) {
        compensationFailures.push({ step: `pending Source 정리: ${source.sourceId}`, cause: compensationCause });
      }
    }

    if (compensationFailures.length > 0) {
      throw new ProjectMutationCompensationError({
        operation: 'add-region',
        failedPhase: 'Source 연결 취소',
        cause,
        compensationFailures,
      });
    }
  }

  private resolveRegionSourceUrl(region: RegionState): string {
    return this.assertRegisteredSource({ sourceId: region.sourceId, regionId: region.id }).objectUrl;
  }

  private prepareSplitSourceAttachments({
    sourceId,
    original,
    leftRegion,
    rightRegion,
  }: {
    sourceId: string;
    original: RegionState;
    leftRegion: RegionState;
    rightRegion: RegionState;
  }): void {
    this.assertRegisteredSource({ sourceId, regionId: original.id });
    const attachedRegionIds: string[] = [];

    try {
      [leftRegion.id, rightRegion.id].forEach(regionId => {
        this.audioSourceRegistry.attach({ sourceId, regionId });
        attachedRegionIds.push(regionId);
      });
    } catch (cause) {
      const compensationFailures = [...attachedRegionIds].reverse().flatMap(regionId => {
        try {
          this.audioSourceRegistry.detach({ sourceId, regionId });
          return [];
        } catch (compensationCause) {
          return [{ step: `분할 Source 연결 취소: ${regionId}`, cause: compensationCause }];
        }
      });

      if (compensationFailures.length > 0) {
        throw new ProjectMutationCompensationError({
          operation: 'split-region',
          failedPhase: 'Source 연결 준비',
          cause,
          compensationFailures,
        });
      }
      throw cause;
    }
  }

  private rollbackPreparedSplitSourceAttachments({
    sourceId,
    leftRegion,
    rightRegion,
    cause,
  }: {
    sourceId: string;
    leftRegion: RegionState;
    rightRegion: RegionState;
    cause: unknown;
  }): void {
    const compensationFailures: Array<{ step: string; cause: unknown }> = [];

    [rightRegion.id, leftRegion.id].forEach(regionId => {
      try {
        this.audioSourceRegistry.detach({ sourceId, regionId });
      } catch (compensationCause) {
        compensationFailures.push({ step: `분할 Source 연결 해제: ${regionId}`, cause: compensationCause });
      }
    });

    if (compensationFailures.length > 0) {
      throw new ProjectMutationCompensationError({
        operation: 'split-region',
        failedPhase: '분할 Source 준비 취소',
        cause,
        compensationFailures,
      });
    }
  }

  private rollbackCommittedSplit({
    trackId,
    original,
    leftRegion,
    rightRegion,
    sourceId,
    cause,
  }: {
    trackId: string;
    original: RegionState;
    leftRegion: RegionState;
    rightRegion: RegionState;
    sourceId: string;
    cause: unknown;
  }): void {
    const compensationFailures: Array<{ step: string; cause: unknown }> = [];

    [rightRegion, leftRegion].forEach(region => {
      let isEngineRegionRemoved = false;
      try {
        this.audioEngine.removeRegion(trackId, region.id);
        isEngineRegionRemoved = true;
      } catch (compensationCause) {
        compensationFailures.push({ step: `AudioEngine 분할 Region 제거: ${region.id}`, cause: compensationCause });
      }

      if (!isEngineRegionRemoved) {
        return;
      }

      try {
        this.audioSourceRegistry.detach({ sourceId, regionId: region.id });
      } catch (compensationCause) {
        compensationFailures.push({ step: `분할 Source 연결 해제: ${region.id}`, cause: compensationCause });
      }
    });

    const source = this.audioSourceRegistry.resolve(sourceId);
    if (source?.regionIds.includes(original.id)) {
      try {
        this.audioSourceRegistry.detach({ sourceId, regionId: original.id });
      } catch (compensationCause) {
        compensationFailures.push({ step: `기존 Source 연결 해제: ${original.id}`, cause: compensationCause });
      }
    }

    if (compensationFailures.length > 0) {
      throw new ProjectMutationCompensationError({
        operation: 'split-region',
        failedPhase: 'Session 재검증 실패 후 분할 취소',
        cause,
        compensationFailures,
      });
    }
  }

  private async rollbackSplitToOriginal({
    trackId,
    original,
    leftRegion,
    rightRegion,
    sourceId,
    sourceUrl,
    cause,
  }: {
    trackId: string;
    original: RegionState;
    leftRegion: RegionState;
    rightRegion: RegionState;
    sourceId: string;
    sourceUrl: string;
    cause: unknown;
  }): Promise<void> {
    const compensationFailures: Array<{ step: string; cause: unknown }> = [];

    [rightRegion, leftRegion].forEach(region => {
      let isEngineRegionRemoved = false;
      try {
        this.audioEngine.removeRegion(trackId, region.id);
        isEngineRegionRemoved = true;
      } catch (compensationCause) {
        compensationFailures.push({ step: `AudioEngine 분할 Region 제거: ${region.id}`, cause: compensationCause });
      }

      if (!isEngineRegionRemoved) {
        return;
      }

      try {
        this.audioSourceRegistry.detach({ sourceId, regionId: region.id });
      } catch (compensationCause) {
        compensationFailures.push({ step: `분할 Source 연결 해제: ${region.id}`, cause: compensationCause });
      }
    });

    try {
      await this.audioEngine.addRegion(trackId, this.toRegionData(original, sourceUrl));
    } catch (compensationCause) {
      compensationFailures.push({ step: `AudioEngine 기존 Region 복원: ${original.id}`, cause: compensationCause });
    }

    const source = this.audioSourceRegistry.resolve(sourceId);
    if (!source?.regionIds.includes(original.id)) {
      try {
        this.audioSourceRegistry.attach({ sourceId, regionId: original.id });
      } catch (compensationCause) {
        compensationFailures.push({ step: `기존 Source 연결 복원: ${original.id}`, cause: compensationCause });
      }
    }

    if (compensationFailures.length > 0) {
      throw new ProjectMutationCompensationError({
        operation: 'split-region',
        failedPhase: 'Source 전환 실패 후 기존 Region 복원',
        cause,
        compensationFailures,
      });
    }
  }

  private toRegionData(region: RegionState, url: string): RegionData {
    return {
      id: region.id,
      url,
      startTime: region.startTime,
      sourceStartTime: region.sourceStartTime,
      duration: region.duration,
    };
  }
}
