import { style } from '@vanilla-extract/css';
import { ardourPalette } from '../../../styles/ardourTheme';

export const container = style({
  position: 'relative',
  width: '100%',
  minWidth: '100%',
  height: '40px',
  backgroundColor: ardourPalette.surfaceRaised,
  borderBottom: `2px solid ${ardourPalette.border}`,
  margin: 0,
  padding: 0,
});

export const rulerContent = style({
  position: 'relative',
  width: '100%',
  height: '100%',
  cursor: 'pointer', // Ardour처럼 클릭 가능함을 표시
});

export const barMarker = style({
  position: 'absolute',
  top: '0',
  bottom: '0',
  width: '2px',
  backgroundColor: ardourPalette.accent,
  zIndex: 2,
});

export const beatMarker = style({
  position: 'absolute',
  top: '8px',
  bottom: '0',
  width: '1px',
  backgroundColor: ardourPalette.divider,
  zIndex: 1,
});

export const barNumber = style({
  position: 'absolute',
  top: '2px',
  left: '4px',
  fontSize: '0.75rem',
  fontWeight: 600,
  color: ardourPalette.textPrimary,
  backgroundColor: 'rgba(255, 255, 255, 0.85)',
  padding: '2px 4px',
  borderRadius: '2px',
  whiteSpace: 'nowrap',
  userSelect: 'none',
});

export const playhead = style({
  position: 'absolute',
  top: '0',
  bottom: '0',
  width: '2px',
  backgroundColor: ardourPalette.critical,
  zIndex: 10,
  pointerEvents: 'none',
  boxShadow: '0 0 4px rgba(186, 27, 37, 0.6)',
});

export const microMarker = style({
  position: 'absolute',
  top: '16px',
  bottom: '0',
  width: '1px',
  backgroundColor: ardourPalette.divider,
  opacity: 0.5,
  zIndex: 0,
});

export const minorLabel = style({
  position: 'absolute',
  top: '2px',
  left: '2px',
  fontSize: '0.7rem',
  fontWeight: 400,
  color: ardourPalette.textSecondary,
  userSelect: 'none',
});

export const rulerContainer = style({
  position: 'relative',
  width: '100%',
  backgroundColor: ardourPalette.surfaceRaised,
});