import { style } from '@vanilla-extract/css';

export const grid = style({
  position: 'absolute',
  top: 0,
  bottom: 0,
  left: '248px',
  zIndex: 2,
  width: 'var(--timeline-content-width, 640px)',
  pointerEvents: 'none',
});
