import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { AgentPreviewContent } from './AgentPreviewPage';

vi.mock('@/layers/apps/web/components/Daw/components/Terminals/AgentTerminal/AgentTerminal', () => ({
  AgentTerminal: () => createElement('div', null, 'Agent chat'),
}));

vi.mock('./PreviewActionBar', () => ({
  PreviewActionBar: () => createElement('div', null, 'Preview ready Export Go Edit'),
}));

vi.mock('./AgentPreviewPage.css', () => ({
  page: 'page',
  heading: 'heading',
  title: 'title',
  description: 'description',
  chatPanel: 'chatPanel',
  errorMessage: 'errorMessage',
}));

function renderAgentPreview(agentRunStatus: 'idle' | 'succeeded'): string {
  return renderToStaticMarkup(
    createElement(AgentPreviewContent, {
      agentRunStatus,
      onGoEdit: vi.fn(),
    })
  );
}

describe('AgentPreviewPage', () => {
  it('Agent 결과가 없으면 결과 액션을 표시하지 않는다', () => {
    expect(renderAgentPreview('idle')).not.toContain('Go Edit');
  });

  it('Agent 명령이 성공하면 결과 액션을 표시한다', () => {
    const page = renderAgentPreview('succeeded');

    expect(page).toContain('Preview ready');
    expect(page).toContain('Export');
    expect(page).toContain('Go Edit');
  });
});
