import { useEffect, useState, type ChangeEvent } from 'react';
import {
  useAudioRuntimeCapabilities,
  useCommandExecutor,
  useEditorRuntimeState,
  useLiveInputRuntimeState,
  useRecordingRuntimeState,
  useSession,
} from '@/layers/apps/web/context/layer-hooks';
import { describeAudioRuntimeFeatureCapability } from '@/layers/apps/web/utils/audio-runtime-capability-labels';
import type { AudioCommand } from '@/layers/shared/types/audioCommand.schema';
import { AudioCommandType } from '@/layers/shared/types/audioCommand.schema';
import { RECORD_MODES, type RecordMode } from '@/layers/shared/types/multitrack-recording';
import { AudioRuntimeFeature } from '@/layers/shared/utils/audio-runtime-capabilities';
import * as styles from '../Track.css.ts';
import { replaceCompRange } from './comp-segment-edits';

const INPUT_CHANNEL_COUNT = 8;

const recordModeLabels: Readonly<Record<RecordMode, string>> = {
  layered: 'Layered',
  nonLayered: 'Non-layered',
  soundOnSound: 'Sound on sound',
};

interface TrackRecordArmControlProps {
  readonly trackId: string;
  readonly trackName: string;
}

export function TrackRecordArmControl({ trackId, trackName }: TrackRecordArmControlProps) {
  const commandExecutor = useCommandExecutor();
  const capability = useAudioRuntimeCapabilities().features[AudioRuntimeFeature.LINEAR_RECORDING];
  const recordingState = useRecordingRuntimeState();
  const liveInputState = useLiveInputRuntimeState();
  const selectedRange = useEditorRuntimeState().selection.range;
  const trackRecording = useSession(state => state.tracks.get(trackId)?.recording);
  const activePlaylist =
    trackRecording?.playlists.find(playlist => playlist.id === trackRecording.activePlaylistId) ??
    trackRecording?.playlists[0];
  const latestTake = activePlaylist?.takes[activePlaylist.takes.length - 1];
  const inputRoute = recordingState.inputRoutes.find(route => route.trackId === trackId);
  const [selectedTakeId, setSelectedTakeId] = useState<string | null>(latestTake?.id ?? null);
  const [isPending, setIsPending] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const isArmed = recordingState.armedTrackIds.includes(trackId);
  const isRecordingIdle = recordingState.phase === 'idle';
  const unavailableReason =
    capability.status === 'available' ? undefined : describeAudioRuntimeFeatureCapability(capability);
  const selectedTake = activePlaylist?.takes.find(take => take.id === selectedTakeId);
  const isCompRangeAvailable = Boolean(
    selectedRange?.trackIds.includes(trackId) &&
      selectedTake &&
      selectedRange.startTimeSeconds >= selectedTake.startTimeSeconds &&
      selectedRange.endTimeSeconds <= selectedTake.startTimeSeconds + selectedTake.durationSeconds
  );

  useEffect(() => {
    if (!selectedTakeId || !activePlaylist?.takes.some(take => take.id === selectedTakeId)) {
      setSelectedTakeId(latestTake?.id ?? null);
    }
  }, [activePlaylist?.takes, latestTake?.id, selectedTakeId]);

  const executeCommand = async (command: AudioCommand) => {
    if (!isRecordingIdle || isPending || unavailableReason) {
      return;
    }

    setIsPending(true);
    try {
      await commandExecutor.execute(command);
      setErrorMessage(null);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setIsPending(false);
    }
  };

  const handleArmChange = async () => {
    await executeCommand({
      armed: !isArmed,
      trackId,
      type: AudioCommandType.SET_TRACK_RECORD_ARM,
    });
  };

  const handleInputChannelChange = async (event: ChangeEvent<HTMLSelectElement>) => {
    await executeCommand({
      channelIndex: Number(event.currentTarget.value),
      deviceId: liveInputState.deviceId ?? inputRoute?.deviceId ?? null,
      trackId,
      type: AudioCommandType.SET_TRACK_RECORDING_INPUT,
    });
  };

  const handleRecordModeChange = async (event: ChangeEvent<HTMLSelectElement>) => {
    await executeCommand({
      recordMode: event.currentTarget.value as RecordMode,
      trackId,
      type: AudioCommandType.SET_TRACK_RECORD_MODE,
    });
  };

  const handleSelectTake = async () => {
    if (!activePlaylist || !selectedTakeId) {
      return;
    }

    await executeCommand({
      playlistId: activePlaylist.id,
      takeId: selectedTakeId,
      trackId,
      type: AudioCommandType.SELECT_TAKE,
    });
  };

  const handleApplyCompRange = async () => {
    if (!activePlaylist || !selectedRange || !selectedTakeId || !isCompRangeAvailable) {
      return;
    }

    await executeCommand({
      compSegments: replaceCompRange({
        createId: () => globalThis.crypto.randomUUID(),
        currentSegments: activePlaylist.compSegments,
        range: selectedRange,
        takeId: selectedTakeId,
      }),
      playlistId: activePlaylist.id,
      trackId,
      type: AudioCommandType.SET_COMP_SEGMENTS,
    });
  };

  const controlsDisabled = !isRecordingIdle || isPending || Boolean(unavailableReason);

  return (
    <>
      <button
        aria-label={`${trackName} 녹음 arm`}
        aria-pressed={isArmed}
        className={`${styles.trackActionButton} ${isArmed ? styles.recordButtonActive : ''}`}
        disabled={controlsDisabled}
        onClick={() => void handleArmChange()}
        title={errorMessage ?? unavailableReason ?? '녹음 arm'}
        type="button"
      >
        R
      </button>
      <div className={styles.recordingOptions}>
        <select
          aria-label={`${trackName} 입력 채널`}
          className={styles.recordingSelect}
          disabled={controlsDisabled}
          onChange={event => void handleInputChannelChange(event)}
          title={`입력 채널 ${(inputRoute?.channelIndex ?? 0) + 1}`}
          value={inputRoute?.channelIndex ?? 0}
        >
          {Array.from({ length: INPUT_CHANNEL_COUNT }, (_, channelIndex) => (
            <option key={channelIndex} value={channelIndex}>
              In {channelIndex + 1}
            </option>
          ))}
        </select>
        <select
          aria-label={`${trackName} 녹음 모드`}
          className={styles.recordingSelect}
          disabled={controlsDisabled}
          onChange={event => void handleRecordModeChange(event)}
          title={recordModeLabels[trackRecording?.recordMode ?? 'layered']}
          value={trackRecording?.recordMode ?? 'layered'}
        >
          {RECORD_MODES.map(recordMode => (
            <option key={recordMode} value={recordMode}>
              {recordModeLabels[recordMode]}
            </option>
          ))}
        </select>
        <select
          aria-label={`${trackName} Take`}
          className={styles.recordingSelect}
          disabled={controlsDisabled || !activePlaylist || activePlaylist.takes.length === 0}
          onChange={event => setSelectedTakeId(event.currentTarget.value)}
          title={selectedTake ? `Take ${selectedTake.takeNumber}` : 'Take 없음'}
          value={selectedTakeId ?? ''}
        >
          {activePlaylist?.takes.map(take => (
            <option key={take.id} value={take.id}>
              Take {take.takeNumber}
            </option>
          ))}
        </select>
        <button
          aria-label={`${trackName} 선택 Take 전체 적용`}
          className={styles.trackActionButton}
          disabled={controlsDisabled || !activePlaylist || !selectedTakeId}
          onClick={() => void handleSelectTake()}
          type="button"
        >
          Take
        </button>
        <button
          aria-label={`${trackName} 선택 범위를 Comp에 적용`}
          className={styles.trackActionButton}
          disabled={controlsDisabled || !isCompRangeAvailable}
          onClick={() => void handleApplyCompRange()}
          type="button"
        >
          Comp
        </button>
        {errorMessage ? (
          <span className={styles.recordingError} role="alert">
            {errorMessage}
          </span>
        ) : null}
      </div>
    </>
  );
}
