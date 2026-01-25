import { style } from '@vanilla-extract/css';

export const container = style({
  width: '100%',
  height: '100%',
  display: 'flex',
  flexDirection: 'column',
  backgroundColor: '#0f0f0f',
  borderLeft: '1px solid #333',
  color: '#e0e0e0',
  fontFamily: '"Fira Code", monospace',
  fontSize: '14px',
});

export const titeBar = style({
  padding: '8px 12px',
  backgroundColor: '#1a1a1a',
  borderBottom: '1px solid #333',
  fontSize: '12px',
  fontWeight: 600,
  color: '#888',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
});

export const logArea = style({
  flex: 1,
  overflowY: 'auto',
  padding: '12px',
  display: 'flex',
  flexDirection: 'column',
  gap: '4px',
});

export const logItem = style({
  wordBreak: 'break-all',
  whiteSpace: 'pre-wrap',
  lineHeight: '1.4',
});

export const logItemError = style({
  color: '#ff5555',
});

export const logItemSuccess = style({
  color: '#50fa7b',
});

export const inputArea = style({
  padding: '12px',
  borderTop: '1px solid #333',
  backgroundColor: '#1a1a1a',
});

export const textarea = style({
  width: '100%',
  minHeight: '80px',
  backgroundColor: 'transparent',
  border: 'none',
  resize: 'none',
  color: '#e0e0e0',
  fontFamily: 'inherit',
  fontSize: 'inherit',
  outline: 'none',
  '::placeholder': {
    color: '#555',
  },
});

export const helpfulText = style({
  fontSize: '10px',
  color: '#666',
  marginTop: '4px',
  textAlign: 'right',
});
