import { style } from '@vanilla-extract/css';

export const container = style({
  position: 'fixed',
  bottom: '30px',
  left: '50%',
  transform: 'translateX(-50%)',
  display: 'flex',
  alignItems: 'center',
  gap: '16px',
  padding: '12px 24px',
  backgroundColor: 'rgba(20, 20, 20, 0.9)',
  backdropFilter: 'blur(10px)',
  borderRadius: '24px',
  border: '1px solid rgba(255, 255, 255, 0.1)',
  boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
  zIndex: 100,
});

export const button = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '20px',
  height: '20px',
  borderRadius: '50%',
  border: 'none',
  backgroundColor: 'transparent',
  color: '#ffffff',
  cursor: 'pointer',
  transition: 'all 0.2s ease',
  padding: 0,
  ':hover': {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    transform: 'scale(1.1)',
  },
  ':active': {
    transform: 'scale(0.95)',
  },
});

export const playButton = style([
  button,
  {
    width: '20px',
    height: '20px',
    backgroundColor: '#ffffff',
    color: '#000000',
    ':hover': {
      backgroundColor: '#f0f0f0',
      transform: 'scale(1.1)',
    },
  },
]);
