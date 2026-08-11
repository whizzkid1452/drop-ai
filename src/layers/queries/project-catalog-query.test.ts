import { describe, expect, it, vi } from 'vitest';
import type { IProjectRepository, ProjectSummary } from '../project-repository/i-project-repository';
import type { IProjectSyncService } from '../project-sync/i-project-sync';
import { ProjectCatalogQuery } from './project-catalog-query';

const SUMMARY: ProjectSummary = {
  projectId: '11111111-1111-4111-8111-111111111111',
  name: '프로젝트',
  revision: 2,
  savedAtEpochMilliseconds: 100,
};

describe('ProjectCatalogQuery', () => {
  it('로컬 프로젝트와 중복되지 않는 원격 프로젝트를 함께 반환한다', async () => {
    const repository = {
      create: vi.fn<IProjectRepository['create']>(),
      save: vi.fn<IProjectRepository['save']>(),
      load: vi.fn<IProjectRepository['load']>(),
      list: vi.fn<IProjectRepository['list']>().mockResolvedValue([SUMMARY]),
      delete: vi.fn<IProjectRepository['delete']>(),
    } satisfies IProjectRepository;
    const projectSync = {
      activateProject: vi.fn(),
      ensureLocalProject: vi.fn(),
      ensureLocalProjectMedia: vi.fn(),
      listRemoteProjects: vi.fn().mockResolvedValue([
        {
          projectId: SUMMARY.projectId,
          latestSequenceId: 3,
          updatedAtEpochMilliseconds: 200,
        },
        {
          projectId: '22222222-2222-4222-8222-222222222222',
          latestSequenceId: 1,
          updatedAtEpochMilliseconds: 300,
        },
      ]),
      notifyProjectChanged: vi.fn(),
      resume: vi.fn(),
    } satisfies IProjectSyncService;
    const query = new ProjectCatalogQuery(repository, projectSync);

    const result = await query.listProjects();

    expect(result).toEqual([
      {
        availability: 'remote',
        localRevision: null,
        name: '원격 프로젝트 22222222',
        projectId: '22222222-2222-4222-8222-222222222222',
        savedAtEpochMilliseconds: 300,
      },
      {
        availability: 'local',
        localRevision: 2,
        name: '프로젝트',
        projectId: SUMMARY.projectId,
        savedAtEpochMilliseconds: 100,
      },
    ]);
    expect(repository.list).toHaveBeenCalledTimes(1);
    expect(projectSync.listRemoteProjects).toHaveBeenCalledTimes(1);
  });
});
