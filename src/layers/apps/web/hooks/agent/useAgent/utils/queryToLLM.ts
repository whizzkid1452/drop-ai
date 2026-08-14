import { generateErrorDiagnostic } from './errorHandler';
import { getSystemPrompt, type AgentPromptPlugin, type AgentPromptTrack } from './getSystemPrompt';
import { createAgentUserPrompt } from './create-agent-user-prompt';
import type { MLCEngine } from '@/types/webllm.types';
import { AGENT_AUDIO_COMMAND_BATCH_JSON_SCHEMA } from '@/types/audioCommand.schema';
import type { AudioRuntimeCapabilities } from '@/layers/shared/utils/audio-runtime-capabilities';
import { throwIfAgentRequestCancelled } from './agent-request-cancelled-error';

export async function queryToLLM({
  capabilities,
  engine,
  plugins,
  signal,
  tracks,
  userInput,
}: {
  capabilities?: AudioRuntimeCapabilities;
  engine: MLCEngine;
  plugins: readonly AgentPromptPlugin[];
  signal?: AbortSignal;
  tracks: readonly AgentPromptTrack[];
  userInput: string;
}) {
  const systemPrompt = getSystemPrompt({ capabilities, plugins, tracks });
  const agentUserPrompt = createAgentUserPrompt(userInput);

  try {
    throwIfAgentRequestCancelled(signal);
    const completion = await engine.chat.completions.create({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: agentUserPrompt },
      ],
      max_tokens: 200,
      temperature: 0.1,
      response_format: {
        type: 'json_object',
        schema: AGENT_AUDIO_COMMAND_BATCH_JSON_SCHEMA,
      },
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
