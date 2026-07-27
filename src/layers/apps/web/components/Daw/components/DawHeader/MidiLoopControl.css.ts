import { style } from '@vanilla-extract/css';

export const container = style({
  minWidth: 0,
  height: '26px',
  padding: '2px 4px',
  display: 'flex',
  alignItems: 'center',
  gap: '3px',
  border: '1px solid #151819',
  borderRadius: '2px',
  backgroundColor: '#232729',
});

export const label = style({
  color: '#aeb3b5',
  fontSize: '8px',
  fontWeight: 700,
  letterSpacing: '0.05em',
  whiteSpace: 'nowrap',
});

export const select = style({
  width: '92px',
  height: '20px',
  border: '1px solid #101214',
  borderRadius: '1px',
  backgroundColor: '#141718',
  color: '#d6d8d9',
  fontSize: '8px',
});

export const channelSelect = style([select, { width: '56px' }]);

export const button = style({
  height: '20px',
  padding: '0 5px',
  border: '1px solid #111416',
  borderRadius: '1px',
  background: 'linear-gradient(180deg, #414649 0%, #303437 100%)',
  color: '#d6d8d9',
  cursor: 'pointer',
  fontSize: '8px',
  selectors: {
    '&:disabled': {
      cursor: 'wait',
      opacity: 0.5,
    },
  },
});

export const connectedButton = style([
  button,
  {
    borderColor: '#2e9067',
    background: '#214f3c',
    color: '#9df0ca',
  },
]);

export const hint = style({
  position: 'absolute',
  width: '1px',
  height: '1px',
  padding: 0,
  margin: '-1px',
  overflow: 'hidden',
  clip: 'rect(0, 0, 0, 0)',
  whiteSpace: 'nowrap',
  border: 0,
});
