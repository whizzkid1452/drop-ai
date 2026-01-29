import { useAgent } from '@/hooks/agent/useAgent/useAgent';
import { useWebLLM } from '@/hooks/agent/useWebLLM';
import { useAgentStore } from '@/stores/useAgentStore';
import { useState, useRef, useEffect } from 'react';
import * as styles from './ChatModalTerminal.css';

export function AgentTerminal() {
  const [input, setInput] = useState('');
  const isModelReady = useAgentStore(state => state.isModelReady);
  const modelLoadingProgress = useAgentStore(
    state => state.modelLoadingProgress
  );
  const modelLoadingText = useAgentStore(state => state.modelLoadingText);

  const { sendMessage, messages, status } = useAgent();
  const { resetEngine, purgeCache } = useWebLLM();

  const isGenerating = status === 'generating';
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, status]);

  const handleSend = () => {
    if (!input.trim() || isGenerating || !isModelReady) return;

    sendMessage(input.trim());
    setInput('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleReset = () => {
    resetEngine(false);
  };

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div className={styles.headerTitle}>
          <span
            className="material-symbols-outlined"
            style={{ color: styles.primaryColor, fontSize: '16px' }}
          >
            terminal
          </span>
          <h1 className={styles.headerTitleText}>
            AI Agent Terminal v2.0{' '}
            <span className={styles.headerSubtitle}>Focus View</span>
          </h1>
        </div>
        <div className={styles.headerActions}>
          <button
            className={styles.headerButton}
            onClick={handleReset}
            type="button"
          >
            <span
              className="material-symbols-outlined"
              style={{ fontSize: '14px' }}
            >
              rotate_left
            </span>
          </button>
          <button
            className={styles.headerButton}
            onClick={purgeCache}
            type="button"
          >
            <span
              className="material-symbols-outlined"
              style={{ fontSize: '14px' }}
            >
              delete_sweep
            </span>
          </button>
        </div>
      </header>

      {!isModelReady && (
        <div className={styles.loadingArea}>
          <div className={styles.progressBarContainer}>
            <div
              className={styles.progressBar}
              style={{ width: `${modelLoadingProgress}%` }}
            />
          </div>
          <div className={styles.statusStrip}>
            <div className={styles.statusInfo}>
              <span className={styles.statusText}>
                {modelLoadingText.toUpperCase()}...
              </span>
              <span className={styles.statusLabel}>MODEL: LLAMA-3-OPTIMIZED</span>
            </div>
            <span className={styles.statusText}>{modelLoadingProgress}%</span>
          </div>
        </div>
      )}

      <div className={styles.terminalBody} ref={scrollRef}>
        <div className={styles.gridBackground} />

        <div className={styles.messageGroup}>
          {messages.map((msg, i) => (
            <div key={msg.id ?? i} className={styles.messageRow}>
              <div
                className={`${styles.avatar} ${msg.role === 'assistant' ? styles.aiAvatar : ''}`}
              >
                <span
                  className="material-symbols-outlined"
                  style={{
                    fontSize: '16px',
                    color:
                      msg.role === 'assistant' ? styles.primaryColor : '#888',
                  }}
                >
                  {msg.role === 'assistant' ? 'smart_toy' : 'person'}
                </span>
              </div>
              <div className={styles.messageContent}>
                <div className={styles.messageHeader}>
                  <span
                    className={`${styles.senderName} ${msg.role === 'assistant' ? styles.aiSenderName : ''}`}
                  >
                    {msg.role === 'assistant' ? 'AI AGENT' : 'USER'}
                  </span>
                  <span className={styles.timestamp}>
                    {new Date().toLocaleTimeString([], { hour12: false })}
                  </span>
                </div>
                <div
                  className={`${styles.bubble} ${msg.role === 'assistant' ? styles.aiBubble : ''}`}
                >
                  {msg.content}
                </div>
              </div>
            </div>
          ))}

          {isGenerating && (
            <div className={styles.systemMessage}>
              <div className={styles.systemInfo}>
                <span
                  className={`material-symbols-outlined ${styles.spinning}`}
                  style={{ fontSize: '14px' }}
                >
                  sync
                </span>
                <span className={styles.systemText}>PROCESSING COMMAND...</span>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className={styles.composer}>
        <div className={styles.composerRow}>
          <div className={styles.inputWrapper}>
            <div className={`${styles.cornerMarker} ${styles.topLeft}`} />
            <div className={`${styles.cornerMarker} ${styles.bottomRight}`} />
            <span className={styles.promptSymbol}>❯</span>
            <div style={{ display: 'flex', flex: 1, minWidth: 0 }}>
              <input
                className={styles.inputField}
                placeholder="Enter command or parameter..."
                type="text"
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
              />
            </div>
          </div>
          <button
            className={styles.executeButton}
            onClick={handleSend}
            disabled={!isModelReady || isGenerating}
            type="button"
          >
            EXECUTE
            <span
              className="material-symbols-outlined"
              style={{ fontSize: '14px' }}
            >
              keyboard_return
            </span>
          </button>
        </div>

        <div className={styles.footer}>
          <div className={styles.footerStats}>
            <span className={styles.statItem}>CPU: 12%</span>
            <span className={styles.statItem}>RAM: 4.2GB</span>
            <span className={styles.statItem}>Latency: 12ms</span>
          </div>
          <div className={styles.statusIndicators}>
            <div className={styles.indicator} />
            <div className={styles.indicator} />
            <div
              className={`${styles.indicator} ${styles.activeIndicator}`}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
