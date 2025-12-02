import { style } from '@vanilla-extract/css';
import { ardourPalette } from './ardourTheme';

export const container = style({
  maxWidth: '1200px',
  margin: '0 auto',
  padding: '32px',
  color: ardourPalette.textPrimary,
});

export const card = style({
  backgroundColor: ardourPalette.surface,
  borderRadius: '14px',
  padding: '32px',
  border: `1px solid ${ardourPalette.border}`,
  boxShadow: ardourPalette.shadow,
});
