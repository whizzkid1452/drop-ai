import { style } from '@vanilla-extract/css';

export const meter = style({
  minWidth: 0,
  height: '12px',
  display: 'grid',
  gridTemplateColumns: 'auto minmax(36px, 1fr) auto',
  alignItems: 'center',
  gap: '4px',
  selectors: {
    '&[data-clipped="true"]': {
      color: '#ff786f',
    },
  },
});

export const label = style({
  maxWidth: '48px',
  overflow: 'hidden',
  color: '#9ba1a3',
  fontSize: '8px',
  fontWeight: 700,
  lineHeight: 1,
  textOverflow: 'ellipsis',
  textTransform: 'uppercase',
  whiteSpace: 'nowrap',
});

export const scale = style({
  position: 'relative',
  height: '7px',
  overflow: 'hidden',
  border: '1px solid #0c0e0f',
  background: '#111416',
});

export const peakBar = style({
  position: 'absolute',
  inset: 0,
  background: 'linear-gradient(90deg, #44b986 0%, #d5bc4d 78%, #db5f55 100%)',
});

export const rmsBar = style({
  position: 'absolute',
  top: '2px',
  bottom: '2px',
  left: 0,
  background: '#9bf2bd',
});

export const clip = style({
  width: '22px',
  color: '#606669',
  fontSize: '7px',
  fontWeight: 800,
  lineHeight: 1,
});
