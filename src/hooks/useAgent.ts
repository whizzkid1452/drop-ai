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

        console.log('=== AGENT v2.6 START ===');
        console.log('[Agent] content:', trimmedContent);

        // 1. KEYWORD FALLBACK (Enhanced for Korean)
        const lowerContent = trimmedContent.toLowerCase();
        let manualActionTaken = false;
        let manualResponseLabel = "";

        // Play keywords: play, 시작, 재생, 틀어, 해
        if (lowerContent.match(/play|시작|재생|틀어|해/)) {
            await handleAudioCommand({ type: AudioCommandType.PLAY });
            manualActionTaken = true;
            manualResponseLabel = "▶️ 재생 시작됨";
        }
        // Pause keywords: pause, 정지, 멈춤, 멈춰, 꺼
        if (lowerContent.match(/pause|정지|멈춤|멈춰|꺼/)) {
            await handleAudioCommand({ type: AudioCommandType.PAUSE });
            manualActionTaken = true;
            manualResponseLabel = "⏸️ 정지됨";
        }

        // 2. HARDWARE INFO (Robust check)
        let hardwareDetails = "Fetching...";
        try {
            if ('gpu' in navigator) {
                const adapter = await (navigator as any).gpu.requestAdapter();
                if (adapter) {
                    const info = await adapter.requestAdapterInfo();
                    hardwareDetails = `${info.vendor} - ${info.device}`;
                } else {
                    hardwareDetails = "WebGPU Adapter not found.";
                }
            } else {
                hardwareDetails = "WebGPU not supported by browser.";
            }
        } catch (e: any) {
            hardwareDetails = `GPU Query Error: ${e.message}`;
        }

        if (!engine) {
            console.error('[Agent] Engine not initialized');
            return;
        }

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

        const assistantMsg: Message = {
            id: assistantMsgId,
            role: 'assistant',
            content: manualActionTaken ? `${manualResponseLabel} (AI v2.6 분석 중...)` : "분석 중 (v2.6)...",
            timestamp: Date.now()
        };
        addMessage(assistantMsg);

        try {
            const trackCount = Array.from(tracksMap.values()).length;
            console.log(`[Agent v2.6] ${new Date().toLocaleTimeString()} - Calling chat.completions (Qwen2)...`);

            const completion = await engine.chat.completions.create({
                messages: [
                    { role: 'system', content: `You are an AI Audio Engineer. ${trackCount} tracks. Respond briefly.` },
                    { role: 'user', content: trimmedContent }
                ],
                max_tokens: 64,
                temperature: 0.1,
            });

            const responseText = completion.choices[0].message.content || "";

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
            console.error('[Agent v2.6] AI Error:', err.message);

            const isValidationError = err.message?.includes('contain either output text') || err.message === 'EMPTY_RESPONSE';

            if (manualActionTaken) {
                updateMessage(assistantMsgId, `${manualResponseLabel}\n\n(AI v2.6 무응답: ${err.message})`);
                setStatus('idle');
            } else {
                const diagReport = `**[v2.6] AI 엔진 장애 분석 (Qwen 모드)**
- **하드웨어:** ${hardwareDetails}
- **에러:** ${err.message}

${isValidationError ? `
> [!IMPORTANT]
> **저사양 모델 구동 실패:**
> 가장 가벼운 모델 중 하나인 Qwen2-0.5B 구동에 실패했습니다. 이는 브라우저의 전역적인 GPU 리소스 부족입니다.
> 1. 크롬을 완전히 종료 후 다시 실행해 보세요.
> 2. 노트북이라면 전원 케이블을 연결해 보세요 (Battery Saver 모드 조심).` : ''}`;

                updateMessage(assistantMsgId, diagReport);
                setStatus('error');
            }
        }
    };

    return { sendMessage };
}
