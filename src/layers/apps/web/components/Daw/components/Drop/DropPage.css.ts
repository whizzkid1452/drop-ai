import { style } from '@vanilla-extract/css';

export const container = style({
  position: 'relative',
  width: '100%',
  minHeight: '100vh',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexDirection: 'column',
  padding: '2rem',
  boxSizing: 'border-box',
  backgroundColor: '#1E1E1E', // ableton-bg-dark
  color: '#DCDCDC', // ableton-text-dark
  fontFamily:
    "'IBM Plex Mono', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
});

export const cardGroup = style({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '0.5rem', // gap-2 느낌
});

export const hero = style({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  textAlign: 'center',
  gap: '1.5rem',
  paddingTop: '1.5rem',
  paddingBottom: '1.5rem',
  marginBottom: '2rem',
});

export const heroTitle = style({
  fontSize: '5rem',
  fontWeight: 650,
  color: '#FF4FD8', // pink accent
  margin: 0,
  letterSpacing: '-0.03em',
});

export const heroSubtitle = style({
  fontSize: '0.875rem',
  fontWeight: 400,
  color: '#A0A0A0',
  margin: 0,
  letterSpacing: '0.01em',
  textTransform: 'uppercase',
});

export const heroAccent = style({
  width: '96px',
  height: '2px',
  background: '#FF4FD8',
  borderRadius: '1px',
  margin: '0.5rem 0',
});
