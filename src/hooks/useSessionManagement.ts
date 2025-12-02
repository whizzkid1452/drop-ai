import { useState, useCallback } from 'react';
import { Session } from '../core/audio';
import { getSessionSerializer } from '../core/utils/sessionSerializer';

export interface SavedSession {
  id: string;
  name: string;
  modifiedAt: string;
}

/**
 * 세션 저장/로드 관리 훅
 */
export function useSessionManagement(session: Session) {
  const [savedSessions, setSavedSessions] = useState<SavedSession[]>([]);
  const [showSessionList, setShowSessionList] = useState(false);
  const [isLoadingSessions, setIsLoadingSessions] = useState(false);
  const [sessionListError, setSessionListError] = useState<string | null>(null);

  const loadSavedSessions = useCallback(async () => {
    try {
      setSessionListError(null);
      setIsLoadingSessions(true);
      const serializer = getSessionSerializer();
      await serializer.init();
      const sessions = await serializer.listSessions();
      setSavedSessions(sessions);
    } catch (error) {
      setSessionListError(
        error instanceof Error
          ? error.message
          : '세션 목록을 불러오지 못했습니다.'
      );
    } finally {
      setIsLoadingSessions(false);
    }
  }, []);

  const handleToggleSessionList = useCallback(async () => {
    if (!showSessionList) {
      await loadSavedSessions();
    }
    setShowSessionList(prev => !prev);
  }, [showSessionList, loadSavedSessions]);

  const handleSessionSave = useCallback(async () => {
    try {
      const sessionId = await session.save();
      await loadSavedSessions();
      return sessionId;
    } catch (error) {
      throw error;
    }
  }, [session, loadSavedSessions]);

  const handleSessionLoad = useCallback(
    async (sessionId: string) => {
      try {
        await session.load(sessionId);
        await loadSavedSessions();
      } catch (error) {
        throw error;
      }
    },
    [session, loadSavedSessions]
  );

  const handleSessionLoadFromList = useCallback(
    async (sessionId: string) => {
      try {
        await handleSessionLoad(sessionId);
        setShowSessionList(false);
      } catch (error) {
        throw error;
      }
    },
    [handleSessionLoad]
  );

  return {
    savedSessions,
    showSessionList,
    isLoadingSessions,
    sessionListError,
    loadSavedSessions,
    handleToggleSessionList,
    handleSessionSave,
    handleSessionLoad,
    handleSessionLoadFromList,
    setShowSessionList,
  };
}

