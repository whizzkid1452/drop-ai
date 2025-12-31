import { type CommandParserDependencies } from './commandParser';
import { generateErrorDiagnostic } from './errorHandler';
import { getHardwareInfo } from '@/utils/hardwareInfo';
import { parseAICommand } from '@/types/audioCommand.schema';
import { AudioCommandType, type AudioCommand } from '@/types/audioEngine';
import { createShadowState, formatShadowStateForAI } from '@/utils/createShadowState';
import { usePlaybackStore } from '@/stores/usePlaybackStore';

export interface AIResponseHandlerDependencies
  extends CommandParserDependencies {
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

    // 🎯 Create Shadow State (lightweight context for AI)
    const { currentTime, isPlaying, tempo } = usePlaybackStore.getState();
    const shadowState = createShadowState(
      commandDeps.getTracks(),
      currentTime,
      isPlaying,
      tempo
    );
    const projectContext = formatShadowStateForAI(shadowState);

    // 프롬프트 엔지니어링: Qwen2-0.5B (Small LLM) 최적화
    const systemPrompt = `You are an AI assistant that controls a Digital Audio Workstation (DAW).

${projectContext}

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

    // 🔍 Zod-based validation (replaces regex parsing)
    const { command, cleanResponse, error } = parseAICommand(fullResponse);

    if (error) {
      // Validation failed - log for debugging (could implement self-correction here)
      console.warn('[AI Command Validation Failed]:', error);
      // For now, treat as normal conversation
      updateMessage(assistantMsgId, cleanResponse || fullResponse);
      setStatus('idle');
      return true;
    }

    if (command) {
      // ✅ Valid command - execute it
      console.log('[AI Command Execution]', command);
      const { handleAudioCommand } = commandDeps;

      // Map command.type to AudioCommandType enum
      const commandTypeMap: Record<string, AudioCommandType> = {
        PLAY: AudioCommandType.PLAY,
        PAUSE: AudioCommandType.PAUSE,
        STOP: AudioCommandType.STOP,
        SET_TRACK_VOLUME: AudioCommandType.SET_TRACK_VOLUME,
        SET_TRACK_PAN: AudioCommandType.SET_TRACK_PAN,
      };

      const audioCommand = {
        ...command,
        type: commandTypeMap[command.type],
      } as AudioCommand; // Type assertion (safe because Zod already validated)

      await handleAudioCommand(audioCommand);

      // Show clean response (without JSON)
      updateMessage(assistantMsgId, cleanResponse || '✅ Command executed');
      setStatus('idle');
      return true;
    } else {
      // No command - normal conversation
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
