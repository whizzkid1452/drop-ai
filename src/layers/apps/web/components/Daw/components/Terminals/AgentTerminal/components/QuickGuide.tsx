import * as styles from '../ChatModalTerminal.css.ts';
import { QUICK_GUIDE_ITEMS } from '../constants';

interface QuickGuideProps {
  isModelReady: boolean;
  onSuggestionClick: (command: string) => void;
}

export function QuickGuide({ isModelReady, onSuggestionClick }: QuickGuideProps) {
  return (
    <div className={styles.quickGuideBox}>
      <div className={styles.quickGuideHeader}>
        <span className="material-symbols-outlined" style={{ fontSize: '14px', color: '#888' }} aria-hidden>
          info
        </span>
        <h3 className={styles.quickGuideTitle}>Quick Guide</h3>
      </div>
      <p className={styles.quickGuideDescription}>Click a command below to fill the input, then press Enter to run.</p>
      <div className={styles.quickGuideChips}>
        {QUICK_GUIDE_ITEMS.map(({ label, value }) => (
          <button
            key={value}
            type="button"
            className={styles.quickGuideChip}
            onClick={() => onSuggestionClick(value)}
            disabled={!isModelReady}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
