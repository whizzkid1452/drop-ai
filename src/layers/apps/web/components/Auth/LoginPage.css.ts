import { style } from '@vanilla-extract/css';

export const page = style({
  width: '100%',
  minHeight: '100vh',
  display: 'grid',
  placeItems: 'center',
  padding: '24px',
  backgroundColor: '#111315',
  color: '#d6d8d9',
});

export const panel = style({
  width: 'min(100%, 420px)',
  padding: '32px',
  display: 'flex',
  flexDirection: 'column',
  gap: '16px',
  border: '1px solid #090b0c',
  backgroundColor: '#202325',
  boxShadow: '0 20px 60px rgba(0, 0, 0, 0.35)',
});

export const brand = style({
  color: '#ff4fd8',
  fontSize: '12px',
  fontWeight: 800,
  letterSpacing: '0.16em',
});

export const title = style({
  margin: 0,
  color: '#f1f2f2',
  fontSize: '24px',
  lineHeight: 1.25,
});

export const description = style({
  color: '#9da3a6',
  fontSize: '14px',
  lineHeight: 1.6,
});

export const form = style({
  display: 'flex',
  flexDirection: 'column',
  gap: '8px',
});

export const label = style({
  color: '#c8cbcc',
  fontSize: '12px',
  fontWeight: 700,
});

export const input = style({
  width: '100%',
  minHeight: '42px',
  padding: '0 12px',
  border: '1px solid #4b5053',
  borderRadius: 0,
  backgroundColor: '#171a1c',
  color: '#f1f2f2',
  fontSize: '14px',
  outline: 'none',
  selectors: {
    '&:focus-visible': {
      borderColor: '#ff4fd8',
      boxShadow: '0 0 0 1px #ff4fd8',
    },
    '&:disabled': {
      opacity: 0.65,
    },
  },
});

export const submitButton = style({
  minHeight: '42px',
  marginTop: '8px',
  border: '1px solid #ff4fd8',
  borderRadius: 0,
  backgroundColor: '#ff4fd8',
  color: '#171a1c',
  cursor: 'pointer',
  fontSize: '13px',
  fontWeight: 800,
  selectors: {
    '&:hover:not(:disabled)': {
      backgroundColor: '#ff78e3',
    },
    '&:focus-visible': {
      outline: '1px solid #ffffff',
      outlineOffset: '2px',
    },
    '&:disabled': {
      cursor: 'wait',
      opacity: 0.65,
    },
  },
});

export const statusMessage = style({
  color: '#9ee6bd',
  fontSize: '13px',
  lineHeight: 1.5,
});

export const errorMessage = style({
  color: '#ff9a9a',
  fontSize: '13px',
  lineHeight: 1.5,
});

export const backLink = style({
  alignSelf: 'flex-start',
  color: '#aeb3b5',
  fontSize: '12px',
  textDecoration: 'none',
  selectors: {
    '&:hover': {
      color: '#ffffff',
    },
    '&:focus-visible': {
      outline: '1px solid #ff4fd8',
      outlineOffset: '3px',
    },
  },
});
