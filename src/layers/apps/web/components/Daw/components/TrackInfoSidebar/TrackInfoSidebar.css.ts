import { style } from '@vanilla-extract/css';

const inspectorButton = style({
  minHeight: '26px',
  padding: '0 9px',
  border: '1px solid #111416',
  borderRadius: '2px',
  background: 'linear-gradient(180deg, #414649 0%, #303437 100%)',
  boxShadow: 'inset 0 1px 0 #555b5e',
  color: '#d7dadb',
  cursor: 'pointer',
  fontSize: '10px',
  fontWeight: 700,
  selectors: {
    '&:disabled': {
      opacity: 0.38,
      cursor: 'not-allowed',
    },
    '&:focus-visible': {
      outline: '1px solid #ff78e3',
      outlineOffset: '-2px',
    },
    '&:hover:not(:disabled)': {
      background: 'linear-gradient(180deg, #4a5053 0%, #383d40 100%)',
      color: '#ffffff',
    },
  },
});

export const container = style({
  width: '100%',
  height: '100%',
  display: 'flex',
  flexDirection: 'column',
  borderRight: '1px solid #080a0b',
  backgroundColor: '#1e2224',
  color: '#c9cccd',
  fontFamily: '"Arial Narrow", "Segoe UI", Arial, sans-serif',
  fontSize: '10px',
});

export const titleBar = style({
  minHeight: '32px',
  padding: '0 10px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: '10px',
  borderBottom: '1px solid #0d0f10',
  background: 'linear-gradient(180deg, #313537 0%, #272b2d 100%)',
  boxShadow: 'inset 0 1px 0 #414649',
  color: '#c1c5c7',
  fontSize: '9px',
  fontWeight: 700,
  letterSpacing: '0.1em',
});

export const trackName = style({
  minWidth: 0,
  overflow: 'hidden',
  color: '#ff78e3',
  fontFamily: '"Consolas", "SFMono-Regular", monospace',
  letterSpacing: 0,
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
});

export const contentArea = style({
  flex: 1,
  minHeight: 0,
  overflowY: 'auto',
  padding: '8px',
  display: 'flex',
  flexDirection: 'column',
  gap: '8px',
});

export const section = style({
  padding: '7px',
  border: '1px solid #121516',
  backgroundColor: '#202426',
});

export const sectionTitle = style({
  margin: '0 0 7px',
  color: '#9fa5a8',
  fontSize: '9px',
  fontWeight: 700,
  letterSpacing: '0.08em',
});

export const mixControls = style({
  display: 'flex',
  flexDirection: 'column',
  gap: '6px',
});

export const actions = style({
  display: 'grid',
  gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
  gap: '5px',
});

export const actionButton = style([inspectorButton]);

export const dangerButton = style({
  color: '#e1a39a',
});

export const emptyMessage = style({
  padding: '24px 10px',
  color: '#72797c',
  fontSize: '10px',
  lineHeight: 1.5,
  textAlign: 'center',
});
