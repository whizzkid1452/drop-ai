import { useState, useCallback } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { usePlaybackStore } from '@/stores/usePlaybackStore';
import { useAudioCommand } from './useAudioCommand';
import { handleAudioEngineError } from './audioErrorHandler';
import { AudioCommandType } from '@/types/audioCommand.schema';
import { downloadBlob } from '@/components/Daw/components/ExportButton/utils/audioExport';

export interface UseProjectExportOptions {
  filename?: string;
  onSuccess?: () => void;
  onError?: (error: Error) => void;
}

/**
 * 프로젝트 Export를 담당하는 Hook
 * 
 * 역할:
 * - AudioEngine을 통해 프로젝트 렌더링
 * - 파일명 자동 생성
 * - Blob 다운로드 처리
 * - 진행 상태 및 에러 관리
 */
export function useProjectExport() {
  const { execute } = useAudioCommand();
  const { exportStartTime, exportEndTime } = usePlaybackStore(
    useShallow(state => ({
      exportStartTime: state.exportStartTime,
      exportEndTime: state.exportEndTime,
    }))
  );

  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const exportProject = useCallback(
    async (options?: UseProjectExportOptions) => {
      setIsExporting(true);
      setError(null);

      try {
        const result = await execute({ type: AudioCommandType.EXPORT_AUDIO });

        if (result instanceof Blob) {
          let filename: string;

          // 1. 커스텀 파일명
          if (options?.filename) {
            filename = options.filename;
          }
          // 2. Export range 기반 자동 생성
          else if (exportStartTime !== null && exportEndTime !== null) {
            filename = `export_${exportStartTime}-${exportEndTime}s`;
          }
          // 3. 기본 파일명
          else {
            filename = 'export';
          }

          // 다운로드 처리 (이 Hook이 "Export 행위" 전반을 담당하므로 여기서 수행)
          downloadBlob(result, `${filename}.wav`);
        }

        setIsExporting(false);
        options?.onSuccess?.();
      } catch (err) {
        const errorObj = err instanceof Error ? err : new Error('Export failed');
        setError(errorObj);
        setIsExporting(false);
        options?.onError?.(errorObj);
        
        // 공통 에러 핸들의 호출 (선택 사항 - 호출자가 처리할 수도 있음)
        handleAudioEngineError(errorObj);
      }
    },
    [execute, exportStartTime, exportEndTime]
  );

  return {
    exportProject,
    isExporting,
    error,
  };
}
