import { useWebLLM } from '@/hooks/useWebLLM';
import { useAppStore } from '@/stores/useAppStore';
import { useTrackStore } from '@/stores/useTrackStore';
import { useAudioEngineHandleWithUi } from '@/hooks/useAudioEngineHandleWithUi';
import { AudioCommandType } from '@/types/audioEngine';
import type { Message } from '@/types/agent';

export function useAgent() {
    const { engine } = useWebLLM();

    const addMessage = useAppStore((state) => state.actions.addMessage);
    const setStatus = useAppStore((state) => state.actions.setStatus);
    const tracksMap = useTrackStore((state) => state.tracks);
    const { handleAudioCommand } = useAudioEngineHandleWithUi();

    // 자연어 명령어 파싱 및 실행
    const parseAndExecuteCommand = async (userInput: string): Promise<string | null> => {
        const lowerInput = userInput.toLowerCase();

        // 한국어/영어 키워드 매핑 (useAudioEngineHandleWithUi의 기능 기반)
        const commandMap = {
            play: ['play', '재생', '플레이', '시작'],
            pause: ['pause', '일시정지', '일시 정지', '멈춰', '멈춤'],
            stop: ['stop', '스톱', '중지', '정지'],
        };

        try {
            // PLAY 명령어
            if (commandMap.play.some(kw => lowerInput.includes(kw))) {
                await handleAudioCommand({ type: AudioCommandType.PLAY });
                return '✅ 재생을 시작했습니다.';
            }

            // PAUSE 명령어
            if (commandMap.pause.some(kw => lowerInput.includes(kw))) {
                await handleAudioCommand({ type: AudioCommandType.PAUSE });
                return '⏸ 일시정지했습니다.';
            }

            // STOP 명령어
            if (commandMap.stop.some(kw => lowerInput.includes(kw))) {
                await handleAudioCommand({ type: AudioCommandType.STOP });
                return '⏹ 정지했습니다.';
            }

            // 볼륨 조절 (예: "볼륨 50으로", "volume 70", "볼륨을 80%로")
            const volumeMatch = lowerInput.match(/(?:볼륨|volume)[을를]?\s*(\d+)/);
            if (volumeMatch) {
                const volumePercent = parseInt(volumeMatch[1]);
                const volume = Math.min(100, Math.max(0, volumePercent)) / 100;
                const tracks = Array.from(tracksMap.values());

                if (tracks.length > 0) {
                    // 첫 번째 트랙의 볼륨 조절
                    await handleAudioCommand({
                        type: AudioCommandType.SET_TRACK_VOLUME,
                        trackId: tracks[0].id,
                        volume
                    });
                    return `🔊 볼륨을 ${Math.round(volume * 100)}%로 설정했습니다.`;
                } else {
                    return '⚠️ 트랙이 없습니다.';
                }
            }

            // 패닝 조절 (예: "왼쪽으로", "오른쪽으로", "pan left", "pan right", "중앙")
            const panLeftMatch = lowerInput.match(/(?:왼쪽|left)/);
            const panRightMatch = lowerInput.match(/(?:오른쪽|right)/);
            const panCenterMatch = lowerInput.match(/(?:중앙|center|가운데)/);

            if (panLeftMatch || panRightMatch || panCenterMatch) {
                const tracks = Array.from(tracksMap.values());

                if (tracks.length > 0) {
                    let pan = 0;
                    let panLabel = '';

                    if (panLeftMatch) {
                        pan = -1;
                        panLabel = '왼쪽';
                    } else if (panRightMatch) {
                        pan = 1;
                        panLabel = '오른쪽';
                    } else {
                        pan = 0;
                        panLabel = '중앙';
                    }

                    await handleAudioCommand({
                        type: AudioCommandType.SET_TRACK_PAN,
                        trackId: tracks[0].id,
                        pan
                    });
                    return `🎧 패닝을 ${panLabel}으로 설정했습니다.`;
                } else {
                    return '⚠️ 트랙이 없습니다.';
                }
            }

        } catch (err: any) {
            console.error('[Command Execution Error]', err);
            return `❌ 명령어 실행 실패: ${err.message}`;
        }

        return null; // 명령어가 아닌 경우
    };

    const sendMessage = async (content: string) => {
        const trimmedContent = content.trim();
        if (!trimmedContent) return;

        console.log('=== AGENT v2.8 START (Hybrid Mode) ===');
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
            content: "분석 중 (v2.8)...",
            timestamp: Date.now()
        };
        addMessage(assistantMsg);

        try {
            const trackCount = Array.from(tracksMap.values()).length;
            console.log(`[Agent v2.8 (Hybrid)] ${new Date().toLocaleTimeString()} - Calling chat.completions...`);

            const completion = await engine.chat.completions.create({
                messages: [
                    { role: 'system', content: `You are an AI Audio Engineer. ${trackCount} tracks. Respond briefly.` },
                    { role: 'user', content: trimmedContent }
                ],
                max_tokens: 64,
                temperature: 0.1,
            });

            const responseText = completion.choices[0].message.content || "";

            // 명령어 파싱 및 실행 (AI 응답 여부와 무관하게 시도)
            const commandResult = await parseAndExecuteCommand(trimmedContent);

            if (responseText && responseText.trim()) {
                // AI 응답 + 명령어 실행 결과
                if (commandResult) {
                    updateMessage(assistantMsgId, `${responseText}\n\n${commandResult}`);
                } else {
                    updateMessage(assistantMsgId, responseText);
                }
                setStatus('idle');
            } else if (commandResult) {
                // AI 응답 없지만 명령어는 실행됨
                updateMessage(assistantMsgId, commandResult);
                setStatus('idle');
            } else {
                // AI 응답도 없고 명령어도 아닌 경우
                throw new Error("EMPTY_RESPONSE");
            }

        } catch (err: any) {
            console.error('[Agent v2.8] AI Error:', err.message);

            // AI 실패 시에도 명령어 실행 시도
            const commandResult = await parseAndExecuteCommand(trimmedContent);

            if (commandResult) {
                // 명령어가 있으면 실행 결과만 표시
                updateMessage(assistantMsgId, `**AI 엔진 오류 발생 (명령어는 실행됨)**\n\n${commandResult}\n\n💡 AI 응답은 생성되지 않았지만 명령어는 정상 실행되었습니다.`);
                setStatus('idle');
                return;
            }

            // 명령어도 없으면 에러 메시지 표시
            const isValidationError = err.message?.includes('contain either output text') || err.message === 'EMPTY_RESPONSE';

            const diagReport = `**[v2.8] AI 엔진 장애 분석 (Hybrid 모드)**
- **하드웨어:** ${hardwareDetails}
- **에러:** ${err.message}

${isValidationError ? `
> [!IMPORTANT]
> **AI 엔진 무응답:**
> AI 엔진이 답변 생성에 실패했습니다.
> 
> **해결 방법:**
> 1. 브라우저를 강력 새로고침하세요 (Ctrl+Shift+R)
> 2. 크롬을 완전히 종료 후 다시 실행해 보세요
> 3. 명령어("재생", "볼륨 50" 등)를 입력하면 AI 없이도 실행됩니다` : ''}`;

            updateMessage(assistantMsgId, diagReport);
            setStatus('error');
        }
    };

    return { sendMessage };
}
