import { z } from 'zod';
import type { IAuthClient } from '../auth/i-auth-client';
import { isEncodedProjectCrdtUpdate } from '../project-crdt/project-crdt-update-codec';
import type { ProjectOutboxEntry } from '../project-repository/i-project-repository';
import type { IProjectSyncGateway, ProjectSyncSuccess, PullProjectUpdatesRequest } from './i-project-sync';
import { ProjectSyncError, ProjectSyncErrorCode } from './project-sync-error';

const SnapshotSyncResponseSchema = z.strictObject({
  operationId: z.uuid(),
  serverRevision: z.number().int().nonnegative(),
  status: z.enum(['already_applied', 'applied', 'revision_conflict']),
});

const CrdtSyncResponseSchema = z.strictObject({
  operationId: z.uuid(),
  sequenceId: z.number().int().positive(),
  status: z.enum(['already_applied', 'applied']),
});

const PullProjectUpdatesRequestSchema = z.strictObject({
  afterSequenceId: z.number().int().nonnegative().safe(),
  limit: z.number().int().positive().max(1_000),
  projectId: z.uuid(),
});

const RemoteProjectCrdtUpdateSchema = z.strictObject({
  operation_id: z.uuid(),
  sequence_id: z.number().int().positive().safe(),
  update_base64: z.string().refine(isEncodedProjectCrdtUpdate),
});

type FetchImplementation = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

interface SupabaseProjectSyncGatewayOptions {
  readonly authClient: IAuthClient;
  readonly fetchImplementation?: FetchImplementation;
  readonly supabasePublishableKey: string;
  readonly supabaseUrl: string;
}

export class SupabaseProjectSyncGateway implements IProjectSyncGateway {
  readonly #authClient: IAuthClient;
  readonly #fetchImplementation: FetchImplementation;
  readonly #supabasePublishableKey: string;
  readonly #supabaseUrl: string;

  constructor({
    authClient,
    fetchImplementation = globalThis.fetch.bind(globalThis),
    supabasePublishableKey,
    supabaseUrl,
  }: SupabaseProjectSyncGatewayOptions) {
    this.#authClient = authClient;
    this.#fetchImplementation = fetchImplementation;
    this.#supabasePublishableKey = supabasePublishableKey;
    this.#supabaseUrl = supabaseUrl.replace(/\/+$/, '');
  }

  async pullProjectUpdates(request: PullProjectUpdatesRequest) {
    const validatedRequest = PullProjectUpdatesRequestSchema.safeParse(request);
    if (!validatedRequest.success) {
      throw new ProjectSyncError({
        code: ProjectSyncErrorCode.INVALID_REQUEST,
        message: '원격 프로젝트 update 조회 조건이 유효하지 않습니다.',
        retryable: false,
        cause: validatedRequest.error,
      });
    }
    const accessToken = this.#requireAccessToken();
    const { afterSequenceId, limit, projectId } = validatedRequest.data;
    const url = new URL(`${this.#supabaseUrl}/rest/v1/project_crdt_updates`);
    url.searchParams.set('select', 'sequence_id,operation_id,update_base64');
    url.searchParams.set('project_id', `eq.${projectId}`);
    url.searchParams.set('sequence_id', `gt.${afterSequenceId}`);
    url.searchParams.set('order', 'sequence_id.asc');
    url.searchParams.set('limit', String(limit));

    let response: Response;
    try {
      response = await this.#fetchImplementation(url, {
        method: 'GET',
        headers: {
          apikey: this.#supabasePublishableKey,
          Authorization: `Bearer ${accessToken}`,
        },
      });
    } catch (cause) {
      throw new ProjectSyncError({
        code: ProjectSyncErrorCode.NETWORK_ERROR,
        message: '원격 프로젝트 update를 조회하지 못했습니다.',
        retryable: true,
        cause,
      });
    }
    if (!response.ok) {
      throw await this.#createHttpError(response);
    }

    const responseBody = await this.#readJsonResponse(response);
    const result = z.array(RemoteProjectCrdtUpdateSchema).safeParse(responseBody);
    if (!result.success) {
      throw this.#createInvalidResponseError(result.error);
    }
    return result.data.map(update => ({
      operationId: update.operation_id,
      sequenceId: update.sequence_id,
      updateBase64: update.update_base64,
    }));
  }

  async pushProjectChange(change: ProjectOutboxEntry): Promise<ProjectSyncSuccess> {
    const accessToken = this.#requireAccessToken();

    const isCrdtUpdate = change.crdtUpdateBase64 !== undefined;
    const rpcName = isCrdtUpdate ? 'append_project_crdt_update' : 'apply_project_change';
    const requestBody = isCrdtUpdate
      ? {
          p_operation_id: change.operationId,
          p_project_id: change.projectId,
          p_update_base64: change.crdtUpdateBase64,
        }
      : {
          p_base_revision: change.baseRevision,
          p_document: change.document,
          p_local_revision: change.localRevision,
          p_operation_id: change.operationId,
          p_project_id: change.projectId,
        };

    let response: Response;
    try {
      response = await this.#fetchImplementation(`${this.#supabaseUrl}/rest/v1/rpc/${rpcName}`, {
        method: 'POST',
        headers: {
          apikey: this.#supabasePublishableKey,
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });
    } catch (cause) {
      throw new ProjectSyncError({
        code: ProjectSyncErrorCode.NETWORK_ERROR,
        message: '프로젝트 동기화 서버에 연결하지 못했습니다.',
        retryable: true,
        cause,
      });
    }

    if (!response.ok) {
      throw await this.#createHttpError(response);
    }

    const responseBody = await this.#readJsonResponse(response);
    if (isCrdtUpdate) {
      const result = CrdtSyncResponseSchema.safeParse(responseBody);
      if (!result.success) {
        throw this.#createInvalidResponseError(result.error);
      }
      return { kind: 'crdt-update', ...result.data };
    }

    const result = SnapshotSyncResponseSchema.safeParse(responseBody);
    if (!result.success) {
      throw this.#createInvalidResponseError(result.error);
    }
    const { operationId, serverRevision, status } = result.data;
    if (status === 'revision_conflict') {
      throw new ProjectSyncError({
        code: ProjectSyncErrorCode.REVISION_CONFLICT,
        message: '서버 프로젝트 revision과 로컬 변경의 기준 revision이 다릅니다.',
        retryable: false,
        details: { operationId, serverRevision },
      });
    }
    return { kind: 'snapshot', operationId, serverRevision, status };
  }

  #requireAccessToken(): string {
    const accessToken = this.#authClient.getAccessToken();
    if (accessToken) {
      return accessToken;
    }
    throw new ProjectSyncError({
      code: ProjectSyncErrorCode.AUTH_REQUIRED,
      message: '프로젝트를 동기화하려면 로그인이 필요합니다.',
      retryable: true,
    });
  }

  async #readJsonResponse(response: Response): Promise<unknown> {
    return response.json().catch(cause => {
      throw new ProjectSyncError({
        code: ProjectSyncErrorCode.INVALID_RESPONSE,
        message: '프로젝트 동기화 서버 응답을 읽지 못했습니다.',
        retryable: false,
        cause,
      });
    });
  }

  #createInvalidResponseError(cause: unknown): ProjectSyncError {
    return new ProjectSyncError({
      code: ProjectSyncErrorCode.INVALID_RESPONSE,
      message: '프로젝트 동기화 서버 응답 형식이 유효하지 않습니다.',
      retryable: false,
      cause,
    });
  }

  async #createHttpError(response: Response): Promise<ProjectSyncError> {
    const responseText = await response.text().catch(() => '');
    const isAuthenticationFailure = response.status === 401 || response.status === 403;
    return new ProjectSyncError({
      code: isAuthenticationFailure ? ProjectSyncErrorCode.AUTH_REQUIRED : ProjectSyncErrorCode.REMOTE_ERROR,
      message: isAuthenticationFailure
        ? '프로젝트 동기화 인증이 만료됐습니다.'
        : `프로젝트 동기화 서버가 요청을 거부했습니다: ${response.status}`,
      retryable:
        isAuthenticationFailure || response.status === 408 || response.status === 429 || response.status >= 500,
      details: { responseBody: responseText, status: response.status },
    });
  }
}
