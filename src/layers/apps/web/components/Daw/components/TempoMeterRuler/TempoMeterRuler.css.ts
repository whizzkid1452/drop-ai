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
  borderBottom: '1px solid #24292b',
  overflow: 'hidden',
});

export const marker = style({
  position: 'absolute',
  top: '2px',
  zIndex: 2,
  display: 'flex',
  alignItems: 'center',
  height: '19px',
  padding: '0 3px',
  border: '1px solid #9d5b91',
  borderRadius: '3px',
  backgroundColor: '#3a2538',
  color: '#f1c5e9',
  fontFamily: '"Consolas", "SFMono-Regular", monospace',
  fontSize: '9px',
  whiteSpace: 'nowrap',
});

export const meterMarker = style({
  borderColor: '#5b879d',
  backgroundColor: '#203743',
  color: '#c7e5f2',
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

export const valueInput = style({
  width: '42px',
  border: 0,
  outline: 0,
  background: 'transparent',
  color: 'inherit',
  font: 'inherit',
});

export const meterInput = style({
  width: '22px',
  border: 0,
  outline: 0,
  background: 'transparent',
  color: 'inherit',
  font: 'inherit',
});

export const beatUnitSelect = style({
  width: '36px',
  border: 0,
  outline: 0,
  background: '#203743',
  color: 'inherit',
  font: 'inherit',
});

export const unit = style({ opacity: 0.7 });

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

export const errorMessage = style({
  position: 'absolute',
  right: '72px',
  top: '4px',
  zIndex: 4,
  maxWidth: '360px',
  overflow: 'hidden',
  color: '#ff9d9d',
  fontSize: '9px',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
});
