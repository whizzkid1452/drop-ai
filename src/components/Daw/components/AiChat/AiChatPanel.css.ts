import { style } from '@vanilla-extract/css';

export const container = style({
  display: 'flex',
  flexDirection: 'column',
  width: '400px',
  height: '100%',
  backgroundColor: '#1a1a1a',
  borderLeft: '1px solid #2a2a2a',
  color: '#e0e0e0',
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
});

export const header = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '16px 20px',
  borderBottom: '1px solid #2a2a2a',
  backgroundColor: '#151515',
});

export const title = style({
  margin: 0,
  fontSize: '18px',
  fontWeight: 600,
  color: '#ffffff',
});

export const badge = style({
  padding: '4px 12px',
  borderRadius: '12px',
  fontSize: '12px',
  backgroundColor: '#2a2a2a',
  color: '#a0a0a0',
});

export const messagesContainer = style({
  flex: 1,
  overflowY: 'auto',
  padding: '16px',
  display: 'flex',
  flexDirection: 'column',
  gap: '12px',
  scrollBehavior: 'smooth',
});

export const message = style({
  display: 'flex',
  gap: '12px',
  padding: '12px',
  borderRadius: '8px',
  lineHeight: '1.5',
});

export const user = style({
  backgroundColor: '#2a2a2a',
  marginLeft: 'auto',
  maxWidth: '80%',
});

export const assistant = style({
  backgroundColor: '#252525',
  marginRight: 'auto',
  maxWidth: '80%',
});

export const messageRole = style({
  fontSize: '20px',
  flexShrink: 0,
});

export const messageContent = style({
  flex: 1,
  fontSize: '14px',
  whiteSpace: 'pre-wrap',
  wordBreak: 'break-word',
});

export const toolCalls = style({
  marginTop: '8px',
  paddingTop: '8px',
  borderTop: '1px solid #3a3a3a',
});

export const toolCallsLabel = style({
  fontSize: '12px',
  color: '#888',
  marginBottom: '4px',
});

export const toolCall = style({
  fontSize: '12px',
  marginTop: '4px',
  selectors: {
    '& code': {
      padding: '2px 6px',
      borderRadius: '4px',
      backgroundColor: '#1a1a1a',
      color: '#4a9eff',
      fontFamily: 'monospace',
    },
  },
});

export const loading = style({
  display: 'inline-flex',
  alignItems: 'center',
  gap: '8px',
  color: '#888',
  fontStyle: 'italic',
  '::after': {
    content: '...',
    animation: 'pulse 1.5s ease-in-out infinite',
  },
});

export const inputContainer = style({
  display: 'flex',
  gap: '8px',
  padding: '16px',
  borderTop: '1px solid #2a2a2a',
  backgroundColor: '#151515',
});

export const input = style({
  flex: 1,
  padding: '12px',
  borderRadius: '8px',
  border: '1px solid #2a2a2a',
  backgroundColor: '#1a1a1a',
  color: '#e0e0e0',
  fontSize: '14px',
  fontFamily: 'inherit',
  resize: 'none',
  outline: 'none',
  selectors: {
    '&:focus': {
      borderColor: '#4a9eff',
    },
    '&:disabled': {
      opacity: 0.5,
      cursor: 'not-allowed',
    },
    '&::placeholder': {
      color: '#666',
    },
  },
});

export const sendButton = style({
  padding: '12px 20px',
  borderRadius: '8px',
  border: 'none',
  backgroundColor: '#4a9eff',
  color: '#ffffff',
  fontSize: '16px',
  cursor: 'pointer',
  transition: 'background-color 0.2s',
  flexShrink: 0,
  selectors: {
    '&:hover:not(:disabled)': {
      backgroundColor: '#3a8eef',
    },
    '&:disabled': {
      opacity: 0.5,
      cursor: 'not-allowed',
    },
  },
});

export const initProgress = style({
  padding: '16px',
  borderBottom: '1px solid #2a2a2a',
  backgroundColor: '#151515',
});

export const initProgressText = style({
  fontSize: '12px',
  color: '#888',
  marginBottom: '8px',
  fontFamily: 'monospace',
});

export const initProgressBar = style({
  width: '100%',
  height: '4px',
  backgroundColor: '#2a2a2a',
  borderRadius: '2px',
  overflow: 'hidden',
});

export const initProgressBarFill = style({
  height: '100%',
  width: '60%',
  backgroundColor: '#4a9eff',
  borderRadius: '2px',
  animation: 'pulse 1.5s ease-in-out infinite',
});

