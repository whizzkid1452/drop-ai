import { style } from '@vanilla-extract/css';

export const track = style({
  display: 'flex',
  flexDirection: 'column',
  border: '1px solid #333',
  borderRadius: '8px',
  padding: '16px',
  marginBottom: '12px',
  backgroundColor: '#1a1a1a',
  transition: 'background-color 0.2s ease',
  ':hover': {
    backgroundColor: '#222',
  },
});

export const trackHeader = style({
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: '12px',
});

export const trackInfo = style({
  display: 'flex',
  alignItems: 'center',
  gap: '12px',
  flex: 1,
});

export const trackNumber = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '32px',
  height: '32px',
  borderRadius: '50%',
  backgroundColor: '#333',
  color: '#fff',
  fontSize: '14px',
  fontWeight: '600',
  flexShrink: 0,
});

export const trackDetails = style({
  display: 'flex',
  flexDirection: 'column',
  gap: '4px',
  flex: 1,
  minWidth: 0,
});

export const trackName = style({
  fontSize: '16px',
  fontWeight: '500',
  color: '#fff',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
});

export const trackMeta = style({
  fontSize: '12px',
  color: '#999',
});

export const removeButton = style({
  background: 'none',
  border: 'none',
  color: '#999',
  fontSize: '24px',
  cursor: 'pointer',
  padding: '4px 8px',
  borderRadius: '4px',
  transition: 'all 0.2s ease',
  ':hover': {
    color: '#ff4444',
    backgroundColor: '#2a1a1a',
  },
});

export const trackContent = style({
  width: '100%',
});

export const audioPlayer = style({
  width: '100%',
  height: '32px',
});


