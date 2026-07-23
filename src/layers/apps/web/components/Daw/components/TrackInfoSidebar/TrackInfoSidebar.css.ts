import { style } from '@vanilla-extract/css';

export const container = style({
  width: '100%',
  height: '100%',
  display: 'flex',
  flexDirection: 'column',
  borderRight: '1px solid #080a0b',
  backgroundColor: '#1e2224',
  color: '#c9cccd',
  fontFamily: '"Consolas", "SFMono-Regular", monospace',
  fontSize: '10px',
});

export const titleBar = style({
  minHeight: '32px',
  padding: '0 10px',
  display: 'flex',
  alignItems: 'center',
  borderBottom: '1px solid #0d0f10',
  background: 'linear-gradient(180deg, #313537 0%, #272b2d 100%)',
  boxShadow: 'inset 0 1px 0 #414649',
  color: '#c1c5c7',
  fontSize: '9px',
  fontWeight: 700,
  letterSpacing: '0.1em',
});

export const contentArea = style({
  flex: 1,
  overflowY: 'auto',
  padding: '8px',
});

export const pre = style({
  margin: 0,
  color: '#aeb4b7',
  lineHeight: 1.45,
  whiteSpace: 'pre-wrap',
  wordBreak: 'break-all',
});

export const emptyMessage = style({
  padding: '24px 10px',
  color: '#72797c',
  fontSize: '10px',
  lineHeight: 1.5,
  textAlign: 'center',
});
