import { style } from '@vanilla-extract/css';
import { ardourPalette } from '../../../styles/ardourTheme';

export const container = style({
  display: 'flex',
  flexDirection: 'column',
  gap: '12px',
  color: ardourPalette.textPrimary,
});

export const hiddenInput = style({
  display: 'none',
});

export const dropZone = style({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '48px 24px',
  border: `2px dashed ${ardourPalette.border}`,
  borderRadius: '12px',
  backgroundColor: ardourPalette.surfaceRaised,
  cursor: 'pointer',
  transition: 'border-color 0.2s ease, transform 0.2s ease',
  minHeight: '200px',

  ':hover': {
    borderColor: ardourPalette.accent,
  },

  selectors: {
    '&:active': {
      transform: 'scale(0.98)',
    },
  },
});

export const dragging = style({
  borderColor: ardourPalette.accentHover,
  backgroundColor: ardourPalette.surface,
  transform: 'scale(1.02)',
});

export const loading = style({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: '12px',
  color: ardourPalette.accent,
});

export const spinner = style({
  width: '40px',
  height: '40px',
  border: '3px solid rgba(162, 86, 255, 0.15)',
  borderTopColor: ardourPalette.accent,
  borderRadius: '50%',
  animation: 'spin 1s linear infinite',
});

export const title = style({
  fontSize: '1.25rem',
  fontWeight: 600,
  color: ardourPalette.textPrimary,
  margin: '0',
});

export const description = style({
  fontSize: '0.875rem',
  color: ardourPalette.textSecondary,
  margin: '4px 0 0 0',
});

export const supported = style({
  fontSize: '0.75rem',
  color: ardourPalette.textMuted,
  margin: '8px 0 0 0',
});

export const error = style({
  padding: '12px 16px',
  backgroundColor: 'rgba(186, 27, 37, 0.15)',
  border: `1px solid ${ardourPalette.critical}`,
  borderRadius: '8px',
  color: ardourPalette.critical,
  fontSize: '0.875rem',
});
