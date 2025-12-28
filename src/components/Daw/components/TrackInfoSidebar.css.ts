import { style } from '@vanilla-extract/css';

export const container = style({
  width: '100%',
  height: '100%',
  display: 'flex',
  flexDirection: 'column',
  backgroundColor: '#0f0f0f',
  borderRight: '1px solid #333',
  color: '#e0e0e0',
  fontFamily: '"Fira Code", monospace',
  fontSize: '12px',
});

export const titleBar = style({
  padding: '8px 12px',
  backgroundColor: '#1a1a1a',
  borderBottom: '1px solid #333',
  fontSize: '12px',
  fontWeight: 600,
  color: '#888',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
});

export const contentArea = style({
  flex: 1,
  overflowY: 'auto',
  padding: '12px',
});

export const pre = style({
  margin: 0,
  whiteSpace: 'pre-wrap',
  wordBreak: 'break-all',
  lineHeight: '1.4',
});
