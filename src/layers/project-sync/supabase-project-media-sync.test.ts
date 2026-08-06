import { describe, expect, it, vi } from 'vitest';
import type { IAuthClient } from '../auth/i-auth-client';
import type { IAudioSourceRepository } from '../audio-source-repository/i-audio-source-repository';
import type { ProjectAudioSource, ProjectDocument } from '../shared/types/project-document.schema';
import { ProjectSyncErrorCode } from './project-sync-error';
import { SupabaseProjectMediaSync } from './supabase-project-media-sync';

const USER_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const PROJECT_ID = '11111111-1111-4111-8111-111111111111';
const SOURCE_ID = '22222222-2222-4222-8222-222222222222';
const SECOND_SOURCE_ID = '33333333-3333-4333-8333-333333333333';
const TEST_CONTENT_HASH = '9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08';

function createAuthClient(authenticated = true): IAuthClient {
  return {
    getAccessToken: () => (authenticated ? 'access-token' : null),
    getSnapshot: () =>
      authenticated
        ? { status: 'authenticated', user: { id: USER_ID, email: null } }
        : { status: 'anonymous', user: null },
    signInWithMagicLink: async () => undefined,
    signOut: async () => undefined,
    subscribe: () => () => undefined,
  };
}

function createSource(id = SOURCE_ID): ProjectAudioSource {
  return {
    id,
    fileName: 'source.wav',
    mimeType: 'audio/wav',
    byteLength: 4,
    durationSeconds: 1,
  };
}

function createDocument(audioSources: readonly ProjectAudioSource[]): ProjectDocument {
  return {
    documentType: 'drop-ai-project',
    schemaVersion: 1,
    project: { id: PROJECT_ID, name: '새 프로젝트', revision: 0 },
    timeline: { timeUnit: 'seconds', tempoBpm: 120 },
    mixer: { masterVolume: 1 },
    exportRange: null,
    audioSources: [...audioSources],
    tracks: [],
  };
}

function createAudioSourceRepository(load: IAudioSourceRepository['load']): IAudioSourceRepository {
  return {
    create: async () => undefined,
    delete: async () => undefined,
    load,
  };
}

describe('SupabaseProjectMediaSync', () => {
  it('동일한 바이트는 한 번 업로드하고 Source별 서버 참조를 등록한다', async () => {
    const fetchImplementation = vi
      .fn()
      .mockResolvedValueOnce(new Response('{}', { status: 200 }))
      .mockResolvedValue(new Response(null, { status: 204 }));
    const mediaSync = new SupabaseProjectMediaSync({
      audioSourceRepository: createAudioSourceRepository(async () => new Blob(['test'], { type: 'audio/wav' })),
      authClient: createAuthClient(),
      fetchImplementation,
      supabasePublishableKey: 'publishable-key',
      supabaseUrl: 'https://example.supabase.co/',
    });

    await mediaSync.ensureProjectMedia(createDocument([createSource(), createSource(SECOND_SOURCE_ID)]));

    expect(fetchImplementation).toHaveBeenCalledTimes(3);
    expect(fetchImplementation).toHaveBeenNthCalledWith(
      1,
      `https://example.supabase.co/storage/v1/object/project-media/${USER_ID}/${TEST_CONTENT_HASH}`,
      expect.objectContaining({
        body: expect.any(Blob),
        headers: expect.objectContaining({
          Authorization: 'Bearer access-token',
          'Content-Type': 'audio/wav',
          apikey: 'publishable-key',
          'x-upsert': 'true',
        }),
        method: 'POST',
      })
    );
    expect(fetchImplementation).toHaveBeenNthCalledWith(
      2,
      'https://example.supabase.co/rest/v1/rpc/register_project_media',
      expect.objectContaining({
        body: expect.stringContaining(`"p_source_id":"${SOURCE_ID}"`),
        method: 'POST',
      })
    );
    expect(fetchImplementation).toHaveBeenNthCalledWith(
      3,
      'https://example.supabase.co/rest/v1/rpc/register_project_media',
      expect.objectContaining({
        body: expect.stringContaining(`"p_source_id":"${SECOND_SOURCE_ID}"`),
        method: 'POST',
      })
    );
  });

  it('로컬 Source 바이트가 없으면 서버 요청 전에 동기화를 중단한다', async () => {
    const fetchImplementation = vi.fn();
    const mediaSync = new SupabaseProjectMediaSync({
      audioSourceRepository: createAudioSourceRepository(async () => null),
      authClient: createAuthClient(),
      fetchImplementation,
      supabasePublishableKey: 'publishable-key',
      supabaseUrl: 'https://example.supabase.co',
    });

    await expect(mediaSync.ensureProjectMedia(createDocument([createSource()]))).rejects.toMatchObject({
      code: ProjectSyncErrorCode.LOCAL_MEDIA_MISSING,
      retryable: false,
    });
    expect(fetchImplementation).not.toHaveBeenCalled();
  });

  it('로그인하지 않은 상태에서는 로컬 Source도 읽지 않는다', async () => {
    const load = vi.fn();
    const mediaSync = new SupabaseProjectMediaSync({
      audioSourceRepository: createAudioSourceRepository(load),
      authClient: createAuthClient(false),
      fetchImplementation: vi.fn(),
      supabasePublishableKey: 'publishable-key',
      supabaseUrl: 'https://example.supabase.co',
    });

    await expect(mediaSync.ensureProjectMedia(createDocument([createSource()]))).rejects.toMatchObject({
      code: ProjectSyncErrorCode.AUTH_REQUIRED,
      retryable: true,
    });
    expect(load).not.toHaveBeenCalled();
  });
});
