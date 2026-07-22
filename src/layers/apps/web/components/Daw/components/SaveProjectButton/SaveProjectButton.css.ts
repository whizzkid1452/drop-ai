import { style } from '@vanilla-extract/css';

export const container = style({
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
});

export const button = style({
  minWidth: '90px',
  minHeight: '36px',
  padding: '0.625rem 1rem',
  border: '1px solid #333333',
  borderRadius: '2px',
  backgroundColor: '#1a1a1a',
  color: '#ffffff',
  cursor: 'pointer',
  fontSize: '0.875rem',
  letterSpacing: '0.05em',
  textTransform: 'uppercase',

  ':hover': {
    backgroundColor: '#222222',
    borderColor: '#444444',
  },

  ':disabled': {
    opacity: 0.5,
    cursor: 'not-allowed',
  },
});

export const status = style({
  color: '#8bd49c',
  fontSize: '0.75rem',
});

export const error = style({
  maxWidth: '220px',
  color: '#ff7777',
  fontSize: '0.75rem',
});
