import { globalStyle, style } from '@vanilla-extract/css';

export const control = style({
  display: 'flex',
  flexDirection: 'column',
  gap: '7px',
});

export const controlRow = style({
  display: 'grid',
  gridTemplateColumns: '54px minmax(0, 1fr) 38px',
  alignItems: 'center',
  gap: '6px',
});

export const label = style({
  color: '#aeb4b6',
  fontSize: '9px',
  fontWeight: 700,
});

export const value = style({
  width: '100%',
  minWidth: 0,
  border: '1px solid #111416',
  borderRadius: '2px',
  backgroundColor: '#171a1c',
  color: '#ffd580',
  fontFamily: '"Consolas", "SFMono-Regular", monospace',
  fontSize: '9px',
  textAlign: 'right',
});

export const checkbox = style({
  gridColumn: '2 / 4',
  justifySelf: 'start',
  accentColor: '#ff78e3',
});

export const derivedSection = style({
  marginTop: '4px',
  paddingTop: '8px',
  display: 'flex',
  flexDirection: 'column',
  gap: '6px',
  borderTop: '1px solid #34383a',
});

export const derivedAction = style({
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1fr) 44px',
  alignItems: 'end',
  gap: '5px',
});

globalStyle(`${derivedAction} label`, {
  display: 'flex',
  flexDirection: 'column',
  gap: '2px',
  color: '#8f9699',
  fontSize: '8px',
});
globalStyle(`${derivedAction} input`, {
  width: '100%',
  minWidth: 0,
  height: '24px',
  padding: '2px 5px',
  border: '1px solid #111416',
  background: '#171a1c',
  color: '#ffd580',
  fontFamily: 'monospace',
  fontSize: '9px',
});
globalStyle(`${derivedAction} button`, {
  height: '24px',
  border: '1px solid #111416',
  background: '#303538',
  color: '#d4d7d8',
  cursor: 'pointer',
  fontSize: '8px',
  fontWeight: 700,
});
globalStyle(`${derivedAction} button:disabled`, { cursor: 'not-allowed', opacity: 0.45 });

export const derivedButtons = style({
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: '5px',
});

globalStyle(`${derivedButtons} button`, {
  minHeight: '26px',
  border: '1px solid #111416',
  background: '#3c2a38',
  color: '#ff9aec',
  cursor: 'pointer',
  fontSize: '8px',
  fontWeight: 700,
});
globalStyle(`${derivedButtons} button:disabled`, { cursor: 'not-allowed', opacity: 0.45 });

export const pendingMessage = style({
  color: '#ffd580',
  fontSize: '8px',
});
