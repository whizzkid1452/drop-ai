import * as styles from '../AgentTerminal/AgentTerminal.css';

interface ActionButtonsProps {
    isGenerating: boolean;
    onReset: () => void;
    onPurgeCache: () => void;
}

export function ActionButtons({ isGenerating, onReset, onPurgeCache }: ActionButtonsProps) {
    return (
        <div className={styles.headerActions}>
            {isGenerating && (
                <div className={styles.generatingStatus}>Thinking...</div>
            )}
            <button onClick={onReset} className={styles.actionButton}>
                Reset Engine
            </button>
            <button onClick={onPurgeCache} className={`${styles.actionButton} ${styles.dangerButton}`}>
                Purge Cache
            </button>
        </div>
    );
}

