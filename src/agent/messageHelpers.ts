import type { Message } from '@/types/agent';

/**
 * 사용자 메시지를 생성하는 함수
 * @param content 메시지 내용
 * @returns Message 객체
 */
export function createUserMessage(content: string): Message {
    return {
        id: crypto.randomUUID(),
        role: 'user',
        content: content.trim(),
        timestamp: Date.now(),
    };
}

/**
 * 어시스턴트 메시지를 생성하는 함수
 * @param content 초기 메시지 내용
 * @returns Message 객체
 */
export function createAssistantMessage(content: string = "분석 중 (v2.8)..."): Message {
    return {
        id: crypto.randomUUID(),
        role: 'assistant',
        content,
        timestamp: Date.now()
    };
}

