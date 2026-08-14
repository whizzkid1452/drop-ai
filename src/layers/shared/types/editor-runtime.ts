import type { TimelineRange } from './project-document.schema';

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

export interface EditorClipboardEntry {
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
