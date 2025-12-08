import { style } from '@vanilla-extract/css';
import { wave } from '@/styles/global.css';

export const container = style({
  width: '100%',
  height: '100vh',
  backgroundColor: '#0a0a0a',
  color: '#ffffff',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  position: 'relative',
  overflow: 'hidden',
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
});

export const backgroundGrid = style({
  position: 'absolute',
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
});

export const content = style({
  position: 'relative',
  zIndex: 1,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: '1.5rem',
  padding: '2rem',
  textAlign: 'center',
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

export const waveAnimation = style({
  position: 'absolute',
  bottom: 0,
  left: 0,
  width: '100%',
  height: '150px',
  background: 'linear-gradient(to top, rgba(0, 0, 0, 0.3) 0%, transparent 100%)',
  pointerEvents: 'none',
  animation: `${wave} 4s ease-in-out infinite`,
});

export const glowEffect = style({
  position: 'absolute',
  top: '50%',
  left: '50%',
  transform: 'translate(-50%, -50%)',
  width: '800px',
  height: '800px',
  background: 'radial-gradient(circle, rgba(255, 255, 255, 0.02) 0%, transparent 70%)',
  borderRadius: '50%',
  pointerEvents: 'none',
  filter: 'blur(80px)',
});

