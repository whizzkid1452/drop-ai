import { useCallback } from 'react';
import { useCommandExecutor, useEditorRuntimeState, useSession } from '@/layers/apps/web/context/layer-hooks';
import {
  KeyboardShortcutAction,
  KEYBOARD_SHORTCUT_LABELS,
  useKeyboardShortcutAction,
} from '@/layers/apps/web/keyboard-shortcuts/keyboard-shortcuts';
import { AudioCommandType, type AudioCommand } from '@/types/audioCommand.schema';
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
    </section>
  );
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
