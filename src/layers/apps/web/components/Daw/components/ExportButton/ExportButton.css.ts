import { style } from '@vanilla-extract/css';

export const container = style({
  display: 'flex',
  alignItems: 'center',
  gap: '4px',
});

export const exportButton = style({
  minWidth: '66px',
  height: '24px',
  padding: '0 10px',
  border: '1px solid #6f245d',
  borderRadius: '2px',
  background: 'linear-gradient(180deg, #e654c7 0%, #a72f8d 100%)',
  boxShadow: 'inset 0 1px 0 #ff8fe8',
  color: '#fff5fd',
  cursor: 'pointer',
  fontSize: '9px',
  fontWeight: 700,
  letterSpacing: '0.05em',
  textTransform: 'uppercase',
  ':hover': {
    background: 'linear-gradient(180deg, #f36bd5 0%, #bd3da1 100%)',
  },
  ':disabled': {
    borderColor: '#202325',
    background: '#292d2f',
    color: '#646a6d',
    cursor: 'not-allowed',
  },
});

export const buttonText = style({
  color: '#fff5fd',
});

export const progressText = style({
  color: '#fff5fd',
  fontSize: '9px',
});

export const progressBar = style({
  width: '100%',
  height: '2px',
  overflow: 'hidden',
  backgroundColor: '#292d2f',
});

export const progressFill = style({
  height: '100%',
  backgroundColor: '#ff4fd8',
  transition: 'width 150ms ease',
});

export const errorMessage = style({
  padding: '4px 6px',
  border: '1px solid #8b3f34',
  backgroundColor: '#3b201d',
  color: '#e49a8f',
  fontSize: '9px',
});
