import { globalStyle, style } from '@vanilla-extract/css';

export const trigger = style({
  alignItems: 'center',
  background: 'linear-gradient(180deg, #50374c 0%, #342431 100%)',
  border: '1px solid #171117',
  borderRadius: '2px',
  color: '#f3d9ed',
  cursor: 'pointer',
  display: 'inline-flex',
  fontSize: '9px',
  fontWeight: 700,
  gap: '5px',
  height: '24px',
  padding: '0 9px',
  textTransform: 'uppercase',
});
export const recordingDot = style({ background: '#ff4d72', borderRadius: '50%', height: '6px', width: '6px' });
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
  border: '1px solid #5c4659',
  borderRadius: '8px',
  color: '#e6e8e9',
  display: 'flex',
  flexDirection: 'column',
  gap: '14px',
  maxHeight: 'calc(100vh - 48px)',
  maxWidth: '980px',
  overflowY: 'auto',
  padding: '18px',
  width: '100%',
});
globalStyle(`${dialog} button`, {
  background: '#303638',
  border: '1px solid #4a5255',
  borderRadius: '3px',
  color: '#e1e3e4',
  cursor: 'pointer',
  minHeight: '30px',
});
globalStyle(`${dialog} button:disabled`, { cursor: 'not-allowed', opacity: 0.4 });
export const header = style({ alignItems: 'flex-start', display: 'flex', justifyContent: 'space-between' });
globalStyle(`${header} h2, ${header} p`, { margin: 0 });
globalStyle(`${header} h2`, { fontSize: '18px' });
globalStyle(`${header} p`, { color: '#8f989c', fontSize: '11px', marginTop: '4px' });
export const transport = style({ alignItems: 'end', display: 'flex', flexWrap: 'wrap', gap: '8px' });
globalStyle(`${transport} label`, { color: '#92999c', display: 'grid', fontSize: '9px', gap: '3px' });
globalStyle(`${transport} input`, {
  background: '#111516',
  border: '1px solid #3d4548',
  color: '#e1e3e4',
  height: '28px',
  padding: '0 8px',
});
globalStyle(`${transport} span`, { color: '#ff718b', fontSize: '10px', fontWeight: 700 });
export const error = style({ background: '#331d1d', color: '#ef9b91', fontSize: '10px', margin: 0, padding: '10px' });
export const grid = style({ display: 'grid', gap: '6px' });
export const trackRow = style({ display: 'grid', gap: '6px', gridTemplateColumns: '120px repeat(4, minmax(0, 1fr))' });
export const trackName = style({ alignItems: 'center', color: '#c8cdcf', display: 'flex', fontSize: '10px' });
export const clipButton = style({
  minWidth: 0,
  padding: '8px',
  textAlign: 'left',
  selectors: {
    '&[data-state="playing"]': { background: '#285841', borderColor: '#49a779' },
    '&[data-state="recording"]': { background: '#5e2830', borderColor: '#db4b4b' },
  },
});
globalStyle(`${clipButton} strong, ${clipButton} span`, {
  display: 'block',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
});
globalStyle(`${clipButton} strong`, { fontSize: '10px' });
globalStyle(`${clipButton} span`, { color: '#91999c', fontSize: '8px', marginTop: '3px' });
export const performances = style({ borderTop: '1px solid #343b3e', paddingTop: '12px' });
globalStyle(`${performances} h3`, { fontSize: '11px', margin: '0 0 8px' });
export const performance = style({
  alignItems: 'center',
  background: '#1d2224',
  border: '1px solid #343b3e',
  display: 'flex',
  justifyContent: 'space-between',
  marginTop: '6px',
  padding: '8px 10px',
});
globalStyle(`${performance} strong, ${performance} span`, { display: 'block' });
globalStyle(`${performance} strong`, { fontSize: '10px' });
globalStyle(`${performance} span`, { color: '#8f989c', fontSize: '9px', marginTop: '2px' });
export const performanceActions = style({ display: 'flex', gap: '6px' });
export const empty = style({ color: '#737d81', fontSize: '10px', margin: 0 });
