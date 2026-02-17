import { style } from '@vanilla-extract/css';

export const container = style({
  display: 'flex',
  flexDirection: 'column',
  height: '100%',
  backgroundColor: 'rgba(15, 15, 20, 0.95)',
  backdropFilter: 'blur(10px)',
  borderLeft: '1px solid rgba(255, 255, 255, 0.1)',
  color: '#e0e0e0',
  overflow: 'hidden',
  position: 'relative',
});

export const content = style({
  flex: 1,
  overflow: 'hidden',
  paddingBottom: '40px', // Space for the toggle button
});

export const footer = style({
  position: 'absolute',
  bottom: 0,
  left: 0,
  right: 0,
  height: '40px',
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  background: 'rgba(26, 26, 26, 0.8)',
  borderTop: '1px solid rgba(255, 255, 255, 0.1)',
  padding: '0 8px',
});

export const toggleButton = style({
  width: '100%',
  height: '32px',
  backgroundColor: 'rgba(255, 255, 255, 0.05)',
  border: '1px solid rgba(255, 255, 255, 0.1)',
  borderRadius: '4px',
  color: '#888',
  fontSize: '11px',
  fontWeight: 600,
  cursor: 'pointer',
  transition: 'all 0.2s ease',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '8px',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  ':hover': {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    color: '#f0f0f0',
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
});

export const activeIndicator = style({
  color: '#00ccff',
});
