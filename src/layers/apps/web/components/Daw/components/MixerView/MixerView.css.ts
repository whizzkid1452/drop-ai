import { style } from '@vanilla-extract/css';

export const container = style({
  minWidth: '920px',
  minHeight: 0,
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
  background: 'linear-gradient(180deg, #1b1e20 0%, #111315 100%)',
});

export const toolbar = style({
  minHeight: '56px',
  padding: '8px 12px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: '16px',
  borderBottom: '1px solid #080a0b',
  background: '#202426',
});

export const title = style({
  margin: 0,
  color: '#eceeef',
  fontSize: '13px',
  letterSpacing: '0.14em',
});

export const subtitle = style({
  margin: '3px 0 0',
  color: '#82898c',
  fontSize: '9px',
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
});

export const trackCreator = style({
  display: 'flex',
  flexWrap: 'wrap',
  justifyContent: 'flex-end',
  gap: '4px',
});

export const addTrackButton = style({
  minHeight: '25px',
  padding: '3px 8px',
  border: '1px solid #0b0d0e',
  background: '#303538',
  color: '#bfc4c6',
  cursor: 'pointer',
  fontSize: '8px',
  fontWeight: 800,
  letterSpacing: '0.08em',
  selectors: {
    '&:hover:not(:disabled)': { background: '#3d303c', color: '#ff8ee9' },
    '&:focus-visible': { outline: '1px solid #ff57dc', outlineOffset: 1 },
    '&:disabled': { cursor: 'wait', opacity: 0.5 },
  },
});

export const error = style({
  padding: '7px 12px',
  borderBottom: '1px solid #6c2929',
  background: '#3a2020',
  color: '#ffaaa3',
  fontSize: '10px',
});

export const strips = style({
  minHeight: 0,
  flex: 1,
  padding: '10px',
  display: 'flex',
  alignItems: 'stretch',
  gap: '8px',
  overflowX: 'auto',
  overflowY: 'hidden',
});

export const strip = style({
  width: '184px',
  minWidth: '184px',
  minHeight: '520px',
  padding: '7px',
  display: 'flex',
  flexDirection: 'column',
  gap: '7px',
  border: '1px solid #080a0b',
  background: 'linear-gradient(180deg, #2b3032 0%, #1d2123 100%)',
  boxShadow: 'inset 0 1px 0 #3b4144, 0 3px 8px rgba(0, 0, 0, 0.28)',
  selectors: {
    '&[data-route-kind="aux"]': { borderTopColor: '#62a67d' },
    '&[data-route-kind="bus"]': { borderTopColor: '#6a8ec2' },
    '&[data-route-kind="folder"]': { borderTopColor: '#bf9a55' },
    '&[data-route-kind="vca"]': { borderTopColor: '#bf69ad' },
  },
});

export const masterStrip = style({
  width: '206px',
  minWidth: '206px',
  borderTopColor: '#ff61dd',
  background: 'linear-gradient(180deg, #352a34 0%, #211d22 100%)',
});

export const stripHeader = style({
  minHeight: '45px',
  display: 'grid',
  gridTemplateColumns: '1fr auto',
  alignItems: 'center',
  gap: '2px 6px',
  borderBottom: '1px solid #111416',
});

export const routeKind = style({
  color: '#ff78e3',
  fontSize: '8px',
  fontWeight: 800,
  letterSpacing: '0.12em',
});

export const trackName = style({
  gridColumn: '1 / -1',
  overflow: 'hidden',
  color: '#eceded',
  fontSize: '11px',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
});

export const channelCount = style({
  color: '#838a8d',
  fontSize: '7px',
  fontWeight: 700,
});

export const fieldLabel = style({
  display: 'flex',
  flexDirection: 'column',
  gap: '3px',
  color: '#858c8f',
  fontSize: '7px',
  fontWeight: 800,
  letterSpacing: '0.08em',
});

export const select = style({
  width: '100%',
  minHeight: '24px',
  padding: '2px 4px',
  border: '1px solid #0a0c0d',
  borderRadius: 0,
  background: '#171a1c',
  color: '#c5c9ca',
  fontSize: '9px',
});

export const compactSelect = style([select, { width: '47px', minHeight: '20px', padding: '1px 2px', fontSize: '7px' }]);

export const noSignalPath = style({
  padding: '6px',
  border: '1px dashed #42484b',
  color: '#777e81',
  fontSize: '8px',
  textAlign: 'center',
  textTransform: 'uppercase',
});

export const groupControls = style({ display: 'flex', flexDirection: 'column', gap: '6px' });

export const vcaFieldset = style({
  minWidth: 0,
  margin: 0,
  padding: '4px',
  border: '1px solid #141719',
  color: '#858c8f',
  fontSize: '7px',
});

export const checkboxLabel = style({
  display: 'flex',
  alignItems: 'center',
  gap: '4px',
  color: '#b8bdbe',
  fontSize: '8px',
});

export const sendSection = style({
  display: 'flex',
  flexDirection: 'column',
  gap: '4px',
  paddingTop: '5px',
  borderTop: '1px solid #111416',
});

export const sectionLabel = style({ color: '#8a9194', fontSize: '7px', fontWeight: 800, letterSpacing: '0.1em' });

export const sendRow = style({
  display: 'grid',
  gridTemplateColumns: 'minmax(34px, 1fr) auto',
  gap: '3px',
  alignItems: 'center',
  padding: '3px',
  border: '1px solid #121517',
  background: '#232729',
});

export const sendDestination = style({
  overflow: 'hidden',
  fontSize: '8px',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
});
export const sendGain = style({ gridColumn: '1 / -1', width: '100%', margin: 0, accentColor: '#d55dc2' });
export const removeSendButton = style({ border: 0, background: 'transparent', color: '#bd7670', cursor: 'pointer' });
export const addSendRow = style({ display: 'flex', gap: '3px' });
export const addSendButton = style([addTrackButton, { minWidth: '48px', padding: '2px 4px' }]);

export const faderControls = style({
  minHeight: 0,
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'stretch',
  gap: '8px',
  paddingTop: '5px',
  borderTop: '1px solid #111416',
});

export const pan = style({ width: '100%', margin: 0, accentColor: '#6ba1c8' });

export const verticalFaderLabel = style({
  minHeight: '130px',
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'space-between',
  color: '#b2b7b9',
  fontSize: '8px',
});

export const verticalFader = style({
  width: '118px',
  margin: '55px 0',
  accentColor: '#ff62dd',
  transform: 'rotate(-90deg)',
});

export const trackToggleRow = style({ display: 'flex', justifyContent: 'center', gap: '5px' });

export const toggleButton = style({
  minWidth: '34px',
  minHeight: '25px',
  border: '1px solid #0c0e0f',
  background: '#303538',
  color: '#aeb3b5',
  cursor: 'pointer',
  fontSize: '8px',
  fontWeight: 800,
  selectors: {
    '&:focus-visible': { outline: '1px solid #ff63df' },
    '&:disabled': { cursor: 'wait', opacity: 0.55 },
  },
});

export const toggleButtonActive = style({ background: '#783665', color: '#fff0fb' });

export const monitorSection = style({
  marginTop: '10px',
  display: 'grid',
  gridTemplateColumns: 'repeat(3, 1fr)',
  gap: '5px',
});

export const monitorLabel = style({ gridColumn: '1 / -1' });

export const trackId = style({
  overflow: 'hidden',
  color: '#596063',
  fontFamily: 'monospace',
  fontSize: '7px',
  textOverflow: 'ellipsis',
});
