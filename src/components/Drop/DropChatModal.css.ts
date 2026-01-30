import { style } from '@vanilla-extract/css';

export const overlay = style({
  position: 'fixed',
  inset: 0,
  backgroundColor: 'rgba(0, 0, 0, 0.75)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 60,
});

export const container = style({
  backgroundColor: '#2E2E2E',
  color: '#DCDCDC',
  minHeight: '60vh',
  width: '100%',
  maxWidth: '720px',
  display: 'flex',
  flexDirection: 'column',
  fontFamily:
    '"IBM Plex Mono", Menlo, Consolas, "Space Grotesk", system-ui, monospace',
  borderRadius: '4px',
  overflow: 'hidden',
  border: '1px solid #444444',
});

export const header = style({
  width: '100%',
  borderBottom: '1px solid #444444',
  padding: '0.75rem 1rem',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  backgroundColor: '#2E2E2E',
  flexShrink: 0,
});

export const headerLeft = style({
  display: 'flex',
  alignItems: 'center',
  gap: '0.75rem',
});

export const headerIcon = style({
  fontFamily: '"Material Symbols Outlined"',
  color: '#888888',
  fontSize: '1.25rem',
});

export const headerTitle = style({
  fontSize: '0.75rem',
  fontWeight: 700,
  letterSpacing: '0.18em',
  textTransform: 'uppercase',
});

export const headerRight = style({
  display: 'flex',
  alignItems: 'center',
  gap: '1rem',
});

export const headerButton = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: '#888888',
  cursor: 'pointer',
  border: 'none',
  background: 'none',
  padding: 0,
});

export const headerAvatar = style({
  width: '24px',
  height: '24px',
  backgroundSize: 'cover',
  backgroundPosition: 'center',
  border: '1px solid #444444',
});

export const main = style({
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '1.5rem 1rem',
  width: '100%',
});

export const inner = style({
  width: '100%',
  maxWidth: '640px',
  display: 'flex',
  flexDirection: 'column',
  gap: '0.75rem',
});

export const fileTabWrapper = style({
  alignSelf: 'flex-start',
  marginBottom: 0,
  position: 'relative',
});

export const fileTab = style({
  backgroundColor: '#444444',
  color: '#DCDCDC',
  padding: '0.35rem 1.75rem 0.35rem 0.75rem',
  fontSize: '11px',
  fontWeight: 500,
  letterSpacing: '0.08em',
  display: 'inline-flex',
  alignItems: 'center',
  gap: '0.35rem',
  borderRight: '1px solid rgba(0,0,0,0.3)',
  borderBottom: '1px solid rgba(0,0,0,0.3)',
  boxShadow: '0 1px 3px rgba(0,0,0,0.35)',
});

export const fileTabIcon = style({
  fontFamily: '"Material Symbols Outlined"',
  fontSize: '0.875rem',
  color: '#b6b6b6',
});

export const fileTabClose = style({
  position: 'absolute',
  right: '0.5rem',
  top: '0.3rem',
  opacity: 0.5,
  fontFamily: '"Material Symbols Outlined"',
  fontSize: '0.75rem',
  cursor: 'pointer',
});

export const inputCard = style({
  width: '100%',
  position: 'relative',
  backgroundColor: '#1A1A1A',
  padding: '0.25rem',
  borderTop: '1px solid #666666',
  borderLeft: '1px solid #666666',
  borderBottom: '1px solid #333333',
  borderRight: '1px solid #333333',
  boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.35)',
});

export const inputWrapper = style({
  position: 'relative',
  display: 'flex',
  alignItems: 'flex-start',
});

export const promptCaret = style({
  position: 'absolute',
  left: '0.75rem',
  top: '0.9rem',
  color: '#FFCC33',
  fontWeight: 700,
  userSelect: 'none',
});

export const textarea = style({
  width: '100%',
  backgroundColor: 'transparent',
  border: 'none',
  color: '#DCDCDC',
  padding: '0.75rem 0.75rem',
  paddingLeft: '2.25rem',
  fontSize: '0.95rem',
  fontFamily: '"IBM Plex Mono", Menlo, Consolas, monospace',
  borderRadius: 0,
  outline: 'none',
  resize: 'none',
  height: '6rem',
  lineHeight: 1.5,
});

export const runHint = style({
  position: 'absolute',
  right: '0.75rem',
  bottom: '0.5rem',
  pointerEvents: 'none',
  opacity: 0.4,
  display: 'flex',
  alignItems: 'center',
  gap: '0.25rem',
  fontSize: '0.625rem',
  textTransform: 'uppercase',
  letterSpacing: '0.12em',
});

export const hintIcon = style({
  fontFamily: '"Material Symbols Outlined"',
  fontSize: '0.9rem',
});

export const quickActions = style({
  marginTop: '0.75rem',
  display: 'grid',
  gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
  gap: '0.5rem',
});

export const quickButton = style({
  backgroundColor: '#444444',
  color: '#CCCCCC',
  padding: '0.4rem 0.75rem',
  fontSize: '11px',
  fontFamily: '"IBM Plex Mono", monospace',
  textAlign: 'center',
  borderLeft: '1px solid #555555',
  borderTop: '1px solid #555555',
  borderRight: '1px solid #222222',
  borderBottom: '1px solid #222222',
  cursor: 'pointer',
  transition: 'none',
  textTransform: 'none',
  selectors: {
    '&:hover': {
      color: '#ffffff',
    },
    '&:active': {
      backgroundColor: '#FF764D',
      color: '#000000',
      border: '1px solid #222222',
      transform: 'translateY(1px)',
    },
  },
});

export const footer = style({
  width: '100%',
  padding: '0.35rem 0.75rem',
  borderTop: '1px solid #444444',
  backgroundColor: '#2E2E2E',
  flexShrink: 0,
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  fontSize: '10px',
  color: '#666666',
  fontFamily: '"IBM Plex Mono", monospace',
});

export const footerLeft = style({
  display: 'flex',
  alignItems: 'center',
  gap: '0.35rem',
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
});

export const footerStatusDot = style({
  display: 'inline-block',
  width: '6px',
  height: '6px',
  backgroundColor: '#666666',
});

export const footerRight = style({
  display: 'flex',
  alignItems: 'center',
  gap: '1rem',
});

export const footerButton = style({
  marginLeft: '0.5rem',
  padding: '0.2rem 0.75rem',
  borderRadius: '2px',
  border: '1px solid #555555',
  backgroundColor: '#1A1A1A',
  color: '#DCDCDC',
  fontSize: '10px',
  textTransform: 'uppercase',
  letterSpacing: '0.12em',
  cursor: 'pointer',
});

