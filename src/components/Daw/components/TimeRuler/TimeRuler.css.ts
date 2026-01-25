import { style } from '@vanilla-extract/css';

export const container = style({
  width: '100%',
  height: '30px',
  backgroundColor: '#0a0a0a',
  borderBottom: '1px solid #333',
  position: 'relative',
  overflow: 'hidden',
  userSelect: 'none',
  flexShrink: 0,
});

export const tick = style({
  position: 'absolute',
  bottom: 0,
  width: '1px',
  backgroundColor: '#444',
  height: '6px',
});

export const majorTick = style({
  height: '12px',
  backgroundColor: '#666',
});

export const label = style({
  position: 'absolute',
  top: '2px',
  fontSize: '10px',
  color: '#888',
  transform: 'translateX(4px)',
});

export const topZone = style({
  position: 'absolute',
  top: 0,
  left: 0,
  right: 0,
  height: '15px',
  zIndex: 10,
  cursor: 'text', // like text selection
  ':hover': {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
});

export const bottomZone = style({
  position: 'absolute',
  bottom: 0,
  left: 0,
  right: 0,
  height: '15px',
  zIndex: 10,
  cursor: 'pointer',
});

export const exportRangeOverlay = style({
  position: 'absolute',
  top: 0,
  height: '100%',
  backgroundColor: 'rgba(0, 150, 255, 0.2)',
  borderLeft: '1px solid #0096ff',
  borderRight: '1px solid #0096ff',
  pointerEvents: 'none', // Allow clicks to pass through to zones
  zIndex: 5,
});

export const exportRangeLabel = style({
    position: 'absolute',
    top: 0,
    left: '50%',
    transform: 'translateX(-50%)',
    fontSize: '10px',
    color: '#0096ff',
    whiteSpace: 'nowrap',
    pointerEvents: 'none',
});
