import * as styles from '../DawPage.css';
import { ExportButton } from './ExportButton/ExportButton';

interface DawHeaderProps {
  trackCount: number;
}

export function DawHeader({ trackCount }: DawHeaderProps) {
  return (
    <div className={styles.header}>
      <h1 className={styles.title}>트랙 목록</h1>
      <div className={styles.headerRight}>
        <span className={styles.trackCount}>{trackCount}개 트랙</span>
        {/* @todo: 추후 추가 예정 */}
        <ExportButton />
      </div>
    </div>
  );
}
