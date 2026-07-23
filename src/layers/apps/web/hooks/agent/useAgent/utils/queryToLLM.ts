import { generateErrorDiagnostic } from './errorHandler';
import { getSystemPrompt, type AgentPromptPlugin, type AgentPromptTrack } from './getSystemPrompt';
import type { MLCEngine } from '@/types/webllm.types';
import { throwIfAgentRequestCancelled } from './agent-request-cancelled-error';

export async function queryToLLM({
  engine,
  plugins,
  signal,
  tracks,
  userInput,
}: {
  engine: MLCEngine;
  plugins: readonly AgentPromptPlugin[];
  signal?: AbortSignal;
  tracks: readonly AgentPromptTrack[];
  userInput: string;
}) {
  const systemPrompt = getSystemPrompt({ plugins, tracks });

  try {
    throwIfAgentRequestCancelled(signal);
    const completion = await engine.chat.completions.create({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userInput },
      ],
      max_tokens: 200,
      temperature: 0.1,
    });
    throwIfAgentRequestCancelled(signal);

    return {
      fullResponse: completion.choices[0].message.content || '',
      error: null,
    } as const;
  } catch (err: unknown) {
    throwIfAgentRequestCancelled(signal);
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    console.error('AI Error:', errorMessage);

    const diagReport = await generateErrorDiagnostic(err instanceof Error ? err : new Error(String(err)));
    return { fullResponse: null, error: diagReport } as const;
  }
}
