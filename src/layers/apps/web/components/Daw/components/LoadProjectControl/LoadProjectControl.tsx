import { useCallback, useEffect, useRef, useState } from 'react';
import { useCommandExecutor, useProjectCatalog } from '@/layers/apps/web/context/layer-hooks';
import {
  KeyboardShortcutAction,
  KEYBOARD_SHORTCUT_LABELS,
  useKeyboardShortcutAction,
} from '@/layers/apps/web/keyboard-shortcuts/keyboard-shortcuts';
import type { ProjectCatalogItem } from '@/layers/queries/project-catalog-query';
import { AudioCommandType } from '@/types/audioCommand.schema';
import * as styles from './LoadProjectControl.css';

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

interface LoadProjectControlProps {
  readonly onProjectLoaded?: () => void;
}

export function LoadProjectControl({ onProjectLoaded }: LoadProjectControlProps) {
  const commandExecutor = useCommandExecutor();
  const { listProjects } = useProjectCatalog();
  const isMountedRef = useRef(false);
  const latestListRequestRef = useRef(0);
  const isOpeningRef = useRef(false);
  const [projects, setProjects] = useState<readonly ProjectCatalogItem[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [isListing, setIsListing] = useState(true);
  const [isOpening, setIsOpening] = useState(false);
  const [isOpened, setIsOpened] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadProjects = useCallback(async () => {
    const requestId = latestListRequestRef.current + 1;
    latestListRequestRef.current = requestId;
    setIsListing(true);
    setErrorMessage(null);
    try {
      const listedProjects = await listProjects();
      if (!isMountedRef.current || latestListRequestRef.current !== requestId) {
        return;
      }
      setProjects(listedProjects);
      setSelectedProjectId(currentId => {
        const hasCurrentSelection = listedProjects.some(project => project.projectId === currentId);
        return hasCurrentSelection ? currentId : (listedProjects[0]?.projectId ?? '');
      });
    } catch (error) {
      if (isMountedRef.current && latestListRequestRef.current === requestId) {
        setErrorMessage(getErrorMessage(error));
      }
    } finally {
      if (isMountedRef.current && latestListRequestRef.current === requestId) {
        setIsListing(false);
      }
    }
  }, [listProjects]);

  useEffect(() => {
    isMountedRef.current = true;
    void loadProjects();
    return () => {
      isMountedRef.current = false;
      latestListRequestRef.current += 1;
    };
  }, [loadProjects]);

  const handleOpen = async () => {
    if (!selectedProjectId || isOpeningRef.current) {
      return;
    }

    isOpeningRef.current = true;
    setIsOpening(true);
    setIsOpened(false);
    setErrorMessage(null);
    try {
      await commandExecutor.execute({ type: AudioCommandType.LOAD_PROJECT, projectId: selectedProjectId });
      setIsOpened(true);
      onProjectLoaded?.();
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      isOpeningRef.current = false;
      setIsOpening(false);
    }
  };

  const hasProjects = projects.length > 0;
  const buttonText = isOpening ? '불러오는 중...' : '불러오기';

  useKeyboardShortcutAction(
    KeyboardShortcutAction.OPEN_PROJECT,
    () => {
      void handleOpen();
    },
    !isListing && !isOpening && Boolean(selectedProjectId)
  );
  useKeyboardShortcutAction(
    KeyboardShortcutAction.REFRESH_PROJECT_LIST,
    () => {
      void loadProjects();
    },
    !isListing && !isOpening
  );

  return (
    <div className={styles.container}>
      <select
        aria-label="프로젝트"
        className={styles.select}
        value={selectedProjectId}
        onChange={event => setSelectedProjectId(event.target.value)}
        disabled={isListing || isOpening || !hasProjects}
      >
        {!hasProjects ? <option value="">{isListing ? '프로젝트 찾는 중...' : '프로젝트 없음'}</option> : null}
        {projects.map(project => (
          <option key={project.projectId} value={project.projectId}>
            {project.name} {project.localRevision === null ? '(원격)' : `(r${project.localRevision})`}
          </option>
        ))}
      </select>
      <button
        className={styles.button}
        type="button"
        onClick={handleOpen}
        disabled={isListing || isOpening || !selectedProjectId}
        title={`불러오기 (${KEYBOARD_SHORTCUT_LABELS[KeyboardShortcutAction.OPEN_PROJECT]})`}
        aria-keyshortcuts="Control+O Meta+O"
      >
        {buttonText}
      </button>
      <button
        className={styles.button}
        type="button"
        onClick={() => void loadProjects()}
        disabled={isListing || isOpening}
        title={`목록 새로고침 (${KEYBOARD_SHORTCUT_LABELS[KeyboardShortcutAction.REFRESH_PROJECT_LIST]})`}
        aria-keyshortcuts="Control+Shift+O Meta+Shift+O"
      >
        {isListing ? '목록 읽는 중...' : '목록 새로고침'}
      </button>
      {isOpened ? (
        <span className={styles.status} role="status">
          프로젝트를 불러왔습니다.
        </span>
      ) : null}
      {errorMessage ? (
        <span className={styles.error} role="alert">
          불러오기 실패: {errorMessage}
        </span>
      ) : null}
    </div>
  );
}
