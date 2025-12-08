import { style } from '@vanilla-extract/css';

export const track = style({
  display: 'flex',
  flexDirection: 'column',
  border: '1px solid #333333',
  borderRadius: '2px',
  padding: '12px',
  backgroundColor: '#0a0a0a',
  transition: 'all 0.15s ease',
  ':hover': {
    backgroundColor: '#0f0f0f',
    borderColor: '#444444',
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
  width: '28px',
  height: '28px',
  borderRadius: '2px',
  backgroundColor: '#1a1a1a',
  color: '#888888',
  fontSize: '0.75rem',
  fontWeight: '500',
  flexShrink: 0,
  border: '1px solid #333333',
});

export const trackDetails = style({
  display: 'flex',
  flexDirection: 'column',
  gap: '4px',
  flex: 1,
  minWidth: 0,
});

export const trackName = style({
  fontSize: '0.875rem',
  fontWeight: '400',
  color: '#ffffff',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
});

export const trackMeta = style({
  fontSize: '0.75rem',
  color: '#666666',
});

export const removeButton = style({
  background: 'none',
  border: '1px solid #333333',
  color: '#666666',
  fontSize: '18px',
  cursor: 'pointer',
  padding: '4px 8px',
  borderRadius: '2px',
  transition: 'all 0.15s ease',
  width: '24px',
  height: '24px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  backgroundColor: '#1a1a1a',
  ':hover': {
    color: '#ff4444',
    borderColor: '#ff4444',
    backgroundColor: '#1a0a0a',
  },
});

export const trackContent = style({
  width: '100%',
  display: 'flex',
  flexDirection: 'column',
  gap: '12px',
});

export const waveformContainer = style({
  width: '100%',
  minHeight: '120px',
  backgroundColor: '#0f0f10',
  border: '1px solid #1f1f1f',
  borderRadius: '4px',
  overflow: 'hidden',
});

export const controls = style({
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  gap: '12px',
  justifyContent: 'space-between',
});

export const controlGroup = style({
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  flexWrap: 'wrap',
});

export const actionButton = style({
  backgroundColor: '#1a1a1a',
  color: '#ffffff',
  border: '1px solid #2c2c2c',
  borderRadius: '4px',
  padding: '6px 10px',
  cursor: 'pointer',
  fontSize: '0.85rem',
  transition: 'all 0.15s ease',
  ':hover': {
    borderColor: '#3a7bfd',
    color: '#bcd2ff',
  },
  ':disabled': {
    opacity: 0.5,
    cursor: 'not-allowed',
  },
});

export const sliderLabel = style({
  color: '#aaaaaa',
  fontSize: '0.8rem',
});

export const slider = style({
  appearance: 'none',
  height: '4px',
  background: '#2b2b2b',
  borderRadius: '2px',
  outline: 'none',
  width: '140px',
  '::-webkit-slider-thumb': {
    appearance: 'none',
    width: '14px',
    height: '14px',
    borderRadius: '50%',
    background: '#3a7bfd',
    border: '1px solid #5a8cff',
  },
});


