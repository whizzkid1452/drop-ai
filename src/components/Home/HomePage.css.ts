import { style } from '@vanilla-extract/css';
import { wave } from '@/styles/global.css';

export const container = style({
  width: '100%',
  height: '100vh',
  backgroundColor: '#1a1a1a',
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
    linear-gradient(rgba(255, 255, 255, 0.03) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255, 255, 255, 0.03) 1px, transparent 1px)
  `,
  backgroundSize: '40px 40px',
  opacity: 0.5,
  pointerEvents: 'none',
});

export const content = style({
  position: 'relative',
  zIndex: 1,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: '2rem',
  padding: '2rem',
  textAlign: 'center',
});

export const logo = style({
  fontSize: '4.5rem',
  fontWeight: 700,
  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 50%, #f093fb 100%)',
  WebkitBackgroundClip: 'text',
  WebkitTextFillColor: 'transparent',
  backgroundClip: 'text',
  margin: 0,
  letterSpacing: '-0.02em',
  textShadow: '0 0 40px rgba(118, 75, 162, 0.3)',
});

export const subtitle = style({
  fontSize: '1.5rem',
  fontWeight: 400,
  color: '#b0b0b0',
  margin: 0,
  letterSpacing: '0.02em',
});

export const accentLine = style({
  width: '60px',
  height: '3px',
  background: 'linear-gradient(90deg, #667eea 0%, #764ba2 100%)',
  borderRadius: '2px',
  margin: '1rem 0',
});

export const waveAnimation = style({
  position: 'absolute',
  bottom: 0,
  left: 0,
  width: '100%',
  height: '200px',
  background: 'linear-gradient(to top, rgba(118, 75, 162, 0.1) 0%, transparent 100%)',
  pointerEvents: 'none',
  animation: `${wave} 3s ease-in-out infinite`,
});

export const glowEffect = style({
  position: 'absolute',
  top: '50%',
  left: '50%',
  transform: 'translate(-50%, -50%)',
  width: '600px',
  height: '600px',
  background: 'radial-gradient(circle, rgba(118, 75, 162, 0.15) 0%, transparent 70%)',
  borderRadius: '50%',
  pointerEvents: 'none',
  filter: 'blur(60px)',
});

