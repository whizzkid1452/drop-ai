import type {
  AudioProjectGraphTrack,
  IAudioEngine,
  IPreparedAudioProjectGraph,
  RegionData,
} from '../audio-engine/i-audio-engine';
import type {
  IAudioSourceRegistry,
  IPreparedAudioSourceRegistryReplacement,
  RuntimeAudioSource,
} from '../audio-source-registry/i-audio-source-registry';
import type { RegionState, SessionStore, TrackState } from '../session/session';
import { calculateFiniteRegionSourceEndTime, isRegionSourceRangeWithinDuration } from '../shared/audio-source-range';
import { calculateFiniteRegionEndTime, isRegionEndTimeConsistent } from '../shared/region-timeline';
import { ProjectMutationCompensationError } from './project-mutation-compensation-error';
import { ProjectStateError, ProjectStateErrorCode } from './project-state-error';
import { calculateSplitRegions } from './utils/split-region';
import type { ReplaceEditorTrackRegionsRequest } from '../shared/types/editor-runtime';
import { createDefaultRegionProcessingState } from '../shared/types/region-processing';
import type { ResourceCleanupResult } from '../shared/types/resource-cleanup';

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

interface PreparedRegionAddition {
  source: PreparedRegionSource;
  endTime: number;
}

interface RegionTimelineFields {
  regionId: string;
  startTime: number;
  duration: number;
}

interface RegionSourceRangeFields {
  id: string;
  sourceStartTime: number;
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
    const preparedRegion = this.prepareAddRegion(track, regionData);
    const { source } = preparedRegion;
    this.attachAddedSource({ source, regionId: regionData.id });

    let isEngineRegionAdded = false;
    let regionPendingPublication: RegionState | null = null;
    try {
      await this.audioEngine.addRegion(trackId, this.toEngineRegionData(regionData, source));
      isEngineRegionAdded = true;

      const latestTrack = this.getTrackOrThrow(trackId);
      this.throwIfRegionExists(latestTrack, regionData.id);
      const newRegion = this.createSessionRegion(regionData, preparedRegion);
      regionPendingPublication = newRegion;
      this.sessionStore.getState().updateTrack(trackId, { regions: [...latestTrack.regions, newRegion] });
    } catch (cause) {
      if (regionPendingPublication && this.isPublishedRegion(trackId, regionPendingPublication)) {
        throw cause;
      }

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

  private isPublishedRegion(trackId: string, region: RegionState): boolean {
    return this.sessionStore.getState().tracks.get(trackId)?.regions.includes(region) ?? false;
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
    const calculatedEndTime = this.getConsistentRegionEndTimeOrThrow(regionToSplit);

    if (!Number.isFinite(splitTime) || splitTime <= regionToSplit.startTime || splitTime >= calculatedEndTime) {
      throw new ProjectStateError(
        ProjectStateErrorCode.INVALID_SPLIT_POSITION,
        `Region 내부에서만 분할할 수 있습니다: ${splitTime}`,
        { trackId, regionId, splitTime }
      );
    }

    const canonicalRegion = { ...regionToSplit, endTime: calculatedEndTime };
    const source = this.assertRegisteredSource({ sourceId: regionToSplit.sourceId, regionId: regionToSplit.id });
    this.assertRegionSourceRange({ source, region: regionToSplit });

    const splitRegions = calculateSplitRegions({ region: canonicalRegion, splitTime });
    if (!splitRegions) {
      throw new ProjectStateError(
        ProjectStateErrorCode.INVALID_SPLIT_POSITION,
        `Region 내부에서만 분할할 수 있습니다: ${splitTime}`,
        { trackId, regionId, splitTime }
      );
    }

    const { left: leftRegion, right: rightRegion } = splitRegions;
    this.getConsistentRegionEndTimeOrThrow(leftRegion);
    this.getConsistentRegionEndTimeOrThrow(rightRegion);
    this.assertRegionSourceRange({ source, region: leftRegion });
    this.assertRegionSourceRange({ source, region: rightRegion });

    const sourceUrl = source.objectUrl;

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
    const regionToMove = this.getRegionOrThrow(track, regionId);
    if (!Number.isFinite(newStartTime) || newStartTime < 0) {
      throw new ProjectStateError(
        ProjectStateErrorCode.INVALID_REGION_POSITION,
        `Region 시작 위치는 0 이상이어야 합니다: ${newStartTime}`,
        { trackId, regionId, newStartTime }
      );
    }

    this.getConsistentRegionEndTimeOrThrow(regionToMove);
    const newEndTime = this.calculateRegionEndTimeOrThrow({
      regionId,
      startTime: newStartTime,
      duration: regionToMove.duration,
    });
    this.audioEngine.rescheduleRegion({ trackId, regionId, startTime: newStartTime });

    const regions = track.regions.map(region =>
      region.id === regionId ? { ...region, startTime: newStartTime, endTime: newEndTime } : region
    );
    this.sessionStore.getState().updateTrack(trackId, { regions });
  }

  async replaceTrackRegions(request: ReplaceEditorTrackRegionsRequest): Promise<void> {
    const nextTracks = this.createEditedTracks(request);
    const preparedRegistry = this.audioSourceRegistry.beginReplacement();
    let preparedGraph: IPreparedAudioProjectGraph | undefined;

    try {
      this.audioSourceRegistry
        .listCommittedRegistrations()
        .forEach(registration => preparedRegistry.restoreCommitted(registration));
      this.attachProjectSources(nextTracks, preparedRegistry);
      preparedGraph = await this.audioEngine.prepareProjectGraph({
        masterVolume: this.sessionStore.getState().masterVolume,
        tracks: this.createAudioGraphTracks(nextTracks, preparedRegistry),
      });
      preparedRegistry.assertActivatable();
      preparedGraph.assertActivatable();
    } catch (cause) {
      this.discardPreparedRegionRuntime(preparedRegistry, preparedGraph);
      throw cause;
    }

    let retiredGraph;
    try {
      retiredGraph = preparedGraph.activate();
    } catch (cause) {
      this.discardPreparedRegionRuntime(preparedRegistry, preparedGraph);
      throw cause;
    }

    const retiredRegistry = preparedRegistry.activate();
    let publicationError: unknown;
    try {
      this.sessionStore
        .getState()
        .replaceTrackStates(request.tracks.map(track => this.getTrackFromMap(nextTracks, track.trackId)));
    } catch (error) {
      publicationError = error;
    }
    this.disposeRetiredRegionRuntime(
      () => retiredGraph.dispose(),
      () => retiredRegistry.dispose()
    );
    if (publicationError) {
      throw publicationError;
    }
  }

  private createEditedTracks(request: ReplaceEditorTrackRegionsRequest): ReadonlyMap<string, TrackState> {
    const currentTracks = this.sessionStore.getState().tracks;
    const nextTracks = new Map(currentTracks);
    const requestedTrackIds = new Set<string>();

    request.tracks.forEach(snapshot => {
      if (requestedTrackIds.has(snapshot.trackId)) {
        throw new ProjectStateError(
          ProjectStateErrorCode.INVALID_EDITOR_SELECTION,
          `중복 Track 편집 요청입니다: ${snapshot.trackId}`
        );
      }
      requestedTrackIds.add(snapshot.trackId);
      const currentTrack = this.getTrackOrThrow(snapshot.trackId);
      const regions = snapshot.regions.map(region => {
        const source = this.audioSourceRegistry.resolve(region.sourceId);
        if (!source) {
          throw new ProjectStateError(
            ProjectStateErrorCode.REGION_SOURCE_MISSING,
            `Region Source를 찾을 수 없습니다: ${region.sourceId}`,
            { regionId: region.id, sourceId: region.sourceId }
          );
        }
        const endTime = this.calculateRegionEndTimeOrThrow({
          duration: region.durationSeconds,
          regionId: region.id,
          startTime: region.startTimeSeconds,
        });
        const sourceEndTime = calculateFiniteRegionSourceEndTime({
          regionDurationSeconds: region.durationSeconds,
          sourceStartTimeSeconds: region.sourceStartTimeSeconds,
        });
        if (source.metadata.durationSeconds === null) {
          throw new ProjectStateError(
            ProjectStateErrorCode.REGION_DURATION_REQUIRED,
            `편집하려는 Region Source의 길이를 알 수 없습니다: ${region.sourceId}`,
            { regionId: region.id, sourceId: region.sourceId }
          );
        }
        if (
          sourceEndTime === null ||
          !isRegionSourceRangeWithinDuration({
            regionDurationSeconds: region.durationSeconds,
            sourceDurationSeconds: source.metadata.durationSeconds,
            sourceStartTimeSeconds: region.sourceStartTimeSeconds,
          })
        ) {
          throw new ProjectStateError(
            ProjectStateErrorCode.REGION_SOURCE_RANGE_EXCEEDED,
            `Region Source 범위가 Source 길이를 벗어납니다: ${region.id}`,
            { regionId: region.id, sourceEndTime, sourceId: region.sourceId }
          );
        }
        return {
          duration: region.durationSeconds,
          endTime,
          fadeIn: { ...region.fadeIn },
          fadeOut: { ...region.fadeOut },
          gain: region.gain,
          id: region.id,
          isOpaque: region.isOpaque,
          layer: region.layer,
          sourceId: region.sourceId,
          sourceStartTime: region.sourceStartTimeSeconds,
          startTime: region.startTimeSeconds,
          status: [],
        };
      });
      nextTracks.set(snapshot.trackId, { ...currentTrack, regions });
    });

    const regionIds = new Set<string>();
    nextTracks.forEach(track =>
      track.regions.forEach(region => {
        if (regionIds.has(region.id)) {
          throw new ProjectStateError(ProjectStateErrorCode.REGION_ID_CONFLICT, `중복 Region ID입니다: ${region.id}`);
        }
        regionIds.add(region.id);
      })
    );
    return nextTracks;
  }

  private attachProjectSources(
    tracks: ReadonlyMap<string, TrackState>,
    registry: IPreparedAudioSourceRegistryReplacement
  ): void {
    tracks.forEach(track => {
      track.regions.forEach(region => registry.attach({ regionId: region.id, sourceId: region.sourceId }));
      (track.loopSlots ?? []).forEach(loopSlot => {
        const sourceIds = loopSlot.sourceId === null ? [] : [loopSlot.sourceId, ...loopSlot.overdubSourceIds];
        sourceIds.forEach(sourceId => registry.attachLoopSlot({ loopSlotId: loopSlot.id, sourceId }));
      });
    });
  }

  private createAudioGraphTracks(
    tracks: ReadonlyMap<string, TrackState>,
    registry: IPreparedAudioSourceRegistryReplacement
  ): AudioProjectGraphTrack[] {
    return [...tracks.values()].map(track => ({
      id: track.id,
      isMuted: track.isMuted,
      isSoloed: track.isSoloed,
      loops: (track.loopSlots ?? []).flatMap(loopSlot => {
        if (loopSlot.sourceId === null) {
          return [];
        }
        return [loopSlot.sourceId, ...loopSlot.overdubSourceIds].map(sourceId => ({
          slotId: loopSlot.id,
          url: this.resolvePreparedSource(registry, sourceId, loopSlot.id),
        }));
      }),
      pan: track.pan,
      pluginInstances: track.pluginInstances.map(instance => ({
        instanceId: instance.id,
        isEnabled: instance.isEnabled,
        manifestId: instance.manifestSummary.id,
        parameterValues: new Map(instance.parameters.map(parameter => [parameter.id, parameter.value] as const)),
      })),
      regions: track.regions.map(region => ({
        duration: region.duration,
        fadeIn: { ...region.fadeIn },
        fadeOut: { ...region.fadeOut },
        gain: region.gain,
        id: region.id,
        isOpaque: region.isOpaque,
        layer: region.layer,
        sourceStartTime: region.sourceStartTime,
        startTime: region.startTime,
        url: this.resolvePreparedSource(registry, region.sourceId, region.id),
      })),
      volume: track.volume,
    }));
  }

  private resolvePreparedSource(
    registry: IPreparedAudioSourceRegistryReplacement,
    sourceId: string,
    ownerId: string
  ): string {
    const source = registry.resolve(sourceId);
    if (!source) {
      throw new ProjectStateError(
        ProjectStateErrorCode.REGION_SOURCE_MISSING,
        `Runtime Source를 찾을 수 없습니다: ${sourceId}`,
        {
          ownerId,
          sourceId,
        }
      );
    }
    return source.objectUrl;
  }

  private getTrackFromMap(tracks: ReadonlyMap<string, TrackState>, trackId: string): TrackState {
    const track = tracks.get(trackId);
    if (!track) {
      throw new ProjectStateError(ProjectStateErrorCode.TRACK_NOT_FOUND, `Track을 찾을 수 없습니다: ${trackId}`);
    }
    return track;
  }

  private discardPreparedRegionRuntime(
    registry: IPreparedAudioSourceRegistryReplacement,
    graph?: IPreparedAudioProjectGraph
  ): void {
    this.disposeRuntimeResource('편집 Audio graph 준비 취소', graph ? () => graph.discard() : null);
    this.disposeRuntimeResource('편집 Source Registry 준비 취소', () => registry.discard());
  }

  private disposeRetiredRegionRuntime(
    disposeGraph: () => ResourceCleanupResult,
    disposeRegistry: () => ResourceCleanupResult
  ): void {
    this.disposeRuntimeResource('이전 편집 Audio graph 정리', disposeGraph);
    this.disposeRuntimeResource('이전 편집 Source Registry 정리', disposeRegistry);
  }

  private disposeRuntimeResource(label: string, dispose: (() => ResourceCleanupResult) | null): void {
    if (!dispose) {
      return;
    }
    try {
      const result = dispose();
      if (!result.isComplete) {
        console.error(`[RegionController] ${label} 미완료`, result);
      }
    } catch (error) {
      console.error(`[RegionController] ${label} 실패`, error);
    }
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

  private prepareAddRegion(track: TrackState, regionData: AddRegionData): PreparedRegionAddition {
    const source = this.prepareAddSource(track, regionData);

    try {
      const endTime = this.calculateRegionEndTimeOrThrow({
        regionId: regionData.id,
        startTime: regionData.startTime,
        duration: source.duration,
      });
      return { source, endTime };
    } catch (cause) {
      this.cleanupPendingSourceAfterFailure({
        sourceId: source.sourceId,
        isCommitted: source.wasCommitted,
        cause,
      });
      throw cause;
    }
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

  private createSessionRegion(regionData: RegionPlacementFields, preparedRegion: PreparedRegionAddition): RegionState {
    const { source, endTime } = preparedRegion;
    const commonRegion = {
      ...createDefaultRegionProcessingState(),
      id: regionData.id,
      startTime: regionData.startTime,
      endTime,
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
      this.cleanupPendingSourceAfterFailure({
        sourceId: source.metadata.id,
        isCommitted: source.isCommitted,
        cause,
      });
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
    let duration: number;

    if (sourceDurationSeconds === null) {
      if (regionData.duration === undefined) {
        throw new ProjectStateError(
          ProjectStateErrorCode.REGION_DURATION_REQUIRED,
          `길이를 알 수 없는 Source에는 Region 길이가 필요합니다: ${source.metadata.id}`,
          { sourceId: source.metadata.id, sourceStartTime: regionData.sourceStartTime }
        );
      }

      duration = regionData.duration;
    } else {
      duration = regionData.duration ?? Math.max(0, sourceDurationSeconds - regionData.sourceStartTime);
    }

    this.assertRegionSourceRange({
      source,
      region: {
        id: regionData.id,
        sourceStartTime: regionData.sourceStartTime,
        duration,
      },
    });
    return duration;
  }

  private cleanupPendingSourceAfterFailure({
    sourceId,
    isCommitted,
    cause,
  }: {
    sourceId: string;
    isCommitted: boolean;
    cause: unknown;
  }): void {
    if (isCommitted) {
      return;
    }

    try {
      this.audioSourceRegistry.discardPending(sourceId);
    } catch (compensationCause) {
      throw new ProjectMutationCompensationError({
        operation: 'add-region',
        failedPhase: 'Source 검증 실패 후 pending Source 정리',
        cause,
        compensationFailures: [{ step: `pending Source 정리: ${sourceId}`, cause: compensationCause }],
      });
    }
  }

  private calculateRegionEndTimeOrThrow({ regionId, startTime, duration }: RegionTimelineFields): number {
    const endTime = calculateFiniteRegionEndTime({ startTime, duration });
    if (endTime !== null) {
      return endTime;
    }

    throw new ProjectStateError(
      ProjectStateErrorCode.INVALID_REGION_TIMELINE_RANGE,
      `Region 시작 시각과 길이로 유한한 끝 시각을 계산할 수 없습니다: ${regionId}`,
      {
        duration,
        reason: 'REGION_TIMELINE_RANGE_NOT_FINITE',
        regionId,
        startTime,
      }
    );
  }

  private getConsistentRegionEndTimeOrThrow(region: RegionState): number {
    const calculatedEndTime = this.calculateRegionEndTimeOrThrow({
      regionId: region.id,
      startTime: region.startTime,
      duration: region.duration,
    });
    if (
      isRegionEndTimeConsistent({
        startTime: region.startTime,
        duration: region.duration,
        endTime: region.endTime,
      })
    ) {
      return calculatedEndTime;
    }

    throw new ProjectStateError(
      ProjectStateErrorCode.INVALID_REGION_TIMELINE_RANGE,
      `Region 끝 시각이 시작 시각과 길이의 합과 다릅니다: ${region.id}`,
      {
        calculatedEndTime,
        endTime: region.endTime,
        reason: 'REGION_END_TIME_MISMATCH',
        regionId: region.id,
      }
    );
  }

  private assertRegionSourceRange({
    source,
    region,
  }: {
    source: RuntimeAudioSource;
    region: RegionSourceRangeFields;
  }): void {
    const sourceEndTime = calculateFiniteRegionSourceEndTime({
      sourceStartTimeSeconds: region.sourceStartTime,
      regionDurationSeconds: region.duration,
    });
    if (sourceEndTime === null) {
      throw new ProjectStateError(
        ProjectStateErrorCode.INVALID_REGION_SOURCE_RANGE,
        `Region 원본 시작 시각과 길이로 유한한 끝 시각을 계산할 수 없습니다: ${region.id}`,
        {
          duration: region.duration,
          reason: 'REGION_SOURCE_RANGE_NOT_FINITE',
          regionId: region.id,
          sourceId: source.metadata.id,
          sourceStartTime: region.sourceStartTime,
        }
      );
    }

    const sourceDurationSeconds = source.metadata.durationSeconds;
    if (
      sourceDurationSeconds === null ||
      isRegionSourceRangeWithinDuration({
        sourceDurationSeconds,
        sourceStartTimeSeconds: region.sourceStartTime,
        regionDurationSeconds: region.duration,
      })
    ) {
      return;
    }

    throw new ProjectStateError(
      ProjectStateErrorCode.REGION_SOURCE_RANGE_EXCEEDED,
      `Region이 Source 길이를 넘습니다: ${source.metadata.id}`,
      {
        duration: region.duration,
        sourceDurationSeconds,
        sourceEndTime,
        sourceId: source.metadata.id,
        sourceStartTime: region.sourceStartTime,
      }
    );
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
    const processingState = createDefaultRegionProcessingState();
    return {
      ...processingState,
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
