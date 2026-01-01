import { parseAICommand, type AudioCommand } from '@/types/audioCommand.schema';
import type { Track } from '@/types/track';
import { getHardwareInfo } from '@/utils/hardwareInfo';
import { generateErrorDiagnostic } from './errorHandler';
import { getSystemPrompt } from './getSystemPrompt';
import type { Message } from '@/types/agent';
import { createAssistantMessage } from './messageHelpers';

export interface AIResponseHandlerDependencies {
  handleAudioCommand: (command: AudioCommand) => Promise<any>;
  getTracks: () => Track[];
  engine: any; // WebLLM 엔진 타입
  trackCount: number;
  userInput: string;
  assistantMsgId: string;
  addMessage: (message: Message) => void;
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
    addMessage,
    updateMessage,
    setStatus,
    handleAudioCommand,
  } = deps;

  const hardwareDetails = await getHardwareInfo();

  const systemPrompt = getSystemPrompt({ trackCount });

  let completion = null;

  try {
    completion = await engine.chat.completions.create({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userInput },
      ],
      max_tokens: 100,
      temperature: 0.1,
    });
  } catch (err: any) {
    console.error('[Agent v2.8] AI Error:', err.message);

    const diagReport = generateErrorDiagnostic(err, hardwareDetails);
    updateMessage(assistantMsgId, diagReport);
    setStatus('error');
    return false;
  }

  const fullResponse = completion.choices[0].message.content || '';
  console.log('[AI Raw Response]:', fullResponse);

  const { command, removeJsonResponse, error } = parseAICommand(fullResponse);

  if (command) {
    console.log('[AI Command Execution]', command);
    await handleAudioCommand(command);
    addMessage(createAssistantMessage('✅ Command executed'));
  }

  updateMessage(
    assistantMsgId,
    removeJsonResponse || fullResponse || 'no response'
  );
  setStatus(error ? 'error' : 'idle');

  return true;
}
