import { useCallback } from 'react';
import { useCommandExecutor, useEditorRuntimeState, useSession } from '@/layers/apps/web/context/layer-hooks';
import {
  KeyboardShortcutAction,
  KEYBOARD_SHORTCUT_LABELS,
  useKeyboardShortcutAction,
} from '@/layers/apps/web/keyboard-shortcuts/keyboard-shortcuts';
import { AudioCommandType, type AudioCommand } from '@/types/audioCommand.schema';
import type { RegionState } from '@/layers/session/session';
import * as styles from './RegionEditControls.css.ts';

const REGION_NUDGE_SECONDS = 0.1;
const REGION_DUPLICATE_OFFSET_SECONDS = 1;

export function RegionEditControls() {
  const commandExecutor = useCommandExecutor();
  const editorRuntime = useEditorRuntimeState();
  const tracks = useSession(state => state.tracks);
  const selectedRegionCount = editorRuntime.selection.regions.length;
  const hasSelectedRegions = selectedRegionCount > 0;
  const hasClipboardEntries = editorRuntime.clipboard.entries.length > 0;
  const selectedRegion = selectedRegionCount === 1 ? editorRuntime.selection.regions[0] : undefined;
  const selectedRegionState = selectedRegion
    ? tracks.get(selectedRegion.trackId)?.regions.find(region => region.id === selectedRegion.regionId)
    : undefined;
  const selectedRegionStates = editorRuntime.selection.regions.flatMap(selection => {
    const region = tracks.get(selection.trackId)?.regions.find(candidate => candidate.id === selection.regionId);
    return region ? [{ region, trackId: selection.trackId }] : [];
  });
  const crossfadeCandidate = resolveCrossfadeCandidate(selectedRegionStates);
  const removableCrossfade = resolveRemovableCrossfade(selectedRegionStates);

  const execute = useCallback(
    async (command: AudioCommand) => {
      try {
        await commandExecutor.execute(command);
      } catch (error) {
        window.alert(error instanceof Error ? error.message : String(error));
      }
    },
    [commandExecutor]
  );

  const copy = useCallback(() => execute({ type: AudioCommandType.COPY_SELECTED_REGIONS }), [execute]);
  const cut = useCallback(() => execute({ type: AudioCommandType.CUT_SELECTED_REGIONS }), [execute]);
  const paste = useCallback(() => execute({ type: AudioCommandType.PASTE_REGIONS }), [execute]);
  const duplicate = useCallback(
    () =>
      execute({
        type: AudioCommandType.DUPLICATE_SELECTED_REGIONS,
        offsetSeconds: REGION_DUPLICATE_OFFSET_SECONDS,
      }),
    [execute]
  );
  const nudge = useCallback(
    (deltaSeconds: number) => execute({ type: AudioCommandType.NUDGE_SELECTED_REGIONS, deltaSeconds }),
    [execute]
  );

  useKeyboardShortcutAction(KeyboardShortcutAction.COPY_REGIONS, () => void copy(), hasSelectedRegions);
  useKeyboardShortcutAction(KeyboardShortcutAction.CUT_REGIONS, () => void cut(), hasSelectedRegions);
  useKeyboardShortcutAction(KeyboardShortcutAction.PASTE_REGIONS, () => void paste(), hasClipboardEntries);
  useKeyboardShortcutAction(KeyboardShortcutAction.DUPLICATE_REGIONS, () => void duplicate(), hasSelectedRegions);
  useKeyboardShortcutAction(
    KeyboardShortcutAction.NUDGE_REGIONS_BACKWARD,
    () => void nudge(-REGION_NUDGE_SECONDS),
    hasSelectedRegions
  );
  useKeyboardShortcutAction(
    KeyboardShortcutAction.NUDGE_REGIONS_FORWARD,
    () => void nudge(REGION_NUDGE_SECONDS),
    hasSelectedRegions
  );

  const align = (edge: 'end' | 'start') =>
    execute({
      type: AudioCommandType.ALIGN_SELECTED_REGIONS,
      edge,
      targetTimeSeconds: editorRuntime.selection.editPointSeconds,
    });
  const slip = (deltaSeconds: number) => {
    if (!selectedRegion || !selectedRegionState) {
      return Promise.resolve();
    }
    return execute({
      type: AudioCommandType.SLIP_REGION,
      regionId: selectedRegion.regionId,
      sourceStartTimeSeconds: Math.max(0, selectedRegionState.sourceStartTime + deltaSeconds),
      trackId: selectedRegion.trackId,
    });
  };
  const createCrossfade = () => {
    if (!crossfadeCandidate) {
      return Promise.resolve();
    }
    return execute({
      type: AudioCommandType.CREATE_REGION_CROSSFADE,
      crossfadeId: globalThis.crypto.randomUUID(),
      curve: 'linear',
      fadeInRegionId: crossfadeCandidate.fadeInRegionId,
      fadeOutRegionId: crossfadeCandidate.fadeOutRegionId,
      trackId: crossfadeCandidate.trackId,
    });
  };
  const removeCrossfade = () => {
    if (!removableCrossfade) {
      return Promise.resolve();
    }
    return execute({
      type: AudioCommandType.REMOVE_REGION_CROSSFADE,
      crossfadeId: removableCrossfade.crossfadeId,
      trackId: removableCrossfade.trackId,
    });
  };

  return (
    <section className={styles.container} aria-label="Region 편집 도구">
      <span className={styles.summary}>{selectedRegionCount} REGION</span>
      <div className={styles.buttonGroup}>
        <EditButton
          label="Region 복사"
          text="COPY"
          disabled={!hasSelectedRegions}
          shortcut={KeyboardShortcutAction.COPY_REGIONS}
          onClick={copy}
        />
        <EditButton
          label="Region 잘라내기"
          text="CUT"
          disabled={!hasSelectedRegions}
          shortcut={KeyboardShortcutAction.CUT_REGIONS}
          onClick={cut}
        />
        <EditButton
          label="Region 붙여넣기"
          text="PASTE"
          disabled={!hasClipboardEntries}
          shortcut={KeyboardShortcutAction.PASTE_REGIONS}
          onClick={paste}
        />
        <EditButton
          label="Region 복제"
          text="DUP"
          disabled={!hasSelectedRegions}
          shortcut={KeyboardShortcutAction.DUPLICATE_REGIONS}
          onClick={duplicate}
        />
      </div>
      <div className={styles.buttonGroup}>
        <EditButton
          label="Region 뒤로 nudge"
          text="←"
          disabled={!hasSelectedRegions}
          shortcut={KeyboardShortcutAction.NUDGE_REGIONS_BACKWARD}
          onClick={() => nudge(-REGION_NUDGE_SECONDS)}
        />
        <EditButton
          label="Region 앞으로 nudge"
          text="→"
          disabled={!hasSelectedRegions}
          shortcut={KeyboardShortcutAction.NUDGE_REGIONS_FORWARD}
          onClick={() => nudge(REGION_NUDGE_SECONDS)}
        />
        <EditButton
          label="Region 시작을 edit point에 정렬"
          text="A↤"
          disabled={!hasSelectedRegions}
          onClick={() => align('start')}
        />
        <EditButton
          label="Region 끝을 edit point에 정렬"
          text="A↦"
          disabled={!hasSelectedRegions}
          onClick={() => align('end')}
        />
      </div>
      <div className={styles.buttonGroup}>
        <EditButton
          label="Region Source 뒤로 slip"
          text="S←"
          disabled={!selectedRegionState || selectedRegionState.sourceStartTime <= 0}
          onClick={() => slip(-REGION_NUDGE_SECONDS)}
        />
        <EditButton
          label="Region Source 앞으로 slip"
          text="S→"
          disabled={!selectedRegionState}
          onClick={() => slip(REGION_NUDGE_SECONDS)}
        />
      </div>
      <div className={styles.buttonGroup}>
        <EditButton
          label="Region 정규화"
          text="NORM"
          disabled={!hasSelectedRegions}
          onClick={() => execute({ type: AudioCommandType.NORMALIZE_SELECTED_REGIONS, targetPeak: 0.98 })}
        />
        <EditButton
          label="Region 뒤집기"
          text="REV"
          disabled={!hasSelectedRegions}
          onClick={() => execute({ type: AudioCommandType.REVERSE_SELECTED_REGIONS })}
        />
        <EditButton
          label="Region 무음 제거"
          text="STRIP"
          disabled={!hasSelectedRegions}
          onClick={() =>
            execute({
              type: AudioCommandType.STRIP_SILENCE_SELECTED_REGIONS,
              minimumSilenceSeconds: 0.2,
              thresholdDb: -60,
            })
          }
        />
        <EditButton
          label="Region Crossfade 생성"
          text="XFADE"
          disabled={!crossfadeCandidate}
          onClick={createCrossfade}
        />
        <EditButton label="Region Crossfade 제거" text="X-" disabled={!removableCrossfade} onClick={removeCrossfade} />
      </div>
    </section>
  );
}

interface SelectedRegionState {
  readonly region: RegionState;
  readonly trackId: string;
}

function resolveCrossfadeCandidate(selectedRegions: readonly SelectedRegionState[]): {
  readonly fadeInRegionId: string;
  readonly fadeOutRegionId: string;
  readonly trackId: string;
} | null {
  if (selectedRegions.length !== 2 || selectedRegions[0]?.trackId !== selectedRegions[1]?.trackId) {
    return null;
  }
  const [fadeOutRegion, fadeInRegion] = [...selectedRegions].sort(
    (left, right) => left.region.startTime - right.region.startTime
  );
  if (!fadeOutRegion || !fadeInRegion || fadeOutRegion.region.startTime === fadeInRegion.region.startTime) {
    return null;
  }
  const fadeOutEndTime = fadeOutRegion.region.startTime + fadeOutRegion.region.duration;
  const fadeInEndTime = fadeInRegion.region.startTime + fadeInRegion.region.duration;
  if (fadeOutEndTime <= fadeInRegion.region.startTime || fadeOutEndTime > fadeInEndTime) {
    return null;
  }
  return {
    fadeInRegionId: fadeInRegion.region.id,
    fadeOutRegionId: fadeOutRegion.region.id,
    trackId: fadeOutRegion.trackId,
  };
}

function resolveRemovableCrossfade(selectedRegions: readonly SelectedRegionState[]): {
  readonly crossfadeId: string;
  readonly trackId: string;
} | null {
  const firstSelection = selectedRegions[0];
  if (!firstSelection || selectedRegions.some(selection => selection.trackId !== firstSelection.trackId)) {
    return null;
  }
  const selectedCrossfadeIds = new Set(
    selectedRegions.flatMap(({ region }) =>
      [region.fadeIn.crossfadeId, region.fadeOut.crossfadeId].filter(
        (crossfadeId): crossfadeId is string => crossfadeId !== null
      )
    )
  );
  const [crossfadeId] = selectedCrossfadeIds;
  return selectedCrossfadeIds.size === 1 && crossfadeId ? { crossfadeId, trackId: firstSelection.trackId } : null;
}

function EditButton({
  disabled,
  label,
  onClick,
  shortcut,
  text,
}: {
  readonly disabled: boolean;
  readonly label: string;
  readonly onClick: () => Promise<unknown>;
  readonly shortcut?: KeyboardShortcutAction;
  readonly text: string;
}) {
  const title = shortcut ? `${label} (${KEYBOARD_SHORTCUT_LABELS[shortcut]})` : label;
  return (
    <button
      type="button"
      className={styles.button}
      aria-label={label}
      disabled={disabled}
      onClick={() => void onClick()}
      title={title}
    >
      {text}
    </button>
  );
}
