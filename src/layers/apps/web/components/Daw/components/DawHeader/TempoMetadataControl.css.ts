import { style } from '@vanilla-extract/css';

export const form = style({
  display: 'flex',
  alignItems: 'center',
  gap: '6px',
  padding: '4px 8px',
  border: '1px solid #333333',
  borderRadius: '6px',
  backgroundColor: '#171717',
});

export const label = style({
  color: '#dddddd',
  fontSize: '0.75rem',
  fontWeight: 600,
});

export const input = style({
  width: '72px',
  padding: '3px 5px',
  border: '1px solid #444444',
  borderRadius: '4px',
  backgroundColor: '#0f0f0f',
  color: '#ffffff',
  fontSize: '0.75rem',
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

export const unit = style({
  color: '#888888',
  fontSize: '0.65rem',
});

export const button = style({
  padding: '3px 7px',
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

export const hint = style({
  color: '#666666',
  fontSize: '0.6rem',
});
