import { style } from '@vanilla-extract/css';

const controlButton = {
  height: '21px',
  border: '1px solid #111416',
  borderRadius: '1px',
  background: 'linear-gradient(180deg, #414649 0%, #303437 100%)',
  color: '#d6d8d9',
  cursor: 'pointer',
  fontSize: '8px',
  fontWeight: 700,
} as const;

export const control = style({
  minWidth: '220px',
  height: '30px',
  padding: '3px 5px',
  display: 'grid',
  gridTemplateColumns: '84px 38px minmax(80px, 1fr)',
  alignItems: 'center',
  gap: '4px',
  border: '1px solid #151819',
  borderRadius: '2px',
  backgroundColor: '#232729',
});

export const select = style({
  minWidth: 0,
  height: '21px',
  border: '1px solid #101214',
  borderRadius: '1px',
  backgroundColor: '#141718',
  color: '#d6d8d9',
  fontSize: '8px',
});

export const button = style({
  ...controlButton,
  padding: '0 4px',
  selectors: {
    '&:disabled': { cursor: 'not-allowed', opacity: 0.4 },
  },
});

export const monitoringButton = style({
  ...controlButton,
  minWidth: '26px',
  padding: '0 7px',
  height: '24px',
  selectors: {
    '&:disabled': { cursor: 'not-allowed', opacity: 0.38 },
  },
});

export const monitoringActive = style({
  borderColor: '#2c6f56',
  background: 'linear-gradient(180deg, #49a47d 0%, #34765b 100%)',
  color: '#f2fff8',
});

export const error = style({
  gridColumn: '1 / -1',
  color: '#ff8b83',
  fontSize: '8px',
});
