import { style } from '@vanilla-extract/css';

export const container = style({
  width: '100%',
  margin: 0,
  padding: '24px',
  backgroundColor: '#0a0a0a',
  minHeight: '100vh',
});

export const header = style({
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

export const trackList = style({
  display: 'flex',
  flexDirection: 'column',
  gap: '8px',
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
  fontSize: '1rem',
  fontWeight: '500',
  color: '#ffffff',
  marginBottom: '8px',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
});

export const emptyMessage = style({
  fontSize: '0.875rem',
  color: '#666666',
});

export const uploadSection = style({
  marginBottom: '24px',
});

