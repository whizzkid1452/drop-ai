import { style } from '@vanilla-extract/css';

const TRACK_HEADER_WIDTH = '248px';

export const cursor = style({
  position: 'absolute',
  top: 0,
  bottom: 0,
  left: TRACK_HEADER_WIDTH,
  zIndex: 10,
  width: '1px',
  backgroundColor: '#ff4fd8',
  boxShadow: '0 0 0 1px rgba(110, 20, 90, 0.55)',
  pointerEvents: 'none',
  willChange: 'transform',
});
