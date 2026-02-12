import { useEffect } from 'react';
import {
  CreateWebWorkerMLCEngine,
  type InitProgressReport,
} from '@mlc-ai/web-llm';
import { useSession } from '@/layers/presentation/context/LayerContext';
import type { MLCEngine } from '@/types/webllm.types';

let globalEngine: MLCEngine | null = null;
let isInitializing = false;

export function useWebLLM() {
  const setModelReady = useSession(state => state.setAgentModelReady);
  const setLoadingProgress = useSession(
    state => state.setAgentLoadingProgress
  );

  useEffect(() => {
    if (globalEngine || isInitializing) return;

    isInitializing = true;
    const initEngine = async () => {
      try {
        const worker = new Worker(
          new URL('../../workers/llm.worker.ts', import.meta.url),
          { type: 'module' }
        );

        globalEngine = await CreateWebWorkerMLCEngine(
          worker,
          'Qwen2.5-0.5B-Instruct-q4f16_1-MLC',
          {
            initProgressCallback: (report: InitProgressReport) => {
              setLoadingProgress(report.progress, report.text);
            },
            logLevel: 'DEBUG',
          }
        );

        setModelReady(true);
        console.log('WebLLM Engine Ready');
      } catch (err) {
        console.error('Failed to initialize WebLLM:', err);
        setLoadingProgress(0, 'Failed to load model');
        isInitializing = false;
      }
    };

    initEngine();
  }, [setModelReady, setLoadingProgress]);

  const purgeCache = async () => {
    try {
      console.log('Purging MLC Cache...');

      // IndexedDB 삭제 (메타데이터/설정)
      const databases = await window.indexedDB.databases();
      for (const db of databases) {
        if (db.name?.startsWith('mlc-') || db.name?.includes('model')) {
          console.log(`Deleting IndexedDB: ${db.name}`);
          window.indexedDB.deleteDatabase(db.name!);
        }
      }

      // Cache API 삭제 (실제 모델 파일)
      if ('caches' in window) {
        const cacheNames = await caches.keys();
        for (const cacheName of cacheNames) {
          if (
            cacheName.includes('mlc') ||
            cacheName.includes('model') ||
            cacheName.includes('web-llm')
          ) {
            console.log(`Deleting Cache: ${cacheName}`);
            await caches.delete(cacheName);
          }
        }
      }

      console.log('Cache purge completed. Reloading...');
      window.location.reload();
    } catch (err) {
      console.error('Failed to purge cache:', err);
    }
  };

  const resetEngine = async (purge: boolean = false) => {
    if (purge) {
      await purgeCache();
      return;
    }
    if (globalEngine) {
      await globalEngine.unload();
      globalEngine = null;
      isInitializing = false;
      setModelReady(false);
      window.location.reload();
    }
  };

  return {
    engine: globalEngine,
    resetEngine,
    purgeCache,
  };
}
