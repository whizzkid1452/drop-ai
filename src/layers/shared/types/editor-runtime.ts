import type { TimelineRange } from './project-document.schema';
import type { RegionFadeCurve, RegionProcessingState } from './region-processing';

export interface EditorRegionSelection {
  readonly regionId: string;
  readonly trackId: string;
}

export interface EditorRangeSelection extends TimelineRange {
  readonly trackIds: readonly string[];
}

export interface EditorSelectionState {
  readonly editPointSeconds: number;
  readonly range: EditorRangeSelection | null;
  readonly regions: readonly EditorRegionSelection[];
  readonly trackIds: readonly string[];
}

export interface SetEditorSelectionRequest {
  readonly editPointSeconds: number;
  readonly range: EditorRangeSelection | null;
  readonly regions: readonly EditorRegionSelection[];
  readonly trackIds: readonly string[];
}

export interface EditorClipboardEntry extends RegionProcessingState {
  readonly durationSeconds: number;
  readonly relativeStartTimeSeconds: number;
  readonly sourceId: string;
  readonly sourceStartTimeSeconds: number;
  readonly sourceTrackId: string;
}

export interface EditorClipboardState {
  readonly entries: readonly EditorClipboardEntry[];
  readonly pasteCount: number;
}

export interface EditorRuntimeState {
  readonly clipboard: EditorClipboardState;
  readonly selection: EditorSelectionState;
}

export type EditorRuntimeListener = (state: EditorRuntimeState) => void;

export interface EditorRegionSnapshot extends RegionProcessingState {
  readonly durationSeconds: number;
  readonly id: string;
  readonly sourceId: string;
  readonly sourceStartTimeSeconds: number;
  readonly startTimeSeconds: number;
}

export interface EditorTrackRegionSnapshot {
  readonly regions: readonly EditorRegionSnapshot[];
  readonly trackId: string;
}

export interface ReplaceEditorTrackRegionsRequest {
  readonly tracks: readonly EditorTrackRegionSnapshot[];
}

export interface IEditorRegionRuntime {
  replaceTrackRegions(request: ReplaceEditorTrackRegionsRequest): Promise<void>;
}

export interface AlignSelectedRegionsRequest {
  readonly edge: 'end' | 'start';
  readonly targetTimeSeconds: number;
}

export interface TrimRegionRequest {
  readonly durationSeconds: number;
  readonly regionId: string;
  readonly sourceStartTimeSeconds: number;
  readonly startTimeSeconds: number;
  readonly trackId: string;
}

export interface SlipRegionRequest {
  readonly regionId: string;
  readonly sourceStartTimeSeconds: number;
  readonly trackId: string;
}

export interface SetRegionProcessingRequest {
  readonly fadeIn?: { readonly curve: RegionFadeCurve; readonly durationSeconds: number };
  readonly fadeOut?: { readonly curve: RegionFadeCurve; readonly durationSeconds: number };
  readonly gain?: number;
  readonly isOpaque?: boolean;
  readonly layer?: number;
  readonly regionId: string;
  readonly trackId: string;
}

export interface CreateRegionCrossfadeRequest {
  readonly crossfadeId: string;
  readonly curve: RegionFadeCurve;
  readonly fadeInRegionId: string;
  readonly fadeOutRegionId: string;
  readonly trackId: string;
}

export interface RemoveRegionCrossfadeRequest {
  readonly crossfadeId: string;
  readonly trackId: string;
}
