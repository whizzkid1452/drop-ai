import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MLCEngine } from '@/types/webllm.types';

const webLLMMocks = vi.hoisted(() => ({
  createEngine: vi.fn(),
  deleteModelCache: vi.fn(),
}));

vi.mock('@mlc-ai/web-llm', () => ({
  CreateWebWorkerMLCEngine: webLLMMocks.createEngine,
  deleteModelAllInfoInCache: webLLMMocks.deleteModelCache,
  prebuiltAppConfig: {
    model_list: [{ model_id: 'Qwen2.5-0.5B-Instruct-q4f16_1-MLC' }],
    useIndexedDBCache: true,
  },
}));

class WorkerStub {
  terminate = vi.fn();
}

async function importEngineModule() {
  return import('./web-llm-engine');
}

describe('web-llm-engine', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubGlobal('Worker', WorkerStub);
    webLLMMocks.createEngine.mockReset();
    webLLMMocks.deleteModelCache.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('동시 초기화 요청에는 하나의 엔진 생성 Promise를 재사용한다', async () => {
    const engine = { unload: vi.fn() } as unknown as MLCEngine;
    webLLMMocks.createEngine.mockResolvedValue(engine);
    const { initializeWebLLM } = await importEngineModule();

    const firstInitialization = initializeWebLLM();
    const secondInitialization = initializeWebLLM();

    await expect(firstInitialization).resolves.toBe(engine);
    await expect(secondInitialization).resolves.toBe(engine);
    expect(webLLMMocks.createEngine).toHaveBeenCalledOnce();
  });

  it('모델 파일을 Cache API에 저장하도록 엔진을 초기화한다', async () => {
    const engine = { unload: vi.fn() } as unknown as MLCEngine;
    webLLMMocks.createEngine.mockResolvedValue(engine);
    const { initializeWebLLM, WEB_LLM_APP_CONFIG, WEB_LLM_MODEL_ID } = await importEngineModule();

    await initializeWebLLM();

    expect(WEB_LLM_APP_CONFIG.useIndexedDBCache).toBe(false);
    expect(webLLMMocks.createEngine).toHaveBeenCalledWith(
      expect.any(WorkerStub),
      WEB_LLM_MODEL_ID,
      expect.objectContaining({
        appConfig: WEB_LLM_APP_CONFIG,
      })
    );
  });

  it('캐시 삭제에는 엔진과 동일한 모델 설정을 사용한다', async () => {
    const { purgeWebLLMCache, WEB_LLM_APP_CONFIG, WEB_LLM_MODEL_ID } = await importEngineModule();

    await purgeWebLLMCache();

    expect(webLLMMocks.deleteModelCache).toHaveBeenCalledWith(WEB_LLM_MODEL_ID, WEB_LLM_APP_CONFIG);
  });

  it('응답 생성 중단 요청을 현재 엔진에 전달한다', async () => {
    const interruptGenerate = vi.fn();
    const engine = { interruptGenerate, unload: vi.fn() } as unknown as MLCEngine;
    webLLMMocks.createEngine.mockResolvedValue(engine);
    const { initializeWebLLM, interruptWebLLMGeneration } = await importEngineModule();
    await initializeWebLLM();

    expect(interruptWebLLMGeneration()).toBe(true);
    expect(interruptGenerate).toHaveBeenCalledOnce();
  });

  it('초기화된 엔진이 없으면 생성 중단 요청을 보내지 않는다', async () => {
    const { interruptWebLLMGeneration } = await importEngineModule();

    expect(interruptWebLLMGeneration()).toBe(false);
  });

  it('초기화 실패 후 새 엔진 생성을 재시도할 수 있다', async () => {
    const engine = { unload: vi.fn() } as unknown as MLCEngine;
    webLLMMocks.createEngine.mockRejectedValueOnce(new Error('download failed')).mockResolvedValueOnce(engine);
    const { initializeWebLLM } = await importEngineModule();

    await expect(initializeWebLLM()).rejects.toThrow('download failed');
    await expect(initializeWebLLM()).resolves.toBe(engine);
    expect(webLLMMocks.createEngine).toHaveBeenCalledTimes(2);
  });
});
