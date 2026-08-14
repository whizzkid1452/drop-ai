import { globalStyle, style } from '@vanilla-extract/css';

export const trigger = style({
  alignItems: 'center',
  background: 'linear-gradient(180deg, #3d4245 0%, #2d3133 100%)',
  border: '1px solid #0f1112',
  borderRadius: '2px',
  color: '#d6d8d9',
  cursor: 'pointer',
  display: 'inline-flex',
  fontSize: '9px',
  fontWeight: 700,
  gap: '5px',
  height: '24px',
  letterSpacing: '0.05em',
  padding: '0 9px',
  textTransform: 'uppercase',
});

export const recoveryDot = style({ background: '#e34cbb', borderRadius: '50%', height: '6px', width: '6px' });
export const backdrop = style({
  alignItems: 'center',
  background: 'rgba(4, 6, 7, 0.84)',
  display: 'flex',
  inset: 0,
  justifyContent: 'center',
  padding: '24px',
  position: 'fixed',
  zIndex: 2200,
});
export const dialog = style({
  background: '#15191b',
  border: '1px solid #40474a',
  borderRadius: '8px',
  boxShadow: '0 24px 80px rgba(0,0,0,.65)',
  color: '#e6e8e9',
  display: 'flex',
  flexDirection: 'column',
  maxHeight: 'calc(100vh - 48px)',
  maxWidth: '980px',
  overflow: 'hidden',
  width: '100%',
});
export const dialogHeader = style({
  alignItems: 'flex-start',
  borderBottom: '1px solid #303638',
  display: 'flex',
  justifyContent: 'space-between',
  padding: '20px',
});
globalStyle(`${dialogHeader} h2, ${dialogHeader} p`, { margin: 0 });
globalStyle(`${dialogHeader} h2`, { fontSize: '18px' });
globalStyle(`${dialogHeader} p`, { color: '#8f989c', fontSize: '11px', marginTop: '4px' });
export const closeButton = style({
  background: 'transparent',
  border: 0,
  color: '#9ba2a5',
  cursor: 'pointer',
  fontSize: '22px',
});
export const content = style({ display: 'grid', gap: '14px', overflowY: 'auto', padding: '18px' });
export const panel = style({
  background: '#1d2224',
  border: '1px solid #343b3e',
  borderRadius: '6px',
  padding: '14px',
});
export const recoveryCard = style({
  alignItems: 'center',
  background: '#2b1d2a',
  border: '1px solid #7a356a',
  borderRadius: '6px',
  display: 'flex',
  justifyContent: 'space-between',
  padding: '12px 14px',
});
globalStyle(`${recoveryCard} strong, ${recoveryCard} span`, { display: 'block' });
globalStyle(`${recoveryCard} span`, { color: '#bda6b8', fontSize: '10px', marginTop: '3px' });
export const sectionHeader = style({
  alignItems: 'end',
  display: 'flex',
  gap: '12px',
  justifyContent: 'space-between',
});
globalStyle(`${sectionHeader} h3`, { fontSize: '12px', letterSpacing: '.06em', textTransform: 'uppercase' });
globalStyle(`${sectionHeader} span`, { color: '#899296', display: 'block', fontSize: '10px', marginTop: '3px' });
export const inlineForm = style({
  alignItems: 'center',
  display: 'flex',
  flexWrap: 'wrap',
  gap: '6px',
  justifyContent: 'flex-end',
});
export const inlineActions = style({ alignItems: 'center', display: 'flex', gap: '6px' });
globalStyle(`${dialog} button`, {
  background: '#303638',
  border: '1px solid #4a5255',
  borderRadius: '3px',
  color: '#e1e3e4',
  cursor: 'pointer',
  fontSize: '10px',
  minHeight: '28px',
  padding: '0 10px',
});
globalStyle(`${dialog} button:disabled`, { cursor: 'not-allowed', opacity: 0.4 });
globalStyle(`${dialog} input, ${dialog} select`, {
  background: '#111516',
  border: '1px solid #3d4548',
  borderRadius: '3px',
  color: '#e1e3e4',
  fontSize: '10px',
  height: '28px',
  minWidth: '130px',
  padding: '0 8px',
});
export const list = style({ display: 'grid', gap: '6px', marginTop: '12px' });
export const listRow = style({
  alignItems: 'center',
  background: '#15191a',
  border: '1px solid #2c3234',
  borderRadius: '4px',
  display: 'flex',
  justifyContent: 'space-between',
  padding: '8px 10px',
});
globalStyle(`${listRow} strong, ${listRow} span`, { display: 'block' });
globalStyle(`${listRow} strong`, { fontSize: '11px' });
globalStyle(`${listRow} span`, { color: '#828c90', fontSize: '9px', marginTop: '2px', textTransform: 'capitalize' });
export const empty = style({ color: '#737d81', fontSize: '10px', margin: '4px 0' });
export const hiddenInput = style({ display: 'none' });
export const error = style({
  background: '#331d1d',
  border: '1px solid #733d3d',
  borderRadius: '4px',
  color: '#ef9b91',
  fontSize: '10px',
  margin: 0,
  padding: '10px',
});
