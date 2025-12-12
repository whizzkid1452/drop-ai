import { style } from '@vanilla-extract/css';
import { wave } from '@/styles/global.css';

export const container = style({
  width: '100%',
  height: '100vh',
  margin: 0,
  padding: '24px',
  backgroundColor: '#0a0a0a',
  minHeight: '100vh',
  position: 'relative',
  overflow: 'auto',
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
});

export const backgroundGrid = style({
  position: 'fixed',
  top: 0,
  left: 0,
  width: '100%',
  height: '100%',
  backgroundImage: `
    linear-gradient(rgba(255, 255, 255, 0.02) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255, 255, 255, 0.02) 1px, transparent 1px)
  `,
  backgroundSize: '20px 20px',
  opacity: 0.4,
  pointerEvents: 'none',
  zIndex: 0,
});

export const glowEffect = style({
  position: 'fixed',
  top: '50%',
  left: '50%',
  transform: 'translate(-50%, -50%)',
  width: '800px',
  height: '800px',
  background: 'radial-gradient(circle, rgba(255, 255, 255, 0.02) 0%, transparent 70%)',
  borderRadius: '50%',
  pointerEvents: 'none',
  filter: 'blur(80px)',
  zIndex: 0,
});

export const waveAnimation = style({
  position: 'fixed',
  bottom: 0,
  left: 0,
  width: '100%',
  height: '150px',
  background: 'linear-gradient(to top, rgba(0, 0, 0, 0.3) 0%, transparent 100%)',
  pointerEvents: 'none',
  animation: `${wave} 4s ease-in-out infinite`,
  zIndex: 0,
});

export const heroSection = style({
  position: 'relative',
  zIndex: 1,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: '1.5rem',
  padding: '2rem',
  textAlign: 'center',
  marginBottom: '2rem',
});

export const logo = style({
  fontSize: '4.5rem',
  fontWeight: 600,
  color: '#ffffff',
  margin: 0,
  letterSpacing: '-0.03em',
  textShadow: '0 2px 8px rgba(0, 0, 0, 0.5)',
  fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif',
});

export const subtitle = style({
  fontSize: '0.875rem',
  fontWeight: 400,
  color: '#888888',
  margin: 0,
  letterSpacing: '0.01em',
  textTransform: 'uppercase',
});

export const accentLine = style({
  width: '80px',
  height: '2px',
  background: '#333333',
  borderRadius: '1px',
  margin: '0.5rem 0',
});

export const header = style({
  position: 'relative',
  zIndex: 1,
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: '24px',
  paddingBottom: '16px',
  borderBottom: '1px solid #333333',
});

export const headerRight = style({
  display: 'flex',
  alignItems: 'center',
  gap: '16px',
});

export const title = style({
  fontSize: '0.875rem',
  fontWeight: '500',
  color: '#ffffff',
  margin: 0,
  textTransform: 'uppercase',
  letterSpacing: '0.1em',
});

export const trackCount = style({
  fontSize: '0.75rem',
  color: '#666666',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
});

export const emptyState = style({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: '400px',
  textAlign: 'center',
});

export const emptyTitle = style({
  fontSize: '1rem',
  fontWeight: '500',
  color: '#ffffff',
  marginBottom: '8px',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
});

export const emptyMessage = style({
  fontSize: '0.875rem',
  color: '#666666',
});

export const uploadSection = style({
  position: 'relative',
  zIndex: 1,
  marginBottom: '24px',
});

export const trackList = style({
  position: 'relative',
  zIndex: 1,
  display: 'flex',
  flexDirection: 'column',
  gap: '8px',
});

