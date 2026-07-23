import { style } from '@vanilla-extract/css';

const projectButton = style({
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
    opacity: 0.4,
    cursor: 'not-allowed',
  },
});

export const container = style({
  display: 'flex',
  alignItems: 'center',
  gap: '3px',
  minWidth: 0,
});

export const select = style({
  width: '138px',
  height: '24px',
  minWidth: 0,
  padding: '0 5px',
  border: '1px solid #0f1112',
  borderRadius: '2px',
  backgroundColor: '#171a1c',
  color: '#cfd2d3',
  fontSize: '9px',
});

export const button = style([projectButton]);

export const status = style({
  maxWidth: '100px',
  overflow: 'hidden',
  color: '#8fc29b',
  fontSize: '9px',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
});

export const error = style({
  maxWidth: '140px',
  overflow: 'hidden',
  color: '#df8a7e',
  fontSize: '9px',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
});
