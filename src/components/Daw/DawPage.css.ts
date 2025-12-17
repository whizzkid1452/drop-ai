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


export const modalOverlay = style({
  position: 'fixed',
  top: 0,
  left: 0,
  width: '100vw',
  height: '100vh',
  backgroundColor: 'rgba(0, 0, 0, 0.7)',
  backdropFilter: 'blur(6px)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 10,
  padding: '16px',
});

