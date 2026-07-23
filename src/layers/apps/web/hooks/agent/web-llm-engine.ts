import {
  CreateWebWorkerMLCEngine,
  deleteModelAllInfoInCache,
  prebuiltAppConfig,
  type AppConfig,
  type InitProgressCallback,
} from '@mlc-ai/web-llm';
import type { MLCEngine } from '@/types/webllm.types';

export const WEB_LLM_MODEL_ID = 'Qwen2.5-0.5B-Instruct-q4f16_1-MLC';
export const WEB_LLM_APP_CONFIG: AppConfig = {
  ...prebuiltAppConfig,
  useIndexedDBCache: false,
};

interface InitializeWebLLMOptions {
  onProgress?: InitProgressCallback;
}

let engine: MLCEngine | null = null;
let engineInitialization: Promise<MLCEngine> | null = null;
let engineWorker: Worker | null = null;

export function getWebLLMEngine(): MLCEngine | null {
  return engine;
}

export function interruptWebLLMGeneration(): boolean {
  if (!engine) {
    return false;
  }

  engine.interruptGenerate();
  return true;
}

export function initializeWebLLM(options: InitializeWebLLMOptions = {}): Promise<MLCEngine> {
  if (engine) {
    return Promise.resolve(engine);
  }

  if (engineInitialization) {
    return engineInitialization;
  }

  engineWorker = new Worker(new URL('../../workers/llm.worker.ts', import.meta.url), { type: 'module' });
  engineInitialization = CreateWebWorkerMLCEngine(engineWorker, WEB_LLM_MODEL_ID, {
    appConfig: WEB_LLM_APP_CONFIG,
    initProgressCallback: options.onProgress,
    logLevel: 'INFO',
  })
    .then(initializedEngine => {
      engine = initializedEngine;
      return initializedEngine;
    })
    .catch((error: unknown) => {
      engineWorker?.terminate();
      engineWorker = null;
      engineInitialization = null;
      throw error;
    });

  return engineInitialization;
}

export async function disposeWebLLM(): Promise<void> {
  let initializedEngine = engine;

  if (!initializedEngine && engineInitialization) {
    initializedEngine = await engineInitialization.catch(() => null);
  }

  engine = null;
  engineInitialization = null;

  try {
    await initializedEngine?.unload();
  } finally {
    engineWorker?.terminate();
    engineWorker = null;
  }
}

export function purgeWebLLMCache(): Promise<void> {
  return deleteModelAllInfoInCache(WEB_LLM_MODEL_ID, WEB_LLM_APP_CONFIG);
}
