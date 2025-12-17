import { style } from '@vanilla-extract/css';

export const header = style({
  position: 'relative',
  zIndex: 1,
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: '24px',
  paddingBottom: '16px',
  borderBottom: '1px solid #333333',
});

export const headerRight = style({
  display: 'flex',
  alignItems: 'center',
  gap: '16px',
});

export const title = style({
  fontSize: '0.875rem',
  fontWeight: '500',
  color: '#ffffff',
  margin: 0,
  textTransform: 'uppercase',
  letterSpacing: '0.1em',
});

export const trackCount = style({
  fontSize: '0.75rem',
  color: '#666666',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
});
