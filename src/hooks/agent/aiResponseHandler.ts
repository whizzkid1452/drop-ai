import { generateErrorDiagnostic } from './errorHandler';
import { getHardwareInfo } from '@/utils/hardwareInfo';
import type { AudioCommand } from '@/types/audioEngine';
import type { Track } from '@/types/track';

export interface AIResponseHandlerDependencies {
  handleAudioCommand: (command: AudioCommand) => Promise<any>;
  getTracks: () => Track[];
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
    console.log(
      `[Agent v2.8 (Hybrid)] ${new Date().toLocaleTimeString()} - Calling chat.completions...`
    );

    // 프롬프트 엔지니어링: Qwen2-0.5B (Small LLM) 최적화
    const systemPrompt = `You are an AI assistant that controls a Digital Audio Workstation (DAW).
You have access to ${trackCount} tracks.
You MUST analyze the user's request and categorize it into one of these actions: PLAY, PAUSE, STOP, or NONE.

If the user wants to PLAY/START music:
Append {"type":"PLAY"} at the end.

If the user wants to PAUSE/STOP music:
Append {"type":"PAUSE"} at the end.

If the user's request is NOT about playing/pausing (e.g. asking a question):
Do NOT append any JSON.

EXAMPLES:

User: "Play music"
Assistant: Starting playback.
{"type":"PLAY"}

User: "Stop the song"
Assistant: Pausing audio.
{"type":"PAUSE"}

User: "How are you?"
Assistant: I am ready to help with your music.

User: "Start"
Assistant: OK.
{"type":"PLAY"}

User: "Can you help me?"
Assistant: Yes, I can control playback.

User: "Pause please"
Assistant: Paused.
{"type":"PAUSE"}

Response MUST be short. JSON MUST be on the last line.`;

    const completion = await engine.chat.completions.create({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userInput },
      ],
      max_tokens: 100, // JSON 포함을 위해 약간 늘림
      temperature: 0.1, // 명령 실행의 정확도를 위해 낮음
    });

    const fullResponse = completion.choices[0].message.content || '';
    console.log('[AI Raw Response]:', fullResponse);

    // JSON 명령어 추출 (마지막 라인 또는 문장 내 검색)
    const jsonMatch = fullResponse.match(/\{"type":"(PLAY|PAUSE|STOP)"\}/);
    let aiCommandType: string | null = null;
    let cleanResponse = fullResponse;

    if (jsonMatch) {
      aiCommandType = jsonMatch[1];
      // 사용자에게 보여줄 메시지에서 JSON 부분 제거
      cleanResponse = fullResponse.replace(jsonMatch[0], '').trim();
      if (aiCommandType) {
        // AI가 명시적으로 명령을 내린 경우 실행
        console.log('[AI Command Execution]', aiCommandType);
        const { handleAudioCommand } = commandDeps;
        // AudioCommandType 매핑 필요 (문자열 -> Enum)
        const type =
          aiCommandType === 'PLAY'
            ? 'PLAY'
            : aiCommandType === 'PAUSE'
              ? 'PAUSE'
              : aiCommandType === 'STOP'
                ? 'STOP'
                : null;

        if (type) {
          // @ts-ignore: AudioCommandType string mapping
          await handleAudioCommand({ type });
        }

        // Clean response output
        updateMessage(assistantMsgId, fullResponse);
        setStatus('idle');
        return true;
      } else {
        // 일반 대화
        if (!cleanResponse) throw new Error('EMPTY_RESPONSE');
        updateMessage(assistantMsgId, cleanResponse);
        setStatus('idle');
        return true;
      }
    } else {
      // 일반 대화 (JSON이 없는 경우)
      if (!cleanResponse) throw new Error('EMPTY_RESPONSE');
      updateMessage(assistantMsgId, cleanResponse);
      setStatus('idle');
      return true;
    }
  } catch (err: any) {
    console.error('[Agent v2.8] AI Error:', err.message);

    const diagReport = generateErrorDiagnostic(err, hardwareDetails);
    updateMessage(assistantMsgId, diagReport);
    setStatus('error');
    return false;
  }
}
