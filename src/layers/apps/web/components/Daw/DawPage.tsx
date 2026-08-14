import { useState, useRef, useCallback, useEffect, useMemo, type CSSProperties } from 'react';
import { DawHeader, type WorkspaceView } from './components/DawHeader/DawHeader';
import { MixerView } from './components/MixerView/MixerView';
import { MediaSourcePanel } from './components/MediaSourcePanel/MediaSourcePanel';
import { TrackList } from './components/TrackList/TrackList';
import { Terminal } from './components/Terminals/Terminal';
import { TrackInfoSidebar } from './components/TrackInfoSidebar/TrackInfoSidebar';
import { TimeRuler } from './components/TimeRuler/TimeRuler';
import * as styles from './DawPage.css.ts';
import { useEditorRuntimeState, usePlaybackClock, useSession } from '@/layers/apps/web/context/layer-hooks';
import {
  KeyboardShortcutAction,
  KEYBOARD_SHORTCUT_LABELS,
  useGlobalKeyboardShortcuts,
  useKeyboardShortcutAction,
} from '@/layers/apps/web/keyboard-shortcuts/keyboard-shortcuts';
import {
  clampTimelinePixelsPerQuarterNote,
  DEFAULT_TIMELINE_PIXELS_PER_QUARTER_NOTE,
  TIMELINE_ZOOM_FACTOR,
} from './timeline-zoom';
import { getMaxDuration } from './get-max-duration';
import { getTimelineContentWidth } from './timeline-content-width';
import { TimelineCoordinateMapper } from '@/layers/shared/timeline-coordinate-mapper';
import { TimelineGridControls } from './components/TimelineGridControls/TimelineGridControls';
import type { TimelineGridDivision, TimelineSnapMode } from './timeline-grid';
import { TimelineNavigationControls } from './components/TimelineNavigationControls/TimelineNavigationControls';
import { TempoMeterRuler } from './components/TempoMeterRuler/TempoMeterRuler';
import { MarkerRangeRuler } from './components/MarkerRangeRuler/MarkerRangeRuler';
import {
  calculateTimelineZoomScrollLeft,
  resolveTimelineZoomAnchor,
  TRACK_HEADER_WIDTH_PX,
  type TimelineZoomFocus,
} from './timeline-navigation';

const CHAT_PANEL_MIN_WIDTH = 280;
const CHAT_PANEL_MAX_WIDTH = 600;
const CHAT_PANEL_DEFAULT_WIDTH = 350;
const WHEEL_DELTA_MODE_LINE = 1;
const WHEEL_DELTA_MODE_PAGE = 2;
const WHEEL_LINE_DISTANCE = 16;

type TimelineWidthStyle = CSSProperties & {
  '--timeline-content-width': string;
};

function getShiftWheelHorizontalDelta(event: WheelEvent, pageWidth: number): number | null {
  if (!event.shiftKey || event.ctrlKey || event.metaKey || event.deltaX !== 0 || event.deltaY === 0) {
    return null;
  }

  if (event.deltaMode === WHEEL_DELTA_MODE_LINE) {
    return event.deltaY * WHEEL_LINE_DISTANCE;
  }

  if (event.deltaMode === WHEEL_DELTA_MODE_PAGE) {
    return event.deltaY * pageWidth;
  }

  return event.deltaY;
}

export function DawPage() {
  const tracks = useSession(state => state.tracks);
  const tempo = useSession(state => state.tempo);
  const tempoChanges = useSession(state => state.tempoChanges);
  const meterChanges = useSession(state => state.meterChanges);
  const editPointSeconds = useEditorRuntimeState().selection.editPointSeconds;
  const trackCount = tracks.size;
  const [isTerminalOpen, setIsTerminalOpen] = useState(true);
  const [isTrackInfoOpen, setIsTrackInfoOpen] = useState(false);
  const [chatPanelWidth, setChatPanelWidth] = useState(CHAT_PANEL_DEFAULT_WIDTH);
  const [isResizing, setIsResizing] = useState(false);
  const [pixelsPerQuarterNote, setPixelsPerQuarterNote] = useState(DEFAULT_TIMELINE_PIXELS_PER_QUARTER_NOTE);
  const [gridDivision, setGridDivision] = useState<TimelineGridDivision>('beat');
  const [snapMode, setSnapMode] = useState<TimelineSnapMode>('grid');
  const [isGridVisible, setIsGridVisible] = useState(true);
  const [zoomFocus, setZoomFocus] = useState<TimelineZoomFocus>('mouse');
  const [followPlayhead, setFollowPlayhead] = useState(true);
  const [requestedTrackId, setRequestedTrackId] = useState<string | null>(null);
  const [workspaceView, setWorkspaceView] = useState<WorkspaceView>('editor');
  const resizeStartXRef = useRef(0);
  const resizeStartWidthRef = useRef(CHAT_PANEL_DEFAULT_WIDTH);
  const mainContentRef = useRef<HTMLDivElement>(null);
  const lastMouseViewportPixelRef = useRef<number | null>(null);
  const playbackClock = usePlaybackClock();
  const coordinateMapper = useMemo(
    () =>
      new TimelineCoordinateMapper({
        tempoBpm: tempo,
        beatsPerBar: 4,
        beatUnit: 4,
        pixelsPerQuarterNote,
        tempoChanges,
        meterChanges,
      }),
    [meterChanges, pixelsPerQuarterNote, tempo, tempoChanges]
  );
  const gridSettings = useMemo(() => ({ division: gridDivision, snapMode }), [gridDivision, snapMode]);
  const timelineContentWidth = useMemo(
    () =>
      getTimelineContentWidth({
        durationSeconds: getMaxDuration(Array.from(tracks.values())),
        coordinateMapper,
      }),
    [coordinateMapper, tracks]
  );
  const timelineWidthStyle: TimelineWidthStyle = {
    // Region은 절대 위치 요소이므로 명시적 폭이 없으면 상위 scrollWidth를 늘리지 못한다.
    '--timeline-content-width': `${timelineContentWidth}px`,
  };
  const firstTrackId = tracks.keys().next().value ?? null;
  // 선택했던 Track이 삭제되면 Inspector가 빈 ID를 유지하지 않고 첫 Track으로 즉시 전환한다.
  const selectedTrackId = requestedTrackId !== null && tracks.has(requestedTrackId) ? requestedTrackId : firstTrackId;

  const applyTimelineZoom = useCallback(
    (nextPixelsPerQuarterNote: number, mouseViewportPixel?: number) => {
      const mainContent = mainContentRef.current;
      const nextScale = clampTimelinePixelsPerQuarterNote(nextPixelsPerQuarterNote);
      if (!mainContent || nextScale === coordinateMapper.pixelsPerQuarterNote) {
        setPixelsPerQuarterNote(nextScale);
        return;
      }

      const centerViewportPixel = (TRACK_HEADER_WIDTH_PX + mainContent.clientWidth) / 2;
      const { anchorQuarterNotes, anchorViewportPixel } = resolveTimelineZoomAnchor({
        clientWidth: mainContent.clientWidth,
        editPointQuarterNotes: coordinateMapper.secondsToQuarterNotes(editPointSeconds),
        focus: zoomFocus,
        mouseViewportPixel: mouseViewportPixel ?? lastMouseViewportPixelRef.current ?? centerViewportPixel,
        pixelsPerQuarterNote: coordinateMapper.pixelsPerQuarterNote,
        playheadQuarterNotes: coordinateMapper.secondsToQuarterNotes(playbackClock.getCurrentTime()),
        scrollLeft: mainContent.scrollLeft,
      });
      const requestedScrollLeft = calculateTimelineZoomScrollLeft({
        anchorQuarterNotes,
        anchorViewportPixel,
        nextPixelsPerQuarterNote: nextScale,
      });

      setPixelsPerQuarterNote(nextScale);
      requestAnimationFrame(() => {
        mainContent.scrollLeft = requestedScrollLeft;
      });
    },
    [coordinateMapper, editPointSeconds, playbackClock, zoomFocus]
  );

  const handleFitSession = useCallback(() => {
    const mainContent = mainContentRef.current;
    const maxDuration = getMaxDuration(Array.from(tracks.values()));
    const sessionQuarterNotes = coordinateMapper.secondsToQuarterNotes(maxDuration);
    if (!mainContent || sessionQuarterNotes === 0) {
      applyTimelineZoom(DEFAULT_TIMELINE_PIXELS_PER_QUARTER_NOTE);
      return;
    }

    const availableWidth = Math.max(1, mainContent.clientWidth - TRACK_HEADER_WIDTH_PX - 24);
    setPixelsPerQuarterNote(clampTimelinePixelsPerQuarterNote(availableWidth / sessionQuarterNotes));
    requestAnimationFrame(() => {
      mainContent.scrollLeft = 0;
    });
  }, [applyTimelineZoom, coordinateMapper, tracks]);

  useGlobalKeyboardShortcuts();
  useKeyboardShortcutAction(KeyboardShortcutAction.TOGGLE_INSPECTOR, () => {
    setIsTrackInfoOpen(current => !current);
  });
  useKeyboardShortcutAction(KeyboardShortcutAction.TOGGLE_TERMINAL, () => {
    setIsTerminalOpen(current => !current);
  });
  useKeyboardShortcutAction(KeyboardShortcutAction.ZOOM_IN, () => {
    applyTimelineZoom(coordinateMapper.pixelsPerQuarterNote * TIMELINE_ZOOM_FACTOR);
  });
  useKeyboardShortcutAction(KeyboardShortcutAction.ZOOM_OUT, () => {
    applyTimelineZoom(coordinateMapper.pixelsPerQuarterNote / TIMELINE_ZOOM_FACTOR);
  });
  useKeyboardShortcutAction(KeyboardShortcutAction.RESET_ZOOM, () => {
    applyTimelineZoom(DEFAULT_TIMELINE_PIXELS_PER_QUARTER_NOTE);
  });

  const handleResizeStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      setIsResizing(true);
      resizeStartXRef.current = e.clientX;
      resizeStartWidthRef.current = chatPanelWidth;
    },
    [chatPanelWidth]
  );

  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = resizeStartXRef.current - e.clientX;
      const newWidth = Math.min(
        CHAT_PANEL_MAX_WIDTH,
        Math.max(CHAT_PANEL_MIN_WIDTH, resizeStartWidthRef.current + deltaX)
      );
      setChatPanelWidth(newWidth);
    };

    const handleMouseUp = () => setIsResizing(false);

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isResizing]);

  useEffect(() => {
    const mainContent = mainContentRef.current;
    if (!mainContent) {
      return;
    }

    const handleTimelineWheel = (event: WheelEvent) => {
      const bounds = mainContent.getBoundingClientRect();
      const mouseViewportPixel = event.clientX - bounds.left;
      lastMouseViewportPixelRef.current = mouseViewportPixel;
      if (event.ctrlKey || event.metaKey) {
        event.preventDefault();
        const zoomFactor = event.deltaY > 0 ? 1 / TIMELINE_ZOOM_FACTOR : TIMELINE_ZOOM_FACTOR;
        applyTimelineZoom(coordinateMapper.pixelsPerQuarterNote * zoomFactor, mouseViewportPixel);
        return;
      }

      const horizontalDelta = getShiftWheelHorizontalDelta(event, mainContent.clientWidth);
      const hasHorizontalOverflow = mainContent.scrollWidth > mainContent.clientWidth;
      if (horizontalDelta === null || !hasHorizontalOverflow) {
        return;
      }

      event.preventDefault();
      mainContent.scrollLeft += horizontalDelta;
    };

    mainContent.addEventListener('wheel', handleTimelineWheel, { passive: false });
    const handleMouseMove = (event: MouseEvent) => {
      lastMouseViewportPixelRef.current = event.clientX - mainContent.getBoundingClientRect().left;
    };
    mainContent.addEventListener('mousemove', handleMouseMove);
    return () => {
      mainContent.removeEventListener('wheel', handleTimelineWheel);
      mainContent.removeEventListener('mousemove', handleMouseMove);
    };
  }, [applyTimelineZoom, coordinateMapper]);

  return (
    <div className={styles.container}>
      <button
        className={`${styles.leftToggleButton} ${isTrackInfoOpen ? styles.leftToggleButtonOpen : ''}`}
        onClick={() => setIsTrackInfoOpen(!isTrackInfoOpen)}
        title={`${isTrackInfoOpen ? 'Close Track Info' : 'Open Track Info'} (${KEYBOARD_SHORTCUT_LABELS[KeyboardShortcutAction.TOGGLE_INSPECTOR]})`}
        aria-label={isTrackInfoOpen ? 'Close track inspector' : 'Open track inspector'}
        aria-keyshortcuts="I"
      >
        INSPECTOR
      </button>

      <button
        className={`${styles.cliToggleButton} ${isTerminalOpen ? styles.cliToggleButtonOpen : ''} ${
          isResizing ? styles.cliToggleButtonResizing : ''
        }`}
        style={isTerminalOpen ? { right: `${chatPanelWidth}px` } : undefined}
        onClick={() => setIsTerminalOpen(!isTerminalOpen)}
        title={`${isTerminalOpen ? 'Close Terminal' : 'Open Terminal'} (${KEYBOARD_SHORTCUT_LABELS[KeyboardShortcutAction.TOGGLE_TERMINAL]})`}
        aria-label={isTerminalOpen ? 'Close terminal' : 'Open terminal'}
        aria-keyshortcuts="`"
      >
        TERMINAL
      </button>

      <div className={`${styles.leftPanel} ${!isTrackInfoOpen ? styles.leftPanelCollapsed : ''}`}>
        {isTrackInfoOpen ? <TrackInfoSidebar selectedTrackId={selectedTrackId} /> : null}
      </div>

      <div ref={mainContentRef} className={styles.mainContent} style={timelineWidthStyle}>
        <DawHeader
          coordinateMapper={coordinateMapper}
          currentView={workspaceView}
          onViewChange={setWorkspaceView}
          trackCount={trackCount}
        />
        {workspaceView === 'editor' ? (
          <>
            <div className={styles.timelineHeader}>
              <div className={styles.trackHeaderRuler}>
                <span>TRACK CONTROLS</span>
                <span className={styles.trackCount}>{trackCount}</span>
              </div>
              <div className={styles.timelineRuler}>
                <div className={styles.timelineMeta}>
                  <span>BBT TIMELINE</span>
                  <TimelineGridControls
                    division={gridDivision}
                    isGridVisible={isGridVisible}
                    onDivisionChange={setGridDivision}
                    onGridVisibleChange={setIsGridVisible}
                    onSnapModeChange={setSnapMode}
                    snapMode={snapMode}
                  />
                  <TimelineNavigationControls
                    followPlayhead={followPlayhead}
                    onFitSession={handleFitSession}
                    onFollowPlayheadChange={setFollowPlayhead}
                    onResetZoom={() => applyTimelineZoom(DEFAULT_TIMELINE_PIXELS_PER_QUARTER_NOTE)}
                    onZoomFocusChange={setZoomFocus}
                    onZoomIn={() => applyTimelineZoom(coordinateMapper.pixelsPerQuarterNote * TIMELINE_ZOOM_FACTOR)}
                    onZoomOut={() => applyTimelineZoom(coordinateMapper.pixelsPerQuarterNote / TIMELINE_ZOOM_FACTOR)}
                    zoomFocus={zoomFocus}
                  />
                  <span>{Math.round(pixelsPerQuarterNote)} PX/♩</span>
                </div>
                <TempoMeterRuler
                  coordinateMapper={coordinateMapper}
                  gridSettings={gridSettings}
                  timelineContentWidth={timelineContentWidth}
                />
                <MarkerRangeRuler
                  coordinateMapper={coordinateMapper}
                  gridSettings={gridSettings}
                  timelineContentWidth={timelineContentWidth}
                />
                <TimeRuler coordinateMapper={coordinateMapper} gridSettings={gridSettings} />
              </div>
            </div>
            <TrackList
              coordinateMapper={coordinateMapper}
              followPlayhead={followPlayhead}
              gridSettings={gridSettings}
              isGridVisible={isGridVisible}
              selectedTrackId={selectedTrackId}
              timelineContentWidth={timelineContentWidth}
              timelineViewportRef={mainContentRef}
              onTrackSelect={setRequestedTrackId}
            />
          </>
        ) : workspaceView === 'mixer' ? (
          <MixerView />
        ) : (
          <MediaSourcePanel />
        )}
      </div>
      <div
        className={`${styles.cliPanel} ${!isTerminalOpen ? styles.cliPanelCollapsed : ''} ${isResizing ? styles.cliPanelResizing : ''}`}
        style={isTerminalOpen ? { width: chatPanelWidth } : undefined}
      >
        {isTerminalOpen && (
          <div className={styles.resizeHandle} onMouseDown={handleResizeStart} title="Drag to resize terminal" />
        )}
        <Terminal />
      </div>
    </div>
  );
}
