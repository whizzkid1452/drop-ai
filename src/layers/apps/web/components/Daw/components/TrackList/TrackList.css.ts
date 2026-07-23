import { style } from '@vanilla-extract/css';

export const tracksContainer = style({
  position: 'relative',
  display: 'flex',
  flexDirection: 'column',
  minHeight: '100%',
});

export const trackList = style({
  position: 'relative',
  zIndex: 1,
  flex: 1,
  minHeight: 0,
  display: 'flex',
  flexDirection: 'column',
  backgroundColor: '#171a1c',
});
