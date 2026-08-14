import { globalStyle, style } from '@vanilla-extract/css';

export const container = style({
  width: '100%',
  minWidth: '640px',
  minHeight: 0,
  padding: '20px',
  display: 'flex',
  flex: 1,
  flexDirection: 'column',
  gap: '12px',
  background: '#171a1c',
});

export const header = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: '16px',
  paddingBottom: '12px',
  borderBottom: '1px solid #34383a',
});

export const title = style({
  margin: 0,
  color: '#f3f4f4',
  fontSize: '16px',
  letterSpacing: '0.1em',
});

export const headerActions = style({
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
});

export const searchInput = style({
  width: '240px',
  padding: '7px 9px',
  border: '1px solid #111416',
  background: '#202426',
  color: '#e2e4e5',
  fontSize: '11px',
  selectors: {
    '&:focus-visible': { outline: '1px solid #ff62df' },
  },
});

export const actionButton = style({
  minHeight: '28px',
  padding: '4px 9px',
  border: '1px solid #111416',
  background: '#303538',
  color: '#d4d7d8',
  cursor: 'pointer',
  fontSize: '9px',
  fontWeight: 700,
  letterSpacing: '0.05em',
  selectors: {
    '&:hover:not(:disabled)': { borderColor: '#ff62df', color: '#ff9aec' },
    '&:disabled': { cursor: 'not-allowed', opacity: 0.45 },
    '&:focus-visible': { outline: '1px solid #ff62df' },
  },
});

export const primaryAction = style({
  borderColor: '#ff62df',
  background: '#56304e',
  color: '#ff9aec',
});

export const status = style({
  margin: 0,
  padding: '7px 9px',
  border: '1px solid #31533d',
  background: '#1d3024',
  color: '#9ce2b1',
  fontSize: '10px',
});

export const errorMessage = style({
  margin: 0,
  padding: '7px 9px',
  border: '1px solid #67383e',
  background: '#382126',
  color: '#ff9da8',
  fontSize: '10px',
});

export const list = style({
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
  gap: '10px',
});

export const card = style({
  minWidth: 0,
  padding: '12px',
  display: 'flex',
  flexDirection: 'column',
  gap: '9px',
  border: '1px solid #303538',
  background: '#202426',
  boxShadow: 'inset 0 1px 0 #303538',
});

export const cardHeader = style({
  minWidth: 0,
  display: 'flex',
  alignItems: 'center',
  gap: '7px',
  color: '#ebeded',
  fontSize: '12px',
});

globalStyle(`${cardHeader} strong`, {
  minWidth: 0,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
});

export const codecBadge = style({
  padding: '2px 5px',
  border: '1px solid #4a4f52',
  color: '#9ca3a6',
  fontFamily: 'monospace',
  fontSize: '8px',
});

export const statusBadge = style({
  marginLeft: 'auto',
  color: '#ffd580',
  fontSize: '9px',
});

export const details = style({
  margin: 0,
  display: 'grid',
  gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
  gap: '6px',
});

globalStyle(`${details} div`, { minWidth: 0 });
globalStyle(`${details} dt`, { color: '#747c7f', fontSize: '8px', textTransform: 'uppercase' });
globalStyle(`${details} dd`, {
  margin: '2px 0 0',
  color: '#c9ccce',
  fontFamily: 'monospace',
  fontSize: '9px',
});

export const metadata = style({
  margin: 0,
  color: '#8e9699',
  fontFamily: 'monospace',
  fontSize: '9px',
});

export const tagActions = style({
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1fr) auto auto',
  alignItems: 'end',
  gap: '6px',
});

export const field = style({
  minWidth: 0,
  display: 'flex',
  flexDirection: 'column',
  gap: '3px',
  color: '#80878a',
  fontSize: '8px',
  fontWeight: 700,
});

export const tagInput = style({
  width: '100%',
  minWidth: 0,
  height: '28px',
  padding: '4px 7px',
  border: '1px solid #111416',
  background: '#171a1c',
  color: '#e2e4e5',
  fontSize: '10px',
});

export const emptyState = style({
  margin: '48px auto',
  color: '#858c8f',
  fontSize: '11px',
});
