import type { IAuthClient } from '@/layers/auth/i-auth-client';
import type { IAudioSourceRepository } from '@/layers/audio-source-repository/i-audio-source-repository';
import type { ILocalFirstProjectRepository } from '@/layers/project-repository/i-project-repository';
import {
  NoopProjectSyncService,
  type IProjectSyncService,
  type IRemoteProjectDocumentApplicator,
} from '@/layers/project-sync/i-project-sync';
import { ProjectSyncCoordinator } from '@/layers/project-sync/project-sync-coordinator';
import { SupabaseProjectMediaSync } from '@/layers/project-sync/supabase-project-media-sync';
import { SupabaseProjectSyncGateway } from '@/layers/project-sync/supabase-project-sync-gateway';

interface OnlineEventSource {
  addEventListener(type: 'online', listener: () => void): void;
}

interface CreateWebProjectSyncServiceOptions {
  readonly audioSourceRepository: IAudioSourceRepository;
  readonly authClient: IAuthClient;
  readonly onlineEventSource?: OnlineEventSource;
  readonly projectRepository: ILocalFirstProjectRepository;
  readonly remoteProjectDocumentApplicator: IRemoteProjectDocumentApplicator;
  readonly supabasePublishableKey?: string;
  readonly supabaseUrl?: string;
}

function hasSupabaseConfiguration(
  options: CreateWebProjectSyncServiceOptions
): options is CreateWebProjectSyncServiceOptions & {
  readonly supabasePublishableKey: string;
  readonly supabaseUrl: string;
} {
  return Boolean(options.supabaseUrl?.trim() && options.supabasePublishableKey?.trim());
}

export function createWebProjectSyncService(options: CreateWebProjectSyncServiceOptions): IProjectSyncService {
  if (!hasSupabaseConfiguration(options)) {
    return new NoopProjectSyncService();
  }

  const coordinator = new ProjectSyncCoordinator({
    gateway: new SupabaseProjectSyncGateway({
      authClient: options.authClient,
      supabasePublishableKey: options.supabasePublishableKey,
      supabaseUrl: options.supabaseUrl,
    }),
    mediaSync: new SupabaseProjectMediaSync({
      audioSourceRepository: options.audioSourceRepository,
      authClient: options.authClient,
      supabasePublishableKey: options.supabasePublishableKey,
      supabaseUrl: options.supabaseUrl,
    }),
    remoteProjectDocumentApplicator: options.remoteProjectDocumentApplicator,
    repository: options.projectRepository,
  });
  options.authClient.subscribe(() => {
    if (options.authClient.getSnapshot().status === 'authenticated') {
      coordinator.resume();
    }
  });
  options.onlineEventSource?.addEventListener('online', () => coordinator.resume());
  return coordinator;
}
