import { style } from '@vanilla-extract/css';

export const container = style({
  display: 'flex',
  alignItems: 'center',
  gap: '6px',
  minWidth: 0,
});

export const email = style({
  maxWidth: '180px',
  overflow: 'hidden',
  color: '#9da3a6',
  fontSize: '10px',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
});

export const action = style({
  minHeight: '24px',
  padding: '0 8px',
  border: '1px solid #4b5053',
  borderRadius: 0,
  backgroundColor: '#292d2f',
  color: '#d6d8d9',
  cursor: 'pointer',
  fontFamily: 'inherit',
  fontSize: '9px',
  fontWeight: 800,
  letterSpacing: '0.08em',
  lineHeight: '22px',
  textDecoration: 'none',
  selectors: {
    '&:hover:not(:disabled)': {
      borderColor: '#ff4fd8',
      color: '#ff78e3',
    },
    '&:focus-visible': {
      outline: '1px solid #ff4fd8',
      outlineOffset: '2px',
    },
    '&:disabled': {
      cursor: 'wait',
      opacity: 0.65,
    },
  },
});

export const error = style({
  color: '#ff9a9a',
  fontSize: '10px',
});
