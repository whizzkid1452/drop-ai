import { style } from '@vanilla-extract/css';

export const container = style({
  display: 'flex',
  alignItems: 'center',
  gap: '4px',
});

export const button = style({
  height: '24px',
  padding: '0 9px',
  border: '1px solid #0f1112',
  borderRadius: '2px',
  background: 'linear-gradient(180deg, #3d4245 0%, #2d3133 100%)',
  boxShadow: 'inset 0 1px 0 #505659',
  color: '#d6d8d9',
  cursor: 'pointer',
  fontSize: '9px',
  fontWeight: 700,
  letterSpacing: '0.05em',
  textTransform: 'uppercase',
  ':hover': {
    background: 'linear-gradient(180deg, #484e51 0%, #373b3e 100%)',
  },
  ':disabled': {
    opacity: 0.4,
    cursor: 'not-allowed',
  },
});

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
