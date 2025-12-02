import { style } from '@vanilla-extract/css';
import { ardourPalette } from '../../../styles/ardourTheme';

export const container = style({
  position: 'relative',
  width: '100%',
  height: '100%',
  backgroundColor: ardourPalette.surface,
  overflow: 'visible',
  margin: 0,
  padding: 0,
});

export const timelineContent = style({
  display: 'flex',
  flexDirection: 'column',
  width: '100%',
  minWidth: '100%',
  position: 'relative',
  cursor: 'pointer', // Ardour처럼 클릭 가능함을 표시
});

export const trackRow = style({
  borderBottom: `1px solid ${ardourPalette.border}`,
  position: 'relative',
  height: '80px',

  selectors: {
    '&:last-child': {
      borderBottom: 'none',
    },
  },
});

export const emptyState = style({
  padding: '48px 24px',
  textAlign: 'center',
  color: ardourPalette.textMuted,
  fontSize: '0.875rem',
});

export const emptyClip = style({
  width: '100%',
  height: '100%',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  backgroundColor: ardourPalette.surfaceRaised,
  border: `2px dashed ${ardourPalette.border}`,
  borderRadius: '6px',
  margin: '4px',
  color: ardourPalette.textMuted,
  fontSize: '0.875rem',
});

export const clip = style({
  position: 'absolute',
  top: '0',
  bottom: '0',
  backgroundColor: ardourPalette.surfaceRaised,
  overflow: 'hidden',
  cursor: 'pointer',
  transition: 'box-shadow 0.2s',

  ':hover': {
    boxShadow: '0 4px 16px rgba(92, 64, 122, 0.18)',
  },
});

export const waveform = style({
  width: '100%',
  height: '100%',
  position: 'relative',
});

export const clipName = style({
  position: 'absolute',
  top: '4px',
  left: '8px',
  fontSize: '0.75rem',
  fontWeight: 600,
  color: ardourPalette.textPrimary,
  backgroundColor: 'rgba(255, 255, 255, 0.85)',
  padding: '2px 6px',
  borderRadius: '4px',
});

export const playhead = style({
  position: 'absolute',
  top: '0',
  bottom: '0',
  width: '2px',
  backgroundColor: ardourPalette.critical,
  pointerEvents: 'none',
  zIndex: 10,
});
