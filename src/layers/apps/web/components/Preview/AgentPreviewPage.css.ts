import { style } from '@vanilla-extract/css';

export const page = style({
  width: '100%',
  minHeight: '100vh',
  padding: '32px',
  boxSizing: 'border-box',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: '20px',
  backgroundColor: '#0a0a0a',
  color: '#f5f5f5',
});

export const heading = style({
  width: 'min(960px, 100%)',
  display: 'flex',
  flexDirection: 'column',
  gap: '8px',
});

export const title = style({
  margin: 0,
  fontSize: '24px',
  fontWeight: 600,
  letterSpacing: '-0.02em',
});

export const description = style({
  margin: 0,
  color: '#8c8c8c',
  fontSize: '14px',
});

export const chatPanel = style({
  width: 'min(960px, 100%)',
  height: 'min(680px, calc(100vh - 220px))',
  minHeight: '440px',
  overflow: 'hidden',
  border: '1px solid #333333',
  backgroundColor: '#151515',
  boxShadow: '0 24px 80px rgba(0, 0, 0, 0.35)',
});

export const actionBar = style({
  width: 'min(960px, 100%)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: '16px',
  padding: '12px',
  boxSizing: 'border-box',
  border: '1px solid #333333',
  backgroundColor: '#111111',
});

export const actionGroup = style({
  display: 'flex',
  alignItems: 'center',
  gap: '12px',
});

export const status = style({
  color: '#9f9f9f',
  fontSize: '12px',
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
});

export const goEditButton = style({
  minHeight: '36px',
  padding: '0 20px',
  border: '1px solid #ff4fd8',
  borderRadius: '2px',
  backgroundColor: '#ff4fd8',
  color: '#111111',
  cursor: 'pointer',
  fontSize: '13px',
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  ':hover': {
    backgroundColor: '#ff75e0',
  },
});

export const errorMessage = style({
  width: 'min(960px, 100%)',
  margin: 0,
  color: '#ff7b7b',
  fontSize: '13px',
});
