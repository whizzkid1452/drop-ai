import { style } from '@vanilla-extract/css';

export const automationControl = style({
  minWidth: 0,
  height: '20px',
  border: '1px solid #111416',
  borderRadius: '2px',
  background: '#202426',
  color: '#d8dcde',
  cursor: 'pointer',
  fontFamily: '"Consolas", "SFMono-Regular", monospace',
  fontSize: '8px',
  padding: '0 5px',
  selectors: {
    '&:disabled': { cursor: 'not-allowed', opacity: 0.38 },
    '&:focus-visible': { outline: '1px solid #ff78e3', outlineOffset: '1px' },
  },
});

export const automationHeader = style({
  position: 'sticky',
  left: 0,
  zIndex: 10,
  minWidth: 0,
  padding: '5px 8px 6px 30px',
  display: 'flex',
  flexDirection: 'column',
  gap: '4px',
  overflow: 'hidden',
  borderTop: '1px solid #111416',
  borderRight: '1px solid #080a0b',
  background: 'linear-gradient(90deg, #25292b 0%, #202426 100%)',
});

export const automationControls = style({
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1fr) auto auto',
  gap: '3px',
});

export const automationToolbar = style({
  display: 'flex',
  flexWrap: 'wrap',
  gap: '3px',
});

export const automationError = style({
  overflow: 'hidden',
  color: '#ff9d9d',
  fontSize: '8px',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
});

export const automationLane = style({
  position: 'relative',
  minWidth: 0,
  height: '80px',
  overflow: 'hidden',
  borderTop: '1px solid #111416',
  backgroundColor: '#171b1d',
  backgroundImage: 'linear-gradient(to bottom, transparent 49%, rgba(255, 255, 255, 0.08) 50%, transparent 51%)',
  cursor: 'crosshair',
});

export const automationRange = style({
  position: 'absolute',
  insetBlock: 0,
  zIndex: 1,
  borderInline: '1px solid rgba(240, 205, 104, 0.68)',
  background: 'rgba(240, 205, 104, 0.1)',
  pointerEvents: 'none',
});

export const automationLine = style({
  position: 'absolute',
  inset: 0,
  zIndex: 2,
  overflow: 'visible',
  pointerEvents: 'none',
});

export const automationPoint = style({
  position: 'absolute',
  zIndex: 3,
  width: '11px',
  height: '11px',
  padding: 0,
  border: '1px solid #59244d',
  borderRadius: '50%',
  background: '#ff68dc',
  boxShadow: '0 0 0 1px #111416',
  cursor: 'grab',
  transform: 'translate(-50%, -50%)',
  selectors: {
    '&:active': { cursor: 'grabbing' },
    '&:focus-visible': { outline: '2px solid #ffffff', outlineOffset: '1px' },
  },
});

export const selectedAutomationPoint = style({
  borderColor: '#ffffff',
  background: '#ffffff',
  boxShadow: '0 0 0 2px #ff4fd8',
});
