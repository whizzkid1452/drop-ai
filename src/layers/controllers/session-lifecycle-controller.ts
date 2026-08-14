import type { SessionStore } from '../session/session';
import { readProjectDocumentV17 } from '../shared/types/project-document-reader';
import type {
  ProjectDocumentV17,
  ProjectLifecycleState,
  ProjectTemplate,
} from '../shared/types/project-document.schema';
import { createDefaultTrackRecordingState } from '../shared/types/multitrack-recording';
import { createDefaultRoutingGraphSnapshot } from '../shared/types/routing-state';
import type { ProjectController } from './project-controller';

interface SessionLifecycleControllerDependencies {
  readonly projectController: ProjectController;
  readonly sessionStore: SessionStore;
  readonly createId?: () => string;
  readonly now?: () => Date;
}

interface CreateTemplateRequest {
  readonly kind: ProjectTemplate['kind'];
  readonly name: string;
  readonly trackId?: string;
}

export class SessionLifecycleController {
  private readonly createId: () => string;
  private readonly now: () => Date;

  constructor(private readonly dependencies: SessionLifecycleControllerDependencies) {
    this.createId = dependencies.createId ?? (() => crypto.randomUUID());
    this.now = dependencies.now ?? (() => new Date());
  }

  createNamedSnapshot(name: string): string {
    const snapshot = {
      createdAt: this.now().toISOString(),
      document: this.dependencies.projectController.createSnapshotDocument(),
      id: this.createId(),
      name,
    };
    const lifecycle = this.getLifecycle();
    this.setLifecycle({ ...lifecycle, snapshots: [...lifecycle.snapshots, snapshot] });
    return snapshot.id;
  }

  deleteNamedSnapshot(snapshotId: string): void {
    const lifecycle = this.getLifecycle();
    this.setLifecycle({
      ...lifecycle,
      snapshots: lifecycle.snapshots.filter(snapshot => snapshot.id !== snapshotId),
    });
  }

  async restoreNamedSnapshot(snapshotId: string): Promise<void> {
    const snapshot = this.getLifecycle().snapshots.find(candidate => candidate.id === snapshotId);
    if (!snapshot) {
      throw new Error(`Named Snapshot을 찾을 수 없습니다: ${snapshotId}`);
    }
    await this.dependencies.projectController.restoreSnapshotDocument(snapshot.document);
  }

  createTemplate(request: CreateTemplateRequest): string {
    const currentDocument = this.dependencies.projectController.createSnapshotDocument();
    const document =
      request.kind === 'track' ? this.createTrackTemplateDocument(currentDocument, request.trackId) : currentDocument;
    const template = {
      createdAt: this.now().toISOString(),
      document,
      id: this.createId(),
      kind: request.kind,
      name: request.name,
    } as ProjectTemplate;
    const lifecycle = this.getLifecycle();
    this.setLifecycle({ ...lifecycle, templates: [...lifecycle.templates, template] });
    return template.id;
  }

  deleteTemplate(templateId: string): void {
    const lifecycle = this.getLifecycle();
    this.setLifecycle({
      ...lifecycle,
      templates: lifecycle.templates.filter(template => template.id !== templateId),
    });
  }

  async applyTemplate(templateId: string): Promise<void> {
    const template = this.getLifecycle().templates.find(candidate => candidate.id === templateId);
    if (!template) {
      throw new Error(`Template을 찾을 수 없습니다: ${templateId}`);
    }
    if (template.kind === 'session') {
      await this.dependencies.projectController.restoreSnapshotDocument(template.document);
      return;
    }
    await this.dependencies.projectController.restoreSnapshotDocument(this.mergeTrackTemplate(template.document));
  }

  private createTrackTemplateDocument(document: ProjectDocumentV17, trackId: string | undefined): ProjectDocumentV17 {
    if (!trackId) {
      throw new Error('Track Template에는 Track ID가 필요합니다.');
    }
    const track = document.tracks.find(candidate => candidate.id === trackId);
    if (!track) {
      throw new Error(`Track을 찾을 수 없습니다: ${trackId}`);
    }
    const templateTrack = {
      ...track,
      automationLanes: [],
      loopSlots: track.loopSlots.map(slot => ({
        ...slot,
        overdubSourceIds: [],
        recordedTempoBpm: null,
        sourceId: null,
      })),
      midi: track.midi ? { ...track.midi, regions: [] } : null,
      pluginInstances: track.pluginInstances.map(instance => ({ ...instance, sidechainSourceTrackId: null })),
      recording: createDefaultTrackRecordingState(),
      regions: [],
    };
    return readProjectDocumentV17({
      ...document,
      audioSources: [],
      mixer: { ...document.mixer, routing: createDefaultRoutingGraphSnapshot([track.id]) },
      recording: { ...document.recording, recoverableSources: [] },
      tracks: [templateTrack],
    });
  }

  private mergeTrackTemplate(templateDocument: ProjectDocumentV17): ProjectDocumentV17 {
    const currentDocument = this.dependencies.projectController.createSnapshotDocument();
    const templateTrack = templateDocument.tracks[0];
    const nextTrackId = this.createId();
    const pluginIdMap = new Map(templateTrack.pluginInstances.map(instance => [instance.id, this.createId()]));
    const track = {
      ...structuredClone(templateTrack),
      id: nextTrackId,
      loopSlots: templateTrack.loopSlots.map(slot => ({ ...slot, id: this.createId() })),
      pluginInstances: templateTrack.pluginInstances.map(instance => ({
        ...instance,
        id: pluginIdMap.get(instance.id) as string,
        sidechainSourceTrackId: null,
      })),
    };
    return readProjectDocumentV17({
      ...currentDocument,
      mixer: {
        ...currentDocument.mixer,
        routing: {
          ...currentDocument.mixer.routing,
          routes: [...currentDocument.mixer.routing.routes, ...createDefaultRoutingGraphSnapshot([nextTrackId]).routes],
        },
      },
      tracks: [...currentDocument.tracks, track],
    });
  }

  private getLifecycle(): ProjectLifecycleState {
    return this.dependencies.sessionStore.getState().lifecycle;
  }

  private setLifecycle(lifecycle: ProjectLifecycleState): void {
    this.dependencies.sessionStore.getState().setLifecycle(lifecycle);
  }
}
