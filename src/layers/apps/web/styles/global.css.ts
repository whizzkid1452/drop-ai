import { globalStyle } from '@vanilla-extract/css';

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
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  WebkitFontSmoothing: 'antialiased',
  MozOsxFontSmoothing: 'grayscale',
  backgroundColor: '#111315',
  colorScheme: 'dark',
});

globalStyle('::-webkit-scrollbar', {
  width: '10px',
  height: '10px',
});

globalStyle('::-webkit-scrollbar-track', {
  backgroundColor: '#171a1c',
});

globalStyle('::-webkit-scrollbar-thumb', {
  backgroundColor: '#414649',
  border: '2px solid #171a1c',
  borderRadius: 0,
});

globalStyle('::-webkit-scrollbar-thumb:hover', {
  backgroundColor: '#555b5e',
});

globalStyle('::selection', {
  backgroundColor: '#8b2f78',
  color: '#ffffff',
});
