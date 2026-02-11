import { style } from '@vanilla-extract/css';

export const container = style({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  height: '100vh',
  width: '100vw',
  backgroundColor: '#0a0a0a',
  color: '#e0e0e0',
  gap: '1.5rem',
  padding: '2rem',
  textAlign: 'center',
  fontFamily: '"Geist Mono", "Roboto Mono", monospace', // Tech-inspired font
});

export const icon = style({
  fontSize: '3rem',
  marginBottom: '1rem',
  color: '#ff4444',
  animation: 'pulse 2s infinite',
});

export const title = style({
  fontSize: '2rem',
  fontWeight: '600',
  color: '#ffffff',
  marginBottom: '0.5rem',
  letterSpacing: '-0.02em',
});

export const message = style({
  fontSize: '1rem',
  color: '#888888',
  maxWidth: '600px',
  lineHeight: '1.6',
});

export const button = style({
  marginTop: '2rem',
  padding: '0.75rem 2rem',
  backgroundColor: '#ffffff',
  color: '#000000',
  border: 'none',
  borderRadius: '4px',
  fontSize: '1rem',
  fontWeight: '500',
  cursor: 'pointer',
  transition: 'transform 0.2s, opacity 0.2s',
  ':hover': {
    transform: 'translateY(-2px)',
    opacity: 0.9,
  },
  ':active': {
    transform: 'translateY(0)',
  },
});

export const codeStack = style({
  marginTop: '2rem',
  padding: '1.5rem',
  backgroundColor: '#111111',
  borderRadius: '8px',
  border: '1px solid #222222',
  textAlign: 'left',
  width: '100%',
  maxWidth: '800px',
  overflowX: 'auto',
  color: '#ff6b6b',
  fontSize: '0.875rem',
  fontFamily: 'monospace',
  maxHeight: '300px',
  overflowY: 'auto',
});
