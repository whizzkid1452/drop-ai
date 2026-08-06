import { describe, expect, it, vi } from 'vitest';
import type { IAuthClient } from '../auth/i-auth-client';
import type { ProjectOutboxEntry } from '../project-repository/i-project-repository';
import { ProjectSyncErrorCode } from './project-sync-error';
import { SupabaseProjectSyncGateway } from './supabase-project-sync-gateway';

const PROJECT_ID = '11111111-1111-4111-8111-111111111111';
const OPERATION_ID = '22222222-2222-4222-8222-222222222222';

function createAuthClient(accessToken: string | null): IAuthClient {
  return {
    getAccessToken: () => accessToken,
    getSnapshot: () => ({ status: 'unavailable', user: null }),
    signInWithMagicLink: async () => undefined,
    signOut: async () => undefined,
    subscribe: () => () => undefined,
  };
}

function createOutboxEntry({ includeCrdtUpdate = true } = {}): ProjectOutboxEntry {
  return {
    operationId: OPERATION_ID,
    projectId: PROJECT_ID,
    baseRevision: null,
    localRevision: 0,
    document: {
      documentType: 'drop-ai-project',
      schemaVersion: 1,
      project: { id: PROJECT_ID, name: '새 프로젝트', revision: 0 },
      timeline: { timeUnit: 'seconds', tempoBpm: 120 },
      mixer: { masterVolume: 1 },
      exportRange: null,
      audioSources: [],
      tracks: [],
    },
    ...(includeCrdtUpdate ? { crdtUpdateBase64: 'AQID' } : {}),
    createdAtEpochMilliseconds: 1_000,
    attemptCount: 0,
    nextAttemptAtEpochMilliseconds: 1_000,
  };
}

describe('SupabaseProjectSyncGateway', () => {
  it('새 Outbox 변경을 CRDT append RPC로 전송한다', async () => {
    const fetchImplementation = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ operationId: OPERATION_ID, sequenceId: 1, status: 'applied' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    );
    const gateway = new SupabaseProjectSyncGateway({
      authClient: createAuthClient('access-token'),
      fetchImplementation,
      supabasePublishableKey: 'publishable-key',
      supabaseUrl: 'https://example.supabase.co',
    });

    await expect(gateway.pushProjectChange(createOutboxEntry())).resolves.toEqual({
      kind: 'crdt-update',
      operationId: OPERATION_ID,
      sequenceId: 1,
      status: 'applied',
    });
    expect(fetchImplementation).toHaveBeenCalledWith(
      'https://example.supabase.co/rest/v1/rpc/append_project_crdt_update',
      expect.objectContaining({
        body: JSON.stringify({
          p_operation_id: OPERATION_ID,
          p_project_id: PROJECT_ID,
          p_update_base64: 'AQID',
        }),
        headers: expect.objectContaining({ Authorization: 'Bearer access-token', apikey: 'publishable-key' }),
        method: 'POST',
      })
    );
  });

  it('기존 JSON Outbox record는 snapshot RPC로 계속 전송한다', async () => {
    const fetchImplementation = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ operationId: OPERATION_ID, serverRevision: 0, status: 'applied' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    );
    const gateway = new SupabaseProjectSyncGateway({
      authClient: createAuthClient('access-token'),
      fetchImplementation,
      supabasePublishableKey: 'publishable-key',
      supabaseUrl: 'https://example.supabase.co',
    });

    await expect(gateway.pushProjectChange(createOutboxEntry({ includeCrdtUpdate: false }))).resolves.toEqual({
      kind: 'snapshot',
      operationId: OPERATION_ID,
      serverRevision: 0,
      status: 'applied',
    });
    expect(fetchImplementation).toHaveBeenCalledWith(
      'https://example.supabase.co/rest/v1/rpc/apply_project_change',
      expect.any(Object)
    );
  });

  it('로그인하지 않은 상태에서는 네트워크 요청을 보내지 않는다', async () => {
    const fetchImplementation = vi.fn();
    const gateway = new SupabaseProjectSyncGateway({
      authClient: createAuthClient(null),
      fetchImplementation,
      supabasePublishableKey: 'publishable-key',
      supabaseUrl: 'https://example.supabase.co',
    });

    await expect(gateway.pushProjectChange(createOutboxEntry({ includeCrdtUpdate: false }))).rejects.toMatchObject({
      code: ProjectSyncErrorCode.AUTH_REQUIRED,
      retryable: true,
    });
    expect(fetchImplementation).not.toHaveBeenCalled();
  });

  it('서버 revision 충돌 응답은 자동 재시도하지 않는 오류로 분류한다', async () => {
    const gateway = new SupabaseProjectSyncGateway({
      authClient: createAuthClient('access-token'),
      fetchImplementation: vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ operationId: OPERATION_ID, serverRevision: 3, status: 'revision_conflict' }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        })
      ),
      supabasePublishableKey: 'publishable-key',
      supabaseUrl: 'https://example.supabase.co',
    });

    await expect(gateway.pushProjectChange(createOutboxEntry({ includeCrdtUpdate: false }))).rejects.toMatchObject({
      code: ProjectSyncErrorCode.REVISION_CONFLICT,
      retryable: false,
    });
  });
});
