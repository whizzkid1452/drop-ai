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
});

globalStyle('body', {
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  WebkitFontSmoothing: 'antialiased',
  MozOsxFontSmoothing: 'grayscale',
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

