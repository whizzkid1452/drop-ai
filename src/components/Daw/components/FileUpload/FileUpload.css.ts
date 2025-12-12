import { style, keyframes } from '@vanilla-extract/css';

export const container = style({
  position: 'relative',
  width: '100%',
  maxWidth: '600px',
  margin: '2rem auto',
});

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

export const icon = style({
  fontSize: '3rem',
  color: '#888888',
  marginBottom: '0.5rem',
  opacity: 0.6,
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

export const fileInfo = style({
  marginTop: '2rem',
  padding: '1.5rem',
  backgroundColor: 'rgba(255, 255, 255, 0.05)',
  borderRadius: '8px',
  border: '1px solid rgba(102, 126, 234, 0.2)',
});

export const fileInfoTitle = style({
  fontSize: '1.1rem',
  fontWeight: 600,
  color: '#ffffff',
  marginBottom: '1rem',
});

export const fileInfoItem = style({
  display: 'flex',
  justifyContent: 'space-between',
  padding: '0.5rem 0',
  borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
  fontSize: '0.9rem',
  
  ':last-child': {
    borderBottom: 'none',
  },
});

export const fileInfoLabel = style({
  color: '#b0b0b0',
  fontWeight: 500,
});

export const fileInfoValue = style({
  color: '#ffffff',
});

export const audioPreview = style({
  width: '100%',
  marginTop: '1rem',
  borderRadius: '8px',
});

export const editButton = style({
  marginTop: '1.5rem',
  padding: '0.75rem 2rem',
  backgroundColor: '#1a1a1a',
  color: '#ffffff',
  border: '1px solid #333333',
  borderRadius: '2px',
  fontSize: '0.875rem',
  fontWeight: 400,
  cursor: 'pointer',
  transition: 'all 0.15s ease',
  width: '100%',
  maxWidth: '300px',
  marginLeft: 'auto',
  marginRight: 'auto',
  display: 'block',
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

export const errorMessage = style({
  marginTop: '1rem',
  padding: '1rem',
  backgroundColor: 'rgba(239, 68, 68, 0.1)',
  border: '1px solid rgba(239, 68, 68, 0.3)',
  borderRadius: '8px',
  color: '#fca5a5',
  fontSize: '0.9rem',
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


