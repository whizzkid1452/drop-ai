import { style } from '@vanilla-extract/css';
import { ardourPalette } from '../../../styles/ardourTheme';

export const container = style({
  padding: '20px',
  backgroundColor: ardourPalette.surface,
  border: `1px solid ${ardourPalette.border}`,
  borderRadius: '12px',
  marginTop: '24px',
});

export const header = style({
  marginBottom: '20px',
});

export const note = style({
  fontSize: '0.875rem',
  color: ardourPalette.textMuted,
  fontStyle: 'italic',
});

// 미구현: 믹서 스트립 스타일 (필요 시 Ardour 팔레트로 재구성 예정)

