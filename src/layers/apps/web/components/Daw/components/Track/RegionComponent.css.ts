import { style } from '@vanilla-extract/css';

export const regionContainer = style({
  position: 'absolute',
  top: 0,
  bottom: 0,
  overflow: 'hidden',
  backgroundColor: '#2b2b2b',
  border: '1px solid #3d3d3d',
  borderRadius: '4px',
});

export const waveformContainer = style({
  height: '100%',
});

export const removeButton = style({
  position: 'absolute',
  top: '4px',
  right: '4px',
  zIndex: 1,
  width: '24px',
  height: '24px',
  padding: 0,
  border: '1px solid #555555',
  borderRadius: '4px',
  backgroundColor: 'rgba(20, 20, 20, 0.85)',
  color: '#dddddd',
  cursor: 'pointer',
  fontSize: '16px',
  lineHeight: 1,
  ':hover': {
    borderColor: '#ff6666',
    color: '#ff8888',
  },
});
