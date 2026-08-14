import { useCallback, useEffect } from 'react';
import { useAgentRuntimeCommands } from '@/layers/apps/web/context/layer-hooks';
import { AgentRuntimeCommandType } from '@/layers/commands/agent-runtime-command-executor';
import {
  disposeWebLLM,
  getWebLLMEngine,
  initializeWebLLM,
  interruptWebLLMGeneration,
  purgeWebLLMCache,
} from '@/layers/apps/web/hooks/agent/web-llm-engine';

export function useWebLLM() {
  const agentRuntimeCommands = useAgentRuntimeCommands();
  const setModelStatus = useCallback(
    (status: 'loading' | 'ready' | 'error') => {
      agentRuntimeCommands.execute({ status, type: AgentRuntimeCommandType.SET_MODEL_STATUS });
    },
    [agentRuntimeCommands]
  );
  const setLoadingProgress = useCallback(
    (progress: number, text: string) => {
      agentRuntimeCommands.execute({ progress, text, type: AgentRuntimeCommandType.SET_LOADING_PROGRESS });
    },
    [agentRuntimeCommands]
  );

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
