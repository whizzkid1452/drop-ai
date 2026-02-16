import * as styles from '../ChatModalTerminal.css';

interface CommandComposerProps {
  input: string;
  isModelReady: boolean;
  isGenerating: boolean;
  onInputChange: (value: string) => void;
  onSend: () => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
}

export function CommandComposer({
  input,
  isModelReady,
  isGenerating,
  onInputChange,
  onSend,
  onKeyDown,
}: CommandComposerProps) {
  return (
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
              onChange={e => onInputChange(e.target.value)}
              onKeyDown={onKeyDown}
            />
          </div>
        </div>
        <button
          className={styles.executeButton}
          onClick={onSend}
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
          <div className={`${styles.indicator} ${styles.activeIndicator}`} />
        </div>
      </div>
    </div>
  );
}
