import { style } from '@vanilla-extract/css';

export const container = style({
  width: '100%',
  maxWidth: '1200px',
  margin: '0 auto',
  padding: '24px',
});

export const header = style({
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: '24px',
});

export const headerRight = style({
  display: 'flex',
  alignItems: 'center',
  gap: '16px',
});

export const title = style({
  fontSize: '28px',
  fontWeight: '600',
  color: '#fff',
  margin: 0,
});

export const trackCount = style({
  fontSize: '14px',
  color: '#999',
});

export const trackList = style({
  display: 'flex',
  flexDirection: 'column',
});

export const emptyState = style({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: '400px',
  textAlign: 'center',
});

export const emptyTitle = style({
  fontSize: '24px',
  fontWeight: '600',
  color: '#fff',
  marginBottom: '12px',
});

export const emptyMessage = style({
  fontSize: '16px',
  color: '#999',
});



