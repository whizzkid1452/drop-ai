import { style } from '@vanilla-extract/css';

export const header = style({
  position: 'sticky',
  left: 0,
  zIndex: 10,
  minWidth: 0,
  padding: '6px 8px 7px 30px',
  display: 'flex',
  flexDirection: 'column',
  gap: '5px',
  overflow: 'hidden',
  borderTop: '1px solid #111416',
  borderRight: '1px solid #080a0b',
  background: 'linear-gradient(90deg, #25292b 0%, #202426 100%)',
  color: '#d8dcde',
  fontFamily: '"Consolas", "SFMono-Regular", monospace',
  fontSize: '8px',
});

export const titleRow = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: '5px',
  color: '#ff9bea',
  letterSpacing: '0.06em',
});

export const button = style({
  height: '20px',
  border: '1px solid #6a205b',
  borderRadius: '2px',
  background: '#3b2036',
  color: '#ff9bea',
  cursor: 'pointer',
  fontSize: '8px',
  fontWeight: 700,
  selectors: {
    '&:focus-visible': { outline: '1px solid #ffffff', outlineOffset: '1px' },
  },
});

export const help = style({ color: '#8f9699', lineHeight: 1.3 });

export const inspector = style({
  display: 'grid',
  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
  gap: '3px 5px',
});

export const inspectorLabel = style({
  display: 'flex',
  flexDirection: 'column',
  gap: '2px',
  color: '#9ea4a6',
});

export const inspectorInput = style({
  width: '100%',
  minWidth: 0,
  height: '18px',
  border: '1px solid #111416',
  background: '#171a1c',
  color: '#e4e7e8',
  fontFamily: 'inherit',
  fontSize: '8px',
});

export const controlLaneEditor = style({
  display: 'flex',
  flexDirection: 'column',
  gap: '4px',
  paddingTop: '4px',
  borderTop: '1px solid #343a3d',
});

export const controlLaneActions = style({
  display: 'flex',
  alignItems: 'center',
  gap: '4px',
  flexWrap: 'wrap',
});

export const controlPoint = style({
  display: 'grid',
  gridTemplateColumns: 'minmax(70px, 1fr) minmax(70px, 1fr) auto',
  alignItems: 'end',
  gap: '4px',
});

export const error = style({ color: '#ff9d9d' });

export const roll = style({
  minWidth: 0,
  height: '180px',
  display: 'grid',
  gridTemplateColumns: '32px minmax(0, 1fr)',
  overflow: 'hidden',
  borderTop: '1px solid #111416',
  background: '#171b1d',
});

export const keyboard = style({
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'space-between',
  padding: '2px 3px',
  borderRight: '1px solid #080a0b',
  background: '#202426',
  color: '#7f878a',
  fontFamily: '"Consolas", "SFMono-Regular", monospace',
  fontSize: '7px',
  textAlign: 'right',
});

export const grid = style({
  position: 'relative',
  overflow: 'hidden',
  backgroundColor: '#171b1d',
  backgroundImage:
    'repeating-linear-gradient(to bottom, rgba(255,255,255,0.045) 0, rgba(255,255,255,0.045) 1px, transparent 1px, transparent calc(100% / 49)), repeating-linear-gradient(to right, rgba(255,255,255,0.055) 0, rgba(255,255,255,0.055) 1px, transparent 1px, transparent 6.25%)',
});

export const note = style({
  position: 'absolute',
  zIndex: 1,
  minWidth: '5px',
  minHeight: '4px',
  padding: 0,
  border: '1px solid #5e2051',
  borderRadius: '2px',
  background: '#c948ae',
  cursor: 'grab',
  selectors: {
    '&:focus-visible': { outline: '1px solid #ffffff', outlineOffset: '1px' },
  },
});

export const noteSelected = style([
  note,
  {
    borderColor: '#ffffff',
    background: '#ff73df',
    boxShadow: '0 0 0 1px #ff4fd8',
  },
]);
