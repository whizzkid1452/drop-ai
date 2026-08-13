import { style } from '@vanilla-extract/css';

export const container = style({
  position: 'relative',
  minWidth: '100%',
  borderBottom: '1px solid #0b0d0e',
  backgroundColor: '#181b1d',
});

export const lane = style({
  position: 'relative',
  height: '24px',
  overflow: 'hidden',
  borderBottom: '1px solid #24292b',
});

export const marker = style({
  position: 'absolute',
  top: '2px',
  zIndex: 2,
  display: 'flex',
  alignItems: 'center',
  height: '19px',
  padding: '0 3px',
  border: '1px solid #a8754f',
  borderRadius: '3px',
  backgroundColor: '#3c2c20',
  color: '#f4d0b3',
  fontFamily: '"Consolas", "SFMono-Regular", monospace',
  fontSize: '9px',
  whiteSpace: 'nowrap',
});

export const dragHandle = style({
  width: '5px',
  height: '13px',
  marginRight: '2px',
  borderLeft: '1px dotted currentColor',
  borderRight: '1px dotted currentColor',
  cursor: 'ew-resize',
  touchAction: 'none',
});

export const markerInput = style({
  width: '72px',
  border: 0,
  outline: 0,
  background: 'transparent',
  color: 'inherit',
  font: 'inherit',
});

export const deleteButton = style({
  marginLeft: '3px',
  padding: 0,
  border: 0,
  background: 'transparent',
  color: 'inherit',
  cursor: 'pointer',
});

export const addButton = style({
  position: 'absolute',
  top: '3px',
  right: '8px',
  zIndex: 3,
  height: '18px',
  padding: '0 6px',
  border: '1px solid #4a5053',
  borderRadius: '3px',
  backgroundColor: '#272b2d',
  color: '#aeb4b7',
  fontSize: '9px',
  cursor: 'pointer',
});

export const rangeLane = style({
  cursor: 'crosshair',
  touchAction: 'none',
  selectors: {
    '&:hover': { backgroundColor: 'rgba(66, 132, 164, 0.08)' },
  },
});

export const exportRange = style({
  position: 'absolute',
  top: '2px',
  zIndex: 2,
  height: '19px',
  border: '1px solid #5b9ab8',
  borderRadius: '2px',
  backgroundColor: 'rgba(66, 132, 164, 0.3)',
  pointerEvents: 'none',
});

export const exportRangeLabel = style({
  position: 'absolute',
  left: '50%',
  transform: 'translateX(-50%)',
  color: '#b9def0',
  fontFamily: '"Consolas", "SFMono-Regular", monospace',
  fontSize: '9px',
  lineHeight: '17px',
  whiteSpace: 'nowrap',
});

export const loopRange = style({
  position: 'absolute',
  top: '2px',
  zIndex: 2,
  height: '19px',
  border: '1px solid #9b6ca8',
  borderRadius: '2px',
  backgroundColor: 'rgba(132, 75, 146, 0.26)',
  pointerEvents: 'none',
});

export const loopRangeEnabled = style({
  borderColor: '#dc6df5',
  backgroundColor: 'rgba(185, 66, 211, 0.34)',
});

export const loopRangeLabel = style({
  position: 'absolute',
  left: '50%',
  transform: 'translateX(-50%)',
  color: '#edc5f6',
  fontFamily: '"Consolas", "SFMono-Regular", monospace',
  fontSize: '9px',
  lineHeight: '17px',
  whiteSpace: 'nowrap',
});

export const clearButton = style({
  position: 'absolute',
  top: '3px',
  right: '8px',
  zIndex: 3,
  height: '18px',
  padding: '0 6px',
  border: '1px solid #4a5053',
  borderRadius: '3px',
  backgroundColor: '#272b2d',
  color: '#aeb4b7',
  fontSize: '9px',
  cursor: 'pointer',
  selectors: {
    '&:disabled': { opacity: 0.4, cursor: 'default' },
  },
});

export const errorMessage = style({
  position: 'absolute',
  top: '4px',
  right: '72px',
  zIndex: 4,
  maxWidth: '360px',
  overflow: 'hidden',
  color: '#ff9d9d',
  fontSize: '9px',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
});
