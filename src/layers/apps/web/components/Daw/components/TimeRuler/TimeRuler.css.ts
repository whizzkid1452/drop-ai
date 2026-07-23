import { style } from '@vanilla-extract/css';

export const container = style({
  width: '100%',
  height: '28px',
  position: 'relative',
  overflow: 'hidden',
  flexShrink: 0,
  borderBottom: '1px solid #090b0c',
  background: 'linear-gradient(180deg, #25292b 0%, #1d2022 100%)',
  boxShadow: 'inset 0 1px 0 #353a3c',
  userSelect: 'none',
});

export const tick = style({
  position: 'absolute',
  bottom: 0,
  width: '1px',
  height: '6px',
  backgroundColor: '#51575a',
});

export const majorTick = style({
  height: '12px',
  backgroundColor: '#8d9598',
});

export const label = style({
  position: 'absolute',
  top: '2px',
  transform: 'translateX(4px)',
  color: '#aeb4b7',
  fontFamily: '"Consolas", "SFMono-Regular", monospace',
  fontSize: '9px',
});

export const topZone = style({
  position: 'absolute',
  top: 0,
  left: 0,
  right: 0,
  zIndex: 10,
  height: '14px',
  cursor: 'crosshair',
  ':hover': {
    backgroundColor: 'rgba(255, 79, 216, 0.07)',
  },
});

export const bottomZone = style({
  position: 'absolute',
  bottom: 0,
  left: 0,
  right: 0,
  zIndex: 10,
  height: '14px',
  cursor: 'pointer',
});

export const exportRangeOverlay = style({
  position: 'absolute',
  top: 0,
  zIndex: 5,
  height: '100%',
  borderLeft: '1px solid #5b9ab8',
  borderRight: '1px solid #5b9ab8',
  backgroundColor: 'rgba(66, 132, 164, 0.22)',
  pointerEvents: 'none',
});

export const exportRangeLabel = style({
  position: 'absolute',
  top: 0,
  left: '50%',
  transform: 'translateX(-50%)',
  color: '#a4d2e8',
  fontSize: '9px',
  whiteSpace: 'nowrap',
  pointerEvents: 'none',
});
