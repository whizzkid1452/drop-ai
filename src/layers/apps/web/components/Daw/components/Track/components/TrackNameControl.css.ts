import { style } from '@vanilla-extract/css';

export const form = style({
  display: 'flex',
  alignItems: 'center',
  gap: '6px',
  marginBottom: '8px',
});

export const label = style({
  color: '#dddddd',
  fontSize: '0.75rem',
  fontWeight: 600,
});

export const input = style({
  minWidth: 0,
  width: '180px',
  padding: '4px 6px',
  border: '1px solid #444444',
  borderRadius: '4px',
  backgroundColor: '#171717',
  color: '#ffffff',
  selectors: {
    '&:focus': {
      borderColor: '#777777',
      outline: 'none',
    },
    '&:disabled': {
      opacity: 0.6,
    },
  },
});

export const button = style({
  padding: '4px 8px',
  border: '1px solid #444444',
  borderRadius: '4px',
  backgroundColor: '#2b2b2b',
  color: '#eeeeee',
  cursor: 'pointer',
  fontSize: '0.7rem',
  selectors: {
    '&:disabled': {
      cursor: 'wait',
      opacity: 0.6,
    },
  },
});
