import { useState, useEffect, useCallback } from 'react';
import { Session, Track } from '../core/audio';

/**
 * Session 관리 훅
 * Session 초기화, 이벤트 리스너, 상태 동기화를 담당
 */
export function useSession(initialBpm: number = 120) {
  const [session] = useState(() => new Session({ bpm: initialBpm }));
  const [tracks, setTracks] = useState<Track[]>([]);
  const [sessionName, setSessionName] = useState('Untitled Session');
  const [bpm, setBpm] = useState(initialBpm);
  const [isDirty, setIsDirty] = useState(false);

  // Session 초기화 및 이벤트 리스너 설정
  useEffect(() => {
    // 세션 이름 동기화
    setSessionName(session.getName());
    setBpm(session.getBPM());

    // 트랙 목록 동기화
    setTracks([...session.getTracks()]);

    // Session 이벤트 리스너 등록
    const handleTrackAdded = () => {
      setTracks([...session.getTracks()]);
      setIsDirty(session.isDirty());
    };

    const handleTrackRemoved = () => {
      setTracks([...session.getTracks()]);
      setIsDirty(session.isDirty());
    };

    const handleDirtyChanged = () => {
      setIsDirty(session.isDirty());
    };

    session.addEventListener('track-added', handleTrackAdded);
    session.addEventListener('track-removed', handleTrackRemoved);
    session.addEventListener('dirty-changed', handleDirtyChanged);

    return () => {
      session.removeEventListener('track-added', handleTrackAdded);
      session.removeEventListener('track-removed', handleTrackRemoved);
      session.removeEventListener('dirty-changed', handleDirtyChanged);
    };
  }, [session]);

  const handleBPMChange = useCallback(
    (newBpm: number) => {
      setBpm(newBpm);
      session.setBPM(newBpm);
    },
    [session]
  );

  const handleSessionNameChange = useCallback(
    (newName: string) => {
      setSessionName(newName);
      session.setName(newName);
    },
    [session]
  );

  const handleUndo = useCallback(() => {
    if (session.canUndo()) {
      session.undo();
      setIsDirty(session.isDirty());
      setTracks([...session.getTracks()]);
    }
  }, [session]);

  const handleRedo = useCallback(() => {
    if (session.canRedo()) {
      session.redo();
      setIsDirty(session.isDirty());
      setTracks([...session.getTracks()]);
    }
  }, [session]);

  return {
    session,
    tracks,
    sessionName,
    bpm,
    isDirty,
    handleBPMChange,
    handleSessionNameChange,
    handleUndo,
    handleRedo,
    canUndo: session.canUndo(),
    canRedo: session.canRedo(),
  };
}

