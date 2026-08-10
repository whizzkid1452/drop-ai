import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AuthSnapshot, IAuthClient } from '@/layers/auth/i-auth-client';
import { InMemoryProjectRepository } from '@/layers/project-repository/in-memory-project-repository';
import type { ProjectDocument } from '@/layers/shared/types/project-document.schema';
import { createWebProjectSyncService } from './create-web-project-sync-service';

const PROJECT_ID = '11111111-1111-4111-8111-111111111111';
const OPERATION_ID = '22222222-2222-4222-8222-222222222222';

function createProjectDocument(): ProjectDocument {
  return {
    documentType: 'drop-ai-project',
    schemaVersion: 1,
    project: { id: PROJECT_ID, name: '새 프로젝트', revision: 0 },
    timeline: { timeUnit: 'seconds', tempoBpm: 120 },
    mixer: { masterVolume: 1 },
    exportRange: null,
    audioSources: [],
    tracks: [],
  };
}

describe('createWebProjectSyncService', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('로그인 상태가 복구되면 활성 프로젝트 Outbox를 즉시 다시 전송한다', async () => {
    let accessToken: string | null = null;
    let authSnapshot: AuthSnapshot = { status: 'anonymous', user: null };
    let authStateListener: (() => void) | undefined;
    const authClient: IAuthClient = {
      getAccessToken: () => accessToken,
      getSnapshot: () => authSnapshot,
      signInWithMagicLink: async () => undefined,
      signOut: async () => undefined,
      subscribe: listener => {
        authStateListener = listener;
        return () => undefined;
      },
    };
    const repository = new InMemoryProjectRepository({ now: () => 1_000 });
    await repository.commitLocal({
      document: createProjectDocument(),
      expectedRevision: 0,
      operationId: OPERATION_ID,
    });
    const fetchImplementation = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ operationId: OPERATION_ID, serverRevision: 0, status: 'applied' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    );
    vi.stubGlobal('fetch', fetchImplementation);
    const projectSync = createWebProjectSyncService({
      authClient,
      projectRepository: repository,
      supabasePublishableKey: 'publishable-key',
      supabaseUrl: 'https://example.supabase.co',
    });
    projectSync.activateProject(PROJECT_ID);
    await vi.waitFor(() => expect(fetchImplementation).not.toHaveBeenCalled());

    accessToken = 'access-token';
    authSnapshot = { status: 'authenticated', user: { id: 'user-1', email: null } };
    authStateListener?.();

    await vi.waitFor(() => expect(fetchImplementation).toHaveBeenCalledOnce());
    await vi.waitFor(async () => {
      await expect(repository.listPendingChanges({ dueAtEpochMilliseconds: 1_000 })).resolves.toEqual([]);
    });
  });
});
