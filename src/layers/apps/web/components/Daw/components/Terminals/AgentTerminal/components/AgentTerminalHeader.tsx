import * as styles from '../ChatModalTerminal.css.ts';

interface AgentTerminalHeaderProps {
  onReset: () => void;
  onPurgeCache: () => void;
}

export function AgentTerminalHeader({ onReset, onPurgeCache }: AgentTerminalHeaderProps) {
  return (
    <header className={styles.header}>
      <div className={styles.headerTitle}>
        <span className="material-symbols-outlined" style={{ color: styles.primaryColor, fontSize: '16px' }}>
          terminal
        </span>
        <h1 className={styles.headerTitleText}>
          AI Agent Terminal v2.0 <span className={styles.headerSubtitle}>Focus View</span>
        </h1>
      </div>
      <div className={styles.headerActions}>
        <button className={styles.headerButton} onClick={onReset} type="button" aria-label="Reset engine">
          <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>
            rotate_left
          </span>
        </button>
        <button className={styles.headerButton} onClick={onPurgeCache} type="button" aria-label="Purge cache">
          <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>
            delete_sweep
          </span>
        </button>
      </div>
    </header>
  );
}
