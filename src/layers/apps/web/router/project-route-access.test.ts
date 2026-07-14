import { describe, expect, it } from 'vitest';
import { getProjectRouteRedirect } from './project-route-access';

describe('getProjectRouteRedirect', () => {
  it('프로젝트가 없으면 Drop 페이지로 이동시킨다', () => {
    expect(
      getProjectRouteRedirect({
        hasProject: false,
        requiresAgentResult: false,
        hasSuccessfulAgentResult: false,
      })
    ).toBe('/');
  });

  it('Agent 결과가 필요하지만 성공 결과가 없으면 Preview 페이지로 이동시킨다', () => {
    expect(
      getProjectRouteRedirect({
        hasProject: true,
        requiresAgentResult: true,
        hasSuccessfulAgentResult: false,
      })
    ).toBe('/preview');
  });

  it('프로젝트와 Agent 성공 결과가 있으면 이동시키지 않는다', () => {
    expect(
      getProjectRouteRedirect({
        hasProject: true,
        requiresAgentResult: true,
        hasSuccessfulAgentResult: true,
      })
    ).toBeNull();
  });
});
