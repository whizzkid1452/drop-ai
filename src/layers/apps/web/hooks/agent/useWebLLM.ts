import { useCallback, useEffect } from 'react';
import { useSession } from '@/layers/apps/web/context/layer-hooks';
import {
  disposeWebLLM,
  getWebLLMEngine,
  initializeWebLLM,
  interruptWebLLMGeneration,
  purgeWebLLMCache,
} from '@/layers/apps/web/hooks/agent/web-llm-engine';

export function useWebLLM() {
  const setModelStatus = useSession(state => state.setAgentModelStatus);
  const setLoadingProgress = useSession(state => state.setAgentLoadingProgress);

  const initializeModel = useCallback(async () => {
    setModelStatus('loading');
    setLoadingProgress(0, 'Preparing AI model');

    try {
      await initializeWebLLM({
        onProgress: report => {
          setLoadingProgress(report.progress, report.text);
        },
      });
      setLoadingProgress(1, 'Model ready');
      setModelStatus('ready');
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown model loading error';
      console.error('Failed to initialize WebLLM:', error);
      setLoadingProgress(0, errorMessage);
      setModelStatus('error');
    }
  }, [setLoadingProgress, setModelStatus]);

  useEffect(() => {
    void initializeModel();
  }, [initializeModel]);

  const purgeCache = async () => {
    try {
      await disposeWebLLM();
      await purgeWebLLMCache();
      setModelStatus('loading');
      window.location.reload();
    } catch (error: unknown) {
      console.error('Failed to purge cache:', error);
    }
  };

  const resetEngine = async (purge: boolean = false) => {
    if (purge) {
      await purgeCache();
      return;
    }

    await disposeWebLLM();
    setModelStatus('loading');
    window.location.reload();
  };

  return {
    engine: getWebLLMEngine(),
    interruptGeneration: interruptWebLLMGeneration,
    retryInitialization: initializeModel,
    resetEngine,
    purgeCache,
  };
}
