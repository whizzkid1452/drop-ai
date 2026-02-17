import { style } from '@vanilla-extract/css';

export const modalOverlay = style({
  position: 'fixed',
  inset: 0,
  backgroundColor: 'rgba(0, 0, 0, 0.75)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 50,
});

export const modal = style({
  backgroundColor: '#282828',
  borderRadius: '4px',
  border: '1px solid #000000',
  boxShadow: '0 1px 3px rgba(0,0,0,0.4)',
  padding: '1.5rem 1.75rem',
  width: '100%',
  maxWidth: '480px',
  display: 'flex',
  flexDirection: 'column',
  gap: '1rem',
});

export const modalTitle = style({
  fontSize: '0.875rem',
  textTransform: 'uppercase',
  letterSpacing: '0.12em',
  color: '#e5e7eb',
});

export const audioPreview = style({
  width: '100%',
  marginTop: '1rem',
  borderRadius: '8px',
});

export const modalActions = style({
  display: 'flex',
  justifyContent: 'flex-end',
  gap: '0.75rem',
  marginTop: '0.75rem',
});

export const closeButton = style({
  padding: '0.75rem 1.5rem',
  backgroundColor: 'transparent',
  color: '#e5e7eb',
  border: '1px solid #444444',
  borderRadius: '2px',
  fontSize: '0.75rem',
  fontWeight: 400,
  cursor: 'pointer',
  textTransform: 'uppercase',
  letterSpacing: '0.12em',
  transition: 'all 0.15s ease',

  ':hover': {
    backgroundColor: '#111111',
    borderColor: '#666666',
  },
});

export const editButton = style({
  padding: '0.75rem 2rem',
  backgroundColor: '#1a1a1a',
  color: '#ffffff',
  border: '1px solid #333333',
  borderRadius: '2px',
  fontSize: '0.875rem',
  fontWeight: 400,
  cursor: 'pointer',
  transition: 'all 0.15s ease',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',

  ':hover': {
    backgroundColor: '#222222',
    borderColor: '#444444',
  },

  ':active': {
    backgroundColor: '#1a1a1a',
  },
});
