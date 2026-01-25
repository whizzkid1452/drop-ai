import * as styles from '../AgentTerminal/AgentTerminal.css.ts';

interface LoadingOverlayProps {
    text: string;
    progress: number;
}

export function LoadingOverlay({ text, progress }: LoadingOverlayProps) {
    return (
        <div className={styles.loadingOverlay}>
            <div>{text}</div>
            <div className={styles.progressBarContainer}>
                <div
                    className={styles.progressBarFill}
                    style={{ width: `${progress * 100}%` }}
                />
            </div>
        </div>
    );
}

