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
  padding: '0 7px',
  border: '1px solid #111416',
  borderRadius: '2px',
  background: 'linear-gradient(180deg, #414649 0%, #303437 100%)',
  boxShadow: 'inset 0 1px 0 #555b5e',
  color: '#d7dadb',
  cursor: 'pointer',
  fontSize: '9px',
  fontWeight: 700,
  selectors: {
    '&:disabled': {
      cursor: 'wait',
      opacity: 0.4,
    },
  },
});
