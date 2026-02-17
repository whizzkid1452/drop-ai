import { globalStyle, keyframes } from '@vanilla-extract/css';

globalStyle('*', {
  boxSizing: 'border-box',
  margin: 0,
  padding: 0,
});

globalStyle('html, body, #root', {
  width: '100%',
  height: '100%',
  margin: 0,
  padding: 0,
  /** @note mac 뒤로가기 기능 방어 */
  overscrollBehaviorX: 'none',
});

globalStyle('body', {
  fontFamily:
    '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  WebkitFontSmoothing: 'antialiased',
  MozOsxFontSmoothing: 'grayscale',
  backgroundColor: '#000000',
});

// 전역 스크롤바 스타일
globalStyle('::-webkit-scrollbar', {
  width: '8px',
  height: '8px',
});

globalStyle('::-webkit-scrollbar-track', {
  backgroundColor: 'transparent',
});

globalStyle('::-webkit-scrollbar-thumb', {
  backgroundColor: '#333333',
  borderRadius: '4px',
  border: '1px solid rgba(255, 255, 255, 0.05)',
});

globalStyle('::-webkit-scrollbar-thumb:hover', {
  backgroundColor: '#444444',
});

export const wave = keyframes({
  '0%, 100%': {
    transform: 'translateY(0)',
    opacity: 0.5,
  },
  '50%': {
    transform: 'translateY(-20px)',
    opacity: 0.8,
  },
});
