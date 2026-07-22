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
  padding: '4px 8px',
  border: 'none',
  borderRadius: '4px',
  backgroundColor: '#333333',
  color: '#ffffff',
  cursor: 'pointer',
  fontSize: '12px',
  selectors: {
    '&:disabled': {
      cursor: 'wait',
      opacity: 0.5,
    },
  },
});
