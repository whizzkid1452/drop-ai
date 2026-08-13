import { style } from '@vanilla-extract/css';

export const container = style({
  position: 'relative',
  display: 'flex',
  height: '30px',
  alignItems: 'center',
  gap: '5px',
  padding: '3px 5px',
  border: '1px solid #151819',
  borderRadius: '2px',
  backgroundColor: '#232729',
});

export const field = style({
  display: 'flex',
  alignItems: 'center',
  gap: '3px',
  color: '#8f9699',
  fontSize: '8px',
  textTransform: 'uppercase',
});

export const input = style({
  width: '42px',
  height: '21px',
  border: '1px solid #111416',
  borderRadius: '1px',
  backgroundColor: '#171a1c',
  color: '#d6d8d9',
  fontFamily: '"Consolas", "SFMono-Regular", monospace',
  fontSize: '9px',
  selectors: {
    '&:disabled': { opacity: 0.4 },
  },
});

export const button = style({
  height: '21px',
  padding: '0 7px',
  border: '1px solid #111416',
  borderRadius: '1px',
  background: 'linear-gradient(180deg, #414649 0%, #303437 100%)',
  color: '#d6d8d9',
  cursor: 'pointer',
  fontSize: '9px',
  selectors: {
    '&:disabled': {
      cursor: 'default',
      opacity: 0.4,
    },
  },
});

export const recordingButton = style([button]);

export const recordingButtonActive = style({
  borderColor: '#7f222c',
  background: '#8d2731',
  color: '#fff5f6',
});

export const status = style({
  minWidth: '48px',
  color: '#aeb3b5',
  fontFamily: '"Consolas", "SFMono-Regular", monospace',
  fontSize: '8px',
});

export const error = style({
  position: 'absolute',
  top: '31px',
  right: 0,
  zIndex: 12,
  maxWidth: '280px',
  overflow: 'hidden',
  color: '#ff9d9d',
  fontSize: '9px',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
});
