import { style, keyframes } from '@vanilla-extract/css';

export const primaryColor = '#FF4FD8';
export const abletonGrey = '#333333';
export const abletonDarkGrey = '#222222';
export const abletonBorder = '#444444';
export const backgroundDark = '#1a1a1a';

const spin = keyframes({
  'from': { transform: 'rotate(0deg)' },
  'to': { transform: 'rotate(360deg)' },
});

const pulse = keyframes({
  '0%, 100%': { opacity: 1 },
  '50%': { opacity: 0.5 },
});

export const modalOverlay = style({
  position: 'fixed',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  backgroundColor: 'rgba(17, 17, 17, 0.95)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 1000,
  padding: '1rem',
  backgroundImage: 'radial-gradient(#222 1px, transparent 1px)',
  backgroundSize: '20px 20px',
});

export const modalContainer = style({
  width: '100%',
  maxWidth: '960px',
  height: '80vh',
  border: `1px solid ${abletonBorder}`,
  backgroundColor: abletonDarkGrey,
  boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
  display: 'flex',
  flexDirection: 'column',
  position: 'relative',
  overflow: 'hidden',
});

export const container = style({
  display: 'flex',
  flexDirection: 'column',
  height: '100%',
  width: '100%',
});

export const header = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  height: '32px',
  backgroundColor: abletonGrey,
  borderBottom: `1px solid ${abletonBorder}`,
  padding: '0 8px',
  userSelect: 'none',
  flexShrink: 0,
});

export const headerTitle = style({
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
});

export const headerTitleText = style({
  fontSize: '12px',
  fontWeight: 'bold',
  letterSpacing: '0.1em',
  color: '#eeeeee',
  textTransform: 'uppercase',
  fontFamily: '"Space Grotesk", sans-serif',
});

export const headerSubtitle = style({
  color: '#888',
  fontWeight: 'normal',
  marginLeft: '8px',
});

export const headerActions = style({
  display: 'flex',
  height: '100%',
  alignItems: 'center',
  gap: '1px',
});

export const headerButton = style({
  height: '20px',
  width: '24px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: '#ccc',
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  transition: 'background-color 0.2s',
  selectors: {
    '&:hover': {
      backgroundColor: '#444',
    },
  },
});

export const loadingArea = style({
  position: 'relative',
  width: '100%',
  backgroundColor: '#181818',
  borderBottom: `1px solid ${abletonBorder}`,
  flexShrink: 0,
});

export const progressBarContainer = style({
  height: '2px',
  width: '100%',
  backgroundColor: '#2a2a2a',
  position: 'relative',
});

export const progressBar = style({
  position: 'absolute',
  top: 0,
  left: 0,
  height: '100%',
  backgroundColor: primaryColor,
  boxShadow: `0 0 8px rgba(13, 223, 242, 0.6)`,
});

export const statusStrip = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '6px 12px',
  backgroundColor: '#262626',
});

export const statusInfo = style({
  display: 'flex',
  alignItems: 'center',
  gap: '12px',
});

export const statusText = style({
  fontFamily: '"Noto Sans Mono", monospace',
  fontSize: '10px',
  color: primaryColor,
  letterSpacing: '0.05em',
});

export const statusLabel = style({
  fontFamily: '"Noto Sans Mono", monospace',
  fontSize: '10px',
  color: '#888',
});

export const terminalBody = style({
  flex: 1,
  overflowY: 'auto',
  padding: '16px',
  display: 'flex',
  flexDirection: 'column',
  gap: '4px',
  backgroundColor: backgroundDark,
  position: 'relative',
  selectors: {
    '&::-webkit-scrollbar': {
      width: '8px',
      height: '8px',
    },
    '&::-webkit-scrollbar-track': {
      background: '#222',
    },
    '&::-webkit-scrollbar-thumb': {
      background: '#444',
      borderRadius: '1px',
    },
    '&::-webkit-scrollbar-thumb:hover': {
      background: '#555',
    },
  },
});

export const gridBackground = style({
  position: 'absolute',
  inset: 0,
  pointerEvents: 'none',
  opacity: 0.03,
  backgroundImage: 'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)',
  backgroundSize: '40px 40px',
});

export const quickGuideBox = style({
  position: 'relative',
  zIndex: 1,
  flexShrink: 0,
  marginBottom: '24px',
  padding: '12px',
  backgroundColor: '#202020',
  borderLeft: '2px solid #555',
  width: '100%',
  maxWidth: '42rem',
});

export const quickGuideHeader = style({
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  marginBottom: '8px',
});

export const quickGuideTitle = style({
  fontSize: '11px',
  fontWeight: 'bold',
  color: '#888',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  margin: 0,
});

export const quickGuideDescription = style({
  fontSize: '12px',
  color: '#999',
  lineHeight: 1.5,
  marginBottom: '12px',
  fontFamily: '"Noto Sans Mono", monospace',
});

export const quickGuideChips = style({
  display: 'flex',
  flexWrap: 'wrap',
  gap: '8px',
});

export const quickGuideChip = style({
  padding: '4px 8px',
  fontSize: '10px',
  fontFamily: '"Noto Sans Mono", monospace',
  color: '#ccc',
  backgroundColor: '#262626',
  border: '1px solid #444',
  cursor: 'pointer',
  transition: 'color 0.15s, border-color 0.15s, background-color 0.15s',
  selectors: {
    '&:hover:not(:disabled)': {
      borderColor: '#777',
      backgroundColor: '#333',
    },
    '&:disabled': {
      opacity: 0.5,
      cursor: 'not-allowed',
    },
  },
});

export const messageGroup = style({
  display: 'flex',
  flexDirection: 'column',
  gap: '16px',
});

export const messageRow = style({
  display: 'flex',
  gap: '12px',
});

export const messageRowUser = style({
  flexDirection: 'row-reverse',
  justifyContent: 'flex-start',
  width: '100%',
});

export const avatar = style({
  width: '32px',
  height: '32px',
  backgroundColor: abletonGrey,
  border: `1px solid ${abletonBorder}`,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
});

export const aiAvatar = style({
  backgroundColor: '#223',
  borderColor: '#334',
});

export const messageContent = style({
  display: 'flex',
  flexDirection: 'column',
  maxWidth: '80%',
});

export const messageContentUser = style({
  alignItems: 'flex-end',
});

export const messageHeaderUser = style({
  justifyContent: 'flex-end',
});

export const bubbleUser = style({
  textAlign: 'right',
});

export const messageHeader = style({
  display: 'flex',
  alignItems: 'baseline',
  gap: '8px',
  marginBottom: '4px',
});

export const senderName = style({
  fontSize: '12px',
  fontWeight: 'bold',
  color: '#ccc',
  letterSpacing: '0.05em',
});

export const aiSenderName = style({
  color: primaryColor,
});

export const timestamp = style({
  fontSize: '10px',
  fontFamily: '"Noto Sans Mono", monospace',
  color: '#666',
});

export const bubble = style({
  backgroundColor: '#262626',
  border: '1px solid #333',
  padding: '8px',
  fontSize: '14px',
  color: '#ddd',
  fontWeight: 300,
  lineHeight: 1.5,
  fontFamily: '"Noto Sans Mono", monospace',
});

export const aiBubble = style({
  backgroundColor: '#223',
  borderColor: '#334',
});

export const systemMessage = style({
  display: 'flex',
  gap: '12px',
  margin: '8px 0',
  paddingLeft: '44px',
});

export const systemInfo = style({
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  color: '#666',
});

export const systemText = style({
  fontFamily: '"Noto Sans Mono", monospace',
  fontSize: '10px',
  letterSpacing: '0.05em',
});

export const composer = style({
  backgroundColor: abletonGrey,
  borderTop: `1px solid ${abletonBorder}`,
  padding: '8px',
  flexShrink: 0,
});

export const composerRow = style({
  display: 'flex',
  gap: '8px',
  height: '40px',
});

export const inputWrapper = style({
  flex: 1,
  backgroundColor: 'black',
  border: '1px solid #555',
  display: 'flex',
  alignItems: 'center',
  padding: '0 12px',
  position: 'relative',
  selectors: {
    '&:focus-within': {
      borderColor: primaryColor,
    },
  },
});

export const cornerMarker = style({
  position: 'absolute',
  width: '4px',
  height: '4px',
});

export const topLeft = style({
  top: 0,
  left: 0,
  borderTop: '1px solid #666',
  borderLeft: '1px solid #666',
  selectors: {
    [`${inputWrapper}:focus-within &`]: {
      borderColor: primaryColor,
    },
  },
});

export const bottomRight = style({
  bottom: 0,
  right: 0,
  borderBottom: '1px solid #666',
  borderRight: '1px solid #666',
  selectors: {
    [`${inputWrapper}:focus-within &`]: {
      borderColor: primaryColor,
    },
  },
});

export const promptSymbol = style({
  color: primaryColor,
  fontWeight: 'bold',
  marginRight: '8px',
  fontSize: '14px',
});

export const inputField = style({
  backgroundColor: 'transparent',
  border: 'none',
  outline: 'none',
  fontSize: '14px',
  color: 'white',
  width: '100%',
  fontFamily: '"Noto Sans Mono", monospace',
  caretShape: 'block',
  caretColor: primaryColor,
  selectors: {
    '&::placeholder': {
      color: '#555',
    },
  },
});

export const executeButton = style({
  backgroundColor: '#444',
  color: 'white',
  fontSize: '12px',
  fontWeight: 'bold',
  letterSpacing: '0.1em',
  padding: '0 16px',
  border: '1px solid #555',
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  minWidth: '100px',
  justifyContent: 'center',
  cursor: 'pointer',
  transition: 'all 0.2s',
  selectors: {
    '&:hover': {
      backgroundColor: '#555',
    },
    '&:active': {
      backgroundColor: primaryColor,
      color: 'black',
    },
  },
});

export const footer = style({
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginTop: '4px',
  padding: '0 4px',
});

export const footerStats = style({
  display: 'flex',
  gap: '16px',
});

export const statItem = style({
  fontSize: '9px',
  color: '#777',
  fontFamily: '"Noto Sans Mono", monospace',
  textTransform: 'uppercase',
});

export const statusIndicators = style({
  display: 'flex',
  gap: '4px',
});

export const indicator = style({
  width: '6px',
  height: '6px',
  backgroundColor: '#444',
});

export const activeIndicator = style({
  backgroundColor: primaryColor,
  animation: `${pulse} 2s infinite`,
});

export const spinning = style({
  animation: `${spin} 1s linear infinite`,
});
