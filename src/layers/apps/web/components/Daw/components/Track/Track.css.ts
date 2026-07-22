import { style } from '@vanilla-extract/css';

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

export const sliderValue = style({
  color: '#888888',
  fontSize: '0.75rem',
  minWidth: '40px',
  textAlign: 'right',
});
