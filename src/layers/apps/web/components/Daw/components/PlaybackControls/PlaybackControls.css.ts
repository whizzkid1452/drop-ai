import { style } from '@vanilla-extract/css';

export const container = style({
  position: 'fixed',
  bottom: '20px',
  left: '50%',
  transform: 'translateX(-50%)',
  zIndex: 100,
  padding: '4px',
  display: 'flex',
  alignItems: 'center',
  gap: '3px',
  border: '1px solid #0e1011',
  borderRadius: '2px',
  backgroundColor: '#202426',
  boxShadow: 'inset 0 1px 0 #3c4144, 0 3px 10px rgba(0, 0, 0, 0.45)',
});

export const inlineContainer = style({
  position: 'static',
  transform: 'none',
  zIndex: 'auto',
  padding: '3px',
  backgroundColor: '#202426',
});

export const button = style({
  width: '30px',
  height: '30px',
  padding: 0,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  border: '1px solid #111416',
  borderRadius: '2px',
  background: 'linear-gradient(180deg, #454a4d 0%, #303437 100%)',
  boxShadow: 'inset 0 1px 0 #5c6265',
  color: '#d7dadb',
  cursor: 'pointer',
  transition: 'background-color 100ms ease, color 100ms ease',
  ':hover': {
    background: 'linear-gradient(180deg, #51575a 0%, #3c4144 100%)',
    color: '#ffffff',
  },
  ':active': {
    boxShadow: 'inset 0 2px 3px rgba(0, 0, 0, 0.45)',
  },
});

export const playButton = style([
  button,
  {
    width: '34px',
    borderColor: '#6f245d',
    background: 'linear-gradient(180deg, #ff65df 0%, #c83aa9 100%)',
    boxShadow: 'inset 0 1px 0 #ffabea',
    color: '#24101f',
    ':hover': {
      background: 'linear-gradient(180deg, #ff83e5 0%, #df4fc0 100%)',
      color: '#1b0a17',
    },
  },
]);
