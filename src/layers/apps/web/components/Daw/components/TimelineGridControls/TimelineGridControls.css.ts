import { style } from '@vanilla-extract/css';

export const controls = style({
  display: 'flex',
  alignItems: 'center',
  gap: '5px',
});

export const toggle = style({
  height: '14px',
  padding: '0 5px',
  border: '1px solid #111416',
  borderRadius: 0,
  backgroundColor: '#292d2f',
  color: '#8e9699',
  cursor: 'pointer',
  fontSize: '8px',
  fontWeight: 700,
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
  fontFamily: '"Consolas", "SFMono-Regular", monospace',
  fontSize: '8px',
});
