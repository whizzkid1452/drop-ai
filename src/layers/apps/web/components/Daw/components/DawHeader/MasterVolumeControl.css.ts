import { style } from '@vanilla-extract/css';

export const form = style({
  height: '30px',
  padding: '3px 5px',
  display: 'flex',
  alignItems: 'center',
  gap: '4px',
  border: '1px solid #151819',
  borderRadius: '2px',
  backgroundColor: '#232729',
});

export const label = style({
  color: '#aeb3b5',
  fontSize: '9px',
  fontWeight: 700,
  letterSpacing: '0.05em',
  textTransform: 'uppercase',
});

export const input = style({
  width: '48px',
  height: '21px',
  padding: '0 4px',
  border: '1px solid #101214',
  borderRadius: '1px',
  backgroundColor: '#141718',
  color: '#ff78e3',
  fontFamily: '"Consolas", "SFMono-Regular", monospace',
  fontSize: '9px',
  selectors: {
    '&:focus': {
      borderColor: '#d43fb5',
      outline: 'none',
    },
    '&:disabled': {
      opacity: 0.5,
    },
  },
});

export const button = style({
  height: '21px',
  padding: '0 6px',
  border: '1px solid #111416',
  borderRadius: '1px',
  background: 'linear-gradient(180deg, #414649 0%, #303437 100%)',
  color: '#d6d8d9',
  cursor: 'pointer',
  fontSize: '9px',
  selectors: {
    '&:disabled': {
      cursor: 'wait',
      opacity: 0.4,
    },
  },
});
