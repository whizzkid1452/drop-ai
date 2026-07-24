import { describe, expect, it } from 'vitest';
import { getProjectRouteRedirect } from './project-route-access';

describe('getProjectRouteRedirect', () => {
  it('프로젝트가 없으면 Drop 페이지로 이동시킨다', () => {
    expect(
      getProjectRouteRedirect({
        hasProject: false,
      })
    ).toBe('/');
  });

  it('프로젝트가 있으면 Agent 성공 결과 없이도 이동시키지 않는다', () => {
    expect(
      getProjectRouteRedirect({
        hasProject: true,
      })
    ).toBeNull();
  });
});
