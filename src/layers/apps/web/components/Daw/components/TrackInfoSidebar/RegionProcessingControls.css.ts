import { style } from '@vanilla-extract/css';

export const control = style({
  display: 'flex',
  flexDirection: 'column',
  gap: '7px',
});

export const controlRow = style({
  display: 'grid',
  gridTemplateColumns: '54px minmax(0, 1fr) 38px',
  alignItems: 'center',
  gap: '6px',
});

export const label = style({
  color: '#aeb4b6',
  fontSize: '9px',
  fontWeight: 700,
});

export const value = style({
  width: '100%',
  minWidth: 0,
  border: '1px solid #111416',
  borderRadius: '2px',
  backgroundColor: '#171a1c',
  color: '#ffd580',
  fontFamily: '"Consolas", "SFMono-Regular", monospace',
  fontSize: '9px',
  textAlign: 'right',
});

export const checkbox = style({
  gridColumn: '2 / 4',
  justifySelf: 'start',
  accentColor: '#ff78e3',
});
