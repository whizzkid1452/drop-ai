import { style } from '@vanilla-extract/css';
import { ardourPalette } from '../../../styles/ardourTheme';

export const container = style({
  display: 'flex',
  flexDirection: 'column',
  backgroundColor: ardourPalette.surface,
  border: `1px solid ${ardourPalette.border}`,
  borderRadius: '12px',
  overflow: 'hidden',
  boxShadow: ardourPalette.shadow,
  position: 'relative',
});

export const trackRow = style({
  display: 'grid',
  gridTemplateColumns: '292px 1fr',
  borderBottom: `1px solid ${ardourPalette.border}`,
  height: '80px',
  position: 'relative',

  selectors: {
    '&:last-child': {
      borderBottom: 'none',
    },
  },
});

export const trackControls = style({
  display: 'flex',
  flexDirection: 'column',
  gap: '2px',
  padding: '4px',
  backgroundColor: '#ffffff',
  borderRight: `1px solid ${ardourPalette.border}`,
  minWidth: '272px',
  position: 'relative',
  zIndex: 15,
  '@media': {
    '(max-width: 1024px)': {
      gap: '2px',
      padding: '4px',
    },
    '(max-width: 768px)': {
      gap: '2px',
      padding: '4px',
    },
  },
});

export const trackName = style({
  fontSize: 'clamp(0.7rem, 1vw, 0.8rem)',
  fontWeight: 600,
  color: ardourPalette.textPrimary,
  marginBottom: '0px',
});

export const controlSection = style({
  display: 'flex',
  flexDirection: 'column',
  gap: '0px',
});

export const controlLabel = style({
  fontSize: 'clamp(0.65rem, 0.9vw, 0.75rem)',
  fontWeight: 500,
  color: ardourPalette.textMuted,
  textTransform: 'uppercase',
});

export const volumeSection = style({
  display: 'flex',
  alignItems: 'center',
  gap: '0px',
});

export const volumeSlider = style({
  flex: 1,
  height: '4px',
  backgroundColor: ardourPalette.border,
  borderRadius: '3px',
  outline: 'none',
  cursor: 'pointer',

  '::-webkit-slider-thumb': {
    appearance: 'none',
    width: '12px',
    height: '12px',
    backgroundColor: ardourPalette.accent,
    borderRadius: '50%',
    cursor: 'pointer',
  },

  '::-moz-range-thumb': {
    width: '12px',
    height: '12px',
    backgroundColor: ardourPalette.accent,
    borderRadius: '50%',
    cursor: 'pointer',
    border: 'none',
  },

  '@media': {
    '(max-width: 768px)': {
      height: '3px',
      '::-webkit-slider-thumb': {
        width: '10px',
        height: '10px',
      },
      '::-moz-range-thumb': {
        width: '10px',
        height: '10px',
      },
    },
  },
});

export const volumeValue = style({
  fontSize: 'clamp(0.65rem, 0.9vw, 0.75rem)',
  color: ardourPalette.textMuted,
  minWidth: '36px',
  textAlign: 'right',
});

export const controlButton = style({
  padding: '2px 6px',
  border: `1px solid ${ardourPalette.border}`,
  borderRadius: '6px',
  backgroundColor: ardourPalette.surface,
  color: ardourPalette.textSecondary,
  fontSize: 'clamp(0.85rem, 1vw, 1rem)',
  cursor: 'pointer',
  transition: 'background-color 0.2s, color 0.2s',

  ':hover': {
    backgroundColor: ardourPalette.surfaceRaised,
    color: ardourPalette.textPrimary,
  },

  ':active': {
    transform: 'scale(0.95)',
  },
});

export const active = style({
  backgroundColor: ardourPalette.accent,
  borderColor: ardourPalette.accent,
  color: '#242424',

  ':hover': {
    backgroundColor: ardourPalette.accentHover,
    borderColor: ardourPalette.accentHover,
  },
});

export const panControl = style({
  display: 'flex',
  alignItems: 'center',
  gap: '6px',
});

/* 미사용: Mixer UI로 이관되기 전까지 pan 슬라이더는 숨김 상태로 유지
export const panSlider = style({
  flex: 1,
  height: '4px',
  backgroundColor: '#2f2f2f',
  borderRadius: '3px',
  outline: 'none',
  cursor: 'pointer',

  '::-webkit-slider-thumb': {
    appearance: 'none',
    width: '10px',
    height: '10px',
    backgroundColor: ardourPalette.focus,
    borderRadius: '50%',
    cursor: 'pointer',
  },

  '::-moz-range-thumb': {
    width: '10px',
    height: '10px',
    backgroundColor: ardourPalette.focus,
    borderRadius: '50%',
    cursor: 'pointer',
    border: 'none',
  },

  '@media': {
    '(max-width: 768px)': {
      height: '3px',
      '::-webkit-slider-thumb': {
        width: '8px',
        height: '8px',
      },
      '::-moz-range-thumb': {
        width: '8px',
        height: '8px',
      },
    },
  },
});
*/

export const panKnobWrap = style({
  display: 'flex',
  flexDirection: 'row',
  alignItems: 'center',
  gap: '6px',
  marginLeft: 'auto',
});

export const panKnob = style({
  position: 'relative',
  width: '28px',
  height: '28px',
  minWidth: '28px',
  borderRadius: '50%',
  background: 'radial-gradient(circle at 30% 30%, #ffffff, #e8dcff)',
  boxShadow:
    'inset 0 2px 4px rgba(255,255,255,0.4), 0 1px 4px rgba(92,64,122,0.2)',
  border: `1px solid ${ardourPalette.border}`,
  cursor: 'pointer',
  touchAction: 'none',
  '@media': {
    '(max-width: 768px)': {
      width: '24px',
      height: '24px',
      minWidth: '24px',
    },
  },
});

export const panKnobIndicator = style({
  position: 'absolute',
  top: '4px',
  left: '50%',
  width: '2px',
  height: '40%',
  backgroundColor: ardourPalette.accentHover,
  transformOrigin: '50% 100%',
  borderRadius: '2px',
});

export const panValue = style({
  fontSize: 'clamp(0.65rem, 0.9vw, 0.75rem)',
  color: ardourPalette.textMuted,
  minWidth: '35px',
  textAlign: 'right',
});

export const buttonGroup = style({
  display: 'flex',
  gap: '4px',
  marginTop: '2px',
});

export const deleteButton = style({
  padding: '4px 8px',
  border: `1px solid ${ardourPalette.critical}`,
  borderRadius: '6px',
  backgroundColor: '#ffe6ef',
  color: ardourPalette.critical,
  fontSize: '1rem',
  cursor: 'pointer',
  transition: 'all 0.2s',

  ':hover': {
    backgroundColor: 'rgba(186, 27, 37, 0.2)',
  },

  ':active': {
    transform: 'scale(0.95)',
  },
});

export const clipInfo = style({
  fontSize: 'clamp(0.65rem, 0.9vw, 0.75rem)',
  color: ardourPalette.textMuted,
  marginTop: '2px',
});

export const timelineContainer = style({
  flex: 1,
  overflowX: 'auto',
  overflowY: 'hidden',
  position: 'relative',
  width: '100%',
  margin: 0,
  padding: 0,
  backgroundColor: ardourPalette.surface,
  // 개별 스크롤바 숨기기
  scrollbarWidth: 'none', // Firefox
  msOverflowStyle: 'none', // IE, Edge (구버전)

  selectors: {
    '&::-webkit-scrollbar': {
      display: 'none', // Chrome, Safari, Edge
    },
  },
});

export const timelinePlayhead = style({
  position: 'absolute',
  top: '0',
  bottom: '0',
  width: '2px',
  backgroundColor: ardourPalette.critical,
  zIndex: 10,
  pointerEvents: 'none',
});

export const bottomScrollWrapper = style({
  display: 'grid',
  gridTemplateColumns: '292px 1fr',
  borderTop: `1px solid ${ardourPalette.border}`,
  height: '17px',
  backgroundColor: ardourPalette.surfaceRaised,
});

export const bottomScrollSpacer = style({
  backgroundColor: ardourPalette.surfaceRaised,
  borderRight: `1px solid ${ardourPalette.border}`,
  width: '292px',
  position: 'relative',
  zIndex: 20,
});

export const bottomScrollContainer = style({
  overflowX: 'auto',
  overflowY: 'hidden',
  width: '100%',
  height: '100%',
  // 스크롤바 스타일링
  scrollbarWidth: 'thin',
  scrollbarColor: `${ardourPalette.border} ${ardourPalette.surfaceRaised}`,

  selectors: {
    '&::-webkit-scrollbar': {
      height: '12px',
    },
    '&::-webkit-scrollbar-track': {
      backgroundColor: ardourPalette.surfaceRaised,
    },
    '&::-webkit-scrollbar-thumb': {
      backgroundColor: ardourPalette.border,
      borderRadius: '6px',
      border: `2px solid ${ardourPalette.surfaceRaised}`,
    },
    '&::-webkit-scrollbar-thumb:hover': {
      backgroundColor: ardourPalette.divider,
    },
  },
});

export const globalPlayhead = style({
  position: 'absolute',
  top: '0',
  width: '2px',
  backgroundColor: ardourPalette.critical,
  zIndex: 10,
  pointerEvents: 'none',
  boxShadow: '0 0 4px rgba(186, 27, 37, 0.6)',
});
