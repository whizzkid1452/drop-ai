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
    '&[aria-pressed="true"]': {
      borderColor: '#d43fb5',
      background: '#54254a',
      color: '#ffb8ef',
    },
    '&:disabled': {
      cursor: 'default',
      opacity: 0.4,
    },
  },
});

export const rangeLabel = style({
  minWidth: '54px',
  color: '#8f9699',
  fontFamily: '"Consolas", "SFMono-Regular", monospace',
  fontSize: '8px',
});

export const volume = style({
  display: 'flex',
  alignItems: 'center',
  gap: '3px',
  color: '#8f9699',
  fontSize: '8px',
  textTransform: 'uppercase',
});

export const range = style({
  width: '54px',
  accentColor: '#d43fb5',
  selectors: {
    '&:disabled': { opacity: 0.4 },
  },
});

export const error = style({
  position: 'absolute',
  top: '31px',
  right: 0,
  zIndex: 10,
  maxWidth: '260px',
  overflow: 'hidden',
  color: '#ff9d9d',
  fontSize: '9px',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
});
