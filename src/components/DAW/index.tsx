import { useState } from 'react';
import { FileUpload } from './FileUpload/FileUpload';
import { FileLibrary } from './FileLibrary/FileLibrary';
import { TrackTimeline } from './TrackTimeline/TrackTimeline';
import { TransportBar } from './Transport/TransportBar';
import { SessionListPanel } from './SessionListPanel/SessionListPanel';
import * as styles from './DAW.css';
import { useSession } from '../../hooks/useSession';
import { useTransport } from '../../hooks/useTransport';
import { useSessionManagement } from '../../hooks/useSessionManagement';
import { useFileManagement } from '../../hooks/useFileManagement';
import { useTrackManagement } from '../../hooks/useTrackManagement';

/**
 * DAW 컴포넌트
 * Ardour 스타일의 웹 기반 DAW UI
 * Session 클래스를 통해 모든 오디오 리소스 관리
 */
export function Daw() {
  const [showFileLibrary, setShowFileLibrary] = useState(false);

  // 커스텀 훅으로 로직 분리
  const {
    session,
    tracks,
    sessionName,
    bpm,
    isDirty,
    handleBPMChange,
    handleSessionNameChange,
    handleUndo,
    handleRedo,
    canUndo,
    canRedo,
  } = useSession(120);

  const engine = session.getAudioEngine();

  const {
    isPlaying,
    metronomeEnabled,
    handlePlayPause,
    handleStop,
    handleMetronomeToggle,
  } = useTransport(engine);

  const {
    savedSessions,
    showSessionList,
    isLoadingSessions,
    sessionListError,
    loadSavedSessions,
    handleToggleSessionList,
    handleSessionSave,
    handleSessionLoad,
    handleSessionLoadFromList,
  } = useSessionManagement(session);

  const { uploadedFiles, handleFileAdd, handleFileDelete, setUploadedFiles } =
    useFileManagement(session, isPlaying);

  const {
    handleTrackVolumeChange,
    handleTrackMute,
    handleTrackSolo,
    handleTrackPanChange,
    handleTrackDelete,
  } = useTrackManagement(session, setUploadedFiles);

  // 세션 로드 후 이름 업데이트를 위한 핸들러 래퍼
  const handleSessionLoadWithUpdate = async () => {
    const sessionId = prompt('불러올 세션 ID를 입력하세요:');
    if (!sessionId) return;
    await handleSessionLoad(sessionId);
  };

  return (
    <div className={styles.container}>
      <TransportBar
        engine={engine}
        isPlaying={isPlaying}
        bpm={bpm}
        metronomeEnabled={metronomeEnabled}
        isDirty={isDirty}
        tracksCount={tracks.length}
        filesCount={uploadedFiles.length}
        canUndo={canUndo}
        canRedo={canRedo}
        showFileLibrary={showFileLibrary}
        sessionName={sessionName}
        onPlayPause={handlePlayPause}
        onStop={handleStop}
        onBPMChange={handleBPMChange}
        onMetronomeToggle={handleMetronomeToggle}
        onUndo={handleUndo}
        onRedo={handleRedo}
        onToggleFileLibrary={() => setShowFileLibrary(!showFileLibrary)}
        onSessionNameChange={handleSessionNameChange}
        onSessionSave={async () => {
          await handleSessionSave();
        }}
        onSessionLoad={handleSessionLoadWithUpdate}
        onToggleSessionList={() => void handleToggleSessionList()}
      />

      {showSessionList && (
        <SessionListPanel
          savedSessions={savedSessions}
          isLoadingSessions={isLoadingSessions}
          sessionListError={sessionListError}
          onLoadSession={async (sessionId: string) => {
            try {
              await handleSessionLoadFromList(sessionId);
              alert('세션이 불러와졌습니다.');
            } catch (error) {
              console.error('세션 로드 실패:', error);
              alert(
                `세션 로드 실패: ${error instanceof Error ? error.message : '알 수 없는 오류'}`
              );
            }
          }}
          onRefresh={async () => {
            await loadSavedSessions();
          }}
        />
      )}

      {/* File Upload & Library */}
      <div className={styles.fileSection}>
        <FileUpload onFileAdd={handleFileAdd} />
        {showFileLibrary && uploadedFiles.length > 0 && (
          <FileLibrary files={uploadedFiles} onDeleteFile={handleFileDelete} />
        )}
      </div>

      {/* Track List + Timeline 통합 */}
      {tracks.length > 0 ? (
        <TrackTimeline
          engine={engine}
          tracks={tracks}
          isPlaying={isPlaying}
          onTrackVolumeChange={handleTrackVolumeChange}
          onTrackMute={handleTrackMute}
          onTrackSolo={handleTrackSolo}
          onTrackPanChange={handleTrackPanChange}
          onTrackDelete={handleTrackDelete}
        />
      ) : (
        <div className={styles.emptyState}>
          <p>트랙이 없습니다. 파일을 업로드하여 시작하세요.</p>
        </div>
      )}

      {/* 미구현: 믹서 패널 */}
      {/* {showMixer && (
        <div className={styles.mixerPanel}>
          <h3>믹서</h3>
          <p>믹서 패널은 아직 구현되지 않았습니다.</p>
        </div>
      )} */}
    </div>
  );
}
