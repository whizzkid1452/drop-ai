import { z } from 'zod';
import type { IAuthClient } from '../auth/i-auth-client';
import { AudioSourceRepositoryError, AudioSourceRepositoryErrorCode } from '../audio-source-repository/errors';
import type { IAudioSourceRepository } from '../audio-source-repository/i-audio-source-repository';
import type { ProjectAudioSource, ProjectDocumentSnapshot } from '../shared/types/project-document.schema';
import { calculateBlobSha256, Sha256UnavailableError } from '../shared/utils/calculate-blob-sha256';
import type { IProjectMediaSync } from './i-project-sync';
import { ProjectSyncError, ProjectSyncErrorCode } from './project-sync-error';

const PROJECT_MEDIA_BUCKET = 'project-media';
const PROJECT_MEDIA_REFERENCE_BATCH_SIZE = 100;
const DEFAULT_CONTENT_TYPE = 'application/octet-stream';
const ContentHashSchema = z.string().regex(/^[a-f0-9]{64}$/u);
const ProjectMediaReferenceSchema = z.strictObject({
  source_id: z.uuid(),
  content_hash: ContentHashSchema,
  byte_length: z.number().int().nonnegative().safe(),
  mime_type: z.string(),
  storage_path: z.string().min(1),
});
const ProjectMediaReferencesSchema = z.array(ProjectMediaReferenceSchema);

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

type ProjectMediaReference = z.infer<typeof ProjectMediaReferenceSchema>;

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

  async ensureLocalProjectMedia(document: ProjectDocumentSnapshot): Promise<void> {
    const missingSources: ProjectAudioSource[] = [];
    for (const source of document.audioSources) {
      if (!(await this.#audioSourceRepository.load(source))) {
        missingSources.push(source);
      }
    }
    if (missingSources.length === 0) {
      return;
    }

    const requestContext = this.#getAuthenticatedRequestContext();
    const references = await this.#fetchProjectMediaReferences({
      projectId: document.project.id,
      requestContext,
      sources: missingSources,
    });
    const downloadedContent = new Map<string, Blob>();
    for (const source of missingSources) {
      const reference = this.#requireMatchingReference({ references, requestContext, source });
      let blob = downloadedContent.get(reference.content_hash);
      if (!blob) {
        blob = await this.#downloadProjectMedia({ reference, requestContext, source });
        downloadedContent.set(reference.content_hash, blob);
      }
      await this.#createLocalSource({ blob, source });
    }
  }

  async #fetchProjectMediaReferences({
    projectId,
    requestContext,
    sources,
  }: {
    readonly projectId: string;
    readonly requestContext: AuthenticatedRequestContext;
    readonly sources: readonly ProjectAudioSource[];
  }): Promise<readonly ProjectMediaReference[]> {
    const references: ProjectMediaReference[] = [];
    for (let sourceIndex = 0; sourceIndex < sources.length; sourceIndex += PROJECT_MEDIA_REFERENCE_BATCH_SIZE) {
      const sourceBatch = sources.slice(sourceIndex, sourceIndex + PROJECT_MEDIA_REFERENCE_BATCH_SIZE);
      const url = new URL(`${this.#supabaseUrl}/rest/v1/project_media_refs`);
      url.searchParams.set('select', 'source_id,content_hash,byte_length,mime_type,storage_path');
      url.searchParams.set('project_id', `eq.${projectId}`);
      url.searchParams.set('source_id', `in.(${sourceBatch.map(source => source.id).join(',')})`);
      const response = await this.#fetch(url, {
        method: 'GET',
        headers: this.#createHeaders(requestContext.accessToken, {}),
      });
      if (!response.ok) {
        throw await this.#createHttpError(response, '미디어 참조 조회');
      }

      const responseBody = await response.json().catch(cause => {
        throw this.#createInvalidResponseError('미디어 참조 응답을 JSON으로 읽지 못했습니다.', cause);
      });
      const result = ProjectMediaReferencesSchema.safeParse(responseBody);
      if (!result.success) {
        throw this.#createInvalidResponseError('미디어 참조 응답 형식이 올바르지 않습니다.', result.error);
      }
      references.push(...result.data);
    }
    return references;
  }

  #requireMatchingReference({
    references,
    requestContext,
    source,
  }: {
    readonly references: readonly ProjectMediaReference[];
    readonly requestContext: AuthenticatedRequestContext;
    readonly source: ProjectAudioSource;
  }): ProjectMediaReference {
    const sourceReferences = references.filter(reference => reference.source_id === source.id);
    const [reference] = sourceReferences;
    const isValid =
      sourceReferences.length === 1 &&
      reference !== undefined &&
      reference.byte_length === source.byteLength &&
      reference.mime_type === source.mimeType &&
      reference.storage_path === `${requestContext.userId}/${reference.content_hash}`;
    if (!isValid || !reference) {
      throw this.#createInvalidResponseError('서버 미디어 참조가 프로젝트 Source metadata와 일치하지 않습니다.', {
        sourceId: source.id,
      });
    }
    return reference;
  }

  async #downloadProjectMedia({
    reference,
    requestContext,
    source,
  }: {
    readonly reference: ProjectMediaReference;
    readonly requestContext: AuthenticatedRequestContext;
    readonly source: ProjectAudioSource;
  }): Promise<Blob> {
    const response = await this.#fetch(
      `${this.#supabaseUrl}/storage/v1/object/${PROJECT_MEDIA_BUCKET}/${reference.storage_path}`,
      {
        method: 'GET',
        headers: this.#createHeaders(requestContext.accessToken, {}),
      }
    );
    if (!response.ok) {
      throw await this.#createHttpError(response, '미디어 다운로드');
    }

    const downloadedBlob = await response.blob();
    const contentHash = await this.#contentHashCalculator(downloadedBlob);
    // private Storage 응답도 손상되거나 잘못 연결될 수 있으므로 문서 metadata와 참조 hash를 모두 확인한다.
    if (downloadedBlob.size !== source.byteLength || contentHash !== reference.content_hash) {
      throw this.#createInvalidResponseError('다운로드한 미디어의 크기 또는 SHA-256이 참조와 일치하지 않습니다.', {
        actualByteLength: downloadedBlob.size,
        actualContentHash: contentHash,
        expectedByteLength: source.byteLength,
        expectedContentHash: reference.content_hash,
        sourceId: source.id,
      });
    }
    return new Blob([downloadedBlob], { type: source.mimeType });
  }

  async #createLocalSource({
    blob,
    source,
  }: {
    readonly blob: Blob;
    readonly source: ProjectAudioSource;
  }): Promise<void> {
    try {
      await this.#audioSourceRepository.create({ blob, metadata: source });
    } catch (cause) {
      if (
        !(cause instanceof AudioSourceRepositoryError) ||
        cause.code !== AudioSourceRepositoryErrorCode.SOURCE_ALREADY_EXISTS
      ) {
        throw cause;
      }
      if (!(await this.#audioSourceRepository.load(source))) {
        throw cause;
      }
    }
  }

  #createInvalidResponseError(message: string, cause: unknown): ProjectSyncError {
    return new ProjectSyncError({
      code: ProjectSyncErrorCode.INVALID_RESPONSE,
      message,
      retryable: false,
      cause,
    });
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
