import { useState, useCallback } from 'react';
import { usePlaybackStore } from '@/stores/usePlaybackStore';
import { useAudio } from '@/presentation/hooks/useAudio';
import { downloadBlob } from '@/components/Daw/components/ExportButton/utils/audioExport';
import { exportProject as renderProject } from './exportProject';

export interface UseProjectExportOptions {
  filename?: string;
  range?: { startTime: number; endTime: number };
  onSuccess?: () => void;
  onError?: (error: Error) => void;
}

/**
 * 프로젝트 Export를 담당하는 Hook
 * 
 * 역할:
 * - 스토어데이터(Tracks, Range) 기반 프로젝트 렌더링 실행
 * - 파일명 자동 생성
 * - Blob 다운로드 처리
 * - 진행 상태 및 에러 관리
 */
export function useProjectExport() {
  const { tracks } = useAudio();
  // tracks is already an array from useAudio snapshot

  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const exportProject = useCallback(
    async (options?: UseProjectExportOptions) => {
      setIsExporting(true);
      setError(null);

      try {
        // 🔧 항상 최신 export range를 읽기 위해 함수 내부에서 store를 직접 읽음
        // 이렇게 하면 SET_EXPORT_RANGE 명령 이후 EXPORT_AUDIO가 실행될 때
        // 업데이트된 range 값을 확실히 사용할 수 있습니다
        const currentExportStartTime = usePlaybackStore.getState().exportStartTime;
        const currentExportEndTime = usePlaybackStore.getState().exportEndTime;

        // 엔진을 거치지 않고 직접 렌더링 로직 호출
        // 옵션으로 전달된 range가 있으면 우선 사용 (Agent 명령 처리용)
        const range = options?.range ?? ((currentExportStartTime !== null && currentExportEndTime !== null)
          ? { startTime: currentExportStartTime, endTime: currentExportEndTime }
          : undefined);

        const result = await renderProject(tracks, range);

        if (result instanceof Blob) {
          let filename: string;

          if (options?.filename) {
            filename = options.filename;
          } else if (range) {
            filename = `export_${range.startTime}-${range.endTime}s`;
          } else {
            filename = 'export';
          }

          downloadBlob(result, `${filename}.wav`);
        }

        setIsExporting(false);
        options?.onSuccess?.();
      } catch (err) {
        const errorObj = err instanceof Error ? err : new Error('Export failed');
        setError(errorObj);
        setIsExporting(false);
        options?.onError?.(errorObj);
        throw errorObj;
      }
    },
    [tracks]
  );

  return {
    exportProject,
    isExporting,
    error,
  };
}

