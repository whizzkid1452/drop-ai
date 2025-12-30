import { useWebLLM } from '@/hooks/useWebLLM';
import { useAppStore } from '@/stores/useAppStore';
import { useTrackStore } from '@/stores/useTrackStore';
import { useAudioEngineHandleWithUi } from '@/hooks/useAudioEngineHandleWithUi';
import { handleAIResponse } from '@/agent/aiResponseHandler';
import { createUserMessage, createAssistantMessage } from '@/agent/messageHelpers';

export function useAgent() {
    const { engine } = useWebLLM();
    const addMessage = useAppStore((state) => state.actions.addMessage);
    const setStatus = useAppStore((state) => state.actions.setStatus);
    const tracksMap = useTrackStore((state) => state.tracks);
    const { handleAudioCommand } = useAudioEngineHandleWithUi();

    const sendMessage = async (content: string) => {
        const trimmedContent = content.trim();
        if (!trimmedContent) return;

        console.log('=== AGENT v2.8 START (Hybrid Mode) ===');
        console.log('[Agent] content:', trimmedContent);

        if (!engine) {
            console.error('[Agent] Engine not initialized');
            return;
        }

        // 사용자 메시지 추가
        const userMsg = createUserMessage(trimmedContent);
        addMessage(userMsg);
        setStatus('generating');

        // 어시스턴트 메시지 생성 및 추가
        const assistantMsg = createAssistantMessage();
        addMessage(assistantMsg);
        const updateMessage = useAppStore.getState().actions.updateMessage;

        // AI 응답 처리
        await handleAIResponse({
            engine,
            trackCount: Array.from(tracksMap.values()).length,
            userInput: trimmedContent,
            assistantMsgId: assistantMsg.id,
            updateMessage,
            setStatus: (status: 'idle' | 'error') => setStatus(status),
            handleAudioCommand: handleAudioCommand as (command: any) => Promise<any>,
            getTracks: () => Array.from(tracksMap.values()),
        });
    };

    return { sendMessage };
}
