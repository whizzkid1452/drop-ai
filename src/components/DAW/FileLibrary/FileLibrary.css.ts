import { style } from '@vanilla-extract/css';
import { ardourPalette } from '@/styles/ardourTheme';

export const container = style({
  display: 'flex',
  flexDirection: 'column',
  gap: '12px',
  backgroundColor: ardourPalette.surfaceRaised,
  border: `1px solid ${ardourPalette.border}`,
  borderRadius: '12px',
  padding: '16px',
});

export const title = style({
  fontSize: '1rem',
  fontWeight: 600,
  color: ardourPalette.textPrimary,
  margin: '0 0 8px 0',
});

export const fileList = style({
  display: 'flex',
  flexDirection: 'column',
  gap: '8px',
  maxHeight: '300px',
  overflowY: 'auto',
  paddingRight: '4px',
});

export const fileItem = style({
  display: 'flex',
  flexDirection: 'column',
  gap: '8px',
  padding: '12px',
  backgroundColor: ardourPalette.surface,
  border: `1px solid ${ardourPalette.border}`,
  borderRadius: '8px',
});

export const fileInfo = style({
  display: 'flex',
  flexDirection: 'column',
  gap: '4px',
});

export const fileName = style({
  fontSize: '0.875rem',
  fontWeight: 500,
  color: ardourPalette.textPrimary,
});

export const fileSize = style({
  fontSize: '0.75rem',
  color: ardourPalette.textMuted,
});

export const fileDuration = style({
  fontSize: '0.75rem',
  color: ardourPalette.textMuted,
});

export const fileActions = style({
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginTop: '8px',
  paddingTop: '8px',
  borderTop: `1px solid ${ardourPalette.border}`,
});

export const trackInfo = style({
  fontSize: '0.75rem',
  color: ardourPalette.accentHover,
});

export const deleteButton = style({
  padding: '4px 12px',
  backgroundColor: ardourPalette.critical,
  color: '#fff',
  border: 'none',
  borderRadius: '8px',
  fontSize: '0.875rem',
  cursor: 'pointer',
  transition: 'background-color 0.2s',

  ':hover': {
    backgroundColor: ardourPalette.criticalHover,
  },

  ':active': {
    transform: 'scale(0.98)',
  },
});

export const emptyState = style({
  padding: '48px 24px',
  textAlign: 'center',
  color: ardourPalette.textMuted,
  fontSize: '0.875rem',
});
