import { style } from '@vanilla-extract/css';

export const details = style({
  position: 'relative',
});

export const summary = style({
  cursor: 'pointer',
  listStyle: 'none',
  selectors: {
    '&::-webkit-details-marker': {
      display: 'none',
    },
    '&:focus-visible': {
      outline: '1px solid #ff78e3',
      outlineOffset: '2px',
    },
  },
});

export const status = style({
  border: '1px solid',
  borderRadius: '2px',
  fontSize: '9px',
  fontWeight: 600,
  letterSpacing: '0.05em',
  padding: '5px 7px',
  whiteSpace: 'nowrap',
});

export const visuallyHidden = style({
  border: 0,
  clip: 'rect(0 0 0 0)',
  clipPath: 'inset(50%)',
  height: '1px',
  margin: '-1px',
  overflow: 'hidden',
  padding: 0,
  position: 'absolute',
  whiteSpace: 'nowrap',
  width: '1px',
});

export const full = style({
  backgroundColor: 'rgba(77, 166, 107, 0.12)',
  borderColor: 'rgba(99, 204, 134, 0.45)',
  color: '#8edda8',
});

export const standard = style({
  backgroundColor: 'rgba(196, 153, 62, 0.12)',
  borderColor: 'rgba(224, 181, 88, 0.45)',
  color: '#e3bf72',
});

export const limited = style({
  backgroundColor: 'rgba(180, 75, 75, 0.12)',
  borderColor: 'rgba(219, 100, 100, 0.45)',
  color: '#e58d8d',
});

export const capabilityPanel = style({
  position: 'absolute',
  top: 'calc(100% + 8px)',
  left: 0,
  zIndex: 50,
  width: '360px',
  maxHeight: '420px',
  padding: '12px',
  overflowY: 'auto',
  border: '1px solid #4b5053',
  backgroundColor: '#1a1d1f',
  boxShadow: '0 8px 24px rgba(0, 0, 0, 0.55)',
  color: '#d6d8d9',
  fontSize: '11px',
});

export const capabilityList = style({
  display: 'grid',
  gap: '7px',
  margin: '10px 0 0',
  padding: 0,
  listStyle: 'none',
});

export const capabilityRow = style({
  display: 'grid',
  gridTemplateColumns: 'minmax(120px, 1fr) auto',
  gap: '3px 8px',
  alignItems: 'center',
});

export const capabilityStatus = style({
  borderRadius: '2px',
  padding: '2px 5px',
  fontSize: '9px',
  fontWeight: 700,
});

export const capabilityReason = style({
  gridColumn: '1 / -1',
  color: '#8f9699',
  fontSize: '10px',
});

export const available = style({
  backgroundColor: 'rgba(77, 166, 107, 0.18)',
  color: '#8edda8',
});

export const blocked = style({
  backgroundColor: 'rgba(196, 153, 62, 0.18)',
  color: '#e3bf72',
});

export const unsupported = style({
  backgroundColor: 'rgba(180, 75, 75, 0.18)',
  color: '#e58d8d',
});
