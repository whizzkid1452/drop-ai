import { style } from '@vanilla-extract/css';

export const container = style({
  position: 'relative',
  height: '100%',
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
  borderLeft: '1px solid #080a0b',
  backgroundColor: '#1b1f21',
  color: '#d2d4d5',
});

export const content = style({
  flex: 1,
  overflow: 'hidden',
  paddingBottom: '32px',
});

export const footer = style({
  position: 'absolute',
  bottom: 0,
  left: 0,
  right: 0,
  height: '32px',
  padding: '4px 6px',
  display: 'flex',
  alignItems: 'center',
  borderTop: '1px solid #0d0f10',
  background: '#24282a',
});

export const toggleButton = style({
  width: '100%',
  height: '24px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '6px',
  border: '1px solid #111416',
  borderRadius: '2px',
  background: 'linear-gradient(180deg, #3b4043 0%, #2c3032 100%)',
  color: '#7f8689',
  cursor: 'pointer',
  fontSize: '9px',
  fontWeight: 700,
  letterSpacing: '0.08em',
  ':hover': {
    color: '#d8dadb',
  },
});

export const activeIndicator = style({
  color: '#ff4fd8',
});
