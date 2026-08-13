import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type MouseEvent, type PointerEvent } from 'react';
import type { TrackState } from '@/layers/session/session';
import {
  AUTOMATION_INTERPOLATIONS,
  getAutomationTargetKey,
  type AutomationInterpolation,
  type AutomationLaneState,
  type AutomationTarget,
} from '@/layers/shared/types/automation-state';
import type { PluginCatalogEntry } from '@/layers/shared/types/plugin-state';
import type { RoutingGraphSnapshot } from '@/layers/shared/types/routing-state';
import type { TimelineCoordinateMapper } from '@/layers/shared/timeline-coordinate-mapper';
import {
  addAutomationPoint,
  copyAutomationPoints,
  deleteAutomationPoints,
  eraseAutomationRange,
  moveAutomationPoint,
  pasteAutomationPoints,
  type AutomationPointClipboard,
} from './automation-lane-edits';
import * as styles from './AutomationLaneEditor.css.ts';

const AUTOMATION_LANE_HEIGHT = 80;
const KEYBOARD_TIME_STEP_SECONDS = 0.1;
const KEYBOARD_VALUE_STEP = 0.01;
const AUTOMATABLE_PLUGIN_MANIFEST_IDS = new Set(['builtin.gain']);
const EMPTY_AUTOMATION_LANES: readonly AutomationLaneState[] = [];

interface AutomationTargetOption {
  readonly key: string;
  readonly label: string;
  readonly target: AutomationTarget;
}

interface AutomationLaneEditorProps {
  readonly coordinateMapper: TimelineCoordinateMapper;
  readonly createId?: () => string;
  readonly editPointSeconds: number;
  readonly onChange: (automationLanes: readonly AutomationLaneState[]) => Promise<void>;
  readonly pluginCatalog: ReadonlyMap<string, PluginCatalogEntry>;
  readonly routingGraph: RoutingGraphSnapshot;
  readonly selectedRange: { readonly endTimeSeconds: number; readonly startTimeSeconds: number } | null;
  readonly track: TrackState;
  readonly trackNamesById: ReadonlyMap<string, string>;
}

interface PointDragState {
  readonly didMove: boolean;
  readonly lane: AutomationLaneState;
  readonly pointId: string;
  readonly pointerId: number;
}

export function AutomationLaneEditor({
  coordinateMapper,
  createId = () => globalThis.crypto.randomUUID(),
  editPointSeconds,
  onChange,
  pluginCatalog,
  routingGraph,
  selectedRange,
  track,
  trackNamesById,
}: AutomationLaneEditorProps) {
  const automationLanes = track.automationLanes ?? EMPTY_AUTOMATION_LANES;
  const targetOptions = useMemo(
    () => createAutomationTargetOptions({ automationLanes, pluginCatalog, routingGraph, track, trackNamesById }),
    [automationLanes, pluginCatalog, routingGraph, track, trackNamesById]
  );
  const [selectedTargetKey, setSelectedTargetKey] = useState(
    getAutomationTargetKey(automationLanes[0]?.target ?? { kind: 'trackVolume' })
  );
  const [selectedPointIds, setSelectedPointIds] = useState<ReadonlySet<string>>(new Set());
  const [clipboard, setClipboard] = useState<AutomationPointClipboard | null>(null);
  const [isPending, setIsPending] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [previewLane, setPreviewLane] = useState<AutomationLaneState | null>(null);
  const laneElementRef = useRef<HTMLDivElement>(null);
  const pointDragRef = useRef<PointDragState | null>(null);

  const selectedLane = automationLanes.find(lane => getAutomationTargetKey(lane.target) === selectedTargetKey);
  const displayedLane = previewLane?.id === selectedLane?.id ? previewLane : selectedLane;
  const selectedTarget = targetOptions.find(option => option.key === selectedTargetKey);

  useEffect(() => {
    if (targetOptions.some(option => option.key === selectedTargetKey)) {
      return;
    }
    setSelectedTargetKey(targetOptions[0]?.key ?? 'trackVolume');
  }, [selectedTargetKey, targetOptions]);

  useEffect(() => {
    const availablePointIds = new Set(selectedLane?.points.map(point => point.id) ?? []);
    setSelectedPointIds(currentIds => new Set([...currentIds].filter(pointId => availablePointIds.has(pointId))));
  }, [selectedLane]);

  const commitAutomationLanes = async (nextLanes: readonly AutomationLaneState[]) => {
    if (isPending) {
      return;
    }
    setIsPending(true);
    setErrorMessage(null);
    try {
      await onChange(nextLanes);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setIsPending(false);
    }
  };

  const commitSelectedLane = async (lane: AutomationLaneState) => {
    await commitAutomationLanes(automationLanes.map(candidate => (candidate.id === lane.id ? lane : candidate)));
  };

  const handleAddLane = async () => {
    if (!selectedTarget || selectedLane) {
      return;
    }
    await commitAutomationLanes([
      ...automationLanes,
      { id: createId(), isEnabled: true, points: [], target: selectedTarget.target },
    ]);
  };

  const handleRemoveLane = async () => {
    if (!selectedLane) {
      return;
    }
    await commitAutomationLanes(automationLanes.filter(lane => lane.id !== selectedLane.id));
  };

  const handleAddPoint = async (timeSeconds: number, value: number) => {
    if (!selectedLane) {
      return;
    }
    const nextLane = addAutomationPoint({
      lane: selectedLane,
      point: { id: createId(), interpolation: 'linear', timeSeconds, value },
    });
    await commitSelectedLane(nextLane);
  };

  const handleLaneDoubleClick = (event: MouseEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget || !selectedLane) {
      return;
    }
    const position = resolvePointerPosition({ coordinateMapper, event, laneElement: event.currentTarget });
    void handleAddPoint(position.timeSeconds, position.value);
  };

  const handlePointSelection = (pointId: string, additive: boolean) => {
    setSelectedPointIds(currentIds => {
      const nextIds = additive ? new Set(currentIds) : new Set<string>();
      if (nextIds.has(pointId)) {
        nextIds.delete(pointId);
      } else {
        nextIds.add(pointId);
      }
      return nextIds;
    });
  };

  const handleDeletePoints = async () => {
    if (!selectedLane || selectedPointIds.size === 0) {
      return;
    }
    const nextLane = deleteAutomationPoints({ lane: selectedLane, pointIds: selectedPointIds });
    await commitSelectedLane(nextLane);
  };

  const handleCopyPoints = () => {
    if (!selectedLane || selectedPointIds.size === 0) {
      return;
    }
    setClipboard(copyAutomationPoints({ lane: selectedLane, pointIds: selectedPointIds }));
  };

  const handlePastePoints = async () => {
    if (!clipboard || !selectedLane || clipboard.points.length === 0) {
      return;
    }
    const nextLane = pasteAutomationPoints({
      clipboard,
      createId,
      lane: selectedLane,
      startTimeSeconds: editPointSeconds,
    });
    await commitSelectedLane(nextLane);
  };

  const handleEraseRange = async () => {
    if (!selectedLane || !selectedRange) {
      return;
    }
    const nextLane = eraseAutomationRange({ lane: selectedLane, ...selectedRange });
    await commitSelectedLane(nextLane);
  };

  const handleInterpolationChange = async (interpolation: AutomationInterpolation) => {
    if (!selectedLane || selectedPointIds.size === 0) {
      return;
    }
    await commitSelectedLane({
      ...selectedLane,
      points: selectedLane.points.map(point => (selectedPointIds.has(point.id) ? { ...point, interpolation } : point)),
    });
  };

  const handlePointKeyboard = async (event: KeyboardEvent<HTMLButtonElement>, pointId: string) => {
    if (!selectedLane) {
      return;
    }
    if (event.key === 'Delete' || event.key === 'Backspace') {
      event.preventDefault();
      await commitSelectedLane(deleteAutomationPoints({ lane: selectedLane, pointIds: new Set([pointId]) }));
      return;
    }
    const point = selectedLane.points.find(candidate => candidate.id === pointId);
    if (!point || !['ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowUp'].includes(event.key)) {
      return;
    }
    event.preventDefault();
    const timeChange =
      event.key === 'ArrowLeft'
        ? -KEYBOARD_TIME_STEP_SECONDS
        : event.key === 'ArrowRight'
          ? KEYBOARD_TIME_STEP_SECONDS
          : 0;
    const valueChange =
      event.key === 'ArrowDown' ? -KEYBOARD_VALUE_STEP : event.key === 'ArrowUp' ? KEYBOARD_VALUE_STEP : 0;
    await commitSelectedLane(
      moveAutomationPoint({
        lane: selectedLane,
        pointId,
        timeSeconds: point.timeSeconds + timeChange,
        value: point.value + valueChange,
      })
    );
  };

  const handlePointPointerDown = (event: PointerEvent<HTMLButtonElement>, pointId: string) => {
    if (!selectedLane || event.button !== 0 || !event.isPrimary) {
      return;
    }
    pointDragRef.current = { didMove: false, lane: selectedLane, pointId, pointerId: event.pointerId };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointPointerMove = (event: PointerEvent<HTMLButtonElement>) => {
    const dragState = pointDragRef.current;
    const laneElement = laneElementRef.current;
    if (!dragState || dragState.pointerId !== event.pointerId || !laneElement) {
      return;
    }
    const position = resolvePointerPosition({ coordinateMapper, event, laneElement });
    const nextLane = moveAutomationPoint({ ...position, lane: dragState.lane, pointId: dragState.pointId });
    pointDragRef.current = { ...dragState, didMove: true, lane: nextLane };
    setPreviewLane(nextLane);
  };

  const handlePointPointerUp = async (event: PointerEvent<HTMLButtonElement>) => {
    const dragState = pointDragRef.current;
    if (!dragState || dragState.pointerId !== event.pointerId) {
      return;
    }
    pointDragRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    setPreviewLane(null);
    if (dragState.didMove) {
      await commitSelectedLane(dragState.lane);
    }
  };

  const handlePointPointerCancel = (event: PointerEvent<HTMLButtonElement>) => {
    if (pointDragRef.current?.pointerId !== event.pointerId) {
      return;
    }
    pointDragRef.current = null;
    setPreviewLane(null);
  };

  const linePoints = displayedLane?.points
    .map(point => `${coordinateMapper.secondsToPixels(point.timeSeconds)},${valueToPixel(point.value)}`)
    .join(' ');

  return (
    <>
      <div className={styles.automationHeader}>
        <div className={styles.automationControls}>
          <select
            aria-label={`${track.name} Automation 대상`}
            className={styles.automationControl}
            disabled={isPending}
            onChange={event => setSelectedTargetKey(event.currentTarget.value)}
            value={selectedTargetKey}
          >
            {targetOptions.map(option => (
              <option key={option.key} value={option.key}>
                {option.label}
              </option>
            ))}
          </select>
          {selectedLane ? (
            <>
              <button
                aria-label={`${track.name} Automation Lane 활성화`}
                aria-pressed={selectedLane.isEnabled}
                className={styles.automationControl}
                disabled={isPending}
                onClick={() => void commitSelectedLane({ ...selectedLane, isEnabled: !selectedLane.isEnabled })}
                type="button"
              >
                {selectedLane.isEnabled ? 'READ' : 'OFF'}
              </button>
              <button
                aria-label={`${track.name} Automation Lane 삭제`}
                className={styles.automationControl}
                disabled={isPending}
                onClick={() => void handleRemoveLane()}
                type="button"
              >
                −
              </button>
            </>
          ) : (
            <button
              aria-label={`${track.name} Automation Lane 추가`}
              className={styles.automationControl}
              disabled={isPending || !selectedTarget}
              onClick={() => void handleAddLane()}
              type="button"
            >
              + LANE
            </button>
          )}
        </div>
        <div className={styles.automationToolbar}>
          <button
            aria-label={`${track.name} Automation 점 추가`}
            className={styles.automationControl}
            disabled={isPending || !selectedLane}
            onClick={() => void handleAddPoint(editPointSeconds, 0.5)}
            type="button"
          >
            + POINT
          </button>
          <button
            aria-label="선택한 Automation 점 복사"
            className={styles.automationControl}
            disabled={isPending || selectedPointIds.size === 0}
            onClick={handleCopyPoints}
            type="button"
          >
            COPY
          </button>
          <button
            aria-label="Automation 점 붙여넣기"
            className={styles.automationControl}
            disabled={isPending || !clipboard || clipboard.points.length === 0}
            onClick={() => void handlePastePoints()}
            type="button"
          >
            PASTE
          </button>
          <button
            aria-label="선택한 Automation 점 삭제"
            className={styles.automationControl}
            disabled={isPending || selectedPointIds.size === 0}
            onClick={() => void handleDeletePoints()}
            type="button"
          >
            DELETE
          </button>
          <button
            aria-label="선택 Range Automation 지우기"
            className={styles.automationControl}
            disabled={isPending || !selectedLane || !selectedRange}
            onClick={() => void handleEraseRange()}
            type="button"
          >
            ERASE RANGE
          </button>
          <select
            aria-label="선택한 Automation 점 보간"
            className={styles.automationControl}
            disabled={isPending || selectedPointIds.size === 0}
            onChange={event => void handleInterpolationChange(event.currentTarget.value as AutomationInterpolation)}
            value={selectedLane?.points.find(point => selectedPointIds.has(point.id))?.interpolation ?? 'linear'}
          >
            {AUTOMATION_INTERPOLATIONS.map(interpolation => (
              <option key={interpolation} value={interpolation}>
                {interpolation}
              </option>
            ))}
          </select>
        </div>
        {errorMessage ? (
          <div aria-live="polite" className={styles.automationError} role="status">
            {errorMessage}
          </div>
        ) : null}
      </div>
      <div
        aria-label={`${track.name} Automation Lane`}
        className={styles.automationLane}
        onDoubleClick={handleLaneDoubleClick}
        ref={laneElementRef}
      >
        {selectedRange ? (
          <div
            className={styles.automationRange}
            style={{
              left: coordinateMapper.secondsToPixels(selectedRange.startTimeSeconds),
              width: coordinateMapper.durationToPixels({
                durationSeconds: selectedRange.endTimeSeconds - selectedRange.startTimeSeconds,
                startSeconds: selectedRange.startTimeSeconds,
              }),
            }}
          />
        ) : null}
        {linePoints ? (
          <svg aria-hidden="true" className={styles.automationLine} height={AUTOMATION_LANE_HEIGHT} width="100%">
            <polyline fill="none" points={linePoints} stroke="#ff68dc" strokeWidth={1.5} />
          </svg>
        ) : null}
        {displayedLane?.points.map(point => (
          <button
            aria-label={`${track.name} Automation point ${point.timeSeconds.toFixed(2)} seconds ${point.value.toFixed(2)}`}
            aria-pressed={selectedPointIds.has(point.id)}
            className={`${styles.automationPoint} ${selectedPointIds.has(point.id) ? styles.selectedAutomationPoint : ''}`}
            data-point-id={point.id}
            key={point.id}
            onClick={event => handlePointSelection(point.id, event.shiftKey)}
            onKeyDown={event => void handlePointKeyboard(event, point.id)}
            onPointerCancel={handlePointPointerCancel}
            onPointerDown={event => handlePointPointerDown(event, point.id)}
            onPointerMove={handlePointPointerMove}
            onPointerUp={event => void handlePointPointerUp(event)}
            style={{ left: coordinateMapper.secondsToPixels(point.timeSeconds), top: valueToPixel(point.value) }}
            title={`${point.timeSeconds.toFixed(2)}s · ${point.value.toFixed(2)} · ${point.interpolation}`}
            type="button"
          />
        ))}
      </div>
    </>
  );
}

function createAutomationTargetOptions({
  automationLanes,
  pluginCatalog,
  routingGraph,
  track,
  trackNamesById,
}: {
  readonly automationLanes: readonly AutomationLaneState[];
  readonly pluginCatalog: ReadonlyMap<string, PluginCatalogEntry>;
  readonly routingGraph: RoutingGraphSnapshot;
  readonly track: TrackState;
  readonly trackNamesById: ReadonlyMap<string, string>;
}): AutomationTargetOption[] {
  const options: AutomationTargetOption[] = [
    createTargetOption({ kind: 'trackVolume' }, 'Volume'),
    createTargetOption({ kind: 'trackPan' }, 'Pan'),
  ];

  routingGraph.sends
    .filter(send => send.sourceTrackId === track.id && send.isEnabled)
    .forEach(send => {
      options.push(
        createTargetOption(
          { kind: 'sendGain', sendId: send.id },
          `Send → ${trackNamesById.get(send.destinationTrackId) ?? send.destinationTrackId}`
        )
      );
    });

  track.pluginInstances
    .filter(instance => instance.isEnabled && AUTOMATABLE_PLUGIN_MANIFEST_IDS.has(instance.manifestSummary.id))
    .forEach(instance => {
      const manifest = pluginCatalog.get(instance.manifestSummary.id);
      manifest?.parameters
        .filter(parameter => parameter.type === 'number')
        .forEach(parameter => {
          options.push(
            createTargetOption(
              { kind: 'pluginParameter', parameterId: parameter.id, pluginInstanceId: instance.id },
              `${instance.manifestSummary.name} / ${parameter.name}`
            )
          );
        });
    });

  automationLanes.forEach(lane => {
    const key = getAutomationTargetKey(lane.target);
    if (!options.some(option => option.key === key)) {
      options.push(createTargetOption(lane.target, describeAutomationTarget(lane.target)));
    }
  });

  return options;
}

function createTargetOption(target: AutomationTarget, label: string): AutomationTargetOption {
  return { key: getAutomationTargetKey(target), label, target };
}

function describeAutomationTarget(target: AutomationTarget): string {
  switch (target.kind) {
    case 'trackVolume':
      return 'Volume';
    case 'trackPan':
      return 'Pan';
    case 'sendGain':
      return `Send ${target.sendId.slice(0, 8)}`;
    case 'pluginParameter':
      return `Plugin ${target.parameterId}`;
  }
}

function resolvePointerPosition({
  coordinateMapper,
  event,
  laneElement,
}: {
  readonly coordinateMapper: TimelineCoordinateMapper;
  readonly event: Pick<MouseEvent<HTMLDivElement> | PointerEvent<HTMLButtonElement>, 'clientX' | 'clientY'>;
  readonly laneElement: HTMLDivElement;
}): { readonly timeSeconds: number; readonly value: number } {
  const bounds = laneElement.getBoundingClientRect();
  const x = Math.max(0, event.clientX - bounds.left);
  const laneHeight = bounds.height > 0 ? bounds.height : AUTOMATION_LANE_HEIGHT;
  const y = Math.min(laneHeight, Math.max(0, event.clientY - bounds.top));
  return {
    timeSeconds: coordinateMapper.pixelsToSeconds(x),
    value: 1 - y / laneHeight,
  };
}

function valueToPixel(value: number): number {
  return (1 - value) * AUTOMATION_LANE_HEIGHT;
}
