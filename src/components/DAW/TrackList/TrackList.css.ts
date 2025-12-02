import { style } from '@vanilla-extract/css';
import { ardourPalette } from '../../../styles/ardourTheme';

export const container = style({
  display: 'flex',
  flexDirection: 'column',
  backgroundColor: ardourPalette.surface,
  border: `1px solid ${ardourPalette.border}`,
  borderRadius: '12px',
  overflow: 'hidden',
});

export const header = style({
  display: 'grid',
  gridTemplateColumns: '1fr 200px 60px 60px 80px',
  gap: '12px',
  padding: '12px 16px',
  backgroundColor: ardourPalette.surfaceRaised,
  borderBottom: `2px solid ${ardourPalette.border}`,
  fontWeight: '600',
  fontSize: '0.875rem',
  color: ardourPalette.textSecondary,
});

export const headerItem = style({
  display: 'flex',
  alignItems: 'center',
});

export const trackList = style({
  display: 'flex',
  flexDirection: 'column',
  maxHeight: '400px',
  overflowY: 'auto',
});

export const trackRow = style({
  display: 'grid',
  gridTemplateColumns: '1fr 200px 60px 60px 80px',
  gap: '12px',
  padding: '12px 16px',
  borderBottom: `1px solid ${ardourPalette.border}`,
  alignItems: 'center',
  transition: 'background-color 0.2s',

  ':hover': {
    backgroundColor: ardourPalette.surfaceRaised,
  },

  selectors: {
    '&:last-child': {
      borderBottom: 'none',
    },
  },
});

export const trackName = style({
  fontSize: '0.875rem',
  fontWeight: '500',
  color: ardourPalette.textPrimary,
  minWidth: 0,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
});

export const volumeControl = style({
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
});

export const volumeSlider = style({
  flex: 1,
  height: '6px',
  backgroundColor: ardourPalette.border,
  borderRadius: '3px',
  outline: 'none',
  cursor: 'pointer',

  '::-webkit-slider-thumb': {
    appearance: 'none',
    width: '16px',
    height: '16px',
    backgroundColor: ardourPalette.accent,
    borderRadius: '50%',
    cursor: 'pointer',
  },

  '::-moz-range-thumb': {
    width: '16px',
    height: '16px',
    backgroundColor: ardourPalette.accent,
    borderRadius: '50%',
    cursor: 'pointer',
    border: 'none',
  },
});

export const volumeValue = style({
  fontSize: '0.75rem',
  color: ardourPalette.textMuted,
  minWidth: '40px',
  textAlign: 'right',
});

export const controlButton = style({
  padding: '6px 12px',
  border: `1px solid ${ardourPalette.border}`,
  borderRadius: '6px',
  backgroundColor: ardourPalette.surface,
  fontSize: '0.875rem',
  fontWeight: '600',
  color: ardourPalette.textSecondary,
  cursor: 'pointer',
  transition: 'all 0.2s',

  ':hover': {
    backgroundColor: ardourPalette.surfaceRaised,
    borderColor: ardourPalette.accent,
  },

  ':active': {
    transform: 'scale(0.95)',
  },
});

export const active = style({
  backgroundColor: ardourPalette.accent,
  borderColor: ardourPalette.accent,
  color: ardourPalette.surface,

  ':hover': {
    backgroundColor: ardourPalette.accentHover,
    borderColor: ardourPalette.accentHover,
  },
});

export const clipInfo = style({
  fontSize: '0.75rem',
  color: ardourPalette.textMuted,
  textAlign: 'right',
});
