import { style } from '@vanilla-extract/css';

export const status = style({
  border: '1px solid',
  borderRadius: '999px',
  fontSize: '0.6875rem',
  fontWeight: 600,
  letterSpacing: '0.02em',
  padding: '5px 9px',
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
