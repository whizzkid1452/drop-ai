import { style } from '@vanilla-extract/css';

export const page = style({
  minHeight: '100%',
  display: 'grid',
  placeItems: 'center',
  padding: '32px 20px',
  background:
    'radial-gradient(circle at 50% 0%, rgba(255, 79, 216, 0.12), transparent 38%), linear-gradient(180deg, #171a1c 0%, #101214 100%)',
  color: '#e7e8e9',
});

export const panel = style({
  width: 'min(100%, 560px)',
  padding: '32px',
  border: '1px solid #3d4245',
  background: 'rgba(30, 34, 36, 0.96)',
  boxShadow: '0 24px 80px rgba(0, 0, 0, 0.34)',
});

export const brand = style({
  color: '#ff5cda',
  fontSize: '11px',
  fontWeight: 900,
  letterSpacing: '0.16em',
});

export const title = style({
  margin: '12px 0 8px',
  fontSize: '28px',
  lineHeight: 1.2,
});

export const description = style({
  margin: 0,
  color: '#aeb3b5',
  fontSize: '14px',
  lineHeight: 1.65,
});

export const price = style({
  margin: '28px 0 4px',
  color: '#ffffff',
  fontSize: '34px',
  fontWeight: 800,
});

export const interval = style({
  color: '#8e9598',
  fontSize: '12px',
});

export const statusBox = style({
  marginTop: '24px',
  padding: '16px',
  border: '1px solid #3a3f42',
  background: '#191d1f',
});

export const statusTitle = style({
  margin: 0,
  color: '#f1f2f2',
  fontSize: '14px',
  fontWeight: 700,
});

export const statusDescription = style({
  margin: '6px 0 0',
  color: '#aeb3b5',
  fontSize: '12px',
  lineHeight: 1.6,
});

export const actionRow = style({
  display: 'flex',
  flexWrap: 'wrap',
  gap: '10px',
  marginTop: '24px',
});

export const primaryAction = style({
  minHeight: '42px',
  padding: '0 18px',
  border: '1px solid #ff4fd8',
  background: '#ff4fd8',
  color: '#171319',
  cursor: 'pointer',
  fontFamily: 'inherit',
  fontSize: '12px',
  fontWeight: 900,
  letterSpacing: '0.04em',
  textDecoration: 'none',
  selectors: {
    '&:hover:not(:disabled)': {
      background: '#ff78e3',
    },
    '&:focus-visible': {
      outline: '2px solid #ffffff',
      outlineOffset: '2px',
    },
    '&:disabled': {
      cursor: 'wait',
      opacity: 0.55,
    },
  },
});

export const secondaryAction = style({
  minHeight: '42px',
  padding: '0 18px',
  border: '1px solid #4b5053',
  background: '#292d2f',
  color: '#d6d8d9',
  cursor: 'pointer',
  fontFamily: 'inherit',
  fontSize: '12px',
  fontWeight: 700,
  lineHeight: '40px',
  textDecoration: 'none',
  selectors: {
    '&:hover:not(:disabled)': {
      borderColor: '#ff4fd8',
      color: '#ff78e3',
    },
    '&:focus-visible': {
      outline: '2px solid #ff4fd8',
      outlineOffset: '2px',
    },
    '&:disabled': {
      cursor: 'wait',
      opacity: 0.55,
    },
  },
});

export const notice = style({
  margin: '16px 0 0',
  color: '#8e9598',
  fontSize: '11px',
  lineHeight: 1.6,
});

export const error = style({
  margin: '16px 0 0',
  color: '#ff9a9a',
  fontSize: '12px',
});

export const success = style({
  margin: '16px 0 0',
  color: '#8be9b1',
  fontSize: '12px',
});
