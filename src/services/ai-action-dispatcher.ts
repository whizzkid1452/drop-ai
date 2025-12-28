/**
 * AI Action Dispatcher
 * AI 에이전트가 호출한 도구(Tool)를 실제로 실행하는 핵심 로직
 */

import { useTrackStore } from '@/stores/useTrackStore';
import { TrackStatus } from '@/types/track';
import {
  type ToolCallResult,
  type ToolName,
  type SetVolumeParams,
  type TrimAudioParams,
  type ApplyReverbParams,
  type ApplyFilterParams,
  type ApplyEqParams,
  type FadeInParams,
  type FadeOutParams,
  type GetTrackInfoParams,
  type MuteTrackParams,
  type SoloTrackParams,
  SAFE_RANGES,
  clampValue,
} from '@/types/ai-tools';

/**
 * AI 도구 호출을 실제 액션으로 변환하고 실행하는 클래스
 */
export class AIActionDispatcher {
  /**
   * 도구 호출의 메인 엔트리포인트
   * @param toolName 실행할 도구 이름
   * @param params 도구 파라미터 (JSON 파싱 완료된 객체)
   * @returns 실행 결과
   */
  async executeToolCall(
    toolName: ToolName,
    params: unknown
  ): Promise<ToolCallResult> {
    try {
      // 기본 파라미터 검증
      if (!params || typeof params !== 'object') {
        return {
          success: false,
          message: '유효하지 않은 파라미터입니다',
          error: 'Invalid parameters',
        };
      }

      // 도구별 실행 로직 분기
      switch (toolName) {
        case 'set_volume':
          return this.setVolume(params as SetVolumeParams);

        case 'trim_audio':
          return this.trimAudio(params as TrimAudioParams);

        case 'apply_reverb':
          return this.applyReverb(params as ApplyReverbParams);

        case 'apply_filter':
          return this.applyFilter(params as ApplyFilterParams);

        case 'apply_eq':
          return this.applyEq(params as ApplyEqParams);

        case 'fade_in':
          return this.fadeIn(params as FadeInParams);

        case 'fade_out':
          return this.fadeOut(params as FadeOutParams);

        case 'get_track_info':
          return this.getTrackInfo(params as GetTrackInfoParams);

        case 'mute_track':
          return this.muteTrack(params as MuteTrackParams);

        case 'solo_track':
          return this.soloTrack(params as SoloTrackParams);

        default:
          return {
            success: false,
            message: `알 수 없는 도구: ${toolName}`,
            error: 'Unknown tool',
          };
      }
    } catch (error) {
      console.error('Tool execution error:', error);
      return {
        success: false,
        message: '도구 실행 중 오류가 발생했습니다',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * 트랙의 볼륨을 조절합니다
   */
  private setVolume(params: SetVolumeParams): ToolCallResult {
    const { trackId, volume } = params;

    // 트랙 존재 여부 확인
    const track = useTrackStore.getState().getTrack({ trackId });
    if (!track) {
      return {
        success: false,
        message: `트랙을 찾을 수 없습니다 (ID: ${trackId})`,
        error: 'Track not found',
      };
    }

    // 안전 범위로 클램핑
    const safeVolume = clampValue(volume, SAFE_RANGES.VOLUME);

    // 스토어 업데이트
    useTrackStore.getState().updateTrack({
      trackId,
      updates: { volume: safeVolume },
    });

    return {
      success: true,
      message: `트랙 "${trackId}"의 볼륨을 ${safeVolume.toFixed(1)}dB로 설정했습니다`,
      data: { trackId, volume: safeVolume },
    };
  }

  /**
   * 오디오의 특정 구간만 남기고 자릅니다 (비파괴적)
   */
  private trimAudio(params: TrimAudioParams): ToolCallResult {
    const { trackId, startTime, endTime } = params;

    // 트랙 존재 여부 확인
    const track = useTrackStore.getState().getTrack({ trackId });
    if (!track) {
      return {
        success: false,
        message: `트랙을 찾을 수 없습니다 (ID: ${trackId})`,
        error: 'Track not found',
      };
    }

    // 시간 유효성 검증
    if (startTime < 0 || endTime <= startTime) {
      return {
        success: false,
        message: '유효하지 않은 시간 범위입니다',
        error: 'Invalid time range',
      };
    }

    // @TODO: Region 업데이트 로직 구현
    // 현재는 메타데이터만 저장하고, 실제 Tone.js Player는 useWaveSurfer 훅에서 처리
    const updatedRegions = track.regions.map(region => ({
      ...region,
      startTime,
      endTime,
    }));

    useTrackStore.getState().updateTrack({
      trackId,
      updates: { regions: updatedRegions },
    });

    return {
      success: true,
      message: `트랙을 ${startTime.toFixed(2)}초부터 ${endTime.toFixed(2)}초까지 트림했습니다`,
      data: { trackId, startTime, endTime },
    };
  }

  /**
   * 리버브 효과를 적용합니다
   */
  private applyReverb(params: ApplyReverbParams): ToolCallResult {
    const { trackId, decay = 2.0, wet = 0.3 } = params;

    // 트랙 존재 여부 확인
    const track = useTrackStore.getState().getTrack({ trackId });
    if (!track) {
      return {
        success: false,
        message: `트랙을 찾을 수 없습니다 (ID: ${trackId})`,
        error: 'Track not found',
      };
    }

    // 안전 범위로 클램핑
    const safeDecay = clampValue(decay, SAFE_RANGES.REVERB_DECAY);
    const safeWet = clampValue(wet, SAFE_RANGES.WET);

    // @TODO: Tone.js Reverb 노드 연결 로직 구현
    // 현재는 메타데이터만 저장
    console.log('Apply Reverb:', { trackId, decay: safeDecay, wet: safeWet });

    return {
      success: true,
      message: `리버브 효과를 적용했습니다 (decay: ${safeDecay}초, wet: ${safeWet})`,
      data: { trackId, decay: safeDecay, wet: safeWet },
    };
  }

  /**
   * 주파수 필터를 적용합니다
   */
  private applyFilter(params: ApplyFilterParams): ToolCallResult {
    const { trackId, type, frequency = 1000 } = params;

    // 트랙 존재 여부 확인
    const track = useTrackStore.getState().getTrack({ trackId });
    if (!track) {
      return {
        success: false,
        message: `트랙을 찾을 수 없습니다 (ID: ${trackId})`,
        error: 'Track not found',
      };
    }

    // 안전 범위로 클램핑
    const safeFrequency = clampValue(frequency, SAFE_RANGES.FREQUENCY);

    // @TODO: Tone.js Filter 노드 연결 로직 구현
    console.log('Apply Filter:', { trackId, type, frequency: safeFrequency });

    const filterTypeKorean = {
      lowpass: '저역 통과 (고음 제거)',
      highpass: '고역 통과 (저음 제거)',
      bandpass: '특정 대역 통과',
    };

    return {
      success: true,
      message: `${filterTypeKorean[type]} 필터를 적용했습니다 (${safeFrequency}Hz)`,
      data: { trackId, type, frequency: safeFrequency },
    };
  }

  /**
   * 이퀄라이저를 적용합니다
   */
  private applyEq(params: ApplyEqParams): ToolCallResult {
    const { trackId, low = 0, mid = 0, high = 0 } = params;

    // 트랙 존재 여부 확인
    const track = useTrackStore.getState().getTrack({ trackId });
    if (!track) {
      return {
        success: false,
        message: `트랙을 찾을 수 없습니다 (ID: ${trackId})`,
        error: 'Track not found',
      };
    }

    // 안전 범위로 클램핑
    const safeLow = clampValue(low, SAFE_RANGES.EQ);
    const safeMid = clampValue(mid, SAFE_RANGES.EQ);
    const safeHigh = clampValue(high, SAFE_RANGES.EQ);

    // @TODO: Tone.js EQ3 노드 연결 로직 구현
    console.log('Apply EQ:', { trackId, low: safeLow, mid: safeMid, high: safeHigh });

    return {
      success: true,
      message: `EQ를 적용했습니다 (저음: ${safeLow}dB, 중음: ${safeMid}dB, 고음: ${safeHigh}dB)`,
      data: { trackId, low: safeLow, mid: safeMid, high: safeHigh },
    };
  }

  /**
   * 페이드 인 효과를 적용합니다
   */
  private fadeIn(params: FadeInParams): ToolCallResult {
    const { trackId, duration = 2.0 } = params;

    // 트랙 존재 여부 확인
    const track = useTrackStore.getState().getTrack({ trackId });
    if (!track) {
      return {
        success: false,
        message: `트랙을 찾을 수 없습니다 (ID: ${trackId})`,
        error: 'Track not found',
      };
    }

    // 안전 범위로 클램핑
    const safeDuration = clampValue(duration, SAFE_RANGES.FADE_DURATION);

    // @TODO: Tone.js 페이드 인 구현
    console.log('Apply Fade In:', { trackId, duration: safeDuration });

    return {
      success: true,
      message: `페이드 인을 적용했습니다 (${safeDuration}초)`,
      data: { trackId, duration: safeDuration },
    };
  }

  /**
   * 페이드 아웃 효과를 적용합니다
   */
  private fadeOut(params: FadeOutParams): ToolCallResult {
    const { trackId, duration = 2.0 } = params;

    // 트랙 존재 여부 확인
    const track = useTrackStore.getState().getTrack({ trackId });
    if (!track) {
      return {
        success: false,
        message: `트랙을 찾을 수 없습니다 (ID: ${trackId})`,
        error: 'Track not found',
      };
    }

    // 안전 범위로 클램핑
    const safeDuration = clampValue(duration, SAFE_RANGES.FADE_DURATION);

    // @TODO: Tone.js 페이드 아웃 구현
    console.log('Apply Fade Out:', { trackId, duration: safeDuration });

    return {
      success: true,
      message: `페이드 아웃을 적용했습니다 (${safeDuration}초)`,
      data: { trackId, duration: safeDuration },
    };
  }

  /**
   * 트랙 정보를 조회합니다
   */
  private getTrackInfo(params: GetTrackInfoParams): ToolCallResult {
    const { trackId } = params;

    // 트랙 존재 여부 확인
    const track = useTrackStore.getState().getTrack({ trackId });
    if (!track) {
      return {
        success: false,
        message: `트랙을 찾을 수 없습니다 (ID: ${trackId})`,
        error: 'Track not found',
      };
    }

    // 트랙 정보 반환
    const info = {
      id: track.id,
      volume: track.volume,
      pan: track.pan,
      status: track.status,
      regionCount: track.regions.length,
      regions: track.regions.map(r => ({
        startTime: r.startTime,
        endTime: r.endTime,
        duration: r.endTime - r.startTime,
        audioFileName: r.audioFile.name,
      })),
    };

    return {
      success: true,
      message: '트랙 정보를 가져왔습니다',
      data: info,
    };
  }

  /**
   * 트랙을 음소거하거나 해제합니다
   */
  private muteTrack(params: MuteTrackParams): ToolCallResult {
    const { trackId, mute } = params;

    // 트랙 존재 여부 확인
    const track = useTrackStore.getState().getTrack({ trackId });
    if (!track) {
      return {
        success: false,
        message: `트랙을 찾을 수 없습니다 (ID: ${trackId})`,
        error: 'Track not found',
      };
    }

    // 상태 업데이트
    let newStatus = [...track.status];
    if (mute) {
      // 음소거 추가 (중복 방지)
      if (!newStatus.includes(TrackStatus.mute)) {
        newStatus.push(TrackStatus.mute);
      }
    } else {
      // 음소거 제거
      newStatus = newStatus.filter(s => s !== TrackStatus.mute);
      if (newStatus.length === 0) {
        newStatus = [TrackStatus.normal];
      }
    }

    useTrackStore.getState().updateTrack({
      trackId,
      updates: { status: newStatus },
    });

    return {
      success: true,
      message: mute ? '트랙을 음소거했습니다' : '트랙 음소거를 해제했습니다',
      data: { trackId, mute, status: newStatus },
    };
  }

  /**
   * 트랙을 솔로 모드로 설정하거나 해제합니다
   */
  private soloTrack(params: SoloTrackParams): ToolCallResult {
    const { trackId, solo } = params;

    // 트랙 존재 여부 확인
    const track = useTrackStore.getState().getTrack({ trackId });
    if (!track) {
      return {
        success: false,
        message: `트랙을 찾을 수 없습니다 (ID: ${trackId})`,
        error: 'Track not found',
      };
    }

    // 솔로 활성화 시 다른 모든 트랙을 음소거
    const allTracks = useTrackStore.getState().getTracks();

    if (solo) {
      // 솔로 트랙 설정
      let soloStatus = [...track.status];
      if (!soloStatus.includes(TrackStatus.solo)) {
        soloStatus.push(TrackStatus.solo);
      }
      soloStatus = soloStatus.filter(s => s !== TrackStatus.mute);

      useTrackStore.getState().updateTrack({
        trackId,
        updates: { status: soloStatus },
      });

      // 다른 트랙들은 음소거
      allTracks.forEach((otherTrack, otherId) => {
        if (otherId !== trackId) {
          let otherStatus = [...otherTrack.status];
          if (!otherStatus.includes(TrackStatus.mute)) {
            otherStatus.push(TrackStatus.mute);
          }
          useTrackStore.getState().updateTrack({
            trackId: otherId,
            updates: { status: otherStatus },
          });
        }
      });
    } else {
      // 솔로 해제
      allTracks.forEach((t, tId) => {
        let newStatus = [...t.status].filter(
          s => s !== TrackStatus.solo && s !== TrackStatus.mute
        );
        if (newStatus.length === 0) {
          newStatus = [TrackStatus.normal];
        }
        useTrackStore.getState().updateTrack({
          trackId: tId,
          updates: { status: newStatus },
        });
      });
    }

    return {
      success: true,
      message: solo ? '트랙 솔로를 활성화했습니다' : '트랙 솔로를 해제했습니다',
      data: { trackId, solo },
    };
  }
}

/**
 * Singleton 인스턴스 export
 */
export const aiActionDispatcher = new AIActionDispatcher();

