import { style } from '@vanilla-extract/css';

export const cursor = style({
  position: 'absolute',
  top: 0,
  bottom: 0,
  width: '2px', // increased width for better visibility
  backgroundColor: 'rgba(255, 255, 255, 0.8)',
  zIndex: 10,
  pointerEvents: 'none',
  willChange: 'transform',
});
