import { useState, useCallback } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { usePlaybackStore } from '@/stores/usePlaybackStore';
import { useAudio } from '@/presentation/hooks/useAudio';
import { handleAudioEngineError } from './audioErrorHandler';
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
  const { exportStartTime, exportEndTime } = usePlaybackStore(
    useShallow(state => ({
      exportStartTime: state.exportStartTime,
      exportEndTime: state.exportEndTime,
    }))
  );

  const { tracks } = useAudio();
  // tracks is already an array from useAudio snapshot

  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const exportProject = useCallback(
    async (options?: UseProjectExportOptions) => {
      setIsExporting(true);
      setError(null);

      try {
        // 엔진을 거치지 않고 직접 렌더링 로직 호출
        // 옵션으로 전달된 range가 있으면 우선 사용 (Agent 명령 처리용)
        const range = options?.range ?? ((exportStartTime !== null && exportEndTime !== null)
          ? { startTime: exportStartTime, endTime: exportEndTime }
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
        handleAudioEngineError(errorObj);
      }
    },
    [tracks, exportStartTime, exportEndTime]
  );

  return {
    exportProject,
    isExporting,
    error,
  };
}

