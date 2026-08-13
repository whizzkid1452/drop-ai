import { style } from '@vanilla-extract/css';

export const regionContainer = style({
  position: 'absolute',
  top: 0,
  bottom: 0,
  overflow: 'hidden',
  border: '1px solid #9b3e84',
  borderRadius: '2px',
  background: 'linear-gradient(180deg, #512041 0%, #3b1830 100%)',
  boxShadow: 'inset 0 1px 0 rgba(255, 143, 232, 0.22), 0 0 0 1px rgba(0, 0, 0, 0.25)',
});

export const selectedRegion = style({
  borderColor: '#fff2a8',
  boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.35), 0 0 0 2px rgba(255, 211, 77, 0.5)',
});

export const fadeRamp = style({
  position: 'absolute',
  top: 0,
  bottom: 0,
  zIndex: 1,
  pointerEvents: 'none',
  background: 'rgba(255, 242, 168, 0.2)',
});

export const fadeInRamp = style({
  left: 0,
  clipPath: 'polygon(0 100%, 100% 0, 100% 100%)',
});

export const fadeOutRamp = style({
  right: 0,
  clipPath: 'polygon(0 0, 100% 100%, 0 100%)',
});

export const fadeHandle = style({
  position: 'absolute',
  top: '3px',
  zIndex: 4,
  width: '10px',
  height: '10px',
  padding: 0,
  border: '1px solid #241f19',
  borderRadius: '50%',
  background: '#fff2a8',
  cursor: 'ew-resize',
  touchAction: 'none',
});

export const fadeInHandle = style({ left: 0 });
export const fadeOutHandle = style({ right: 0 });

export const trimHandle = style({
  position: 'absolute',
  top: 0,
  bottom: 0,
  zIndex: 2,
  width: '8px',
  padding: 0,
  border: 0,
  background: 'rgba(255, 242, 168, 0.32)',
  cursor: 'ew-resize',
});

export const startTrimHandle = style({ left: 0 });
export const endTrimHandle = style({ right: 0 });

export const waveformContainer = style({
  height: '100%',
});

export const removeButton = style({
  position: 'absolute',
  top: '4px',
  right: '4px',
  zIndex: 1,
  width: '20px',
  height: '20px',
  padding: 0,
  border: '1px solid rgba(28, 21, 16, 0.7)',
  borderRadius: '2px',
  backgroundColor: 'rgba(43, 31, 24, 0.82)',
  color: '#ffc4f2',
  cursor: 'pointer',
  fontSize: '13px',
  lineHeight: 1,
  ':hover': {
    borderColor: '#d16e5b',
    backgroundColor: '#7c3f35',
    color: '#fff2ee',
  },
});
