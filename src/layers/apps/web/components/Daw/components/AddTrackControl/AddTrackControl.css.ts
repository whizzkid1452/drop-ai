import { style } from '@vanilla-extract/css';

export const input = style({
  position: 'absolute',
  width: '1px',
  height: '1px',
  padding: 0,
  margin: '-1px',
  overflow: 'hidden',
  clip: 'rect(0, 0, 0, 0)',
  whiteSpace: 'nowrap',
  border: 0,
});

export const button = style({
  height: '24px',
  padding: '0 9px',
  border: '1px solid #6a205b',
  borderRadius: '2px',
  background: 'linear-gradient(180deg, #5a294f 0%, #3b2036 100%)',
  boxShadow: 'inset 0 1px 0 #754068',
  color: '#ff9bea',
  cursor: 'pointer',
  fontSize: '9px',
  fontWeight: 700,
  letterSpacing: '0.05em',
  textTransform: 'uppercase',
  selectors: {
    '&:hover': {
      background: 'linear-gradient(180deg, #6a3260 0%, #4a2943 100%)',
      color: '#ffd0f5',
    },
    '&:focus-visible': {
      outline: '1px solid #ff78e3',
      outlineOffset: '1px',
    },
    '&:disabled': {
      opacity: 0.4,
      cursor: 'not-allowed',
    },
  },
});
