import type { ILiveAudioInput, ILiveAudioInputConnection, OpenLiveAudioInputOptions } from './live-audio-input';
import type { LiveAudioInputDevice } from '../../shared/types/live-input';
import { LiveAudioInputError, LiveAudioInputErrorCode } from './live-audio-input-error';

const LIVE_INPUT_MESSAGES = {
  apiUnavailable: '이 브라우저에서는 실시간 오디오 입력을 사용할 수 없습니다.',
  audioTrackMissing: '입력 장치에서 오디오 트랙을 찾지 못했습니다.',
  constraintsUnsatisfied: '요청한 오디오 입력 조건을 충족하는 장치가 없습니다.',
  deviceNotFound: '사용 가능한 오디오 입력 장치를 찾지 못했습니다.',
  openFailed: '오디오 입력 장치를 열지 못했습니다.',
  permissionDenied: '오디오 입력 장치 접근 권한이 거부되었습니다.',
} as const;

function createAudioConstraints(deviceId?: string): MediaTrackConstraints {
  return {
    autoGainControl: false,
    ...(deviceId === undefined ? {} : { deviceId: { exact: deviceId } }),
    echoCancellation: false,
    noiseSuppression: false,
  };
}

function closeMediaStream(stream: MediaStream): void {
  stream.getTracks().forEach(track => track.stop());
}

function readDomExceptionName(error: unknown): string | null {
  if (typeof DOMException === 'undefined' || !(error instanceof DOMException)) {
    return null;
  }

  return error.name;
}

function mapOpenError(error: unknown): LiveAudioInputError {
  const errorName = readDomExceptionName(error);

  if (errorName === 'NotAllowedError' || errorName === 'SecurityError') {
    return new LiveAudioInputError(LiveAudioInputErrorCode.PERMISSION_DENIED, LIVE_INPUT_MESSAGES.permissionDenied, {
      cause: error,
    });
  }
  if (errorName === 'NotFoundError') {
    return new LiveAudioInputError(LiveAudioInputErrorCode.DEVICE_NOT_FOUND, LIVE_INPUT_MESSAGES.deviceNotFound, {
      cause: error,
    });
  }
  if (errorName === 'OverconstrainedError') {
    return new LiveAudioInputError(
      LiveAudioInputErrorCode.CONSTRAINTS_UNSATISFIED,
      LIVE_INPUT_MESSAGES.constraintsUnsatisfied,
      { cause: error }
    );
  }

  return new LiveAudioInputError(LiveAudioInputErrorCode.OPEN_FAILED, LIVE_INPUT_MESSAGES.openFailed, { cause: error });
}

export class BrowserLiveAudioInput implements ILiveAudioInput {
  async listDevices(): Promise<readonly LiveAudioInputDevice[]> {
    const mediaDevices = typeof navigator === 'undefined' ? undefined : navigator.mediaDevices;
    if (mediaDevices?.enumerateDevices === undefined) {
      throw new LiveAudioInputError(LiveAudioInputErrorCode.API_UNAVAILABLE, LIVE_INPUT_MESSAGES.apiUnavailable);
    }

    const devices = await mediaDevices.enumerateDevices();
    return devices
      .filter(device => device.kind === 'audioinput')
      .map(device => ({ deviceId: device.deviceId, label: device.label }));
  }

  async open(options: OpenLiveAudioInputOptions): Promise<ILiveAudioInputConnection> {
    const mediaDevices = typeof navigator === 'undefined' ? undefined : navigator.mediaDevices;
    if (mediaDevices?.getUserMedia === undefined) {
      throw new LiveAudioInputError(LiveAudioInputErrorCode.API_UNAVAILABLE, LIVE_INPUT_MESSAGES.apiUnavailable);
    }

    let stream: MediaStream;
    try {
      stream = await mediaDevices.getUserMedia({
        audio: createAudioConstraints(options.deviceId),
        video: false,
      });
    } catch (error: unknown) {
      throw mapOpenError(error);
    }

    const audioTrack = stream.getAudioTracks()[0];
    if (audioTrack === undefined) {
      closeMediaStream(stream);
      throw new LiveAudioInputError(LiveAudioInputErrorCode.AUDIO_TRACK_MISSING, LIVE_INPUT_MESSAGES.audioTrackMissing);
    }

    return {
      close: () => closeMediaStream(stream),
      deviceId: audioTrack.getSettings().deviceId ?? options.deviceId ?? null,
      stream,
    };
  }
}
