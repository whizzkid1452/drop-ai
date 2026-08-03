import { useState, useRef, useCallback, useEffect, useMemo, type CSSProperties } from 'react';
import { DawHeader } from './components/DawHeader/DawHeader';
import { TrackList } from './components/TrackList/TrackList';
import { Terminal } from './components/Terminals/Terminal';
import { TrackInfoSidebar } from './components/TrackInfoSidebar/TrackInfoSidebar';
import { TimeRuler } from './components/TimeRuler/TimeRuler';
import * as styles from './DawPage.css.ts';
import { useSession } from '@/layers/apps/web/context/layer-hooks';
import {
  KeyboardShortcutAction,
  KEYBOARD_SHORTCUT_LABELS,
  useGlobalKeyboardShortcuts,
  useKeyboardShortcutAction,
} from '@/layers/apps/web/keyboard-shortcuts/keyboard-shortcuts';
import {
  clampTimelinePixelsPerSecond,
  DEFAULT_TIMELINE_PIXELS_PER_SECOND,
  TIMELINE_ZOOM_FACTOR,
} from './timeline-zoom';
import { getMaxDuration } from './get-max-duration';
import { getTimelineContentWidth } from './timeline-content-width';

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
  const trackCount = tracks.size;
  const [isTerminalOpen, setIsTerminalOpen] = useState(true);
  const [isTrackInfoOpen, setIsTrackInfoOpen] = useState(false);
  const [chatPanelWidth, setChatPanelWidth] = useState(CHAT_PANEL_DEFAULT_WIDTH);
  const [isResizing, setIsResizing] = useState(false);
  const [pixelsPerSecond, setPixelsPerSecond] = useState(DEFAULT_TIMELINE_PIXELS_PER_SECOND);
  const resizeStartXRef = useRef(0);
  const resizeStartWidthRef = useRef(CHAT_PANEL_DEFAULT_WIDTH);
  const mainContentRef = useRef<HTMLDivElement>(null);
  const timelineContentWidth = useMemo(
    () =>
      getTimelineContentWidth({
        durationSeconds: getMaxDuration(Array.from(tracks.values())),
        pixelsPerSecond,
      }),
    [pixelsPerSecond, tracks]
  );
  const timelineWidthStyle: TimelineWidthStyle = {
    // Region은 절대 위치 요소이므로 명시적 폭이 없으면 상위 scrollWidth를 늘리지 못한다.
    '--timeline-content-width': `${timelineContentWidth}px`,
  };

  useGlobalKeyboardShortcuts();
  useKeyboardShortcutAction(KeyboardShortcutAction.TOGGLE_INSPECTOR, () => {
    setIsTrackInfoOpen(current => !current);
  });
  useKeyboardShortcutAction(KeyboardShortcutAction.TOGGLE_TERMINAL, () => {
    setIsTerminalOpen(current => !current);
  });
  useKeyboardShortcutAction(KeyboardShortcutAction.ZOOM_IN, () => {
    setPixelsPerSecond(current => clampTimelinePixelsPerSecond(current * TIMELINE_ZOOM_FACTOR));
  });
  useKeyboardShortcutAction(KeyboardShortcutAction.ZOOM_OUT, () => {
    setPixelsPerSecond(current => clampTimelinePixelsPerSecond(current / TIMELINE_ZOOM_FACTOR));
  });
  useKeyboardShortcutAction(KeyboardShortcutAction.RESET_ZOOM, () => {
    setPixelsPerSecond(DEFAULT_TIMELINE_PIXELS_PER_SECOND);
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
      const horizontalDelta = getShiftWheelHorizontalDelta(event, mainContent.clientWidth);
      const hasHorizontalOverflow = mainContent.scrollWidth > mainContent.clientWidth;
      if (horizontalDelta === null || !hasHorizontalOverflow) {
        return;
      }

      event.preventDefault();
      mainContent.scrollLeft += horizontalDelta;
    };

    mainContent.addEventListener('wheel', handleTimelineWheel, { passive: false });
    return () => {
      mainContent.removeEventListener('wheel', handleTimelineWheel);
    };
  }, []);

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
        <TrackInfoSidebar />
      </div>

      <div ref={mainContentRef} className={styles.mainContent} style={timelineWidthStyle}>
        <DawHeader trackCount={trackCount} />
        <div className={styles.timelineHeader}>
          <div className={styles.trackHeaderRuler}>
            <span>TRACK CONTROLS</span>
            <span className={styles.trackCount}>{trackCount}</span>
          </div>
          <div className={styles.timelineRuler}>
            <div className={styles.timelineMeta}>
              <span>TIMELINE</span>
              <span>{Math.round(pixelsPerSecond)} PX/S</span>
            </div>
            <TimeRuler pixelsPerSecond={pixelsPerSecond} />
          </div>
        </div>
        <TrackList pixelsPerSecond={pixelsPerSecond} setPixelsPerSecond={setPixelsPerSecond} />
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
