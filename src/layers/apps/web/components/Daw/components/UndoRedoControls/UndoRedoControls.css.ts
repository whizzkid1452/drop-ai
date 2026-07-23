import { style } from '@vanilla-extract/css';

export const container = style({
  display: 'flex',
  alignItems: 'center',
  gap: '3px',
});

export const button = style({
  height: '24px',
  padding: '0 8px',
  border: '1px solid #0f1112',
  borderRadius: '2px',
  background: 'linear-gradient(180deg, #3d4245 0%, #2d3133 100%)',
  boxShadow: 'inset 0 1px 0 #505659',
  color: '#d6d8d9',
  cursor: 'pointer',
  fontSize: '9px',
  ':disabled': {
    opacity: 0.35,
    cursor: 'not-allowed',
  },
});

export const error = style({
  maxWidth: '130px',
  overflow: 'hidden',
  color: '#df8a7e',
  fontSize: '9px',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
});
