import { style, keyframes } from '@vanilla-extract/css';

export const dropZone = style({
  border: '1px dashed #6b7280', // border-gray-500
  borderRadius: '2px', // rounded-sm
  width: '24rem', // w-96
  height: '14rem', // h-56
  padding: '0',
  textAlign: 'center',
  cursor: 'pointer',
  transition: 'all 0.3s ease-out',
  backgroundColor: 'transparent',
  position: 'relative',
  overflow: 'hidden',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',

  ':hover': {
    borderStyle: 'solid',
    borderColor: 'rgba(255, 79, 216, 0.5)', // pink accent/50
    backgroundColor: 'rgba(255, 79, 216, 0.06)', // pink accent/10 느낌
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
  justifyContent: 'center',
  gap: '1rem', // gap-4
  pointerEvents: 'none',
});

export const iconWrapper = style({
  position: 'relative',
});

export const iconMain = style({
  fontFamily: '"Material Symbols Outlined", system-ui, sans-serif',
  fontSize: '3rem', // text-5xl
  opacity: 0.5,
  color: '#d1d5db', // text-gray-300
  transition: 'transform 0.3s ease, opacity 0.3s ease',

  selectors: {
    [`${dropZone}:hover &`]: {
      opacity: 1,
      transform: 'scale(1.1) translateY(-4px)',
    },
  },
});

export const iconGlow = style({
  fontFamily: '"Material Symbols Outlined", system-ui, sans-serif',
  fontSize: '3rem',
  position: 'absolute',
  top: 0,
  left: 0,
  opacity: 0,
  color: '#FF4FD8', // pink accent
  transition: 'transform 0.5s ease, opacity 0.5s ease',

  selectors: {
    [`${dropZone}:hover &`]: {
      opacity: 0.3,
      transform: 'scale(1.25)',
    },
  },
});

export const label = style({
  fontSize: '1.25rem', // text-xl
  textTransform: 'uppercase',
  letterSpacing: '0.3em', // tracking-widest
  opacity: 0.8,
  fontWeight: 700,
  fontFamily: '"Inter", system-ui, sans-serif',
  color: '#e5e7eb', // text-gray-200
  transition: 'opacity 0.3s ease',

  selectors: {
    [`${dropZone}:hover &`]: {
      opacity: 1,
    },
  },
});

export const fileInput = style({
  display: 'none',
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
