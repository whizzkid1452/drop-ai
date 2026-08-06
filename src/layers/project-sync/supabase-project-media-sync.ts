import type { IAuthClient } from '../auth/i-auth-client';
import type { IAudioSourceRepository } from '../audio-source-repository/i-audio-source-repository';
import type { ProjectAudioSource, ProjectDocumentSnapshot } from '../shared/types/project-document.schema';
import { calculateBlobSha256, Sha256UnavailableError } from '../shared/utils/calculate-blob-sha256';
import type { IProjectMediaSync } from './i-project-sync';
import { ProjectSyncError, ProjectSyncErrorCode } from './project-sync-error';

const PROJECT_MEDIA_BUCKET = 'project-media';
const DEFAULT_CONTENT_TYPE = 'application/octet-stream';

type FetchImplementation = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
type ContentHashCalculator = (blob: Blob) => Promise<string>;

interface SupabaseProjectMediaSyncOptions {
  readonly audioSourceRepository: IAudioSourceRepository;
  readonly authClient: IAuthClient;
  readonly contentHashCalculator?: ContentHashCalculator;
  readonly fetchImplementation?: FetchImplementation;
  readonly supabasePublishableKey: string;
  readonly supabaseUrl: string;
}

interface AuthenticatedRequestContext {
  readonly accessToken: string;
  readonly userId: string;
}

export class SupabaseProjectMediaSync implements IProjectMediaSync {
  readonly #audioSourceRepository: IAudioSourceRepository;
  readonly #authClient: IAuthClient;
  readonly #contentHashCalculator: ContentHashCalculator;
  readonly #fetchImplementation: FetchImplementation;
  readonly #supabasePublishableKey: string;
  readonly #supabaseUrl: string;
  readonly #uploadedContentKeys = new Set<string>();

  constructor({
    audioSourceRepository,
    authClient,
    contentHashCalculator = calculateProjectMediaContentHash,
    fetchImplementation = globalThis.fetch.bind(globalThis),
    supabasePublishableKey,
    supabaseUrl,
  }: SupabaseProjectMediaSyncOptions) {
    this.#audioSourceRepository = audioSourceRepository;
    this.#authClient = authClient;
    this.#contentHashCalculator = contentHashCalculator;
    this.#fetchImplementation = fetchImplementation;
    this.#supabasePublishableKey = supabasePublishableKey;
    this.#supabaseUrl = supabaseUrl.replace(/\/+$/, '');
  }

  async ensureProjectMedia(document: ProjectDocumentSnapshot): Promise<void> {
    const requestContext = this.#getAuthenticatedRequestContext();

    for (const source of document.audioSources) {
      const blob = await this.#audioSourceRepository.load(source);
      if (!blob) {
        throw new ProjectSyncError({
          code: ProjectSyncErrorCode.LOCAL_MEDIA_MISSING,
          message: `프로젝트가 참조하는 로컬 미디어가 없습니다: ${source.id}`,
          retryable: false,
          details: { projectId: document.project.id, sourceId: source.id },
        });
      }

      const contentHash = await this.#contentHashCalculator(blob);
      const contentKey = `${requestContext.userId}:${contentHash}`;
      if (!this.#uploadedContentKeys.has(contentKey)) {
        await this.#uploadContent({ blob, contentHash, requestContext, source });
        this.#uploadedContentKeys.add(contentKey);
      }
      await this.#registerProjectMedia({
        contentHash,
        projectId: document.project.id,
        requestContext,
        source,
      });
    }
  }

  async #uploadContent({
    blob,
    contentHash,
    requestContext,
    source,
  }: {
    readonly blob: Blob;
    readonly contentHash: string;
    readonly requestContext: AuthenticatedRequestContext;
    readonly source: ProjectAudioSource;
  }): Promise<void> {
    const objectPath = `${requestContext.userId}/${contentHash}`;
    const response = await this.#fetch(`${this.#supabaseUrl}/storage/v1/object/${PROJECT_MEDIA_BUCKET}/${objectPath}`, {
      method: 'POST',
      headers: this.#createHeaders(requestContext.accessToken, {
        'Content-Type': source.mimeType || DEFAULT_CONTENT_TYPE,
        'x-upsert': 'true',
      }),
      body: blob,
    });

    if (!response.ok) {
      throw await this.#createHttpError(response, '미디어 업로드');
    }
  }

  async #registerProjectMedia({
    contentHash,
    projectId,
    requestContext,
    source,
  }: {
    readonly contentHash: string;
    readonly projectId: string;
    readonly requestContext: AuthenticatedRequestContext;
    readonly source: ProjectAudioSource;
  }): Promise<void> {
    const response = await this.#fetch(`${this.#supabaseUrl}/rest/v1/rpc/register_project_media`, {
      method: 'POST',
      headers: this.#createHeaders(requestContext.accessToken, { 'Content-Type': 'application/json' }),
      body: JSON.stringify({
        p_byte_length: source.byteLength,
        p_content_hash: contentHash,
        p_mime_type: source.mimeType,
        p_project_id: projectId,
        p_source_id: source.id,
      }),
    });

    if (!response.ok) {
      throw await this.#createHttpError(response, '미디어 참조 등록');
    }
  }

  async #fetch(input: RequestInfo | URL, init: RequestInit): Promise<Response> {
    try {
      return await this.#fetchImplementation(input, init);
    } catch (cause) {
      throw new ProjectSyncError({
        code: ProjectSyncErrorCode.NETWORK_ERROR,
        message: '프로젝트 미디어 서버에 연결하지 못했습니다.',
        retryable: true,
        cause,
      });
    }
  }

  #getAuthenticatedRequestContext(): AuthenticatedRequestContext {
    const accessToken = this.#authClient.getAccessToken();
    const snapshot = this.#authClient.getSnapshot();
    if (!accessToken || snapshot.status !== 'authenticated') {
      throw new ProjectSyncError({
        code: ProjectSyncErrorCode.AUTH_REQUIRED,
        message: '프로젝트 미디어를 동기화하려면 로그인이 필요합니다.',
        retryable: true,
      });
    }

    return { accessToken, userId: snapshot.user.id };
  }

  #createHeaders(accessToken: string, additionalHeaders: Readonly<Record<string, string>>): HeadersInit {
    return {
      apikey: this.#supabasePublishableKey,
      Authorization: `Bearer ${accessToken}`,
      ...additionalHeaders,
    };
  }

  async #createHttpError(response: Response, operation: string): Promise<ProjectSyncError> {
    const responseBody = await response.text().catch(() => '');
    const isAuthenticationFailure = response.status === 401 || response.status === 403;
    return new ProjectSyncError({
      code: isAuthenticationFailure ? ProjectSyncErrorCode.AUTH_REQUIRED : ProjectSyncErrorCode.REMOTE_ERROR,
      message: isAuthenticationFailure
        ? '프로젝트 미디어 동기화 인증이 만료됐습니다.'
        : `${operation} 요청을 서버가 거부했습니다: ${response.status}`,
      retryable:
        isAuthenticationFailure || response.status === 408 || response.status === 429 || response.status >= 500,
      details: { operation, responseBody, status: response.status },
    });
  }
}

async function calculateProjectMediaContentHash(blob: Blob): Promise<string> {
  try {
    return await calculateBlobSha256(blob);
  } catch (cause) {
    if (!(cause instanceof Sha256UnavailableError)) {
      throw cause;
    }
    throw new ProjectSyncError({
      code: ProjectSyncErrorCode.REMOTE_ERROR,
      message: '이 환경에서는 미디어 SHA-256 계산을 사용할 수 없습니다.',
      retryable: false,
      cause,
    });
  }
}
