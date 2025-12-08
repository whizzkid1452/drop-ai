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
  padding: '12px 24px',
  backgroundColor: '#4CAF50',
  color: '#fff',
  border: 'none',
  borderRadius: '8px',
  fontSize: '16px',
  fontWeight: '600',
  cursor: 'pointer',
  transition: 'background-color 0.2s, opacity 0.2s',
  minWidth: '120px',
  minHeight: '48px',
  position: 'relative',
  overflow: 'hidden',

  ':hover': {
    backgroundColor: '#45a049',
  },

  ':disabled': {
    backgroundColor: '#666',
    cursor: 'not-allowed',
    opacity: 0.6,
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
  height: '4px',
  backgroundColor: 'rgba(255, 255, 255, 0.3)',
  borderRadius: '2px',
  overflow: 'hidden',
});

export const progressFill = style({
  height: '100%',
  backgroundColor: '#fff',
  transition: 'width 0.3s ease',
  borderRadius: '2px',
});

export const errorMessage = style({
  padding: '8px 12px',
  backgroundColor: '#f44336',
  color: '#fff',
  borderRadius: '4px',
  fontSize: '14px',
  fontWeight: '500',
});




