import { style } from '@vanilla-extract/css';

const pluginButton = style({
  height: '22px',
  padding: '0 6px',
  border: '1px solid #101214',
  borderRadius: '2px',
  background: 'linear-gradient(180deg, #3e4346 0%, #2d3133 100%)',
  boxShadow: 'inset 0 1px 0 #505659',
  color: '#d6d8d9',
  cursor: 'pointer',
  fontSize: '9px',
  selectors: {
    '&:disabled': {
      opacity: 0.4,
      cursor: 'wait',
    },
  },
});

export const container = style({
  display: 'flex',
  flexDirection: 'column',
  gap: '4px',
  minWidth: 0,
  padding: '5px',
  border: '1px solid #151819',
  borderRadius: 0,
  backgroundColor: '#1f2325',
});

export const header = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: '5px',
  minWidth: 0,
});

export const title = style({
  flexShrink: 0,
  color: '#9ca2a5',
  fontSize: '9px',
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
});

export const addControls = style({
  display: 'flex',
  gap: '3px',
  minWidth: 0,
});

export const select = style({
  minWidth: 0,
  maxWidth: '120px',
  height: '22px',
  padding: '0 4px',
  border: '1px solid #111416',
  borderRadius: '2px',
  backgroundColor: '#171a1c',
  color: '#d8dadb',
  fontSize: '9px',
});

export const addButton = style([pluginButton]);

export const removeButton = style([
  pluginButton,
  {
    color: '#dda79f',
  },
]);

export const toggleButton = style([pluginButton]);

export const instanceList = style({
  display: 'flex',
  flexDirection: 'column',
  gap: '3px',
});

export const instance = style({
  display: 'flex',
  flexDirection: 'column',
  gap: '4px',
  padding: '4px',
  border: '1px solid #151819',
  backgroundColor: '#262a2c',
});

export const instanceHeader = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: '4px',
  color: '#d7d9da',
  fontSize: '9px',
});

export const instanceActions = style({
  display: 'flex',
  gap: '2px',
});

export const parameter = style({
  display: 'grid',
  gridTemplateColumns: '52px minmax(54px, 1fr) 32px',
  alignItems: 'center',
  gap: '4px',
  minWidth: 0,
  color: '#aeb3b5',
  fontSize: '9px',
});

export const parameterName = style({
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
});

export const parameterValue = style({
  minWidth: 0,
  overflow: 'hidden',
  color: '#ff78e3',
  fontFamily: '"Consolas", "SFMono-Regular", monospace',
  textAlign: 'right',
  textOverflow: 'ellipsis',
});

export const emptyMessage = style({
  color: '#777d80',
  fontSize: '9px',
});
