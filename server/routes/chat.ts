import { Router } from 'express';
import OpenAI from 'openai';
import { AI_TOOLS } from '@/types/ai-tools';

const router = Router();

// OpenAI 클라이언트 초기화
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * POST /api/chat
 * AI 에이전트와 대화하는 엔드포인트
 */
router.post('/', async (req, res) => {
  try {
    const { messages, currentState } = req.body;

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({
        error: 'messages 배열이 필요합니다',
      });
    }

    // 현재 DAW 상태를 시스템 프롬프트에 주입
    const systemPrompt = `당신은 Tone.js 기반 웹 DAW(Digital Audio Workstation)를 제어하는 전문 오디오 엔지니어 AI 에이전트입니다.
사용자의 자연어 요청을 해석하여 적절한 도구(Tool)를 호출하여 오디오 편집 작업을 수행하세요.

현재 프로젝트 상태:
${JSON.stringify(currentState || {}, null, 2)}

중요 규칙:
1. 모든 오디오 편집은 비파괴적(Non-destructive)이어야 합니다. 원본 오디오 데이터는 절대 삭제하지 않습니다.
2. 볼륨은 -60dB ~ 6dB 범위로 제한합니다. 이 범위를 벗어나는 값은 자동으로 클램핑됩니다.
3. 사용자가 구체적인 수치를 제시하지 않으면, 음악적으로 통용되는 합리적인 기본값을 사용하세요.
   예: "공간감을 줘" -> Reverb decay 2.0초, wet 0.3
   예: "소리를 밝게" -> High-pass filter 또는 EQ high band boost
4. 실행 불가능한 요청(존재하지 않는 트랙 ID 참조 등)에는 정중히 이유를 설명하고 대안을 제시하세요.
5. 한 번에 여러 작업을 요청받으면, 순서대로 하나씩 실행하세요.

사용자의 의도를 정확히 파악하고, 가장 적절한 도구를 선택하여 호출하세요.`;

    const response = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: systemPrompt,
        },
        ...messages,
      ],
      tools: AI_TOOLS as any,
      tool_choice: 'auto',
      temperature: 0.7,
      max_tokens: 1000,
    });

    res.json(response);
  } catch (error) {
    console.error('OpenAI API Error:', error);
    
    if (error instanceof Error) {
      // OpenAI API 에러 처리
      if (error.message.includes('API key')) {
        return res.status(401).json({
          error: 'OpenAI API 키가 유효하지 않습니다. .env 파일을 확인하세요.',
        });
      }
      
      return res.status(500).json({
        error: 'AI 요청 처리 중 오류가 발생했습니다',
        message: error.message,
      });
    }

    res.status(500).json({
      error: '알 수 없는 오류가 발생했습니다',
    });
  }
});

export { router as chatRouter };

