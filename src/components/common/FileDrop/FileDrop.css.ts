import { style, keyframes } from '@vanilla-extract/css';

export const dropZone = style({
  border: '1px solid #333333',
  borderRadius: '4px',
  padding: '4rem 2rem',
  textAlign: 'center',
  cursor: 'pointer',
  transition: 'all 0.2s ease',
  backgroundColor: '#0a0a0a',
  position: 'relative',
  overflow: 'hidden',

  ':hover': {
    borderColor: '#444444',
    backgroundColor: '#0f0f0f',
  },
});

export const dropZoneActive = style({
  borderColor: '#555555',
  backgroundColor: '#111111',
  borderStyle: 'solid',
});

export const dropZoneContent = style({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: '1rem',
  pointerEvents: 'none',
});

export const title = style({
  fontSize: '1.25rem',
  fontWeight: 500,
  color: '#ffffff',
  margin: 0,
  letterSpacing: '-0.01em',
});

export const subtitle = style({
  fontSize: '0.875rem',
  color: '#666666',
  margin: 0,
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
});

export const fileInput = style({
  display: 'none',
});

export const button = style({
  marginTop: '1.5rem',
  padding: '0.625rem 1.5rem',
  backgroundColor: '#1a1a1a',
  color: '#ffffff',
  border: '1px solid #333333',
  borderRadius: '2px',
  fontSize: '0.875rem',
  fontWeight: 400,
  cursor: 'pointer',
  transition: 'all 0.15s ease',
  pointerEvents: 'auto',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',

  ':hover': {
    backgroundColor: '#222222',
    borderColor: '#444444',
  },

  ':active': {
    backgroundColor: '#1a1a1a',
  },
});

const pulse = keyframes({
  '0%, 100%': {
    opacity: 1,
  },
  '50%': {
    opacity: 0.5,
  },
});

export const loadingIndicator = style({
  display: 'inline-block',
  width: '20px',
  height: '20px',
  border: '2px solid #333333',
  borderTopColor: '#888888',
  borderRadius: '50%',
  animation: `${pulse} 1s linear infinite`,
});
