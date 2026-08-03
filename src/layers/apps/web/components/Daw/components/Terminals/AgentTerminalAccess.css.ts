import { style } from '@vanilla-extract/css';

export const container = style({
  height: '100%',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '28px',
  textAlign: 'center',
});

export const badge = style({
  color: '#ff5cda',
  fontSize: '10px',
  fontWeight: 900,
  letterSpacing: '0.16em',
});

export const title = style({
  margin: '10px 0 6px',
  color: '#f1f2f2',
  fontSize: '18px',
});

export const description = style({
  maxWidth: '280px',
  margin: 0,
  color: '#9da3a6',
  fontSize: '12px',
  lineHeight: 1.6,
});

export const action = style({
  minHeight: '36px',
  marginTop: '18px',
  padding: '0 14px',
  border: '1px solid #ff4fd8',
  background: '#2c2830',
  color: '#ff78e3',
  fontSize: '11px',
  fontWeight: 800,
  lineHeight: '34px',
  textDecoration: 'none',
  selectors: {
    '&:hover': {
      background: '#3b2d3b',
    },
    '&:focus-visible': {
      outline: '2px solid #ffffff',
      outlineOffset: '2px',
    },
  },
});
