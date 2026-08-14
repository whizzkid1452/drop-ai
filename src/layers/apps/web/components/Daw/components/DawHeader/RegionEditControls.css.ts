import { style } from '@vanilla-extract/css';

export const container = style({
  display: 'flex',
  alignItems: 'center',
  gap: '6px',
  minWidth: 0,
});

export const buttonGroup = style({
  display: 'flex',
  gap: '2px',
});

export const button = style({
  minWidth: '28px',
  height: '24px',
  padding: '0 6px',
  border: '1px solid #4e4640',
  borderRadius: '2px',
  background: '#2d2926',
  color: '#e7ddd2',
  cursor: 'pointer',
  fontSize: '10px',
  selectors: {
    '&:disabled': { cursor: 'not-allowed', opacity: 0.42 },
    '&:hover:not(:disabled)': { borderColor: '#e2bd61', color: '#fff4c8' },
  },
});

export const summary = style({
  minWidth: '72px',
  color: '#b9aca0',
  fontSize: '10px',
  whiteSpace: 'nowrap',
});
