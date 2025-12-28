import { style } from "@vanilla-extract/css";

export const chatContainer = style({
  display: "flex",
  flexDirection: "column",
  height: "100%",
  backgroundColor: "#1a1a1a",
  borderRadius: "8px",
  overflow: "hidden",
});

export const chatHeader = style({
  padding: "16px",
  borderBottom: "1px solid #333",
  backgroundColor: "#222",
});

export const chatTitle = style({
  margin: 0,
  fontSize: "18px",
  fontWeight: "600",
  color: "#fff",
});

export const loadingContainer = style({
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  flex: 1,
  padding: "32px",
  gap: "16px",
});

export const loadingText = style({
  color: "#aaa",
  fontSize: "14px",
  textAlign: "center",
});

export const progressBar = style({
  width: "100%",
  maxWidth: "300px",
  height: "8px",
  backgroundColor: "#333",
  borderRadius: "4px",
  overflow: "hidden",
});

export const progressFill = style({
  height: "100%",
  backgroundColor: "#4CAF50",
  transition: "width 0.3s ease",
});

export const messagesContainer = style({
  flex: 1,
  overflowY: "auto",
  padding: "16px",
  display: "flex",
  flexDirection: "column",
  gap: "12px",
});

export const messageWrapper = style({
  display: "flex",
  flexDirection: "column",
  gap: "4px",
});

export const messageUser = style({
  alignSelf: "flex-end",
  maxWidth: "70%",
});

export const messageAssistant = style({
  alignSelf: "flex-start",
  maxWidth: "70%",
});

export const messageBubble = style({
  padding: "12px 16px",
  borderRadius: "12px",
  fontSize: "14px",
  lineHeight: "1.5",
  wordBreak: "break-word",
});

export const userBubble = style({
  backgroundColor: "#2196F3",
  color: "#fff",
});

export const assistantBubble = style({
  backgroundColor: "#333",
  color: "#fff",
});

export const messageTimestamp = style({
  fontSize: "11px",
  color: "#888",
  paddingLeft: "8px",
  paddingRight: "8px",
});

export const toolCallsContainer = style({
  marginTop: "8px",
  padding: "8px",
  backgroundColor: "#2a2a2a",
  borderRadius: "6px",
  fontSize: "12px",
});

export const toolCallItem = style({
  padding: "4px 0",
  color: "#4CAF50",
  fontFamily: "monospace",
});

export const inputContainer = style({
  padding: "16px",
  borderTop: "1px solid #333",
  backgroundColor: "#222",
  display: "flex",
  gap: "8px",
});

export const input = style({
  flex: 1,
  padding: "12px 16px",
  backgroundColor: "#333",
  border: "1px solid #444",
  borderRadius: "8px",
  color: "#fff",
  fontSize: "14px",
  outline: "none",
  ":focus": {
    borderColor: "#2196F3",
  },
  "::placeholder": {
    color: "#888",
  },
});

export const sendButton = style({
  padding: "12px 24px",
  backgroundColor: "#2196F3",
  color: "#fff",
  border: "none",
  borderRadius: "8px",
  fontSize: "14px",
  fontWeight: "600",
  cursor: "pointer",
  transition: "background-color 0.2s",
  ":hover": {
    backgroundColor: "#1976D2",
  },
  ":disabled": {
    backgroundColor: "#555",
    cursor: "not-allowed",
  },
});

export const initButton = style({
  padding: "12px 24px",
  backgroundColor: "#4CAF50",
  color: "#fff",
  border: "none",
  borderRadius: "8px",
  fontSize: "16px",
  fontWeight: "600",
  cursor: "pointer",
  transition: "background-color 0.2s",
  ":hover": {
    backgroundColor: "#45a049",
  },
  ":disabled": {
    backgroundColor: "#555",
    cursor: "not-allowed",
  },
});

export const errorContainer = style({
  padding: "12px 16px",
  backgroundColor: "#d32f2f",
  color: "#fff",
  borderRadius: "8px",
  fontSize: "14px",
  marginBottom: "12px",
});

export const errorCloseButton = style({
  float: "right",
  background: "none",
  border: "none",
  color: "#fff",
  fontSize: "18px",
  cursor: "pointer",
  padding: "0 8px",
});

