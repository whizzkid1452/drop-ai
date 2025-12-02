import { style } from '@vanilla-extract/css';
import { ardourPalette } from '../../styles/ardourTheme';

export const container = style({
  display: 'flex',
  flexDirection: 'column',
  gap: '24px',
  color: ardourPalette.textPrimary,
});

export const transportBar = style({
  display: 'flex',
  flexWrap: 'wrap',
  gap: '16px',
  alignItems: 'center',
  padding: '20px',
  backgroundColor: ardourPalette.surface,
  border: `1px solid ${ardourPalette.border}`,
  borderRadius: '12px',
  boxShadow: ardourPalette.shadow,
});

export const playButton = style({
  padding: '10px 24px',
  border: `1px solid ${ardourPalette.border}`,
  borderRadius: '8px',
  fontSize: '1rem',
  fontWeight: 600,
  cursor: 'pointer',
  transition: 'transform 0.2s ease, background-color 0.2s ease',
  backgroundColor: ardourPalette.surfaceRaised,
  color: ardourPalette.textPrimary,
  textTransform: 'uppercase',
});

export const playButtonActive = style({
  backgroundColor: ardourPalette.accent,
  borderColor: ardourPalette.accent,
  color: '#242424',
  ':hover': {
    backgroundColor: ardourPalette.accentHover,
    transform: 'scale(1.05)',
  },
  ':active': {
    transform: 'scale(0.95)',
  },
});

export const pauseButton = style({
  backgroundColor: ardourPalette.accentHover,
  borderColor: ardourPalette.accentHover,
  color: '#242424',
  ':hover': {
    backgroundColor: ardourPalette.accent,
    transform: 'scale(1.05)',
  },
  ':active': {
    transform: 'scale(0.95)',
  },
});

export const stopButton = style({
  backgroundColor: ardourPalette.critical,
  borderColor: ardourPalette.critical,
  color: '#f8f8f2',
  ':hover': {
    backgroundColor: ardourPalette.criticalHover,
    transform: 'scale(1.05)',
  },
  ':active': {
    transform: 'scale(0.95)',
  },
});

export const bpmControl = style({
  display: 'flex',
  gap: '8px',
  alignItems: 'center',
  fontSize: '0.875rem',
  fontWeight: 500,
  color: ardourPalette.textSecondary,
});

export const bpmInput = style({
  width: '80px',
  padding: '6px 8px',
  border: `1px solid ${ardourPalette.border}`,
  borderRadius: '6px',
  fontSize: '0.875rem',
  backgroundColor: ardourPalette.surfaceRaised,
  color: ardourPalette.textPrimary,

  ':focus': {
    outline: 'none',
    borderColor: ardourPalette.accent,
    boxShadow: '0 0 0 2px rgba(162, 86, 255, 0.25)',
  },
});

export const transportControls = style({
  display: 'flex',
  gap: '12px',
  alignItems: 'center',
});

export const transportSettings = style({
  display: 'flex',
  gap: '16px',
  alignItems: 'center',
  marginLeft: '24px',
  paddingLeft: '24px',
  borderLeft: `1px solid ${ardourPalette.border}`,
});

export const transportInfo = style({
  display: 'flex',
  gap: '12px',
  alignItems: 'center',
  marginLeft: 'auto',
  color: ardourPalette.textSecondary,
});

export const positionDisplay = style({
  display: 'flex',
  flexDirection: 'column',
  gap: '2px',
  padding: '6px 16px',
  backgroundColor: ardourPalette.surfaceRaised,
  border: `1px solid ${ardourPalette.border}`,
  borderRadius: '8px',
  minWidth: '80px',
  textAlign: 'center',
  boxShadow: '0 4px 18px rgba(92, 64, 122, 0.12)',
});

export const positionTime = style({
  fontSize: '0.875rem',
  fontWeight: 700,
  color: ardourPalette.textPrimary,
  letterSpacing: '0.1em',
});

export const positionBBT = style({
  fontSize: '0.7rem',
  color: ardourPalette.textMuted,
  letterSpacing: '0.08em',
});

export const positionInput = style({
  fontSize: '0.875rem',
  fontWeight: 700,
  color: ardourPalette.textPrimary,
  backgroundColor: 'transparent',
  border: 'none',
  outline: 'none',
  textAlign: 'center',
  width: '100%',
  padding: '0',
  letterSpacing: '0.1em',
  fontFamily: 'inherit',
  
  '::placeholder': {
    color: ardourPalette.textMuted,
    opacity: 0.6,
  },
});

export const metronomeButton = style({
  padding: '6px 12px',
  border: `1px solid ${ardourPalette.border}`,
  borderRadius: '8px',
  backgroundColor: ardourPalette.surface,
  color: ardourPalette.textMuted,
  fontSize: '0.875rem',
  fontWeight: 500,
  cursor: 'pointer',
  transition: 'background-color 0.2s, color 0.2s',

  ':hover': {
    backgroundColor: ardourPalette.surfaceRaised,
    color: ardourPalette.textPrimary,
  },
});

export const metronomeActive = style({
  backgroundColor: ardourPalette.focus,
  color: ardourPalette.surface,
  borderColor: ardourPalette.focus,

  ':hover': {
    backgroundColor: ardourPalette.accent,
  },
});

export const toggleButton = style({
  padding: '6px 12px',
  border: `1px solid ${ardourPalette.border}`,
  borderRadius: '8px',
  backgroundColor: ardourPalette.surface,
  color: ardourPalette.textMuted,
  fontSize: '0.875rem',
  fontWeight: 500,
  cursor: 'pointer',
  transition: 'background-color 0.2s, color 0.2s',

  ':hover': {
    backgroundColor: ardourPalette.surfaceRaised,
    borderColor: ardourPalette.accent,
    color: ardourPalette.textPrimary,
  },
});

export const sessionControls = style({
  display: 'flex',
  gap: '8px',
  alignItems: 'center',
  marginLeft: '16px',
  paddingLeft: '16px',
  borderLeft: `1px solid ${ardourPalette.border}`,
});

export const sessionNameInput = style({
  padding: '4px 8px',
  border: `1px solid ${ardourPalette.border}`,
  borderRadius: '6px',
  fontSize: '0.875rem',
  width: '150px',
  backgroundColor: ardourPalette.surfaceRaised,
  color: ardourPalette.textPrimary,

  ':focus': {
    outline: 'none',
    borderColor: ardourPalette.accent,
    boxShadow: '0 0 0 2px rgba(162, 86, 255, 0.25)',
  },
});

export const sessionButton = style({
  padding: '4px 12px',
  border: `1px solid ${ardourPalette.border}`,
  borderRadius: '8px',
  backgroundColor: ardourPalette.surface,
  color: ardourPalette.textSecondary,
  fontSize: '0.875rem',
  fontWeight: 500,
  cursor: 'pointer',
  transition: 'background-color 0.2s, color 0.2s',

  ':hover': {
    backgroundColor: ardourPalette.surfaceRaised,
    color: ardourPalette.textPrimary,
  },
});

export const sessionListPanel = style({
  display: 'flex',
  flexDirection: 'column',
  gap: '12px',
  padding: '16px',
  border: `1px solid ${ardourPalette.border}`,
  borderRadius: '12px',
  backgroundColor: ardourPalette.surface,
  boxShadow: ardourPalette.shadow,
});

export const sessionListHeader = style({
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  fontSize: '0.95rem',
  fontWeight: 600,
  color: ardourPalette.textPrimary,
});

export const sessionListActions = style({
  display: 'flex',
  gap: '8px',
  alignItems: 'center',
});

export const sessionList = style({
  display: 'flex',
  flexDirection: 'column',
  gap: '8px',
  maxHeight: '220px',
  overflowY: 'auto',
});

export const sessionListItem = style({
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '10px 12px',
  borderRadius: '8px',
  backgroundColor: ardourPalette.surfaceRaised,
  border: `1px solid transparent`,
  transition: 'border-color 0.2s',

  ':hover': {
    borderColor: ardourPalette.accent,
  },
});

export const sessionListInfo = style({
  display: 'flex',
  flexDirection: 'column',
  gap: '2px',
});

export const sessionListName = style({
  fontSize: '0.95rem',
  fontWeight: 600,
  color: ardourPalette.textPrimary,
});

export const sessionListMeta = style({
  fontSize: '0.8rem',
  color: ardourPalette.textSecondary,
});

export const sessionListEmpty = style({
  padding: '20px',
  textAlign: 'center',
  border: `1px dashed ${ardourPalette.border}`,
  borderRadius: '10px',
  color: ardourPalette.textMuted,
  fontSize: '0.9rem',
});

export const sessionListError = style({
  padding: '12px',
  borderRadius: '8px',
  backgroundColor: 'rgba(255, 71, 87, 0.12)',
  color: ardourPalette.critical,
  fontSize: '0.85rem',
});

export const fileSection = style({
  display: 'flex',
  flexDirection: 'column',
  gap: '16px',
  backgroundColor: ardourPalette.surface,
  border: `1px solid ${ardourPalette.border}`,
  borderRadius: '12px',
  padding: '20px',
  boxShadow: ardourPalette.shadow,
});

export const emptyState = style({
  padding: '60px 20px',
  textAlign: 'center',
  backgroundColor: 'rgba(162, 86, 255, 0.08)',
  border: `2px dashed ${ardourPalette.border}`,
  borderRadius: '10px',
  color: ardourPalette.textMuted,
  fontSize: '1rem',
});

export const mixerPanel = style({
  marginTop: '24px',
  padding: '20px',
  backgroundColor: ardourPalette.surface,
  border: `1px dashed ${ardourPalette.border}`,
  borderRadius: '12px',
});

export const info = style({
  fontSize: '0.875rem',
  color: ardourPalette.textMuted,
});

export const dirtyIndicator = style({
  color: ardourPalette.critical,
  fontSize: '0.75rem',
  marginLeft: '4px',
});

export const undoRedoControls = style({
  display: 'flex',
  gap: '4px',
  alignItems: 'center',
});

export const undoButton = style({
  padding: '4px 12px',
  border: `1px solid ${ardourPalette.border}`,
  borderRadius: '8px',
  backgroundColor: ardourPalette.surface,
  color: ardourPalette.textSecondary,
  fontSize: '0.875rem',
  fontWeight: 500,
  cursor: 'pointer',
  transition: 'background-color 0.2s, color 0.2s',

  ':hover': {
    backgroundColor: ardourPalette.surfaceRaised,
    color: ardourPalette.textPrimary,
  },

  ':disabled': {
    opacity: 0.5,
    cursor: 'not-allowed',
  },
});

export const redoButton = style({
  padding: '4px 12px',
  border: `1px solid ${ardourPalette.border}`,
  borderRadius: '8px',
  backgroundColor: ardourPalette.surface,
  color: ardourPalette.textSecondary,
  fontSize: '0.875rem',
  fontWeight: 500,
  cursor: 'pointer',
  transition: 'background-color 0.2s, color 0.2s',

  ':hover': {
    backgroundColor: ardourPalette.surfaceRaised,
    color: ardourPalette.textPrimary,
  },

  ':disabled': {
    opacity: 0.5,
    cursor: 'not-allowed',
  },
});
