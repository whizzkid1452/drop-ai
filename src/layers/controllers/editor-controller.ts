import type { RegionState, SessionStore } from '../session/session';
import type {
  AlignSelectedRegionsRequest,
  CreateRegionCrossfadeRequest,
  EditorClipboardEntry,
  EditorRegionSelection,
  EditorRegionSnapshot,
  EditorRuntimeListener,
  EditorRuntimeState,
  EditorSelectionState,
  IEditorRegionRuntime,
  ReplaceEditorTrackRegionsRequest,
  SetEditorSelectionRequest,
  SetRegionProcessingRequest,
  SlipRegionRequest,
  TrimRegionRequest,
  RemoveRegionCrossfadeRequest,
} from '../shared/types/editor-runtime';
import { ProjectStateError, ProjectStateErrorCode } from './project-state-error';

const EMPTY_EDITOR_RUNTIME_STATE: EditorRuntimeState = {
  clipboard: { entries: [], pasteCount: 0 },
  selection: { editPointSeconds: 0, range: null, regions: [], trackIds: [] },
};

function uniqueStrings(values: readonly string[]): string[] {
  return [...new Set(values)];
}

function uniqueRegionSelections(values: readonly EditorRegionSelection[]): EditorRegionSelection[] {
  const selections = new Map<string, EditorRegionSelection>();
  values.forEach(selection => selections.set(`${selection.trackId}\u0000${selection.regionId}`, { ...selection }));
  return [...selections.values()];
}

function areStringArraysEqual(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function areRegionSelectionsEqual(
  left: readonly EditorRegionSelection[],
  right: readonly EditorRegionSelection[]
): boolean {
  return (
    left.length === right.length &&
    left.every((selection, index) => {
      const candidate = right[index];
      return candidate?.regionId === selection.regionId && candidate.trackId === selection.trackId;
    })
  );
}

function areSelectionsEqual(left: EditorSelectionState, right: EditorSelectionState): boolean {
  return (
    left.editPointSeconds === right.editPointSeconds &&
    left.range?.startTimeSeconds === right.range?.startTimeSeconds &&
    left.range?.endTimeSeconds === right.range?.endTimeSeconds &&
    areStringArraysEqual(left.range?.trackIds ?? [], right.range?.trackIds ?? []) &&
    areStringArraysEqual(left.trackIds, right.trackIds) &&
    areRegionSelectionsEqual(left.regions, right.regions)
  );
}

interface EditorControllerDependencies {
  readonly createRegionId?: () => string;
  readonly regionRuntime: IEditorRegionRuntime;
  readonly sessionStore: SessionStore;
}

export class EditorController {
  readonly #listeners = new Set<EditorRuntimeListener>();
  readonly #createRegionId: () => string;
  readonly #regionRuntime: IEditorRegionRuntime;
  readonly #sessionStore: SessionStore;
  #state = EMPTY_EDITOR_RUNTIME_STATE;

  constructor({
    createRegionId = () => globalThis.crypto.randomUUID(),
    regionRuntime,
    sessionStore,
  }: EditorControllerDependencies) {
    this.#createRegionId = createRegionId;
    this.#regionRuntime = regionRuntime;
    this.#sessionStore = sessionStore;
  }

  getState(): EditorRuntimeState {
    return this.#state;
  }

  subscribe(listener: EditorRuntimeListener): () => void {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  setSelection(request: SetEditorSelectionRequest): void {
    const selection = this.validateSelection(request);
    if (areSelectionsEqual(this.#state.selection, selection)) {
      return;
    }
    this.publish({ ...this.#state, selection });
  }

  copySelectedRegions(): void {
    const entries = this.createClipboardEntries(this.#state.selection.regions);
    this.publish({ ...this.#state, clipboard: { entries, pasteCount: 0 } });
  }

  async cutSelectedRegions(): Promise<void> {
    const selections = this.#state.selection.regions;
    const entries = this.createClipboardEntries(selections);
    const selectedKeys = new Set(selections.map(selection => this.createRegionSelectionKey(selection)));
    const tracks = this.createTrackRegionSnapshots(selections.map(selection => selection.trackId)).map(track => ({
      ...track,
      regions: track.regions.filter(
        region =>
          !selectedKeys.has(
            this.createRegionSelectionKey({
              regionId: region.id,
              trackId: track.trackId,
            })
          )
      ),
    }));

    await this.#regionRuntime.replaceTrackRegions({ tracks });
    this.publish({
      clipboard: { entries, pasteCount: 0 },
      selection: { ...this.#state.selection, regions: [] },
    });
  }

  async pasteRegions(): Promise<void> {
    const entries = this.#state.clipboard.entries;
    if (entries.length === 0) {
      this.throwEmptySelection('붙여넣을 Region이 Clipboard에 없습니다.');
    }

    const selectedTrackId = this.#state.selection.trackIds.length === 1 ? this.#state.selection.trackIds[0] : null;
    const additions = entries.map(entry => ({
      durationSeconds: entry.durationSeconds,
      fadeIn: { ...entry.fadeIn },
      fadeOut: { ...entry.fadeOut },
      gain: entry.gain,
      id: this.#createRegionId(),
      isOpaque: entry.isOpaque,
      layer: entry.layer,
      sourceId: entry.sourceId,
      sourceStartTimeSeconds: entry.sourceStartTimeSeconds,
      startTimeSeconds: this.#state.selection.editPointSeconds + entry.relativeStartTimeSeconds,
      trackId: selectedTrackId ?? entry.sourceTrackId,
    }));
    const trackIds = additions.map(addition => addition.trackId);
    const tracks = this.createTrackRegionSnapshots(trackIds).map(track => ({
      ...track,
      regions: [
        ...track.regions,
        ...additions
          .filter(addition => addition.trackId === track.trackId)
          .map(addition => this.toAddedRegionSnapshot(addition)),
      ],
    }));

    await this.#regionRuntime.replaceTrackRegions({ tracks });
    this.publish({
      clipboard: { ...this.#state.clipboard, pasteCount: this.#state.clipboard.pasteCount + 1 },
      selection: {
        ...this.#state.selection,
        regions: additions.map(addition => ({ regionId: addition.id, trackId: addition.trackId })),
      },
    });
  }

  async duplicateSelectedRegions(offsetSeconds: number): Promise<void> {
    if (!Number.isFinite(offsetSeconds) || offsetSeconds <= 0) {
      this.throwInvalidSelection('복제 간격은 0보다 큰 유한한 초 단위 값이어야 합니다.');
    }
    const selections = this.requireSelectedRegions();
    const additions = selections.map(selection => {
      const region = this.getRegion(selection);
      return {
        durationSeconds: region.duration,
        fadeIn: { ...region.fadeIn },
        fadeOut: { ...region.fadeOut },
        gain: region.gain,
        id: this.#createRegionId(),
        isOpaque: region.isOpaque,
        layer: region.layer,
        sourceId: region.sourceId,
        sourceStartTimeSeconds: region.sourceStartTime,
        startTimeSeconds: region.startTime + offsetSeconds,
        trackId: selection.trackId,
      };
    });
    const tracks = this.createTrackRegionSnapshots(additions.map(addition => addition.trackId)).map(track => ({
      ...track,
      regions: [
        ...track.regions,
        ...additions
          .filter(addition => addition.trackId === track.trackId)
          .map(addition => this.toAddedRegionSnapshot(addition)),
      ],
    }));

    await this.#regionRuntime.replaceTrackRegions({ tracks });
    this.publish({
      ...this.#state,
      selection: {
        ...this.#state.selection,
        regions: additions.map(addition => ({ regionId: addition.id, trackId: addition.trackId })),
      },
    });
  }

  async nudgeSelectedRegions(deltaSeconds: number): Promise<void> {
    if (!Number.isFinite(deltaSeconds) || deltaSeconds === 0) {
      this.throwInvalidSelection('Nudge 간격은 0이 아닌 유한한 초 단위 값이어야 합니다.');
    }
    await this.replaceSelectedRegions(region => ({
      ...region,
      startTimeSeconds: region.startTimeSeconds + deltaSeconds,
    }));
  }

  async alignSelectedRegions({ edge, targetTimeSeconds }: AlignSelectedRegionsRequest): Promise<void> {
    if (!Number.isFinite(targetTimeSeconds) || targetTimeSeconds < 0) {
      this.throwInvalidSelection('정렬 기준 시각은 0 이상의 유한한 초 단위 값이어야 합니다.');
    }
    await this.replaceSelectedRegions(region => ({
      ...region,
      startTimeSeconds: edge === 'start' ? targetTimeSeconds : targetTimeSeconds - region.durationSeconds,
    }));
  }

  async trimRegion(request: TrimRegionRequest): Promise<void> {
    this.assertFiniteRegionPlacement(request);
    await this.replaceRegion(request.trackId, request.regionId, region => ({
      ...region,
      durationSeconds: request.durationSeconds,
      sourceStartTimeSeconds: request.sourceStartTimeSeconds,
      startTimeSeconds: request.startTimeSeconds,
    }));
  }

  async slipRegion(request: SlipRegionRequest): Promise<void> {
    if (!Number.isFinite(request.sourceStartTimeSeconds) || request.sourceStartTimeSeconds < 0) {
      this.throwInvalidSelection('Source 시작 시각은 0 이상의 유한한 초 단위 값이어야 합니다.');
    }
    await this.replaceRegion(request.trackId, request.regionId, region => ({
      ...region,
      sourceStartTimeSeconds: request.sourceStartTimeSeconds,
    }));
  }

  async setRegionProcessing(request: SetRegionProcessingRequest): Promise<void> {
    const [track] = this.createTrackRegionSnapshots([request.trackId]);
    if (!track) {
      this.throwInvalidSelection(`Track을 찾을 수 없습니다: ${request.trackId}`);
    }
    const targetRegion = track.regions.find(region => region.id === request.regionId);
    if (!targetRegion) {
      this.throwInvalidSelection(`Region을 찾을 수 없습니다: ${request.regionId}`);
    }

    const crossfadeIdsToClear = new Set<string>();
    if (request.fadeIn !== undefined && targetRegion.fadeIn.crossfadeId !== null) {
      crossfadeIdsToClear.add(targetRegion.fadeIn.crossfadeId);
    }
    if (request.fadeOut !== undefined && targetRegion.fadeOut.crossfadeId !== null) {
      crossfadeIdsToClear.add(targetRegion.fadeOut.crossfadeId);
    }
    const regions = this.clearRegionCrossfades(track.regions, crossfadeIdsToClear).map(region => {
      if (region.id !== request.regionId) {
        return region;
      }
      return this.validateRegionSnapshot({
        ...region,
        fadeIn: request.fadeIn ? { ...request.fadeIn, crossfadeId: null } : region.fadeIn,
        fadeOut: request.fadeOut ? { ...request.fadeOut, crossfadeId: null } : region.fadeOut,
        gain: request.gain ?? region.gain,
        isOpaque: request.isOpaque ?? region.isOpaque,
        layer: request.layer ?? region.layer,
      });
    });

    await this.#regionRuntime.replaceTrackRegions({ tracks: [{ ...track, regions }] });
  }

  async createRegionCrossfade(request: CreateRegionCrossfadeRequest): Promise<void> {
    const [track] = this.createTrackRegionSnapshots([request.trackId]);
    if (!track) {
      this.throwInvalidSelection(`Track을 찾을 수 없습니다: ${request.trackId}`);
    }
    if (track.regions.some(region => this.regionUsesCrossfadeId(region, request.crossfadeId))) {
      this.throwInvalidSelection(`이미 사용 중인 Crossfade ID입니다: ${request.crossfadeId}`);
    }
    const fadeOutRegion = track.regions.find(region => region.id === request.fadeOutRegionId);
    const fadeInRegion = track.regions.find(region => region.id === request.fadeInRegionId);
    if (!fadeOutRegion || !fadeInRegion || fadeOutRegion.id === fadeInRegion.id) {
      this.throwInvalidSelection('Crossfade를 만들 두 Region을 찾을 수 없습니다.');
    }

    const fadeOutRegionEnd = fadeOutRegion.startTimeSeconds + fadeOutRegion.durationSeconds;
    const fadeInRegionEnd = fadeInRegion.startTimeSeconds + fadeInRegion.durationSeconds;
    const durationSeconds = fadeOutRegionEnd - fadeInRegion.startTimeSeconds;
    if (
      fadeOutRegion.startTimeSeconds >= fadeInRegion.startTimeSeconds ||
      durationSeconds <= 0 ||
      fadeOutRegionEnd > fadeInRegionEnd
    ) {
      this.throwInvalidSelection('Crossfade는 앞 Region의 끝과 뒤 Region의 시작이 겹쳐야 합니다.');
    }

    const crossfadeIdsToClear = new Set(
      [fadeOutRegion.fadeOut.crossfadeId, fadeInRegion.fadeIn.crossfadeId].filter(
        (crossfadeId): crossfadeId is string => crossfadeId !== null
      )
    );
    const regions = this.clearRegionCrossfades(track.regions, crossfadeIdsToClear).map(region => {
      if (region.id === fadeOutRegion.id) {
        return {
          ...region,
          fadeOut: { crossfadeId: request.crossfadeId, curve: request.curve, durationSeconds },
          isOpaque: false,
        };
      }
      if (region.id === fadeInRegion.id) {
        return {
          ...region,
          fadeIn: { crossfadeId: request.crossfadeId, curve: request.curve, durationSeconds },
          isOpaque: false,
        };
      }
      return region;
    });

    await this.#regionRuntime.replaceTrackRegions({ tracks: [{ ...track, regions }] });
  }

  async removeRegionCrossfade(request: RemoveRegionCrossfadeRequest): Promise<void> {
    const [track] = this.createTrackRegionSnapshots([request.trackId]);
    if (!track || !track.regions.some(region => this.regionUsesCrossfadeId(region, request.crossfadeId))) {
      this.throwInvalidSelection(`Crossfade를 찾을 수 없습니다: ${request.crossfadeId}`);
    }
    const regions = this.clearRegionCrossfades(track.regions, new Set([request.crossfadeId]));
    await this.#regionRuntime.replaceTrackRegions({ tracks: [{ ...track, regions }] });
  }

  restoreTrackRegions(request: ReplaceEditorTrackRegionsRequest): Promise<void> {
    return this.#regionRuntime.replaceTrackRegions(request);
  }

  restoreRuntimeState(state: EditorRuntimeState): void {
    const selection = this.validateSelection(state.selection);
    this.publish({
      clipboard: {
        entries: state.clipboard.entries.map(entry => ({
          ...entry,
          fadeIn: { ...entry.fadeIn },
          fadeOut: { ...entry.fadeOut },
        })),
        pasteCount: state.clipboard.pasteCount,
      },
      selection,
    });
  }

  reset(): void {
    if (this.#state === EMPTY_EDITOR_RUNTIME_STATE) {
      return;
    }
    this.publish(EMPTY_EDITOR_RUNTIME_STATE);
  }

  removeMissingSelections(): void {
    const selection = this.#state.selection;
    const trackIds = selection.trackIds.filter(trackId => this.#sessionStore.getState().tracks.has(trackId));
    const regions = selection.regions.filter(region => this.hasRegion(region));
    const range = selection.range
      ? {
          ...selection.range,
          trackIds: selection.range.trackIds.filter(trackId => this.#sessionStore.getState().tracks.has(trackId)),
        }
      : null;
    const nextSelection = { ...selection, range, regions, trackIds };
    if (!areSelectionsEqual(selection, nextSelection)) {
      this.publish({ ...this.#state, selection: nextSelection });
    }
  }

  private validateSelection(request: SetEditorSelectionRequest): EditorSelectionState {
    if (!Number.isFinite(request.editPointSeconds) || request.editPointSeconds < 0) {
      this.throwInvalidSelection('edit point는 0 이상의 유한한 초 단위 값이어야 합니다.');
    }

    const trackIds = uniqueStrings(request.trackIds);
    const regions = uniqueRegionSelections(request.regions);
    const rangeTrackIds = uniqueStrings(request.range?.trackIds ?? []);
    [...trackIds, ...rangeTrackIds].forEach(trackId => this.getTrack(trackId));
    regions.forEach(selection => this.getRegion(selection));

    const range = request.range
      ? {
          endTimeSeconds: request.range.endTimeSeconds,
          startTimeSeconds: request.range.startTimeSeconds,
          trackIds: rangeTrackIds,
        }
      : null;
    if (
      range &&
      (!Number.isFinite(range.startTimeSeconds) ||
        !Number.isFinite(range.endTimeSeconds) ||
        range.startTimeSeconds < 0 ||
        range.endTimeSeconds <= range.startTimeSeconds)
    ) {
      this.throwInvalidSelection('Range 선택은 0 이상의 시작과 더 큰 유한한 끝 시각이 필요합니다.');
    }

    return { editPointSeconds: request.editPointSeconds, range, regions, trackIds };
  }

  private createClipboardEntries(selections: readonly EditorRegionSelection[]): EditorClipboardEntry[] {
    if (selections.length === 0) {
      throw new ProjectStateError(ProjectStateErrorCode.EDITOR_SELECTION_EMPTY, '복사할 Region 선택이 없습니다.');
    }
    const selectedRegions = selections.map(selection => ({ selection, region: this.getRegion(selection) }));
    const originTimeSeconds = Math.min(...selectedRegions.map(({ region }) => region.startTime));
    return selectedRegions.map(({ selection, region }) => ({
      durationSeconds: region.duration,
      fadeIn: { ...region.fadeIn },
      fadeOut: { ...region.fadeOut },
      gain: region.gain,
      isOpaque: region.isOpaque,
      layer: region.layer,
      relativeStartTimeSeconds: region.startTime - originTimeSeconds,
      sourceId: region.sourceId,
      sourceStartTimeSeconds: region.sourceStartTime,
      sourceTrackId: selection.trackId,
    }));
  }

  private requireSelectedRegions(): readonly EditorRegionSelection[] {
    if (this.#state.selection.regions.length === 0) {
      this.throwEmptySelection('편집할 Region 선택이 없습니다.');
    }
    return this.#state.selection.regions;
  }

  private async replaceSelectedRegions(replace: (region: EditorRegionSnapshot) => EditorRegionSnapshot): Promise<void> {
    const selections = this.requireSelectedRegions();
    const selectedKeys = new Set(selections.map(selection => this.createRegionSelectionKey(selection)));
    const tracks = this.createTrackRegionSnapshots(selections.map(selection => selection.trackId)).map(track => ({
      ...track,
      regions: track.regions.map(region => {
        const key = this.createRegionSelectionKey({ regionId: region.id, trackId: track.trackId });
        return selectedKeys.has(key) ? this.validateRegionSnapshot(replace(region)) : region;
      }),
    }));
    await this.#regionRuntime.replaceTrackRegions({ tracks });
  }

  private async replaceRegion(
    trackId: string,
    regionId: string,
    replace: (region: EditorRegionSnapshot) => EditorRegionSnapshot
  ): Promise<void> {
    this.getRegion({ regionId, trackId });
    const [track] = this.createTrackRegionSnapshots([trackId]);
    if (!track) {
      this.throwInvalidSelection(`Track을 찾을 수 없습니다: ${trackId}`);
    }
    await this.#regionRuntime.replaceTrackRegions({
      tracks: [
        {
          ...track,
          regions: track.regions.map(region =>
            region.id === regionId ? this.validateRegionSnapshot(replace(region)) : region
          ),
        },
      ],
    });
  }

  private createTrackRegionSnapshots(trackIds: readonly string[]) {
    return uniqueStrings(trackIds).map(trackId => ({
      regions: this.getTrack(trackId).regions.map(region => this.toRegionSnapshot(region)),
      trackId,
    }));
  }

  private toRegionSnapshot(region: RegionState): EditorRegionSnapshot {
    return {
      durationSeconds: region.duration,
      fadeIn: { ...region.fadeIn },
      fadeOut: { ...region.fadeOut },
      gain: region.gain,
      id: region.id,
      isOpaque: region.isOpaque,
      layer: region.layer,
      sourceId: region.sourceId,
      sourceStartTimeSeconds: region.sourceStartTime,
      startTimeSeconds: region.startTime,
    };
  }

  private toAddedRegionSnapshot(region: EditorRegionSnapshot & { readonly trackId: string }): EditorRegionSnapshot {
    return {
      durationSeconds: region.durationSeconds,
      fadeIn: { ...region.fadeIn },
      fadeOut: { ...region.fadeOut },
      gain: region.gain,
      id: region.id,
      isOpaque: region.isOpaque,
      layer: region.layer,
      sourceId: region.sourceId,
      sourceStartTimeSeconds: region.sourceStartTimeSeconds,
      startTimeSeconds: region.startTimeSeconds,
    };
  }

  private validateRegionSnapshot(region: EditorRegionSnapshot): EditorRegionSnapshot {
    this.assertFiniteRegionPlacement(region);
    if (
      !Number.isFinite(region.gain) ||
      region.gain < 0 ||
      !Number.isSafeInteger(region.layer) ||
      region.layer < 0 ||
      !Number.isFinite(region.fadeIn.durationSeconds) ||
      !Number.isFinite(region.fadeOut.durationSeconds) ||
      region.fadeIn.durationSeconds < 0 ||
      region.fadeOut.durationSeconds < 0 ||
      region.fadeIn.durationSeconds > region.durationSeconds ||
      region.fadeOut.durationSeconds > region.durationSeconds
    ) {
      this.throwInvalidSelection('Region gain, layer, Fade 값이 허용 범위를 벗어났습니다.');
    }
    return region;
  }

  private clearRegionCrossfades(
    regions: readonly EditorRegionSnapshot[],
    crossfadeIds: ReadonlySet<string>
  ): EditorRegionSnapshot[] {
    if (crossfadeIds.size === 0) {
      return regions.map(region => ({ ...region, fadeIn: { ...region.fadeIn }, fadeOut: { ...region.fadeOut } }));
    }
    return regions.map(region => ({
      ...region,
      fadeIn: crossfadeIds.has(region.fadeIn.crossfadeId ?? '')
        ? { ...region.fadeIn, crossfadeId: null, durationSeconds: 0 }
        : { ...region.fadeIn },
      fadeOut: crossfadeIds.has(region.fadeOut.crossfadeId ?? '')
        ? { ...region.fadeOut, crossfadeId: null, durationSeconds: 0 }
        : { ...region.fadeOut },
    }));
  }

  private regionUsesCrossfadeId(region: EditorRegionSnapshot, crossfadeId: string): boolean {
    return region.fadeIn.crossfadeId === crossfadeId || region.fadeOut.crossfadeId === crossfadeId;
  }

  private assertFiniteRegionPlacement(region: {
    readonly durationSeconds: number;
    readonly sourceStartTimeSeconds: number;
    readonly startTimeSeconds: number;
  }): void {
    if (
      !Number.isFinite(region.durationSeconds) ||
      !Number.isFinite(region.sourceStartTimeSeconds) ||
      !Number.isFinite(region.startTimeSeconds) ||
      region.durationSeconds <= 0 ||
      region.sourceStartTimeSeconds < 0 ||
      region.startTimeSeconds < 0 ||
      !Number.isFinite(region.startTimeSeconds + region.durationSeconds) ||
      !Number.isFinite(region.sourceStartTimeSeconds + region.durationSeconds)
    ) {
      this.throwInvalidSelection('Region timeline과 Source 범위는 0 이상의 유한한 범위여야 합니다.');
    }
  }

  private createRegionSelectionKey(selection: EditorRegionSelection): string {
    return `${selection.trackId}\u0000${selection.regionId}`;
  }

  private getTrack(trackId: string) {
    const track = this.#sessionStore.getState().tracks.get(trackId);
    if (!track) {
      throw new ProjectStateError(ProjectStateErrorCode.TRACK_NOT_FOUND, `Track을 찾을 수 없습니다: ${trackId}`, {
        trackId,
      });
    }
    return track;
  }

  private getRegion({ trackId, regionId }: EditorRegionSelection): RegionState {
    const region = this.getTrack(trackId).regions.find(candidate => candidate.id === regionId);
    if (!region) {
      throw new ProjectStateError(ProjectStateErrorCode.REGION_NOT_FOUND, `Region을 찾을 수 없습니다: ${regionId}`, {
        regionId,
        trackId,
      });
    }
    return region;
  }

  private hasRegion(selection: EditorRegionSelection): boolean {
    return (
      this.#sessionStore
        .getState()
        .tracks.get(selection.trackId)
        ?.regions.some(region => region.id === selection.regionId) === true
    );
  }

  private throwInvalidSelection(message: string): never {
    throw new ProjectStateError(ProjectStateErrorCode.INVALID_EDITOR_SELECTION, message);
  }

  private throwEmptySelection(message: string): never {
    throw new ProjectStateError(ProjectStateErrorCode.EDITOR_SELECTION_EMPTY, message);
  }

  private publish(state: EditorRuntimeState): void {
    this.#state = state;
    this.#listeners.forEach(listener => listener(state));
  }
}
