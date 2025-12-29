import { useWebLLM } from '@/hooks/useWebLLM';
import { useAppStore } from '@/stores/useAppStore';
import { useTrackStore } from '@/stores/useTrackStore';
import { useAudioEngineHandleWithUi } from '@/hooks/useAudioEngineHandleWithUi';
import type { Message } from '@/types/agent';
import { AudioCommandType } from '@/types/audioEngine';

export function useAgent() {
    const { engine } = useWebLLM();
    const { handleAudioCommand } = useAudioEngineHandleWithUi();

    const addMessage = useAppStore((state) => state.actions.addMessage);
    const setStatus = useAppStore((state) => state.actions.setStatus);
    const tracksMap = useTrackStore((state) => state.tracks);

    const sendMessage = async (content: string) => {
        const trimmedContent = content.trim();
        if (!trimmedContent) return;

        console.log('=== AGENT v2.1 START ===');
        console.log('[Agent] content:', trimmedContent);

        // 1. KEYWORD FALLBACK
        const lowerContent = trimmedContent.toLowerCase();
        let manualActionTaken = false;
        let manualResponseLabel = "";

        if (lowerContent.match(/play|시작|재생/)) {
            await handleAudioCommand({ type: AudioCommandType.PLAY });
            manualActionTaken = true;
            manualResponseLabel = "▶️ 재생 시작됨";
        } else if (lowerContent.match(/pause|정지|멈춤/)) {
            await handleAudioCommand({ type: AudioCommandType.PAUSE });
            manualActionTaken = true;
            manualResponseLabel = "⏸️ 정지됨";
        }

        // 2. HARDWARE INFO
        let hardwareDetails = "Fetching...";
        try {
            const adapter = await (navigator as any).gpu?.requestAdapter();
            if (adapter) {
                const info = await adapter.requestAdapterInfo();
                hardwareDetails = `${info.vendor} - ${info.device}`;
            }
        } catch (e) {
            hardwareDetails = "Error querying GPU.";
        }

        if (!engine) {
            console.error('[Agent] Engine not initialized');
            return;
        }

        // Use Message type properly
        const userMsg: Message = {
            id: crypto.randomUUID(),
            role: 'user',
            content: trimmedContent,
            timestamp: Date.now(),
        };
        addMessage(userMsg);
        setStatus('generating');

        const assistantMsgId = crypto.randomUUID();
        const updateMessage = useAppStore.getState().actions.updateMessage;

        addMessage({
            id: assistantMsgId,
            role: 'assistant',
            content: manualActionTaken ? `${manualResponseLabel} (AI 엔진 v2.1 분석 중...)` : "분석 중 (v2.1)...",
            timestamp: Date.now()
        });

        try {
            const trackCount = Array.from(tracksMap.values()).length;
            const prompt = `System: Audio Engineer assistant. Current project has ${trackCount} tracks.\nUser: ${trimmedContent}\nAssistant:`;

            console.log(`[Agent v2.2] ${new Date().toLocaleTimeString()} - Calling generate()...`);
            const responseText = await engine.generate(prompt, { max_tokens: 64 });

            if (responseText && responseText.trim()) {
                updateMessage(assistantMsgId, manualActionTaken
                    ? `${manualResponseLabel}\n\n${responseText}`
                    : responseText
                );
                setStatus('idle');
            } else {
                throw new Error("EMPTY_RESPONSE");
            }

        } catch (err: any) {
            console.error('[Agent v2.2] Failure:', err.message);

            const isValidationError = err.message?.includes('contain either output text');

            if (manualActionTaken) {
                updateMessage(assistantMsgId, `${manualResponseLabel}\n\n(AI v2.2 침묵: ${err.message})`);
                setStatus('idle');
            } else {
                const diagReport = `**[v2.2] AI 엔진 장애 보고서**
- **하드웨어:** ${hardwareDetails}
- **에러:** ${err.message}

${isValidationError ? `
> [!CAUTION]
> **브라우저에 예전 코드가 강력하게 캐싱되어 있습니다.**
> 1. 브라우저에서 **F12**를 눌러 개발자 도구를 엽니다.
> 2. 새로고침 버튼을 **우클릭**하고 **"캐시 비우기 및 강력 새로고침"**을 선택하세요.
> 3. 하단의 **[Purge Cache]** 버튼을 눌러 모델을 다시 받으세요.` : ''}`;

                updateMessage(assistantMsgId, diagReport);
                setStatus('error');
            }
        }
    };

    return { sendMessage };
}
