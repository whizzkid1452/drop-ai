import { style } from '@vanilla-extract/css';

export const region = style({
  position: 'absolute',
  insetBlock: '8px',
  zIndex: 2,
  minWidth: '18px',
  padding: '5px 6px',
  overflow: 'hidden',
  border: '1px solid #5b2850',
  borderRadius: '3px',
  background: 'linear-gradient(180deg, #713560 0%, #3b2537 100%)',
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.12)',
  color: '#ffe0f8',
  cursor: 'pointer',
  textAlign: 'left',
  selectors: {
    '&:focus-visible': { outline: '2px solid #ffffff', outlineOffset: '-3px' },
  },
});

export const regionSelected = style([
  region,
  { borderColor: '#ffffff', boxShadow: 'inset 0 0 0 1px #ff58d8, 0 0 0 1px #ff58d8' },
]);

export const name = style({
  position: 'relative',
  zIndex: 2,
  display: 'block',
  overflow: 'hidden',
  fontSize: '9px',
  fontWeight: 700,
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
});

export const notes = style({
  position: 'absolute',
  inset: '24px 5px 5px',
});

export const noteBar = style({
  position: 'absolute',
  height: '3px',
  minWidth: '2px',
  borderRadius: '1px',
  background: '#ff9bea',
});
