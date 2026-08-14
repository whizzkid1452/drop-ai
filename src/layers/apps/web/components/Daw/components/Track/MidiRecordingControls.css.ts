import { style } from '@vanilla-extract/css';

export const controls = style({
  minWidth: 0,
  display: 'flex',
  alignItems: 'end',
  gap: '5px',
  flexWrap: 'wrap',
  paddingBottom: '4px',
  borderBottom: '1px solid #343a3d',
  color: '#aeb4b7',
  fontFamily: '"Consolas", "SFMono-Regular", monospace',
  fontSize: '8px',
});

export const field = style({
  display: 'flex',
  flexDirection: 'column',
  gap: '2px',
});

export const select = style({
  minWidth: '54px',
  height: '20px',
  border: '1px solid #111416',
  borderRadius: '2px',
  background: '#171a1c',
  color: '#e4e7e8',
  fontFamily: 'inherit',
  fontSize: '8px',
});

export const button = style({
  height: '20px',
  padding: '0 6px',
  border: '1px solid #5c6265',
  borderRadius: '2px',
  background: '#282d2f',
  color: '#dfe3e5',
  cursor: 'pointer',
  fontFamily: 'inherit',
  fontSize: '8px',
  fontWeight: 700,
  selectors: {
    '&:disabled': { cursor: 'not-allowed', opacity: 0.45 },
    '&:focus-visible': { outline: '1px solid #ffffff', outlineOffset: '1px' },
  },
});

export const buttonActive = style([
  button,
  {
    borderColor: '#ff6868',
    background: '#682d33',
    color: '#ffd9d9',
  },
]);

export const status = style({
  minHeight: '20px',
  display: 'inline-flex',
  alignItems: 'center',
  color: '#8bd8c1',
});

export const error = style({
  width: '100%',
  color: '#ff9d9d',
});
