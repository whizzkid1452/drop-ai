import { generateErrorDiagnostic } from './errorHandler';
import { getSystemPrompt, type AgentPromptPlugin, type AgentPromptTrack } from './getSystemPrompt';
import type { MLCEngine } from '@/types/webllm.types';

export async function queryToLLM({
  engine,
  plugins,
  tracks,
  userInput,
}: {
  engine: MLCEngine;
  plugins: readonly AgentPromptPlugin[];
  tracks: readonly AgentPromptTrack[];
  userInput: string;
}) {
  const systemPrompt = getSystemPrompt({ plugins, tracks });

  try {
    const completion = await engine.chat.completions.create({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userInput },
      ],
      max_tokens: 200,
      temperature: 0.1,
    });
    return {
      fullResponse: completion.choices[0].message.content || '',
      error: null,
    } as const;
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    console.error('AI Error:', errorMessage);

    const diagReport = await generateErrorDiagnostic(err instanceof Error ? err : new Error(String(err)));
    return { fullResponse: null, error: diagReport } as const;
  }
}
