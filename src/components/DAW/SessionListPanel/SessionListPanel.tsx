import * as styles from '../DAW.css';
import type { SavedSession } from '../../../hooks/useSessionManagement';

interface SessionListPanelProps {
  savedSessions: SavedSession[];
  isLoadingSessions: boolean;
  sessionListError: string | null;
  onLoadSession: (sessionId: string) => Promise<void>;
  onRefresh: () => Promise<void>;
}

/**
 * 세션 목록 패널 컴포넌트
 */
export function SessionListPanel({
  savedSessions,
  isLoadingSessions,
  sessionListError,
  onLoadSession,
  onRefresh,
}: SessionListPanelProps) {
  return (
    <div className={styles.sessionListPanel}>
      <div className={styles.sessionListHeader}>
        <span>저장된 세션</span>
        <div className={styles.sessionListActions}>
          {isLoadingSessions && <span>불러오는 중...</span>}
          <button
            className={styles.sessionButton}
            onClick={() => void onRefresh()}
            disabled={isLoadingSessions}
            title="새로고침"
          >
            ↻ 새로고침
          </button>
        </div>
      </div>
      {sessionListError && (
        <div className={styles.sessionListError}>⚠️ {sessionListError}</div>
      )}
      {savedSessions.length === 0 && !sessionListError ? (
        <div className={styles.sessionListEmpty}>
          저장된 세션이 없습니다.
        </div>
      ) : (
        <div className={styles.sessionList}>
          {savedSessions.map(saved => (
            <div key={saved.id} className={styles.sessionListItem}>
              <div className={styles.sessionListInfo}>
                <span className={styles.sessionListName}>
                  {saved.name || '제목 없음'}
                </span>
                <span className={styles.sessionListMeta}>
                  {new Date(saved.modifiedAt).toLocaleString()} · {saved.id}
                </span>
              </div>
              <button
                className={styles.sessionButton}
                onClick={() => void onLoadSession(saved.id)}
              >
                불러오기
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

