import { style } from '@vanilla-extract/css';
import { ardourPalette } from '../../../styles/ardourTheme';

export const wrapper = style({
  display: 'grid',
  gridTemplateColumns: '296px 1fr',
  borderBottom: `1px solid ${ardourPalette.border}`,
  position: 'relative',
  margin: 0,
  padding: 0,
});

export const spacer = style({
  backgroundColor: ardourPalette.surfaceRaised,
  borderRight: `1px solid ${ardourPalette.border}`,
  width: '296px',
  margin: 0,
  padding: 0,
  position: 'relative',
  zIndex: 20,
});

export const scrollContainer = style({
  overflowX: 'auto',
  overflowY: 'hidden',
  width: '100%',
  height: '100%',
  position: 'relative',
  // 스크롤바 숨기기
  scrollbarWidth: 'none', // Firefox
  msOverflowStyle: 'none', // IE, Edge (구버전)

  selectors: {
    '&::-webkit-scrollbar': {
      display: 'none', // Chrome, Safari, Edge
    },
  },
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
