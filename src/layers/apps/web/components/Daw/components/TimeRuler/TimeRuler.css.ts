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

export const barTick = style({
  height: '12px',
  backgroundColor: '#8d9598',
});

export const beatTick = style({
  height: '8px',
  backgroundColor: '#686f72',
});

export const subdivisionTick = style({
  height: '4px',
  backgroundColor: '#454a4c',
});

export const label = style({
  position: 'absolute',
  top: '2px',
  transform: 'translateX(4px)',
  color: '#aeb4b7',
  fontFamily: '"Consolas", "SFMono-Regular", monospace',
  fontSize: '9px',
});

export const interactionZone = style({
  position: 'absolute',
  top: 0,
  bottom: 0,
  left: 0,
  right: 0,
  zIndex: 10,
  padding: 0,
  border: 0,
  background: 'transparent',
  cursor: 'pointer',
  ':hover': {
    backgroundColor: 'rgba(255, 255, 255, 0.025)',
  },
});
