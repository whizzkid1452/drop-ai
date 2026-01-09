import { generateErrorDiagnostic } from './errorHandler';
import { getSystemPrompt } from './getSystemPrompt';

export async function queryToLLM({
  engine,
  trackCount,
  userInput,
}: {
  /** @todo engine 타입 추가 필요 */
  engine: any;
  trackCount: number;
  userInput: string;
}) {
  const systemPrompt = getSystemPrompt({ trackCount });

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
  } catch (err: any) {
    console.error('AI Error:', err.message);

    const diagReport = await generateErrorDiagnostic(err);
    return { fullResponse: null, error: diagReport } as const;
  }
}
