import * as styles from '../DAW.css';
import { TransportPositionDisplay } from './TransportPositionDisplay';
import type { AudioEngine } from '../../../core/audio';

interface TransportBarProps {
  engine: AudioEngine;
  isPlaying: boolean;
  bpm: number;
  metronomeEnabled: boolean;
  isDirty: boolean;
  tracksCount: number;
  filesCount: number;
  canUndo: boolean;
  canRedo: boolean;
  showFileLibrary: boolean;
  sessionName: string;
  onPlayPause: () => void;
  onStop: () => void;
  onBPMChange: (bpm: number) => void;
  onMetronomeToggle: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onToggleFileLibrary: () => void;
  onSessionNameChange: (name: string) => void;
  onSessionSave: () => Promise<void>;
  onSessionLoad: () => Promise<void>;
  onToggleSessionList: () => void;
}

/**
 * Transport Bar 컴포넌트
 * 재생 컨트롤, BPM, 메트로놈, 세션 관리 UI를 포함
 */
export function TransportBar({
  engine,
  isPlaying,
  bpm,
  metronomeEnabled,
  isDirty,
  tracksCount,
  filesCount,
  canUndo,
  canRedo,
  showFileLibrary,
  sessionName,
  onPlayPause,
  onStop,
  onBPMChange,
  onMetronomeToggle,
  onUndo,
  onRedo,
  onToggleFileLibrary,
  onSessionNameChange,
  onSessionSave,
  onSessionLoad,
  onToggleSessionList,
}: TransportBarProps) {
  return (
    <div className={styles.transportBar}>
      <div className={styles.transportControls}>
        <button
          onClick={onPlayPause}
          className={`${styles.playButton} ${isPlaying ? styles.pauseButton : styles.playButtonActive}`}
          title={isPlaying ? '일시정지' : '재생'}
        >
          {isPlaying ? '⏸' : '▶'}
        </button>
        <button
          onClick={onStop}
          className={`${styles.playButton} ${styles.stopButton}`}
          title="정지"
        >
          ⏹
        </button>

        <TransportPositionDisplay
          engine={engine}
          bpm={bpm}
          isPlaying={isPlaying}
        />
      </div>

      <div className={styles.transportSettings}>
        <label className={styles.bpmControl}>
          <span>BPM:</span>
          <input
            type="number"
            value={bpm}
            onChange={e => onBPMChange(Number(e.target.value))}
            min={30}
            max={300}
            className={styles.bpmInput}
          />
        </label>

        <button
          onClick={onMetronomeToggle}
          className={`${styles.metronomeButton} ${metronomeEnabled ? styles.metronomeActive : ''}`}
          title={metronomeEnabled ? '메트로놈 끄기' : '메트로놈 켜기'}
        >
          🥁 {metronomeEnabled ? 'ON' : 'OFF'}
        </button>
      </div>

      <div className={styles.transportInfo}>
        <div className={styles.info}>
          트랙: {tracksCount} | 파일: {filesCount}
          {isDirty && <span className={styles.dirtyIndicator}> ●</span>}
        </div>

        <div className={styles.undoRedoControls}>
          <button
            onClick={onUndo}
            disabled={!canUndo}
            className={styles.undoButton}
            title="실행 취소 (Ctrl+Z)"
          >
            ↶ Undo
          </button>
          <button
            onClick={onRedo}
            disabled={!canRedo}
            className={styles.redoButton}
            title="다시 실행 (Ctrl+Shift+Z)"
          >
            ↷ Redo
          </button>
        </div>

        <button
          onClick={onToggleFileLibrary}
          className={styles.toggleButton}
          title="파일 라이브러리 토글"
        >
          {showFileLibrary ? '📁' : '📂'} 라이브러리
        </button>

        <div className={styles.sessionControls}>
          <input
            type="text"
            value={sessionName}
            onChange={e => onSessionNameChange(e.target.value)}
            className={styles.sessionNameInput}
            placeholder="세션 이름"
            title="세션 이름"
          />
          <button
            onClick={async () => {
              try {
                await onSessionSave();
                alert('세션이 저장되었습니다.');
              } catch (error) {
                console.error('세션 저장 실패:', error);
                alert(
                  `세션 저장 실패: ${error instanceof Error ? error.message : '알 수 없는 오류'}`
                );
              }
            }}
            className={styles.sessionButton}
            title="세션 저장"
          >
            💾 저장
          </button>
          <button
            onClick={async () => {
              const sessionId = prompt('불러올 세션 ID를 입력하세요:');
              if (!sessionId) return;

              try {
                await onSessionLoad();
                alert('세션이 불러와졌습니다.');
              } catch (error) {
                console.error('세션 로드 실패:', error);
                alert(
                  `세션 로드 실패: ${error instanceof Error ? error.message : '알 수 없는 오류'}`
                );
              }
            }}
            className={styles.sessionButton}
            title="세션 불러오기"
          >
            📂 불러오기
          </button>
          <button
            onClick={onToggleSessionList}
            className={styles.sessionButton}
            title="저장된 세션 목록 보기"
          >
            📋 목록
          </button>
        </div>
      </div>
    </div>
  );
}

