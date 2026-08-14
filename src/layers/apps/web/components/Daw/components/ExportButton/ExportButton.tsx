import { useState } from 'react';
import { createPortal } from 'react-dom';
import * as styles from './ExportButton.css.ts';
import { useCommandExecutor, useRenderJobState, useSession } from '@/layers/apps/web/context/layer-hooks';
import {
  KeyboardShortcutAction,
  KEYBOARD_SHORTCUT_LABELS,
  useKeyboardShortcutAction,
} from '@/layers/apps/web/keyboard-shortcuts/keyboard-shortcuts';
import { AudioCommandType } from '@/layers/shared/types/audioCommand.schema';
import {
  cloneProjectExportState,
  type ExportNormalizationState,
  type ExportPresetState,
  type ProjectExportState,
} from '@/layers/shared/types/export-state';
import type { RenderJobResult } from '@/layers/shared/types/render-job';
import { ValidatedProjectExportSettingsSchema } from '@/layers/shared/types/project-document.schema';
import { downloadRenderJobFiles } from './download-render-job-files';

const MINIMUM_RANGE_END_SECONDS = 1;

function createDraft(settings: ProjectExportState, projectEndTime: number): ProjectExportState {
  const draft = cloneProjectExportState(settings);
  if (draft.ranges.length > 0) {
    return draft;
  }
  return {
    ...draft,
    ranges: [
      {
        endTimeSeconds: Math.max(MINIMUM_RANGE_END_SECONDS, projectEndTime),
        id: crypto.randomUUID(),
        name: 'Mix',
        startTimeSeconds: 0,
      },
    ],
  };
}

function isRenderJobResult(value: unknown): value is RenderJobResult {
  return typeof value === 'object' && value !== null && 'jobId' in value && 'files' in value;
}

function formatAnalysisValue(value: number, suffix: string): string {
  return Number.isFinite(value) ? `${value.toFixed(1)} ${suffix}` : `−∞ ${suffix}`;
}

export function ExportButton() {
  const commandExecutor = useCommandExecutor();
  const persistedSettings = useSession(state => state.exportSettings);
  const projectEndTime = useSession(state =>
    Math.max(0, ...[...state.tracks.values()].flatMap(track => track.regions.map(region => region.endTime)))
  );
  const renderJobState = useRenderJobState();
  const [isOpen, setIsOpen] = useState(false);
  const [draft, setDraft] = useState(() => createDraft(persistedSettings, projectEndTime));
  const [lastResult, setLastResult] = useState<RenderJobResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const activePreset = draft.presets.find(preset => preset.id === draft.activePresetId) ?? draft.presets[0];
  const isRunning = renderJobState.status === 'running';

  const openDialog = () => {
    setDraft(createDraft(persistedSettings, projectEndTime));
    setErrorMessage(null);
    setIsOpen(true);
  };

  useKeyboardShortcutAction(KeyboardShortcutAction.EXPORT_AUDIO, openDialog, !isOpen);

  const updateActivePreset = (update: Partial<ExportPresetState>) => {
    setDraft(current => ({
      ...current,
      presets: current.presets.map(preset =>
        preset.id === current.activePresetId ? { ...preset, ...update } : preset
      ),
    }));
  };

  const updateNormalization = (normalization: ExportNormalizationState) => {
    updateActivePreset({ normalization });
  };

  const saveSettings = async (): Promise<void> => {
    setErrorMessage(null);
    await commandExecutor.execute({
      settings: ValidatedProjectExportSettingsSchema.parse(draft),
      type: AudioCommandType.SET_EXPORT_SETTINGS,
    });
  };

  const handleSave = async () => {
    try {
      await saveSettings();
    } catch (cause) {
      setErrorMessage(cause instanceof Error ? cause.message : String(cause));
    }
  };

  const handleStart = async () => {
    if (isRunning) {
      return;
    }
    try {
      await saveSettings();
      const result = await commandExecutor.execute({ type: AudioCommandType.START_RENDER_JOB });
      if (!isRenderJobResult(result)) {
        throw new Error('RenderJob 결과를 받지 못했습니다.');
      }
      setLastResult(result);
      downloadRenderJobFiles(result);
    } catch (cause) {
      const code = typeof cause === 'object' && cause !== null && 'code' in cause ? cause.code : null;
      if (code !== 'RENDER_JOB_CANCELLED') {
        setErrorMessage(cause instanceof Error ? cause.message : String(cause));
      }
    }
  };

  const handleCancel = async () => {
    if (!renderJobState.jobId) {
      return;
    }
    await commandExecutor.execute({
      jobId: renderJobState.jobId,
      type: AudioCommandType.CANCEL_RENDER_JOB,
    });
  };

  const addRange = () => {
    setDraft(current => ({
      ...current,
      ranges: [
        ...current.ranges,
        {
          endTimeSeconds: Math.max(MINIMUM_RANGE_END_SECONDS, projectEndTime),
          id: crypto.randomUUID(),
          name: `Range ${current.ranges.length + 1}`,
          startTimeSeconds: 0,
        },
      ],
    }));
  };

  const updateRange = (rangeId: string, update: Partial<ProjectExportState['ranges'][number]>) => {
    setDraft(current => ({
      ...current,
      ranges: current.ranges.map(range => (range.id === rangeId ? { ...range, ...update } : range)),
    }));
  };

  const removeRange = (rangeId: string) => {
    setDraft(current => ({ ...current, ranges: current.ranges.filter(range => range.id !== rangeId) }));
  };

  const duplicatePreset = () => {
    if (!activePreset) {
      return;
    }
    const preset = { ...activePreset, id: crypto.randomUUID(), name: `${activePreset.name} copy` };
    setDraft(current => ({ ...current, activePresetId: preset.id, presets: [...current.presets, preset] }));
  };

  const removeActivePreset = () => {
    if (draft.presets.length <= 1) {
      return;
    }
    const presets = draft.presets.filter(preset => preset.id !== draft.activePresetId);
    setDraft(current => ({ ...current, activePresetId: presets[0]!.id, presets }));
  };

  return (
    <div className={styles.container}>
      <button
        aria-haspopup="dialog"
        className={styles.exportButton}
        onClick={openDialog}
        title={`Export Audio (${KEYBOARD_SHORTCUT_LABELS[KeyboardShortcutAction.EXPORT_AUDIO]})`}
        type="button"
      >
        Export
      </button>
      {isOpen && activePreset
        ? createPortal(
            <div
              className={styles.backdrop}
              onMouseDown={event => event.target === event.currentTarget && setIsOpen(false)}
            >
              <section aria-label="Export & Analysis" aria-modal="true" className={styles.dialog} role="dialog">
                <header className={styles.dialogHeader}>
                  <div>
                    <h2 className={styles.title}>Export & Analysis</h2>
                    <p className={styles.subtitle}>WAV batch render, stems, loudness analysis</p>
                  </div>
                  <button
                    aria-label="Close Export"
                    className={styles.closeButton}
                    onClick={() => setIsOpen(false)}
                    type="button"
                  >
                    ×
                  </button>
                </header>

                <div className={styles.dialogBody}>
                  <section className={styles.section}>
                    <div className={styles.sectionHeader}>
                      <h3>Preset</h3>
                      <div className={styles.inlineActions}>
                        <button className={styles.secondaryButton} onClick={duplicatePreset} type="button">
                          Duplicate preset
                        </button>
                        <button
                          className={styles.secondaryButton}
                          disabled={draft.presets.length <= 1}
                          onClick={removeActivePreset}
                          type="button"
                        >
                          Remove preset
                        </button>
                      </div>
                    </div>
                    <div className={styles.fieldGrid}>
                      <label className={styles.field}>
                        <span>Active preset</span>
                        <select
                          aria-label="Active preset"
                          onChange={event => setDraft(current => ({ ...current, activePresetId: event.target.value }))}
                          value={draft.activePresetId}
                        >
                          {draft.presets.map(preset => (
                            <option key={preset.id} value={preset.id}>
                              {preset.name}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className={styles.field}>
                        <span>Preset name</span>
                        <input
                          aria-label="Preset name"
                          onChange={event => updateActivePreset({ name: event.target.value })}
                          value={activePreset.name}
                        />
                      </label>
                      <label className={styles.field}>
                        <span>Format</span>
                        <select aria-label="Format" value="wav" onChange={() => undefined}>
                          <option value="wav">WAV</option>
                          <option disabled value="flac">
                            FLAC — encoder unavailable
                          </option>
                          <option disabled value="mp3">
                            MP3 — encoder unavailable
                          </option>
                        </select>
                      </label>
                      <label className={styles.field}>
                        <span>Sample format</span>
                        <select
                          aria-label="Sample format"
                          onChange={event => {
                            const sampleFormat = event.target.value as ExportPresetState['sampleFormat'];
                            updateActivePreset({
                              sampleFormat,
                              ...(sampleFormat === 'float32' ? { dither: 'none' as const } : {}),
                            });
                          }}
                          value={activePreset.sampleFormat}
                        >
                          <option value="pcm16">16-bit PCM</option>
                          <option value="pcm24">24-bit PCM</option>
                          <option value="float32">32-bit float</option>
                        </select>
                      </label>
                      <label className={styles.field}>
                        <span>Sample rate</span>
                        <select
                          aria-label="Sample rate"
                          onChange={event => updateActivePreset({ sampleRate: Number(event.target.value) })}
                          value={activePreset.sampleRate}
                        >
                          <option value="44100">44.1 kHz</option>
                          <option value="48000">48 kHz</option>
                          <option value="88200">88.2 kHz</option>
                          <option value="96000">96 kHz</option>
                          <option value="192000">192 kHz</option>
                        </select>
                      </label>
                      <label className={styles.field}>
                        <span>Channels</span>
                        <select
                          aria-label="Channels"
                          onChange={event =>
                            updateActivePreset({ channelMode: event.target.value as ExportPresetState['channelMode'] })
                          }
                          value={activePreset.channelMode}
                        >
                          <option value="mono">Mono</option>
                          <option value="stereo">Stereo</option>
                        </select>
                      </label>
                      <label className={styles.field}>
                        <span>Dither</span>
                        <select
                          aria-label="Dither"
                          disabled={activePreset.sampleFormat === 'float32'}
                          onChange={event =>
                            updateActivePreset({ dither: event.target.value as ExportPresetState['dither'] })
                          }
                          value={activePreset.dither}
                        >
                          <option value="none">None</option>
                          <option value="tpdf">TPDF</option>
                        </select>
                      </label>
                      <label className={styles.field}>
                        <span>Output</span>
                        <select
                          aria-label="Output mode"
                          onChange={event =>
                            updateActivePreset({ exportMode: event.target.value as ExportPresetState['exportMode'] })
                          }
                          value={activePreset.exportMode}
                        >
                          <option value="mix">Master mix</option>
                          <option value="stems">Track stems</option>
                        </select>
                      </label>
                      <label className={styles.field}>
                        <span>Normalization</span>
                        <select
                          aria-label="Normalization"
                          onChange={event => {
                            if (event.target.value === 'peak') {
                              updateNormalization({ mode: 'peak', targetDbfs: -1 });
                            } else if (event.target.value === 'lufs') {
                              updateNormalization({ mode: 'lufs', targetLufs: -14 });
                            } else {
                              updateNormalization({ mode: 'none' });
                            }
                          }}
                          value={activePreset.normalization.mode}
                        >
                          <option value="none">None</option>
                          <option value="peak">True peak</option>
                          <option value="lufs">Integrated LUFS</option>
                        </select>
                      </label>
                      {activePreset.normalization.mode === 'peak' ? (
                        <label className={styles.field}>
                          <span>Peak target (dBFS)</span>
                          <input
                            aria-label="Peak target"
                            max="0"
                            min="-60"
                            onChange={event =>
                              updateNormalization({ mode: 'peak', targetDbfs: Number(event.target.value) })
                            }
                            step="0.1"
                            type="number"
                            value={activePreset.normalization.targetDbfs}
                          />
                        </label>
                      ) : null}
                      {activePreset.normalization.mode === 'lufs' ? (
                        <label className={styles.field}>
                          <span>LUFS target</span>
                          <input
                            aria-label="LUFS target"
                            max="0"
                            min="-70"
                            onChange={event =>
                              updateNormalization({ mode: 'lufs', targetLufs: Number(event.target.value) })
                            }
                            step="0.1"
                            type="number"
                            value={activePreset.normalization.targetLufs}
                          />
                        </label>
                      ) : null}
                    </div>
                    <p className={styles.capabilityNotice}>
                      FLAC·MP3 encoder가 설치되지 않아 WAV만 사용할 수 있습니다.
                    </p>
                  </section>

                  <section className={styles.section}>
                    <div className={styles.sectionHeader}>
                      <h3>Ranges</h3>
                      <button className={styles.secondaryButton} onClick={addRange} type="button">
                        Add range
                      </button>
                    </div>
                    <div className={styles.rangeList}>
                      {draft.ranges.map((range, index) => (
                        <div className={styles.rangeRow} key={range.id}>
                          <input
                            aria-label={`Range name ${index + 1}`}
                            onChange={event => updateRange(range.id, { name: event.target.value })}
                            value={range.name}
                          />
                          <label>
                            <span>Start</span>
                            <input
                              aria-label={`Range start ${index + 1}`}
                              min="0"
                              onChange={event =>
                                updateRange(range.id, { startTimeSeconds: Number(event.target.value) })
                              }
                              step="0.01"
                              type="number"
                              value={range.startTimeSeconds}
                            />
                          </label>
                          <label>
                            <span>End</span>
                            <input
                              aria-label={`Range end ${index + 1}`}
                              min="0.01"
                              onChange={event => updateRange(range.id, { endTimeSeconds: Number(event.target.value) })}
                              step="0.01"
                              type="number"
                              value={range.endTimeSeconds}
                            />
                          </label>
                          <button
                            aria-label={`Remove range ${index + 1}`}
                            className={styles.removeButton}
                            disabled={draft.ranges.length <= 1}
                            onClick={() => removeRange(range.id)}
                            type="button"
                          >
                            Remove
                          </button>
                        </div>
                      ))}
                    </div>
                  </section>

                  {renderJobState.status !== 'idle' ? (
                    <section aria-live="polite" className={styles.statusPanel}>
                      <div className={styles.statusSummary}>
                        <strong>{renderJobState.status}</strong>
                        <span>{renderJobState.stage}</span>
                        <span>{Math.round(renderJobState.progress * 100)}%</span>
                        <span>
                          {renderJobState.completedFileCount} / {renderJobState.outputFileCount} files
                        </span>
                      </div>
                      <div aria-label="Export progress" className={styles.progressBar} role="progressbar">
                        <div className={styles.progressFill} style={{ width: `${renderJobState.progress * 100}%` }} />
                      </div>
                      {renderJobState.errorMessage ? (
                        <p className={styles.errorMessage}>{renderJobState.errorMessage}</p>
                      ) : null}
                    </section>
                  ) : null}

                  {lastResult ? (
                    <section className={styles.section}>
                      <h3>Analysis</h3>
                      <div className={styles.resultList}>
                        {lastResult.files.map(file => (
                          <article className={styles.resultCard} key={`${file.rangeId}:${file.trackId ?? 'mix'}`}>
                            <strong>{file.fileName}</strong>
                            <span>{formatAnalysisValue(file.analysis.integratedLufs, 'LUFS')}</span>
                            <span>{formatAnalysisValue(file.analysis.truePeakDbtp, 'dBTP')}</span>
                            <span>{formatAnalysisValue(file.analysis.loudnessRangeLu, 'LU')}</span>
                            <span>
                              {file.analysis.normalizationGainDb >= 0 ? '+' : ''}
                              {formatAnalysisValue(file.analysis.normalizationGainDb, 'dB')}
                            </span>
                          </article>
                        ))}
                      </div>
                    </section>
                  ) : null}

                  {errorMessage ? (
                    <p className={styles.errorMessage} role="alert">
                      {errorMessage}
                    </p>
                  ) : null}
                </div>

                <footer className={styles.dialogFooter}>
                  <button className={styles.secondaryButton} disabled={isRunning} onClick={handleSave} type="button">
                    Save settings
                  </button>
                  {isRunning ? (
                    <button className={styles.cancelButton} onClick={handleCancel} type="button">
                      Cancel export
                    </button>
                  ) : (
                    <button className={styles.primaryButton} onClick={handleStart} type="button">
                      Start export
                    </button>
                  )}
                </footer>
              </section>
            </div>,
            document.body
          )
        : null}
    </div>
  );
}
