import { useEffect } from 'react';
import { useSession } from '@/layers/apps/web/context/layer-hooks';
import {
  disposeWebLLM,
  getWebLLMEngine,
  initializeWebLLM,
  purgeWebLLMCache,
} from '@/layers/apps/web/hooks/agent/web-llm-engine';

export function useWebLLM() {
  const setModelReady = useSession(state => state.setAgentModelReady);
  const setLoadingProgress = useSession(state => state.setAgentLoadingProgress);

  useEffect(() => {
    void initializeWebLLM({
      onProgress: report => {
        setLoadingProgress(report.progress, report.text);
      },
    })
      .then(() => {
        setModelReady(true);
      })
      .catch((error: unknown) => {
        console.error('Failed to initialize WebLLM:', error);
        setLoadingProgress(0, 'Failed to load model');
      });
  }, [setModelReady, setLoadingProgress]);

  const purgeCache = async () => {
    try {
      await disposeWebLLM();
      await purgeWebLLMCache();
      setModelReady(false);
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
    setModelReady(false);
    window.location.reload();
  };

  return {
    engine: getWebLLMEngine(),
    resetEngine,
    purgeCache,
  };
}
