import { style } from '@vanilla-extract/css';

const TRACK_HEADER_WIDTH = '248px';
const TIMELINE_MIN_WIDTH = '640px';

const dockToggle = style({
  position: 'absolute',
  top: 'calc(50% - 46px)',
  zIndex: 30,
  width: '22px',
  height: '92px',
  padding: 0,
  border: '1px solid #090b0c',
  borderRadius: 0,
  backgroundColor: '#2b2e30',
  boxShadow: 'inset 0 1px 0 #404447, 0 2px 8px rgba(0, 0, 0, 0.4)',
  color: '#8f9699',
  cursor: 'pointer',
  fontSize: '9px',
  fontWeight: 700,
  letterSpacing: '0.12em',
  lineHeight: '22px',
  textOrientation: 'mixed',
  transition: 'background-color 120ms ease, color 120ms ease, left 180ms ease, right 180ms ease',
  writingMode: 'vertical-rl',
  selectors: {
    '&:hover': {
      backgroundColor: '#383c3f',
      color: '#ff78e3',
    },
    '&:focus-visible': {
      outline: '1px solid #ff78e3',
      outlineOffset: '-2px',
    },
  },
});

export const container = style({
  width: '100%',
  height: '100vh',
  margin: 0,
  position: 'relative',
  display: 'flex',
  overflow: 'hidden',
  backgroundColor: '#111315',
  color: '#d6d8d9',
  fontFamily: '"Arial Narrow", "Segoe UI", Arial, sans-serif',
});

export const mainContent = style({
  flex: 1,
  minWidth: 0,
  height: '100%',
  position: 'relative',
  overflow: 'auto',
  backgroundColor: '#171a1c',
  display: 'flex',
  flexDirection: 'column',
});

export const cliPanel = style({
  width: '350px',
  height: '100%',
  flexShrink: 0,
  zIndex: 20,
  overflow: 'hidden',
  position: 'relative',
  borderLeft: '1px solid #07090a',
  backgroundColor: '#1d2022',
  transition: 'width 180ms ease-in-out',
});

export const cliPanelCollapsed = style({
  width: 0,
  borderLeft: 0,
});

export const cliPanelResizing = style({
  transition: 'none',
});

export const resizeHandle = style({
  position: 'absolute',
  left: 0,
  top: 0,
  bottom: 0,
  width: '6px',
  cursor: 'col-resize',
  zIndex: 5,
  selectors: {
    '&::before': {
      content: '""',
      position: 'absolute',
      left: '2px',
      top: '50%',
      transform: 'translateY(-50%)',
      width: '2px',
      height: '44px',
      backgroundColor: '#4b5053',
    },
    '&:hover::before': {
      backgroundColor: '#ff4fd8',
    },
  },
});

export const leftPanel = style({
  width: '300px',
  height: '100%',
  flexShrink: 0,
  zIndex: 20,
  overflow: 'hidden',
  position: 'relative',
  borderRight: '1px solid #07090a',
  backgroundColor: '#1d2022',
  transition: 'width 180ms ease-in-out',
});

export const leftPanelCollapsed = style({
  width: 0,
  borderRight: 0,
});

export const cliToggleButton = style([
  dockToggle,
  {
    right: 0,
    borderRight: 0,
  },
]);

export const cliToggleButtonOpen = style({
  backgroundColor: '#3b2036',
  color: '#ff78e3',
});

export const leftToggleButton = style([
  dockToggle,
  {
    left: 0,
    borderLeft: 0,
    transform: 'rotate(180deg)',
  },
]);

export const leftToggleButtonOpen = style({
  left: '300px',
  backgroundColor: '#3b2036',
  color: '#ff78e3',
});

export const header = style({
  position: 'sticky',
  top: 0,
  zIndex: 18,
  minWidth: `calc(${TRACK_HEADER_WIDTH} + ${TIMELINE_MIN_WIDTH})`,
  flexShrink: 0,
  backgroundColor: '#262a2c',
  borderBottom: '1px solid #090b0c',
  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.3)',
});

export const projectBar = style({
  minHeight: '32px',
  padding: '3px 8px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: '12px',
  borderBottom: '1px solid #111416',
  backgroundColor: '#202325',
});

export const headerIdentity = style({
  display: 'flex',
  alignItems: 'baseline',
  gap: '8px',
  flexShrink: 0,
});

export const productName = style({
  color: '#e3e4e4',
  fontSize: '12px',
  fontWeight: 800,
  letterSpacing: '0.14em',
});

export const workspaceName = style({
  color: '#ff4fd8',
  fontSize: '10px',
  fontWeight: 700,
  letterSpacing: '0.12em',
});

export const projectActions = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'flex-end',
  gap: '4px',
  minWidth: 0,
});

export const transportBar = style({
  minHeight: '48px',
  padding: '5px 8px',
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1fr) auto minmax(0, 1fr)',
  alignItems: 'center',
  gap: '12px',
  background: 'linear-gradient(180deg, #303436 0%, #292d2f 100%)',
  boxShadow: 'inset 0 1px 0 #3d4245',
});

export const runtimeSection = style({
  minWidth: 0,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'flex-start',
});

export const transportSection = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
});

export const statusSection = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'flex-end',
  gap: '6px',
  minWidth: 0,
});

export const headerRight = style({
  display: 'flex',
  alignItems: 'center',
  gap: '6px',
});

export const title = style({
  margin: 0,
  color: '#e3e4e4',
  fontSize: '12px',
  fontWeight: 700,
  letterSpacing: '0.1em',
  textTransform: 'uppercase',
});

export const trackCount = style({
  color: '#92989b',
  fontFamily: '"Consolas", "SFMono-Regular", monospace',
  fontSize: '10px',
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
  whiteSpace: 'nowrap',
});

export const timelineHeader = style({
  position: 'sticky',
  top: '80px',
  zIndex: 15,
  display: 'grid',
  gridTemplateColumns: `${TRACK_HEADER_WIDTH} minmax(${TIMELINE_MIN_WIDTH}, 1fr)`,
  minWidth: `calc(${TRACK_HEADER_WIDTH} + ${TIMELINE_MIN_WIDTH})`,
  flexShrink: 0,
  borderBottom: '1px solid #080a0b',
  boxShadow: '0 2px 5px rgba(0, 0, 0, 0.3)',
});

export const trackHeaderRuler = style({
  minHeight: '44px',
  padding: '0 9px 0 30px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  borderRight: '1px solid #080a0b',
  backgroundColor: '#292d2f',
  boxShadow: 'inset -1px 0 0 #3b4043, inset 0 1px 0 #3b4043',
  color: '#aeb3b5',
  fontSize: '9px',
  fontWeight: 700,
  letterSpacing: '0.1em',
});

export const timelineRuler = style({
  minWidth: 0,
  backgroundColor: '#1c1f21',
});

export const timelineMeta = style({
  height: '16px',
  padding: '0 8px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  borderBottom: '1px solid #101214',
  color: '#737a7d',
  fontFamily: '"Consolas", "SFMono-Regular", monospace',
  fontSize: '9px',
  letterSpacing: '0.08em',
});
