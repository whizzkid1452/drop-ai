import { AudioSourceRepositoryError } from '../audio-source-repository/errors';
import type { IAudioSourceRepository } from '../audio-source-repository/i-audio-source-repository';
import type {
  AudioSourceRegistration,
  ICommittedAudioSourceReader,
} from '../audio-source-registry/i-audio-source-registry';
import { createProjectDocumentFromSession } from '../project-document-mapper/project-document-mapper';
import type { IProjectRepository } from '../project-repository/i-project-repository';
import type { SessionStore } from '../session/session';
import type { ProjectDocument } from '../shared/types/project-document.schema';

interface ProjectControllerDependencies {
  readonly sessionStore: SessionStore;
  readonly audioSourceReader: ICommittedAudioSourceReader;
  readonly audioSourceRepository: IAudioSourceRepository;
  readonly projectRepository: IProjectRepository;
}

export class ProjectController {
  constructor(private readonly dependencies: ProjectControllerDependencies) {}

  async saveProject(): Promise<void> {
    const registrations = this.dependencies.audioSourceReader.listCommittedRegistrations();
    const document = createProjectDocumentFromSession({
      session: this.dependencies.sessionStore.getState(),
      audioSources: registrations.map(registration => registration.metadata),
    });

    await this.ensureAudioSources(registrations);
    const savedDocument = await this.saveDocument(document);
    this.dependencies.sessionStore.getState().replaceProjectMetadata(savedDocument.project);
  }

  private async ensureAudioSources(registrations: ReadonlyArray<Readonly<AudioSourceRegistration>>): Promise<void> {
    for (const registration of registrations) {
      await this.ensureAudioSource(registration);
    }
  }

  private async ensureAudioSource(registration: Readonly<AudioSourceRegistration>): Promise<void> {
    const storedBlob = await this.dependencies.audioSourceRepository.load(registration.metadata);
    if (storedBlob) {
      return;
    }

    try {
      await this.dependencies.audioSourceRepository.create(registration);
    } catch (cause) {
      if (!this.isConcurrentSourceCreation(cause)) {
        throw cause;
      }

      const concurrentlyStoredBlob = await this.dependencies.audioSourceRepository.load(registration.metadata);
      if (concurrentlyStoredBlob) {
        return;
      }

      throw cause;
    }
  }

  private async saveDocument(document: ProjectDocument): Promise<ProjectDocument> {
    const storedDocument = await this.dependencies.projectRepository.load(document.project.id);
    if (!storedDocument) {
      return this.dependencies.projectRepository.create(document);
    }

    return this.dependencies.projectRepository.save({
      document,
      expectedRevision: document.project.revision,
    });
  }

  private isConcurrentSourceCreation(cause: unknown): cause is AudioSourceRepositoryError {
    return cause instanceof AudioSourceRepositoryError && cause.code === 'SOURCE_ALREADY_EXISTS';
  }
}
