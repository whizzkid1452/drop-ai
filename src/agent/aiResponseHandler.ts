import { parseAndExecuteCommand, type CommandParserDependencies } from './commandParser';
import { generateErrorDiagnostic } from './errorHandler';
import { getHardwareInfo } from '@/utils/hardwareInfo';
import type { Message } from '@/types/agent';

export interface AIResponseHandlerDependencies extends CommandParserDependencies {
    engine: any; // WebLLM 엔진 타입
    trackCount: number;
    userInput: string;
    assistantMsgId: string;
    updateMessage: (id: string, content: string) => void;
    setStatus: (status: 'idle' | 'error') => void;
}

/**
 * AI 응답을 처리하고 명령어를 실행하는 함수
 * @param deps 의존성 객체
 * @returns 성공 여부
 */
export async function handleAIResponse(
    deps: AIResponseHandlerDependencies
): Promise<boolean> {
    const {
        engine,
        trackCount,
        userInput,
        assistantMsgId,
        updateMessage,
        setStatus,
        ...commandDeps
    } = deps;

    const hardwareDetails = await getHardwareInfo();

    try {
        console.log(`[Agent v2.8 (Hybrid)] ${new Date().toLocaleTimeString()} - Calling chat.completions...`);

        const completion = await engine.chat.completions.create({
            messages: [
                { 
                    role: 'system', 
                    content: `You are an AI Audio Engineer. ${trackCount} tracks. Respond briefly.` 
                },
                { role: 'user', content: userInput }
            ],
            max_tokens: 64,
            temperature: 0.1,
        });

        const responseText = completion.choices[0].message.content || "";

        // 명령어 파싱 및 실행 (AI 응답 여부와 무관하게 시도)
        const commandResult = await parseAndExecuteCommand(userInput, commandDeps);

        if (responseText && responseText.trim()) {
            // AI 응답 + 명령어 실행 결과
            if (commandResult) {
                updateMessage(assistantMsgId, `${responseText}\n\n${commandResult}`);
            } else {
                updateMessage(assistantMsgId, responseText);
            }
            setStatus('idle');
            return true;
        } else if (commandResult) {
            // AI 응답 없지만 명령어는 실행됨
            updateMessage(assistantMsgId, commandResult);
            setStatus('idle');
            return true;
        } else {
            // AI 응답도 없고 명령어도 아닌 경우
            throw new Error("EMPTY_RESPONSE");
        }

    } catch (err: any) {
        console.error('[Agent v2.8] AI Error:', err.message);

        // AI 실패 시에도 명령어 실행 시도
        const commandResult = await parseAndExecuteCommand(userInput, commandDeps);

        if (commandResult) {
            // 명령어가 있으면 실행 결과만 표시
            updateMessage(
                assistantMsgId,
                `**AI 엔진 오류 발생 (명령어는 실행됨)**\n\n${commandResult}\n\n💡 AI 응답은 생성되지 않았지만 명령어는 정상 실행되었습니다.`
            );
            setStatus('idle');
            return true;
        }

        // 명령어도 없으면 에러 메시지 표시
        const diagReport = generateErrorDiagnostic(err, hardwareDetails);
        updateMessage(assistantMsgId, diagReport);
        setStatus('error');
        return false;
    }
}

