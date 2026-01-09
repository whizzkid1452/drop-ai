import * as styles from '../AgentInterface.css';

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

