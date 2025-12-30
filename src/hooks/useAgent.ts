import { useWebLLM } from '@/hooks/useWebLLM';
import { useAppStore } from '@/stores/useAppStore';
import { useTrackStore } from '@/stores/useTrackStore';
import type { Message } from '@/types/agent';

export function useAgent() {
    const { engine } = useWebLLM();

    const addMessage = useAppStore((state) => state.actions.addMessage);
    const setStatus = useAppStore((state) => state.actions.setStatus);
    const tracksMap = useTrackStore((state) => state.tracks);

    const sendMessage = async (content: string) => {
        const trimmedContent = content.trim();
        if (!trimmedContent) return;

        console.log('=== AGENT v2.7 START (Pure AI) ===');
        console.log('[Agent] content:', trimmedContent);

        // 1. HARDWARE INFO (Robust check)
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
            content: "분석 중 (v2.7)...",
            timestamp: Date.now()
        };
        addMessage(assistantMsg);

        try {
            const trackCount = Array.from(tracksMap.values()).length;
            console.log(`[Agent v2.7] ${new Date().toLocaleTimeString()} - Calling chat.completions (Pure AI)...`);

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
                updateMessage(assistantMsgId, responseText);
                setStatus('idle');
            } else {
                throw new Error("EMPTY_RESPONSE");
            }

        } catch (err: any) {
            console.error('[Agent v2.7] AI Error:', err.message);

            const isValidationError = err.message?.includes('contain either output text') || err.message === 'EMPTY_RESPONSE';

            const diagReport = `**[v2.7] AI 엔진 장애 분석 (Pure AI 모드)**
- **하드웨어:** ${hardwareDetails}
- **에러:** ${err.message}

${isValidationError ? `
> [!IMPORTANT]
> **AI 엔진 무응답:**
> 키워드 가로채기(Fallback) 기능이 비활성화된 상태에서 AI 엔진이 답변 생성에 실패했습니다.
> 1. 브라우저의 전역적인 GPU 리소스 부족입니다.
> 2. 크롬을 완전히 종료 후 다시 실행하거나 PC를 재부팅해 보세요.` : ''}`;

            updateMessage(assistantMsgId, diagReport);
            setStatus('error');
        }
    };

    return { sendMessage };
}
