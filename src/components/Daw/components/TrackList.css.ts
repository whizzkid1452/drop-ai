import { style } from '@vanilla-extract/css';

export const tracksContainer = style({
  display: 'flex',
  flexDirection: 'column',
  position: 'relative',
});

export const trackList = style({
  position: 'relative',
  zIndex: 1,
  display: 'flex',
  flexDirection: 'column',
  gap: '8px',
});
