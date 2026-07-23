import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { MessageList } from './MessageList';

vi.mock('../ChatModalTerminal.css.ts', () => ({
  messageGroup: 'messageGroup',
  messageRow: 'messageRow',
  messageRowUser: 'messageRowUser',
  avatar: 'avatar',
  aiAvatar: 'aiAvatar',
  primaryColor: '#ff4fd8',
  messageContent: 'messageContent',
  messageContentUser: 'messageContentUser',
  messageHeader: 'messageHeader',
  messageHeaderUser: 'messageHeaderUser',
  senderName: 'senderName',
  aiSenderName: 'aiSenderName',
  timestamp: 'timestamp',
  bubble: 'bubble',
  aiBubble: 'aiBubble',
  bubbleUser: 'bubbleUser',
  systemMessage: 'systemMessage',
  systemInfo: 'systemInfo',
  spinning: 'spinning',
  systemText: 'systemText',
}));

describe('MessageList', () => {
  it('메시지가 생성된 시각을 표시한다', () => {
    const timestamp = new Date('2000-01-01T00:00:00.000Z').getTime();
    const expectedTime = new Date(timestamp).toLocaleTimeString([], { hour12: false });
    const markup = renderToStaticMarkup(
      createElement(MessageList, {
        messages: [{ id: 'message-1', role: 'user', content: '안녕', timestamp }],
        agentStatus: 'idle',
      })
    );

    expect(markup).toContain(expectedTime);
  });
});
