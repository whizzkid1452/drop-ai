import { describe, expect, it, vi } from 'vitest';
import type { IProjectRepository, ProjectSummary } from '../project-repository/i-project-repository';
import { ProjectCatalogQuery } from './project-catalog-query';

const SUMMARY: ProjectSummary = {
  projectId: '11111111-1111-4111-8111-111111111111',
  name: '프로젝트',
  revision: 2,
  savedAtEpochMilliseconds: 100,
};

describe('ProjectCatalogQuery', () => {
  it('저장소의 프로젝트 목록을 복사해 반환한다', async () => {
    const repository = {
      create: vi.fn<IProjectRepository['create']>(),
      save: vi.fn<IProjectRepository['save']>(),
      load: vi.fn<IProjectRepository['load']>(),
      list: vi.fn<IProjectRepository['list']>().mockResolvedValue([SUMMARY]),
      delete: vi.fn<IProjectRepository['delete']>(),
    } satisfies IProjectRepository;
    const query = new ProjectCatalogQuery(repository);

    const result = await query.listProjects();

    expect(result).toEqual([SUMMARY]);
    expect(result[0]).not.toBe(SUMMARY);
    expect(repository.list).toHaveBeenCalledTimes(1);
  });
});
