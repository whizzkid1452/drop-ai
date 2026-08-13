import { style } from '@vanilla-extract/css';

const TRACK_HEADER_WIDTH = '248px';
const TIMELINE_MIN_WIDTH = '640px';
const TIMELINE_CONTENT_WIDTH = `var(--timeline-content-width, ${TIMELINE_MIN_WIDTH})`;

const controlButton = style({
  minWidth: '26px',
  height: '24px',
  padding: '0 7px',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  border: '1px solid #111416',
  borderRadius: '2px',
  background: 'linear-gradient(180deg, #414649 0%, #303437 100%)',
  boxShadow: 'inset 0 1px 0 #555b5e',
  color: '#d7dadb',
  cursor: 'pointer',
  fontSize: '10px',
  fontWeight: 700,
  letterSpacing: '0.04em',
  selectors: {
    '&:hover': {
      background: 'linear-gradient(180deg, #4a5053 0%, #383d40 100%)',
      color: '#ffffff',
    },
    '&:focus-visible': {
      outline: '1px solid #ff78e3',
      outlineOffset: '-2px',
    },
    '&:disabled': {
      opacity: 0.38,
      cursor: 'not-allowed',
    },
  },
});

export const trackRow = style({
  display: 'grid',
  gridTemplateColumns: `${TRACK_HEADER_WIDTH} minmax(${TIMELINE_CONTENT_WIDTH}, 1fr)`,
  minWidth: `calc(${TRACK_HEADER_WIDTH} + ${TIMELINE_CONTENT_WIDTH})`,
  minHeight: '98px',
  borderBottom: '1px solid #090b0c',
  backgroundColor: '#1c1f21',
});

export const trackHeader = style({
  position: 'sticky',
  left: 0,
  zIndex: 11,
  minWidth: 0,
  padding: '7px 8px 7px 30px',
  display: 'flex',
  flexDirection: 'column',
  gap: '6px',
  alignSelf: 'stretch',
  overflow: 'hidden',
  borderRight: '1px solid #080a0b',
  background: 'linear-gradient(90deg, #2a2e30 0%, #25292b 100%)',
  boxShadow: 'inset -1px 0 0 #3a3f42, inset 0 1px 0 #383d40',
});

export const trackHeaderSelected = style({
  boxShadow: 'inset 3px 0 0 #ff4fd8, inset -1px 0 0 #3a3f42, inset 0 1px 0 #383d40',
  background: 'linear-gradient(90deg, #362b34 0%, #292a2d 100%)',
});

export const trackTimeline = style({
  position: 'relative',
  minWidth: 0,
  minHeight: '98px',
  overflow: 'hidden',
  backgroundColor: '#202426',
  backgroundImage:
    'linear-gradient(to bottom, rgba(255, 255, 255, 0.035) 1px, transparent 1px), linear-gradient(to bottom, transparent 49.5%, rgba(255, 255, 255, 0.035) 50%, transparent 50.5%)',
  backgroundSize: '100% 24px, 100% 100%',
});

export const rangeSelection = style({
  position: 'absolute',
  top: 0,
  bottom: 0,
  zIndex: 1,
  borderLeft: '1px solid #f0cd68',
  borderRight: '1px solid #f0cd68',
  background: 'rgba(240, 205, 104, 0.16)',
  pointerEvents: 'none',
});

export const actionControls = style({
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  gap: '4px',
  minWidth: 0,
});

export const recordingOptions = style({
  order: 2,
  flexBasis: '100%',
  display: 'grid',
  gridTemplateColumns: '34px 54px 40px 30px 32px',
  minWidth: 0,
  alignItems: 'center',
  gap: '2px',
  color: '#9ea4a6',
  fontFamily: '"Consolas", "SFMono-Regular", monospace',
  fontSize: '8px',
});

export const recordingSelect = style({
  minWidth: 0,
  height: '20px',
  border: '1px solid #111416',
  borderRadius: '1px',
  backgroundColor: '#171a1c',
  color: '#d6d8d9',
  fontSize: '8px',
  selectors: {
    '&:disabled': { opacity: 0.4 },
  },
});

export const recordingError = style({
  gridColumn: '1 / -1',
  overflow: 'hidden',
  color: '#ff9d9d',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
});

export const trackActionButton = style([controlButton]);

export const muteButtonActive = style({
  borderColor: '#42251e',
  background: 'linear-gradient(180deg, #a85943 0%, #804131 100%)',
  boxShadow: 'inset 0 1px 0 #ca755f',
  color: '#fff4ee',
});

export const soloButtonActive = style({
  borderColor: '#6f245d',
  background: 'linear-gradient(180deg, #e654c7 0%, #a72f8d 100%)',
  boxShadow: 'inset 0 1px 0 #ff8fe8',
  color: '#fff5fd',
});

export const recordButtonActive = style({
  borderColor: '#651d24',
  background: 'linear-gradient(180deg, #dd4c58 0%, #9e2631 100%)',
  boxShadow: 'inset 0 1px 0 #ff8490',
  color: '#fff5f6',
});

export const automationButtonActive = style({
  borderColor: '#6f245d',
  background: 'linear-gradient(180deg, #bd4da7 0%, #7e2e70 100%)',
  boxShadow: 'inset 0 1px 0 #f381da',
  color: '#fff5fd',
});

export const controls = style({
  width: '100%',
  minWidth: 0,
});

export const controlGroup = style({
  width: '100%',
  display: 'grid',
  gridTemplateColumns: '40px minmax(72px, 1fr) 44px',
  alignItems: 'center',
  gap: '5px',
});

export const sliderLabel = style({
  color: '#aeb3b5',
  fontSize: '9px',
  fontWeight: 700,
  letterSpacing: '0.04em',
  textTransform: 'uppercase',
});

export const slider = style({
  width: '100%',
  minWidth: 0,
  height: '3px',
  appearance: 'none',
  border: '1px solid #0d0f10',
  borderRadius: 0,
  background: '#111416',
  outline: 'none',
  '::-webkit-slider-thumb': {
    width: '7px',
    height: '15px',
    appearance: 'none',
    border: '1px solid #171a1c',
    borderRadius: '1px',
    background: '#aeb4b7',
    boxShadow: 'inset 1px 0 0 #e0e3e4',
  },
});

export const sliderValue = style({
  minWidth: 0,
  color: '#ff78e3',
  fontFamily: '"Consolas", "SFMono-Regular", monospace',
  fontSize: '9px',
  textAlign: 'right',
});
