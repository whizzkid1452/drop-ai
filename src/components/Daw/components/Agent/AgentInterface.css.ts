import { style, keyframes } from '@vanilla-extract/css';

const fadeIn = keyframes({
    from: { opacity: 0, transform: 'translateY(10px)' },
    to: { opacity: 1, transform: 'translateY(0)' },
});

export const container = style({
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    backgroundColor: 'rgba(15, 15, 20, 0.95)',
    backdropFilter: 'blur(10px)',
    borderLeft: '1px solid rgba(255, 255, 255, 0.1)',
    color: '#e0e0e0',
    fontFamily: '"Inter", sans-serif',
    overflow: 'hidden',
});

export const header = style({
    padding: '16px',
    borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
});

export const title = style({
    fontSize: '14px',
    fontWeight: 600,
    letterSpacing: '0.05em',
    color: '#f0f0f0',
    textTransform: 'uppercase',
});

export const loadingOverlay = style({
    padding: '20px',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    fontSize: '12px',
});

export const progressBarContainer = style({
    width: '100%',
    height: '4px',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: '2px',
    overflow: 'hidden',
});

export const progressBarFill = style({
    height: '100%',
    backgroundColor: '#00ccff',
    transition: 'width 0.3s ease',
    boxShadow: '0 0 10px rgba(0, 204, 255, 0.5)',
});

export const messageArea = style({
    flex: 1,
    padding: '20px',
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
    scrollBehavior: 'smooth',
    '::-webkit-scrollbar': {
        width: '6px',
    },
    '::-webkit-scrollbar-thumb': {
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        borderRadius: '3px',
    },
});

export const messageBubble = style({
    padding: '12px 16px',
    borderRadius: '12px',
    maxWidth: '85%',
    fontSize: '14px',
    lineHeight: '1.5',
    animation: `${fadeIn} 0.3s ease-out`,
});

export const userMessage = style({
    alignSelf: 'flex-end',
    backgroundColor: 'rgba(0, 102, 255, 0.2)',
    border: '1px solid rgba(0, 102, 255, 0.3)',
    color: '#ffffff',
});

export const assistantMessage = style({
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
});

export const inputArea = style({
    padding: '16px',
    borderTop: '1px solid rgba(255, 255, 255, 0.1)',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
});

export const textarea = style({
    width: '100%',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    borderRadius: '8px',
    color: '#ffffff',
    padding: '12px',
    fontSize: '14px',
    resize: 'none',
    outline: 'none',
    transition: 'border-color 0.2s',
    ':focus': {
        borderColor: 'rgba(0, 204, 255, 0.5)',
    },
});

export const statusGlow = keyframes({
    '0%': { opacity: 0.5 },
    '50%': { opacity: 1 },
    '100%': { opacity: 0.5 },
});

export const generatingStatus = style({
    fontSize: '11px',
    color: '#00ccff',
    fontStyle: 'italic',
    animation: `${statusGlow} 1.5s infinite`,
});
