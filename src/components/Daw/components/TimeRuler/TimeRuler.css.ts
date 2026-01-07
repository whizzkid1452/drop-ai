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
