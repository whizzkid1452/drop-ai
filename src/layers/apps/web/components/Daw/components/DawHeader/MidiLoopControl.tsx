import { useEffect, useState } from 'react';
import { useCommandExecutor, useMidiInput, useSession } from '@/layers/apps/web/context/layer-hooks';
import { useLayer } from '@/layers/apps/web/context/layer-context';
import type { MidiInputDevice } from '@/layers/midi-input/i-midi-input';
import { createMidiLoopCommand } from '@/layers/apps/web/midi/create-midi-loop-command';
import * as styles from './MidiLoopControl.css';

type ConnectionStatus = 'connected' | 'connecting' | 'disconnected' | 'error';

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function MidiLoopControl() {
  const app = useLayer();
  const commandExecutor = useCommandExecutor();
  const midiInput = useMidiInput();
  const tracks = useSession(state => state.tracks);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected');
  const [devices, setDevices] = useState<readonly MidiInputDevice[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [midiChannel, setMidiChannel] = useState(0);
  const [requestedTrackId, setRequestedTrackId] = useState('');
  const firstTrackId = tracks.values().next().value?.id ?? '';
  const targetTrackId = tracks.has(requestedTrackId) ? requestedTrackId : firstTrackId;

  useEffect(() => {
    return midiInput.subscribe(event => {
      if (midiChannel !== 0 && event.channel !== midiChannel) {
        return;
      }
      const track = app.session.getState().tracks.get(targetTrackId);
      if (!track && event.note !== 40) {
        return;
      }
      const command = track ? createMidiLoopCommand({ note: event.note, track }) : null;
      if (!command) {
        return;
      }
      void commandExecutor.execute(command).catch(error => {
        setConnectionStatus('error');
        setErrorMessage(describeError(error));
      });
    });
  }, [app.session, commandExecutor, midiChannel, midiInput, targetTrackId]);

  useEffect(() => () => midiInput.disconnect(), [midiInput]);

  const handleConnection = async (): Promise<void> => {
    if (connectionStatus === 'connected') {
      midiInput.disconnect();
      setConnectionStatus('disconnected');
      setDevices([]);
      setErrorMessage(null);
      return;
    }

    setConnectionStatus('connecting');
    setErrorMessage(null);
    try {
      const connectedDevices = await midiInput.connect();
      setDevices(connectedDevices);
      setConnectionStatus('connected');
    } catch (error) {
      setConnectionStatus('error');
      setErrorMessage(describeError(error));
    }
  };

  const deviceLabel =
    connectionStatus === 'connected'
      ? devices.map(device => device.name ?? device.id).join(', ') || '입력 장치 없음'
      : '노트 36–39: 슬롯 · 40: 전체 정지';

  return (
    <div className={styles.container} title={errorMessage ?? deviceLabel}>
      <span className={styles.label}>MIDI LOOP</span>
      <select
        aria-label="MIDI 대상 트랙"
        className={styles.select}
        disabled={tracks.size === 0}
        onChange={event => setRequestedTrackId(event.target.value)}
        value={targetTrackId}
      >
        {tracks.size === 0 ? <option value="">트랙 없음</option> : null}
        {[...tracks.values()].map(track => (
          <option key={track.id} value={track.id}>
            {track.name}
          </option>
        ))}
      </select>
      <select
        aria-label="MIDI 채널"
        className={styles.channelSelect}
        onChange={event => setMidiChannel(Number(event.target.value))}
        value={midiChannel}
      >
        <option value={0}>ALL CH</option>
        {Array.from({ length: 16 }, (_, index) => index + 1).map(channel => (
          <option key={channel} value={channel}>
            CH {channel}
          </option>
        ))}
      </select>
      <button
        className={connectionStatus === 'connected' ? styles.connectedButton : styles.button}
        disabled={connectionStatus === 'connecting'}
        onClick={() => void handleConnection()}
        type="button"
      >
        {connectionStatus === 'connecting' ? 'CONNECTING' : connectionStatus === 'connected' ? 'DISCONNECT' : 'CONNECT'}
      </button>
      <span aria-live="polite" className={styles.hint}>
        {errorMessage ?? deviceLabel}
      </span>
    </div>
  );
}
