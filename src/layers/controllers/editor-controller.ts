import type { RegionState, SessionStore } from '../session/session';
import type {
  EditorClipboardEntry,
  EditorRegionSelection,
  EditorRuntimeListener,
  EditorRuntimeState,
  EditorSelectionState,
  SetEditorSelectionRequest,
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

export class EditorController {
  readonly #listeners = new Set<EditorRuntimeListener>();
  #state = EMPTY_EDITOR_RUNTIME_STATE;

  constructor(private readonly sessionStore: SessionStore) {}

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

  reset(): void {
    if (this.#state === EMPTY_EDITOR_RUNTIME_STATE) {
      return;
    }
    this.publish(EMPTY_EDITOR_RUNTIME_STATE);
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
      relativeStartTimeSeconds: region.startTime - originTimeSeconds,
      sourceId: region.sourceId,
      sourceStartTimeSeconds: region.sourceStartTime,
      sourceTrackId: selection.trackId,
    }));
  }

  private getTrack(trackId: string) {
    const track = this.sessionStore.getState().tracks.get(trackId);
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

  private throwInvalidSelection(message: string): never {
    throw new ProjectStateError(ProjectStateErrorCode.INVALID_EDITOR_SELECTION, message);
  }

  private publish(state: EditorRuntimeState): void {
    this.#state = state;
    this.#listeners.forEach(listener => listener(state));
  }
}
