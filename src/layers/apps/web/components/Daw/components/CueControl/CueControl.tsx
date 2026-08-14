import { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useCommandExecutor, useSession } from '@/layers/apps/web/context/layer-hooks';
import type { LoopSlotState } from '@/layers/session/session';
import { AudioCommandType } from '@/layers/shared/types/audioCommand.schema';
import * as styles from './CueControl.css';

interface ClipAddress {
  readonly slotId: string;
  readonly trackId: string;
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function CueControl() {
  const commandExecutor = useCommandExecutor();
  const trackMap = useSession(state => state.tracks);
  const cue = useSession(state => state.cue);
  const cueRecording = useSession(state => state.cueRecording);
  const tracks = useMemo(() => [...trackMap.values()], [trackMap]);
  const [isOpen, setIsOpen] = useState(false);
  const [performanceName, setPerformanceName] = useState('Cue performance');
  const [isBusy, setIsBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

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

  const execute = (command: Parameters<typeof commandExecutor.execute>[0]) =>
    run(() => commandExecutor.execute(command));
  const triggerClip = (address: ClipAddress) => execute({ ...address, type: AudioCommandType.TRIGGER_LOOP_SLOT });
  const stopClip = (address: ClipAddress) => execute({ ...address, type: AudioCommandType.STOP_LOOP_SLOT });

  return (
    <>
      <button className={styles.trigger} onClick={() => setIsOpen(true)} type="button">
        Cue
        {cueRecording.isRecording ? <span aria-label="Cue recording" className={styles.recordingDot} /> : null}
      </button>
      {isOpen
        ? createPortal(
            <div className={styles.backdrop} role="presentation">
              <section aria-label="Cue Grid" aria-modal="true" className={styles.dialog} role="dialog">
                <header className={styles.header}>
                  <div>
                    <h2>Cue Grid</h2>
                    <p>Clip을 연주하고 Timeline arrangement로 변환합니다.</p>
                  </div>
                  <button aria-label="Close Cue Grid" onClick={() => setIsOpen(false)} type="button">
                    ×
                  </button>
                </header>
                <div className={styles.transport}>
                  <label>
                    PERFORMANCE
                    <input
                      aria-label="Cue performance name"
                      maxLength={120}
                      onChange={event => setPerformanceName(event.currentTarget.value)}
                      value={performanceName}
                    />
                  </label>
                  {cueRecording.isRecording ? (
                    <>
                      <button
                        disabled={isBusy || performanceName.trim().length === 0}
                        onClick={() =>
                          void execute({ name: performanceName, type: AudioCommandType.STOP_CUE_RECORDING })
                        }
                        type="button"
                      >
                        SAVE TAKE
                      </button>
                      <button
                        disabled={isBusy}
                        onClick={() => void execute({ type: AudioCommandType.CANCEL_CUE_RECORDING })}
                        type="button"
                      >
                        CANCEL
                      </button>
                      <span role="status">REC · {cueRecording.events.length} events</span>
                    </>
                  ) : (
                    <button
                      disabled={isBusy}
                      onClick={() => void execute({ type: AudioCommandType.START_CUE_RECORDING })}
                      type="button"
                    >
                      RECORD CUE
                    </button>
                  )}
                  <button
                    disabled={isBusy}
                    onClick={() => void execute({ type: AudioCommandType.STOP_ALL_LOOPS })}
                    type="button"
                  >
                    STOP ALL
                  </button>
                </div>
                {errorMessage ? (
                  <p className={styles.error} role="alert">
                    {errorMessage}
                  </p>
                ) : null}
                <div className={styles.grid} role="grid">
                  {tracks.map(track => (
                    <div className={styles.trackRow} key={track.id} role="row">
                      <strong className={styles.trackName}>{track.name}</strong>
                      {(track.loopSlots ?? []).map(slot => (
                        <ClipLaunchButton
                          isBusy={isBusy}
                          key={slot.id}
                          onStop={stopClip}
                          onTrigger={triggerClip}
                          slot={slot}
                          trackId={track.id}
                        />
                      ))}
                    </div>
                  ))}
                </div>
                <section aria-label="Cue performances" className={styles.performances}>
                  <h3>PERFORMANCES</h3>
                  {cue.performances.length === 0 ? (
                    <p className={styles.empty}>저장된 Cue 연주가 없습니다.</p>
                  ) : (
                    cue.performances.map(performance => (
                      <article className={styles.performance} key={performance.id}>
                        <div>
                          <strong>{performance.name}</strong>
                          <span>{performance.events.length} events</span>
                        </div>
                        <div className={styles.performanceActions}>
                          <button
                            disabled={isBusy}
                            onClick={() =>
                              void execute({
                                performanceId: performance.id,
                                type: AudioCommandType.CONVERT_CUE_TO_ARRANGEMENT,
                              })
                            }
                            type="button"
                          >
                            ARRANGE
                          </button>
                          <button
                            disabled={isBusy}
                            onClick={() =>
                              void execute({
                                performanceId: performance.id,
                                type: AudioCommandType.DELETE_CUE_PERFORMANCE,
                              })
                            }
                            type="button"
                          >
                            DELETE
                          </button>
                        </div>
                      </article>
                    ))
                  )}
                </section>
              </section>
            </div>,
            document.body
          )
        : null}
    </>
  );
}

function ClipLaunchButton({
  isBusy,
  onStop,
  onTrigger,
  slot,
  trackId,
}: {
  readonly isBusy: boolean;
  readonly onStop: (address: ClipAddress) => void;
  readonly onTrigger: (address: ClipAddress) => void;
  readonly slot: LoopSlotState;
  readonly trackId: string;
}) {
  const address = { slotId: slot.id, trackId };
  const isEmpty = slot.sourceId === null;
  const isGate = slot.launchMode === 'gate';

  return (
    <button
      aria-label={`${slot.name} ${slot.state}`}
      className={styles.clipButton}
      data-state={slot.state}
      disabled={isBusy || isEmpty}
      onClick={isGate ? undefined : () => onTrigger(address)}
      onPointerDown={isGate ? () => onTrigger(address) : undefined}
      onPointerUp={isGate ? () => onStop(address) : undefined}
      role="gridcell"
      type="button"
    >
      <strong>{slot.name}</strong>
      <span>
        {isEmpty ? 'EMPTY' : slot.state} · {slot.launchMode} · Q{slot.quantizationBars}
      </span>
    </button>
  );
}
