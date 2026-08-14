import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { useAudioMonitorState, useCommandExecutor, useSession } from '@/layers/apps/web/context/layer-hooks';
import type { TrackState } from '@/layers/session/session';
import { AudioCommandType, type AudioCommand } from '@/layers/shared/types/audioCommand.schema';
import type {
  RoutingGraphSnapshot,
  RoutingRouteState,
  RoutingRouteTarget,
  RoutingSendState,
  RoutingTrackKind,
} from '@/layers/shared/types/routing-state';
import type { AudioMonitorState } from '@/layers/shared/types/audio-monitor-state';
import { AudioLevelMeter } from '../AudioLevelMeter/AudioLevelMeter';
import { MasterVolumeControl } from '../DawHeader/MasterVolumeControl';
import * as styles from './MixerView.css.ts';

const SIGNAL_TRACK_KINDS = new Set<RoutingTrackKind>(['audio', 'aux', 'bus']);
const TRACK_KIND_LABELS: Record<RoutingTrackKind, string> = {
  audio: 'AUDIO',
  aux: 'AUX',
  bus: 'BUS',
  folder: 'FOLDER',
  vca: 'VCA',
};

interface MixerCommandContext {
  readonly execute: (command: AudioCommand) => Promise<void>;
  readonly isPending: boolean;
}

interface MixerStripProps extends MixerCommandContext {
  readonly graph: RoutingGraphSnapshot;
  readonly route: RoutingRouteState;
  readonly track: TrackState;
  readonly tracksById: ReadonlyMap<string, TrackState>;
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message || error.name : String(error);
}

function routeTargetToValue(target: RoutingRouteTarget): string {
  return target.kind === 'track' ? `track:${target.trackId}` : target.kind;
}

function valueToRouteTarget(value: string): RoutingRouteTarget {
  if (value === 'master') {
    return { kind: 'master' };
  }
  if (value.startsWith('track:')) {
    return { kind: 'track', trackId: value.slice('track:'.length) };
  }
  return { kind: 'none' };
}

function getRouteDestinations(graph: RoutingGraphSnapshot, sourceTrackId: string): readonly RoutingRouteState[] {
  return graph.routes.filter(
    route => route.trackId !== sourceTrackId && (route.kind === 'aux' || route.kind === 'bus')
  );
}

function TrackOutputControl({ execute, graph, isPending, route, track, tracksById }: MixerStripProps) {
  if (!SIGNAL_TRACK_KINDS.has(route.kind)) {
    return <span className={styles.noSignalPath}>No audio output</span>;
  }

  const destinations = getRouteDestinations(graph, route.trackId);
  const handleInput = (event: FormEvent<HTMLSelectElement>) => {
    return execute({
      type: AudioCommandType.SET_TRACK_ROUTING,
      channelCount: route.channelCount,
      kind: route.kind,
      output: valueToRouteTarget(event.currentTarget.value),
      trackId: route.trackId,
    });
  };

  return (
    <label className={styles.fieldLabel}>
      <span>OUTPUT</span>
      <select
        aria-label={`${track.name} output`}
        className={styles.select}
        disabled={isPending}
        onInput={event => void handleInput(event)}
        value={routeTargetToValue(route.output)}
      >
        <option value="master">Master</option>
        {destinations.map(destination => (
          <option key={destination.trackId} value={`track:${destination.trackId}`}>
            {tracksById.get(destination.trackId)?.name ?? destination.trackId} ({TRACK_KIND_LABELS[destination.kind]})
          </option>
        ))}
      </select>
    </label>
  );
}

function TrackGroupControls({ execute, graph, isPending, route, track, tracksById }: MixerStripProps) {
  const folders = graph.routes.filter(candidate => candidate.kind === 'folder' && candidate.trackId !== route.trackId);
  const vcas = graph.routes.filter(candidate => candidate.kind === 'vca' && candidate.trackId !== route.trackId);
  const setGroups = (updates: { readonly folderId?: string | null; readonly vcaIds?: readonly string[] }) =>
    execute({
      type: AudioCommandType.SET_TRACK_GROUPS,
      folderId: updates.folderId === undefined ? route.folderId : updates.folderId,
      trackId: route.trackId,
      vcaIds: [...(updates.vcaIds ?? route.vcaIds)],
    });

  return (
    <div className={styles.groupControls}>
      <label className={styles.fieldLabel}>
        <span>FOLDER</span>
        <select
          aria-label={`${track.name} folder`}
          className={styles.select}
          disabled={isPending}
          onChange={event => void setGroups({ folderId: event.target.value || null })}
          value={route.folderId ?? ''}
        >
          <option value="">None</option>
          {folders.map(folder => (
            <option key={folder.trackId} value={folder.trackId}>
              {tracksById.get(folder.trackId)?.name ?? folder.trackId}
            </option>
          ))}
        </select>
      </label>
      {vcas.length > 0 ? (
        <fieldset className={styles.vcaFieldset}>
          <legend>VCA</legend>
          {vcas.map(vca => {
            const isAssigned = route.vcaIds.includes(vca.trackId);
            const vcaName = tracksById.get(vca.trackId)?.name ?? vca.trackId;
            return (
              <label key={vca.trackId} className={styles.checkboxLabel}>
                <input
                  aria-label={`Assign ${track.name} to ${vcaName}`}
                  checked={isAssigned}
                  disabled={isPending}
                  onChange={() =>
                    void setGroups({
                      vcaIds: isAssigned
                        ? route.vcaIds.filter(vcaId => vcaId !== vca.trackId)
                        : [...route.vcaIds, vca.trackId],
                    })
                  }
                  type="checkbox"
                />
                <span>{vcaName}</span>
              </label>
            );
          })}
        </fieldset>
      ) : null}
    </div>
  );
}

function MixerFaderControls({ execute, isPending, route, track }: MixerStripProps) {
  if (route.kind === 'folder') {
    return null;
  }

  const showPan = SIGNAL_TRACK_KINDS.has(route.kind);
  return (
    <div className={styles.faderControls}>
      {showPan ? (
        <label className={styles.fieldLabel}>
          <span>PAN {track.pan.toFixed(2)}</span>
          <input
            aria-label={`${track.name} pan`}
            className={styles.pan}
            disabled={isPending}
            max={1}
            min={-1}
            onChange={event =>
              void execute({
                type: AudioCommandType.SET_TRACK_PAN,
                pan: Number(event.target.value),
                trackId: track.id,
              })
            }
            step={0.01}
            type="range"
            value={track.pan}
          />
        </label>
      ) : null}
      <label className={styles.verticalFaderLabel}>
        <span>{Math.round(track.volume * 100)}%</span>
        <input
          aria-label={`${track.name} volume`}
          className={styles.verticalFader}
          disabled={isPending}
          max={1}
          min={0}
          onChange={event =>
            void execute({
              type: AudioCommandType.SET_TRACK_VOLUME,
              trackId: track.id,
              volume: Number(event.target.value),
            })
          }
          step={0.01}
          type="range"
          value={track.volume}
        />
      </label>
      <div className={styles.trackToggleRow}>
        <ToggleButton
          active={track.isMuted}
          disabled={isPending}
          label={`${track.name} mute`}
          onClick={() =>
            execute({
              type: AudioCommandType.SET_TRACK_MUTE,
              muted: !track.isMuted,
              trackId: track.id,
            })
          }
        >
          M
        </ToggleButton>
        <ToggleButton
          active={track.isSoloed}
          disabled={isPending}
          label={`${track.name} solo`}
          onClick={() =>
            execute({
              type: AudioCommandType.SET_TRACK_SOLO,
              soloed: !track.isSoloed,
              trackId: track.id,
            })
          }
        >
          S
        </ToggleButton>
      </div>
    </div>
  );
}

function ToggleButton({
  active,
  children,
  disabled,
  label,
  onClick,
}: {
  readonly active: boolean;
  readonly children: ReactNode;
  readonly disabled: boolean;
  readonly label: string;
  readonly onClick: () => Promise<void>;
}) {
  return (
    <button
      aria-label={label}
      aria-pressed={active}
      className={`${styles.toggleButton} ${active ? styles.toggleButtonActive : ''}`}
      disabled={disabled}
      onClick={() => void onClick()}
      type="button"
    >
      {children}
    </button>
  );
}

function SendRow({
  execute,
  isPending,
  send,
  trackName,
  tracksById,
}: MixerCommandContext & {
  readonly send: RoutingSendState;
  readonly trackName: string;
  readonly tracksById: ReadonlyMap<string, TrackState>;
}) {
  const destinationName = tracksById.get(send.destinationTrackId)?.name ?? send.destinationTrackId;
  const updateSend = (updates: Partial<Pick<RoutingSendState, 'gain' | 'isEnabled' | 'tapPoint'>>) =>
    execute({
      type: AudioCommandType.UPDATE_SEND,
      gain: updates.gain ?? send.gain,
      id: send.id,
      isEnabled: updates.isEnabled ?? send.isEnabled,
      tapPoint: updates.tapPoint ?? send.tapPoint,
    });

  return (
    <div aria-label={`${trackName} Send ${destinationName}`} className={styles.sendRow} data-send-id={send.id}>
      <span className={styles.sendDestination}>{destinationName}</span>
      <select
        aria-label={`${trackName} Send ${destinationName} tap`}
        className={styles.compactSelect}
        disabled={isPending}
        onChange={event => void updateSend({ tapPoint: event.target.value as RoutingSendState['tapPoint'] })}
        value={send.tapPoint}
      >
        <option value="preFader">PRE</option>
        <option value="postFader">POST</option>
      </select>
      <input
        aria-label={`${trackName} Send ${destinationName} gain`}
        className={styles.sendGain}
        disabled={isPending}
        max={1}
        min={0}
        onChange={event => void updateSend({ gain: Number(event.target.value) })}
        step={0.01}
        type="range"
        value={send.gain}
      />
      <input
        aria-label={`${trackName} Send ${destinationName} enabled`}
        checked={send.isEnabled}
        disabled={isPending}
        onChange={() => void updateSend({ isEnabled: !send.isEnabled })}
        type="checkbox"
      />
      <button
        aria-label={`Remove ${trackName} Send ${destinationName}`}
        className={styles.removeSendButton}
        disabled={isPending}
        onClick={() => void execute({ type: AudioCommandType.REMOVE_SEND, id: send.id })}
        type="button"
      >
        ×
      </button>
    </div>
  );
}

function TrackSends({ execute, graph, isPending, route, track, tracksById }: MixerStripProps) {
  const destinations = useMemo(() => getRouteDestinations(graph, route.trackId), [graph, route.trackId]);
  const sends = graph.sends.filter(send => send.sourceTrackId === route.trackId);
  const [destinationTrackId, setDestinationTrackId] = useState(destinations[0]?.trackId ?? '');

  useEffect(() => {
    setDestinationTrackId(currentDestination => {
      const isCurrentDestinationAvailable = destinations.some(
        destination => destination.trackId === currentDestination
      );
      return isCurrentDestinationAvailable ? currentDestination : (destinations[0]?.trackId ?? '');
    });
  }, [destinations]);

  if (!SIGNAL_TRACK_KINDS.has(route.kind)) {
    return null;
  }

  const addSend = () => {
    if (destinationTrackId === '') {
      return Promise.resolve();
    }
    return execute({
      type: AudioCommandType.ADD_SEND,
      destinationTrackId,
      gain: 1,
      id: crypto.randomUUID(),
      isEnabled: true,
      sourceTrackId: route.trackId,
      tapPoint: 'postFader',
    });
  };

  return (
    <section className={styles.sendSection} aria-label={`${track.name} Sends`}>
      <span className={styles.sectionLabel}>SENDS</span>
      {sends.map(send => (
        <SendRow
          key={send.id}
          execute={execute}
          isPending={isPending}
          send={send}
          trackName={track.name}
          tracksById={tracksById}
        />
      ))}
      <div className={styles.addSendRow}>
        <select
          aria-label={`${track.name} new Send destination`}
          className={styles.select}
          disabled={destinations.length === 0 || isPending}
          onChange={event => setDestinationTrackId(event.target.value)}
          value={destinationTrackId}
        >
          {destinations.length === 0 ? <option value="">No Bus or Aux</option> : null}
          {destinations.map(destination => (
            <option key={destination.trackId} value={destination.trackId}>
              {tracksById.get(destination.trackId)?.name ?? destination.trackId}
            </option>
          ))}
        </select>
        <button
          aria-label={`Add Send to ${track.name}`}
          className={styles.addSendButton}
          disabled={destinationTrackId === '' || isPending}
          onClick={() => void addSend()}
          type="button"
        >
          + SEND
        </button>
      </div>
    </section>
  );
}

function MixerStrip(props: MixerStripProps) {
  const { route, track } = props;
  const hasMeter = SIGNAL_TRACK_KINDS.has(route.kind);
  return (
    <article aria-label={`Mixer Track ${track.name}`} className={styles.strip} data-route-kind={route.kind}>
      <header className={styles.stripHeader}>
        <span className={styles.routeKind}>{TRACK_KIND_LABELS[route.kind]}</span>
        <strong className={styles.trackName} title={track.name}>
          {track.name}
        </strong>
        <span className={styles.channelCount}>{route.channelCount === 1 ? 'MONO' : 'STEREO'}</span>
      </header>
      {hasMeter ? (
        <AudioLevelMeter label={`${track.name} output`} target={{ kind: 'track', trackId: track.id }} />
      ) : null}
      <TrackOutputControl {...props} />
      <TrackGroupControls {...props} />
      <TrackSends {...props} />
      <MixerFaderControls {...props} />
      <span className={styles.trackId} title={track.id}>
        {track.id.slice(0, 8)}
      </span>
    </article>
  );
}

function MonitorSection({
  execute,
  isPending,
  monitorState,
}: MixerCommandContext & { readonly monitorState: AudioMonitorState }) {
  const setMonitor = (updates: Partial<AudioMonitorState>) =>
    execute({
      type: AudioCommandType.SET_MONITOR_STATE,
      isCut: updates.isCut ?? monitorState.isCut,
      isDimmed: updates.isDimmed ?? monitorState.isDimmed,
      isMono: updates.isMono ?? monitorState.isMono,
    });

  return (
    <section className={styles.monitorSection} aria-label="Monitor controls">
      <span className={`${styles.sectionLabel} ${styles.monitorLabel}`}>MONITOR</span>
      <ToggleButton
        active={monitorState.isCut}
        disabled={isPending}
        label="Monitor Cut"
        onClick={() => setMonitor({ isCut: !monitorState.isCut })}
      >
        CUT
      </ToggleButton>
      <ToggleButton
        active={monitorState.isDimmed}
        disabled={isPending}
        label="Monitor Dim"
        onClick={() => setMonitor({ isDimmed: !monitorState.isDimmed })}
      >
        DIM
      </ToggleButton>
      <ToggleButton
        active={monitorState.isMono}
        disabled={isPending}
        label="Monitor Mono"
        onClick={() => setMonitor({ isMono: !monitorState.isMono })}
      >
        MONO
      </ToggleButton>
    </section>
  );
}

function MasterStrip(props: MixerCommandContext & { readonly monitorState: AudioMonitorState }) {
  return (
    <aside aria-label="Master strip" className={`${styles.strip} ${styles.masterStrip}`}>
      <header className={styles.stripHeader}>
        <span className={styles.routeKind}>MASTER</span>
        <strong className={styles.trackName}>Master</strong>
      </header>
      <MasterVolumeControl />
      <MonitorSection {...props} />
    </aside>
  );
}

function TrackCreator({ execute, isPending }: MixerCommandContext) {
  const addTrack = (kind: RoutingTrackKind) =>
    execute({
      type: AudioCommandType.ADD_TRACK,
      channelCount: 2,
      kind,
      trackId: crypto.randomUUID(),
    });

  return (
    <div className={styles.trackCreator} aria-label="Add Mixer Track">
      {(['audio', 'aux', 'bus', 'folder', 'vca'] as const).map(kind => (
        <button
          key={kind}
          aria-label={`Add ${TRACK_KIND_LABELS[kind][0]}${TRACK_KIND_LABELS[kind].slice(1).toLowerCase()} Track`}
          className={styles.addTrackButton}
          disabled={isPending}
          onClick={() => void addTrack(kind)}
          type="button"
        >
          + {TRACK_KIND_LABELS[kind]}
        </button>
      ))}
    </div>
  );
}

export function MixerView() {
  const tracks = useSession(state => state.tracks);
  const routingGraph = useSession(state => state.routingGraph);
  const commandExecutor = useCommandExecutor();
  const monitorState = useAudioMonitorState();
  const [isPending, setIsPending] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const tracksById = useMemo(() => new Map(tracks), [tracks]);

  const execute = async (command: AudioCommand) => {
    if (isPending) {
      return;
    }
    setIsPending(true);
    setErrorMessage(null);
    try {
      await commandExecutor.execute(command);
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsPending(false);
    }
  };

  return (
    <main className={styles.container} aria-label="Mixer">
      <div className={styles.toolbar}>
        <div>
          <h1 className={styles.title}>MIXER</h1>
          <p className={styles.subtitle}>Route, Send, group and monitor control</p>
        </div>
        <TrackCreator execute={execute} isPending={isPending} />
      </div>
      {errorMessage ? (
        <div className={styles.error} role="alert">
          {errorMessage}
        </div>
      ) : null}
      <div className={styles.strips}>
        {routingGraph.routes.map(route => {
          const track = tracksById.get(route.trackId);
          return track ? (
            <MixerStrip
              key={route.trackId}
              execute={execute}
              graph={routingGraph}
              isPending={isPending}
              route={route}
              track={track}
              tracksById={tracksById}
            />
          ) : null;
        })}
        <MasterStrip execute={execute} isPending={isPending} monitorState={monitorState} />
      </div>
    </main>
  );
}
