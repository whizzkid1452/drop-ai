import type { AgentModelStatus, AgentStatus } from '@/types/agent';
import * as styles from '../ChatModalTerminal.css.ts';

interface CommandComposerProps {
  input: string;
  modelStatus: AgentModelStatus;
  agentStatus: AgentStatus;
  onInputChange: (value: string) => void;
  onSend: () => void;
  onStop: () => void;
  onKeyDown: (event: React.KeyboardEvent<HTMLTextAreaElement>) => void;
}

export function CommandComposer({
  input,
  modelStatus,
  agentStatus,
  onInputChange,
  onSend,
  onStop,
  onKeyDown,
}: CommandComposerProps) {
  const isGenerating = agentStatus === 'generating';
  const isExecuting = agentStatus === 'executing';
  const isBusy = isGenerating || isExecuting;
  const canSend = modelStatus === 'ready' && !isBusy && input.trim().length > 0;
  const placeholder =
    modelStatus === 'loading'
      ? 'You can prepare a message while the model loads...'
      : modelStatus === 'error'
        ? 'Retry the model load before sending...'
        : 'Enter command or parameter...';
  const footerStatus =
    modelStatus === 'loading'
      ? 'MODEL PREPARING'
      : modelStatus === 'error'
        ? 'MODEL UNAVAILABLE'
        : isGenerating
          ? 'ESC: STOP'
          : isExecuting
            ? 'APPLYING COMMANDS'
            : 'ENTER: SEND · SHIFT+ENTER: NEW LINE';

  return (
    <div className={styles.composer}>
      <div className={styles.composerRow}>
        <div className={styles.inputWrapper}>
          <div className={`${styles.cornerMarker} ${styles.topLeft}`} />
          <div className={`${styles.cornerMarker} ${styles.bottomRight}`} />
          <span className={styles.promptSymbol}>&gt;</span>
          <div style={{ display: 'flex', flex: 1, minWidth: 0 }}>
            <textarea
              className={styles.inputField}
              placeholder={placeholder}
              value={input}
              onChange={event => onInputChange(event.target.value)}
              onKeyDown={onKeyDown}
              rows={1}
            />
          </div>
        </div>
        {isGenerating ? (
          <button
            className={`${styles.executeButton} ${styles.stopButton}`}
            onClick={onStop}
            type="button"
            aria-label="응답 생성 중지"
          >
            STOP
            <span className="material-symbols-outlined" style={{ fontSize: '14px' }} aria-hidden>
              stop
            </span>
          </button>
        ) : (
          <button className={styles.executeButton} onClick={onSend} disabled={!canSend} type="button">
            {isExecuting ? 'APPLYING' : 'EXECUTE'}
            <span className="material-symbols-outlined" style={{ fontSize: '14px' }} aria-hidden>
              {isExecuting ? 'hourglass_top' : 'keyboard_return'}
            </span>
          </button>
        )}
      </div>

      <div className={styles.footer}>
        <div className={styles.footerStats}>
          <span className={styles.statItem} aria-live="polite">
            {footerStatus}
          </span>
        </div>
        <div className={styles.statusIndicators}>
          <div className={styles.indicator} />
          <div className={styles.indicator} />
          <div className={`${styles.indicator} ${styles.activeIndicator}`} />
        </div>
      </div>
    </div>
  );
}
