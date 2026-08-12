import { style } from '@vanilla-extract/css';

export const controls = style({
  display: 'flex',
  alignItems: 'center',
  gap: '3px',
});

export const button = style({
  minWidth: '18px',
  height: '14px',
  padding: '0 4px',
  border: '1px solid #111416',
  borderRadius: 0,
  backgroundColor: '#292d2f',
  color: '#939a9d',
  cursor: 'pointer',
  fontSize: '8px',
  selectors: {
    '&[aria-pressed="true"]': {
      borderColor: '#6f245d',
      backgroundColor: '#522046',
      color: '#ff9aea',
    },
    '&:focus-visible': {
      outline: '1px solid #ff78e3',
      outlineOffset: '-1px',
    },
  },
});

export const select = style({
  height: '14px',
  padding: '0 13px 0 4px',
  border: '1px solid #111416',
  borderRadius: 0,
  backgroundColor: '#25292b',
  color: '#aeb4b7',
  fontSize: '8px',
});
