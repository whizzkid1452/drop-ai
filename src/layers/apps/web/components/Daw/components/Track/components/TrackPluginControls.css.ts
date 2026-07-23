import { style } from '@vanilla-extract/css';

export const container = style({
  display: 'flex',
  flexDirection: 'column',
  gap: '8px',
  marginTop: '8px',
  padding: '8px',
  border: '1px solid #2c2c2c',
  borderRadius: '6px',
  backgroundColor: '#151515',
});

export const header = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: '8px',
  flexWrap: 'wrap',
});

export const title = style({
  color: '#f0f0f0',
  fontSize: '0.8rem',
});

export const addControls = style({
  display: 'flex',
  gap: '6px',
});

export const select = style({
  minWidth: '100px',
  padding: '4px 6px',
  color: '#ffffff',
  backgroundColor: '#242424',
  border: '1px solid #3a3a3a',
  borderRadius: '4px',
});

const button = style({
  padding: '4px 8px',
  color: '#ffffff',
  backgroundColor: '#333333',
  border: '1px solid #444444',
  borderRadius: '4px',
  cursor: 'pointer',
  ':disabled': {
    opacity: 0.5,
    cursor: 'wait',
  },
});

export const addButton = style([button]);

export const removeButton = style([
  button,
  {
    color: '#ffb8b8',
  },
]);

export const instanceList = style({
  display: 'flex',
  flexDirection: 'column',
  gap: '6px',
});

export const instance = style({
  display: 'flex',
  flexDirection: 'column',
  gap: '6px',
  padding: '6px',
  backgroundColor: '#1d1d1d',
  borderRadius: '4px',
});

export const instanceHeader = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  color: '#dddddd',
  fontSize: '0.78rem',
});

export const parameter = style({
  display: 'grid',
  gridTemplateColumns: 'minmax(72px, auto) minmax(100px, 1fr) auto',
  alignItems: 'center',
  gap: '8px',
  color: '#bbbbbb',
  fontSize: '0.75rem',
});

export const parameterName = style({
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
});

export const parameterValue = style({
  minWidth: '32px',
  color: '#8eb2ff',
  textAlign: 'right',
});

export const emptyMessage = style({
  color: '#888888',
  fontSize: '0.72rem',
});
