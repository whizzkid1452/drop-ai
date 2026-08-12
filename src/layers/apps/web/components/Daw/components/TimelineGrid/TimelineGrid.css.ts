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

export const divisionLine = style({
  position: 'absolute',
  top: 0,
  bottom: 0,
  width: '1px',
  backgroundColor: 'rgba(255, 255, 255, 0.055)',
});

export const barLine = style({
  position: 'absolute',
  top: 0,
  bottom: 0,
  width: '1px',
  backgroundColor: 'rgba(255, 143, 232, 0.16)',
});
