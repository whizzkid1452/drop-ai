import { useEffect } from 'react';
import { CreateWebWorkerMLCEngine, type InitProgressReport } from '@mlc-ai/web-llm';
import { useAppStore } from '@/stores/useAppStore';

let globalEngine: any = null;
let isInitializing = false;

export function useWebLLM() {
    const setModelReady = useAppStore((state) => state.agentActions.setModelReady);
    const setLoadingProgress = useAppStore((state) => state.agentActions.setLoadingProgress);

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
                    'Qwen2-0.5B-Instruct-q4f16_1-MLC',
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
            const databases = await window.indexedDB.databases();
            for (const db of databases) {
                if (db.name?.startsWith('mlc-') || db.name?.includes('model')) {
                    console.log(`Deleting DB: ${db.name}`);
                    window.indexedDB.deleteDatabase(db.name!);
                }
            }
            console.log('Cache purge requested. Reloading...');
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
        purgeCache
    };
}
