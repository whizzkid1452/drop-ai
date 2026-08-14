import { style } from '@vanilla-extract/css';

const compactButton = {
  minHeight: '22px',
  border: '1px solid #111416',
  borderRadius: '2px',
  background: '#303538',
  color: '#d7dadb',
  cursor: 'pointer',
  fontSize: '9px',
  fontWeight: 700,
} as const;

export const container = style({ display: 'flex', flexDirection: 'column', gap: '4px' });

export const inputControls = style({
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: '4px',
});

export const inputButton = style({
  ...compactButton,
  selectors: { '&:disabled': { cursor: 'not-allowed', opacity: 0.45 } },
});
export const monitoringActive = style({ background: '#355f4e', color: '#e9fff6' });

export const slotGrid = style({ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px' });

export const slot = style({
  minWidth: 0,
  padding: '4px',
  border: '1px solid #111416',
  background: '#202426',
  selectors: {
    '&[data-state="armed"]': { borderColor: '#b27b32' },
    '&[data-state="recording"]': { borderColor: '#db4b4b' },
    '&[data-state="playing"]': { borderColor: '#49a779' },
    '&[data-state="error"]': { borderColor: '#c64a4a' },
  },
});

export const slotHeader = style({
  display: 'flex',
  justifyContent: 'space-between',
  gap: '3px',
  color: '#bfc4c6',
  fontSize: '8px',
  fontWeight: 700,
});

export const state = style({ overflow: 'hidden', color: '#ff78e3', textOverflow: 'ellipsis' });
export const slotActions = style({ display: 'flex', gap: '3px', marginTop: '3px' });
export const primaryButton = style({ ...compactButton, flex: 1, background: '#43494c' });
export const overdubButton = style({ ...compactButton, flex: 1, background: '#355f4e', color: '#e9fff6' });
export const clearButton = style({ ...compactButton, minWidth: '22px', color: '#e2a59c' });

export const slotSettings = style({
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: '3px',
  marginTop: '3px',
});

export const settingLabel = style({
  display: 'flex',
  alignItems: 'center',
  gap: '2px',
  color: '#92999c',
  fontSize: '8px',
});
export const settingSelect = style({
  minWidth: 0,
  width: '100%',
  border: '1px solid #111416',
  background: '#171a1c',
  color: '#d7dadb',
  fontSize: '8px',
});

export const settingsToggle = style({
  ...compactButton,
  marginTop: '3px',
  width: '100%',
  selectors: { '&[aria-expanded="true"]': { background: '#4d3a50', color: '#ffe6fb' } },
});

export const clipSettings = style({
  display: 'grid',
  gap: '4px',
  gridTemplateColumns: '1fr 1fr',
  marginTop: '4px',
});

export const settingInput = style({
  minWidth: 0,
  width: '100%',
  border: '1px solid #111416',
  background: '#171a1c',
  color: '#d7dadb',
  fontSize: '8px',
});

export const saveSettingsButton = style({
  ...compactButton,
  gridColumn: '1 / -1',
  background: '#4d3a50',
  selectors: { '&:disabled': { cursor: 'not-allowed', opacity: 0.45 } },
});

export const error = style({ color: '#ff7979', fontSize: '8px', fontWeight: 700 });
