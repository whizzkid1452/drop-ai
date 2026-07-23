import { style } from '@vanilla-extract/css';

export const form = style({
  display: 'flex',
  alignItems: 'center',
  gap: '4px',
  minWidth: 0,
});

export const label = style({
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

export const input = style({
  minWidth: 0,
  flex: 1,
  height: '26px',
  padding: '0 7px',
  border: '1px solid #111416',
  borderRadius: '2px',
  backgroundColor: '#171a1c',
  boxShadow: 'inset 0 1px 2px rgba(0, 0, 0, 0.5)',
  color: '#e1e3e4',
  fontSize: '11px',
  fontWeight: 700,
  selectors: {
    '&:focus': {
      borderColor: '#d43fb5',
      outline: 'none',
    },
    '&:disabled': {
      opacity: 0.55,
    },
  },
});

export const button = style({
  height: '26px',
  padding: '0 7px',
  border: '1px solid #111416',
  borderRadius: '2px',
  background: 'linear-gradient(180deg, #414649 0%, #303437 100%)',
  boxShadow: 'inset 0 1px 0 #555b5e',
  color: '#cfd2d3',
  cursor: 'pointer',
  fontSize: '9px',
  fontWeight: 700,
  selectors: {
    '&:disabled': {
      cursor: 'wait',
      opacity: 0.5,
    },
  },
});
