import { globalStyle, style } from '@vanilla-extract/css';

const surface = '#171a1c';
const elevatedSurface = '#202427';
const border = '#3a4044';
const mutedText = '#9aa3a8';
const accent = '#e654c7';

export const container = style({ display: 'flex', alignItems: 'center' });

export const exportButton = style({
  minWidth: '66px',
  height: '24px',
  padding: '0 10px',
  border: '1px solid #6f245d',
  borderRadius: '2px',
  background: 'linear-gradient(180deg, #e654c7 0%, #a72f8d 100%)',
  boxShadow: 'inset 0 1px 0 #ff8fe8',
  color: '#fff5fd',
  cursor: 'pointer',
  fontSize: '9px',
  fontWeight: 700,
  letterSpacing: '0.05em',
  textTransform: 'uppercase',
  ':hover': { background: 'linear-gradient(180deg, #f36bd5 0%, #bd3da1 100%)' },
});

export const backdrop = style({
  position: 'fixed',
  inset: 0,
  zIndex: 2000,
  display: 'grid',
  placeItems: 'center',
  padding: '24px',
  background: 'rgba(4, 6, 7, 0.76)',
});

export const dialog = style({
  display: 'flex',
  flexDirection: 'column',
  width: 'min(760px, 100%)',
  maxHeight: 'min(820px, calc(100vh - 48px))',
  overflow: 'hidden',
  border: `1px solid ${border}`,
  borderRadius: '8px',
  background: surface,
  boxShadow: '0 24px 80px rgba(0, 0, 0, 0.55)',
  color: '#eef1f2',
});

export const dialogHeader = style({
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'space-between',
  padding: '18px 20px',
  borderBottom: `1px solid ${border}`,
});

export const title = style({ margin: 0, fontSize: '18px', letterSpacing: '-0.01em' });
export const subtitle = style({ margin: '4px 0 0', color: mutedText, fontSize: '11px' });
export const closeButton = style({
  width: '28px',
  height: '28px',
  border: 0,
  background: 'transparent',
  color: mutedText,
  cursor: 'pointer',
  fontSize: '22px',
});

export const dialogBody = style({ display: 'grid', gap: '14px', padding: '16px 20px', overflowY: 'auto' });
export const section = style({
  display: 'grid',
  gap: '12px',
  padding: '14px',
  border: `1px solid ${border}`,
  borderRadius: '6px',
  background: elevatedSurface,
});
globalStyle(`${section} h3`, { margin: 0, fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.08em' });
export const sectionHeader = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: '12px',
});
export const inlineActions = style({ display: 'flex', gap: '6px' });
export const fieldGrid = style({ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '10px' });
export const field = style({
  display: 'grid',
  gap: '5px',
  color: mutedText,
  fontSize: '10px',
});
globalStyle(`${field} input, ${field} select`, {
  width: '100%',
  height: '30px',
  padding: '0 8px',
  border: `1px solid ${border}`,
  borderRadius: '3px',
  background: '#111416',
  color: '#eef1f2',
  fontSize: '11px',
});
globalStyle(`${field} input:focus, ${field} select:focus`, { borderColor: accent, outline: '1px solid #7d2f6d' });
globalStyle(`${field} select:disabled`, { color: '#6d7478' });

export const capabilityNotice = style({ margin: 0, color: '#caa267', fontSize: '10px' });
export const rangeList = style({ display: 'grid', gap: '8px' });
export const rangeRow = style({
  display: 'grid',
  gridTemplateColumns: 'minmax(120px, 1.5fr) 1fr 1fr auto',
  alignItems: 'end',
  gap: '8px',
});
globalStyle(`${rangeRow} > input, ${rangeRow} label input`, {
  width: '100%',
  height: '30px',
  padding: '0 8px',
  border: `1px solid ${border}`,
  borderRadius: '3px',
  background: '#111416',
  color: '#eef1f2',
  fontSize: '11px',
});
globalStyle(`${rangeRow} label`, { display: 'grid', gap: '4px', color: mutedText, fontSize: '9px' });

const buttonBase = {
  height: '30px',
  padding: '0 12px',
  borderRadius: '3px',
  cursor: 'pointer',
  fontSize: '10px',
  fontWeight: 700,
} as const;

export const secondaryButton = style({
  ...buttonBase,
  border: `1px solid ${border}`,
  background: '#282d30',
  color: '#d9dddf',
  ':disabled': { color: '#62686c', cursor: 'not-allowed' },
});
export const removeButton = style({
  ...buttonBase,
  border: '1px solid #654039',
  background: '#342321',
  color: '#e7aaa0',
});
export const primaryButton = style({
  ...buttonBase,
  border: '1px solid #7c2969',
  background: accent,
  color: '#180612',
});
export const cancelButton = style({ ...buttonBase, border: '1px solid #9a4338', background: '#c95a4c', color: '#fff' });
export const statusPanel = style({
  display: 'grid',
  gap: '8px',
  padding: '12px',
  border: `1px solid ${border}`,
  borderRadius: '6px',
});
export const statusSummary = style({
  display: 'flex',
  alignItems: 'center',
  gap: '12px',
  color: mutedText,
  fontSize: '10px',
});
export const progressBar = style({
  width: '100%',
  height: '5px',
  overflow: 'hidden',
  borderRadius: '3px',
  background: '#303538',
});
export const progressFill = style({ height: '100%', background: accent, transition: 'width 150ms ease' });
export const errorMessage = style({
  margin: 0,
  padding: '8px 10px',
  border: '1px solid #8b3f34',
  background: '#3b201d',
  color: '#efaaa0',
  fontSize: '10px',
});
export const resultList = style({ display: 'grid', gap: '6px' });
export const resultCard = style({
  display: 'grid',
  gridTemplateColumns: 'minmax(140px, 1fr) repeat(4, auto)',
  gap: '12px',
  alignItems: 'center',
  padding: '9px 10px',
  borderRadius: '3px',
  background: '#131719',
  color: '#b7c0c4',
  fontSize: '10px',
});
globalStyle(`${resultCard} strong`, { overflow: 'hidden', color: '#f2f4f5', textOverflow: 'ellipsis' });
export const dialogFooter = style({
  display: 'flex',
  justifyContent: 'flex-end',
  gap: '8px',
  padding: '14px 20px',
  borderTop: `1px solid ${border}`,
  background: '#141719',
});
