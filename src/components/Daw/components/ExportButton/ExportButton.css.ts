import { style } from '@vanilla-extract/css';

export const container = style({
  display: 'flex',
  flexDirection: 'column',
  gap: '8px',
});

export const exportButton = style({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '8px',
  padding: '0.625rem 1.5rem',
  backgroundColor: '#1a1a1a',
  color: '#ffffff',
  border: '1px solid #333333',
  borderRadius: '2px',
  fontSize: '0.875rem',
  fontWeight: '400',
  cursor: 'pointer',
  transition: 'all 0.15s ease',
  minWidth: '120px',
  minHeight: '36px',
  position: 'relative',
  overflow: 'hidden',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',

  ':hover': {
    backgroundColor: '#222222',
    borderColor: '#444444',
  },

  ':disabled': {
    backgroundColor: '#0a0a0a',
    borderColor: '#222222',
    color: '#444444',
    cursor: 'not-allowed',
    opacity: 0.5,
  },
});

export const buttonText = style({
  color: '#fff',
});

export const progressText = style({
  color: '#fff',
  fontSize: '14px',
  fontWeight: '500',
});

export const progressBar = style({
  width: '100%',
  height: '2px',
  backgroundColor: '#333333',
  borderRadius: '1px',
  overflow: 'hidden',
});

export const progressFill = style({
  height: '100%',
  backgroundColor: '#888888',
  transition: 'width 0.3s ease',
  borderRadius: '1px',
});

export const errorMessage = style({
  padding: '8px 12px',
  backgroundColor: '#1a0a0a',
  color: '#ff4444',
  borderRadius: '2px',
  fontSize: '0.75rem',
  fontWeight: '400',
  border: '1px solid #ff4444',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
});

