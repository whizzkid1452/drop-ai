import { style, keyframes } from '@vanilla-extract/css';

export const container = style({
  position: 'relative',
  width: '100%',
  maxWidth: '720px',
  margin: '0 auto',
});

export const hero = style({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  textAlign: 'center',
  gap: '1.5rem',
  paddingTop: '2rem',
  paddingBottom: '2rem',
  marginBottom: '1.75rem',
});

export const heroTitle = style({
  fontSize: '5rem',
  fontWeight: 650,
  color: '#ffffff',
  margin: 0,
  letterSpacing: '-0.03em',
});

export const heroSubtitle = style({
  fontSize: '0.875rem',
  fontWeight: 400,
  color: '#888888',
  margin: 0,
  letterSpacing: '0.01em',
  textTransform: 'uppercase',
});

export const heroAccent = style({
  width: '80px',
  height: '2px',
  background: '#333333',
  borderRadius: '1px',
  margin: '0.5rem 0',
});

export const audioPreview = style({
  width: '100%',
  marginTop: '1rem',
  borderRadius: '8px',
});

export const editButton = style({
  marginTop: '1.5rem',
  padding: '0.75rem 2rem',
  backgroundColor: '#1a1a1a',
  color: '#ffffff',
  border: '1px solid #333333',
  borderRadius: '2px',
  fontSize: '0.875rem',
  fontWeight: 400,
  cursor: 'pointer',
  transition: 'all 0.15s ease',
  width: '100%',
  maxWidth: '300px',
  marginLeft: 'auto',
  marginRight: 'auto',
  display: 'block',
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
