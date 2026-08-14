import { useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useCommandExecutor, useSession, useSessionRecoveryCheckpoint } from '@/layers/apps/web/context/layer-hooks';
import { AudioCommandType } from '@/types/audioCommand.schema';
import * as styles from './SessionLifecycleControl.css';

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function downloadArchive(blob: Blob, projectName: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `${projectName.replaceAll(/[^a-zA-Z0-9가-힣_-]+/g, '-') || 'session'}.dropai-archive`;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function SessionLifecycleControl() {
  const commandExecutor = useCommandExecutor();
  const project = useSession(state => state.project);
  const lifecycle = useSession(state => state.lifecycle);
  const trackMap = useSession(state => state.tracks);
  const tracks = useMemo(() => [...trackMap.values()].map(track => ({ id: track.id, name: track.name })), [trackMap]);
  const recovery = useSessionRecoveryCheckpoint();
  const [isOpen, setIsOpen] = useState(false);
  const [snapshotName, setSnapshotName] = useState('');
  const [templateName, setTemplateName] = useState('');
  const [templateKind, setTemplateKind] = useState<'session' | 'track'>('session');
  const [trackId, setTrackId] = useState('');
  const [isBusy, setIsBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const archiveInputRef = useRef<HTMLInputElement>(null);
  const recoverableCheckpoint = useMemo(() => {
    if (!recovery) {
      return null;
    }
    return recovery.projectId !== project.id || recovery.projectRevision > project.revision ? recovery : null;
  }, [project.id, project.revision, recovery]);

  const run = async (operation: () => Promise<unknown>) => {
    if (isBusy) {
      return;
    }
    setIsBusy(true);
    setErrorMessage(null);
    try {
      await operation();
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsBusy(false);
    }
  };

  const createSnapshot = () =>
    run(async () => {
      await commandExecutor.execute({ name: snapshotName, type: AudioCommandType.CREATE_NAMED_SNAPSHOT });
      setSnapshotName('');
    });

  const createTemplate = () =>
    run(async () => {
      await commandExecutor.execute({
        kind: templateKind,
        name: templateName,
        trackId: templateKind === 'track' ? trackId || tracks[0]?.id : undefined,
        type: AudioCommandType.CREATE_PROJECT_TEMPLATE,
      });
      setTemplateName('');
    });

  const exportArchive = () =>
    run(async () => {
      const result = await commandExecutor.execute({ type: AudioCommandType.EXPORT_PROJECT_ARCHIVE });
      if (!(result instanceof Blob)) {
        throw new Error('Archive Blob을 생성하지 못했습니다.');
      }
      downloadArchive(result, project.name);
    });

  const importArchive = (archive: File) =>
    run(async () => {
      await commandExecutor.execute({ archive, type: AudioCommandType.IMPORT_PROJECT_ARCHIVE });
      if (archiveInputRef.current) {
        archiveInputRef.current.value = '';
      }
    });

  return (
    <>
      <button className={styles.trigger} onClick={() => setIsOpen(true)} type="button">
        Session
        {recoverableCheckpoint ? <span className={styles.recoveryDot} aria-label="Recovery available" /> : null}
      </button>
      {isOpen
        ? createPortal(
            <div className={styles.backdrop} role="presentation">
              <section aria-label="Session lifecycle" aria-modal="true" className={styles.dialog} role="dialog">
                <header className={styles.dialogHeader}>
                  <div>
                    <h2>Session lifecycle</h2>
                    <p>Snapshots, templates, archive and crash recovery</p>
                  </div>
                  <button
                    aria-label="Close Session lifecycle"
                    className={styles.closeButton}
                    onClick={() => setIsOpen(false)}
                  >
                    ×
                  </button>
                </header>
                <div className={styles.content}>
                  {recoverableCheckpoint ? (
                    <section className={styles.recoveryCard} aria-label="Crash recovery">
                      <div>
                        <strong>Recover {recoverableCheckpoint.projectName}</strong>
                        <span>revision {recoverableCheckpoint.projectRevision}</span>
                      </div>
                      <div className={styles.inlineActions}>
                        <button
                          disabled={isBusy}
                          onClick={() =>
                            run(async () => {
                              await commandExecutor.execute({
                                projectId: recoverableCheckpoint.projectId,
                                type: AudioCommandType.LOAD_PROJECT,
                              });
                              await commandExecutor.execute({
                                projectId: recoverableCheckpoint.projectId,
                                type: AudioCommandType.DISMISS_SESSION_RECOVERY,
                              });
                            })
                          }
                        >
                          Recover
                        </button>
                        <button
                          disabled={isBusy}
                          onClick={() =>
                            run(() =>
                              commandExecutor.execute({
                                projectId: recoverableCheckpoint.projectId,
                                type: AudioCommandType.DISMISS_SESSION_RECOVERY,
                              })
                            )
                          }
                        >
                          Dismiss
                        </button>
                      </div>
                    </section>
                  ) : null}

                  <section className={styles.panel} aria-labelledby="snapshot-heading">
                    <div className={styles.sectionHeader}>
                      <div>
                        <h3 id="snapshot-heading">Named snapshots</h3>
                        <span>{lifecycle.snapshots.length} saved</span>
                      </div>
                      <div className={styles.inlineForm}>
                        <input
                          aria-label="Snapshot name"
                          maxLength={120}
                          onChange={event => setSnapshotName(event.target.value)}
                          placeholder="Before mix"
                          value={snapshotName}
                        />
                        <button disabled={isBusy || snapshotName.trim().length === 0} onClick={createSnapshot}>
                          Create snapshot
                        </button>
                      </div>
                    </div>
                    <div className={styles.list}>
                      {lifecycle.snapshots.length === 0 ? <p className={styles.empty}>No snapshots</p> : null}
                      {lifecycle.snapshots.map(snapshot => (
                        <article className={styles.listRow} key={snapshot.id}>
                          <div>
                            <strong>{snapshot.name}</strong>
                            <span>{new Date(snapshot.createdAt).toLocaleString()}</span>
                          </div>
                          <div className={styles.inlineActions}>
                            <button
                              disabled={isBusy}
                              onClick={() =>
                                run(() =>
                                  commandExecutor.execute({
                                    snapshotId: snapshot.id,
                                    type: AudioCommandType.RESTORE_NAMED_SNAPSHOT,
                                  })
                                )
                              }
                            >
                              Restore
                            </button>
                            <button
                              disabled={isBusy}
                              onClick={() =>
                                run(() =>
                                  commandExecutor.execute({
                                    snapshotId: snapshot.id,
                                    type: AudioCommandType.DELETE_NAMED_SNAPSHOT,
                                  })
                                )
                              }
                            >
                              Delete
                            </button>
                          </div>
                        </article>
                      ))}
                    </div>
                  </section>

                  <section className={styles.panel} aria-labelledby="template-heading">
                    <div className={styles.sectionHeader}>
                      <div>
                        <h3 id="template-heading">Templates</h3>
                        <span>{lifecycle.templates.length} saved</span>
                      </div>
                      <div className={styles.inlineForm}>
                        <select
                          aria-label="Template kind"
                          value={templateKind}
                          onChange={event => setTemplateKind(event.target.value as 'session' | 'track')}
                        >
                          <option value="session">Session</option>
                          <option value="track">Track</option>
                        </select>
                        {templateKind === 'track' ? (
                          <select
                            aria-label="Template track"
                            value={trackId || tracks[0]?.id || ''}
                            onChange={event => setTrackId(event.target.value)}
                          >
                            {tracks.map(track => (
                              <option key={track.id} value={track.id}>
                                {track.name}
                              </option>
                            ))}
                          </select>
                        ) : null}
                        <input
                          aria-label="Template name"
                          maxLength={120}
                          onChange={event => setTemplateName(event.target.value)}
                          placeholder="Vocal chain"
                          value={templateName}
                        />
                        <button
                          disabled={
                            isBusy ||
                            templateName.trim().length === 0 ||
                            (templateKind === 'track' && tracks.length === 0)
                          }
                          onClick={createTemplate}
                        >
                          Save template
                        </button>
                      </div>
                    </div>
                    <div className={styles.list}>
                      {lifecycle.templates.length === 0 ? <p className={styles.empty}>No templates</p> : null}
                      {lifecycle.templates.map(template => (
                        <article className={styles.listRow} key={template.id}>
                          <div>
                            <strong>{template.name}</strong>
                            <span>{template.kind}</span>
                          </div>
                          <div className={styles.inlineActions}>
                            <button
                              disabled={isBusy}
                              onClick={() =>
                                run(() =>
                                  commandExecutor.execute({
                                    templateId: template.id,
                                    type: AudioCommandType.APPLY_PROJECT_TEMPLATE,
                                  })
                                )
                              }
                            >
                              Apply
                            </button>
                            <button
                              disabled={isBusy}
                              onClick={() =>
                                run(() =>
                                  commandExecutor.execute({
                                    templateId: template.id,
                                    type: AudioCommandType.DELETE_PROJECT_TEMPLATE,
                                  })
                                )
                              }
                            >
                              Delete
                            </button>
                          </div>
                        </article>
                      ))}
                    </div>
                  </section>

                  <section className={styles.panel} aria-labelledby="archive-heading">
                    <div className={styles.sectionHeader}>
                      <div>
                        <h3 id="archive-heading">Session archive</h3>
                        <span>Project document and original Sources</span>
                      </div>
                      <div className={styles.inlineActions}>
                        <button disabled={isBusy} onClick={exportArchive}>
                          Export archive
                        </button>
                        <button disabled={isBusy} onClick={() => archiveInputRef.current?.click()}>
                          Import archive
                        </button>
                        <input
                          accept=".dropai-archive,application/vnd.drop-ai.session-archive+json"
                          aria-label="Session archive file"
                          className={styles.hiddenInput}
                          onChange={event => {
                            const archive = event.target.files?.[0];
                            if (archive) void importArchive(archive);
                          }}
                          ref={archiveInputRef}
                          type="file"
                        />
                      </div>
                    </div>
                  </section>
                  {errorMessage ? (
                    <p className={styles.error} role="alert">
                      {errorMessage}
                    </p>
                  ) : null}
                </div>
              </section>
            </div>,
            document.body
          )
        : null}
    </>
  );
}
