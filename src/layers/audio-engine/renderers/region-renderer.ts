import type { RegionState } from '@/layers/session/session';

/**
 * Region 렌더링 파라미터
 *
 * 목적: Region을 Tone.js Player로 렌더링하기 위한 모든 파라미터
 */
export interface RegionRenderParams {
  /** 오디오 파일 URL */
  url: string;
  /** 타임라인에서 시작 시간 (초) */
  startTime: number;
  /** 오디오 파일 내에서 시작 오프셋 (초) */
  startOffset: number;
  /** 재생 지속 시간 (초) */
  duration: number;
}

/**
 * Export 범위
 */
export interface ExportRange {
  startTime: number;
  endTime: number;
}

/**
 * Split된 두 Region
 */
export interface SplitRegionResult {
  left: RegionState;
  right: RegionState;
}

/**
 * RegionRenderer
 *
 * 역할:
 * - Region의 렌더링 파라미터를 계산하는 순수 함수 모음
 * - 실시간 재생(AudioEngine)과 Export(exportProject)에서 공통으로 사용
 *
 * 원칙:
 * - 순수 함수만 포함 (Side Effect 없음)
 * - Tone.js 인스턴스를 생성하지 않음 (계산만 수행)
 * - 테스트 가능한 구조
 */
export class RegionRenderer {
  /**
   * Region을 렌더링하기 위한 파라미터 계산
   *
   * 이 함수는 실시간 재생과 Export 모두에서 사용되어
   * 동일한 결과를 보장합니다.
   *
   * @param region - 렌더링할 Region
   * @returns Tone.js Player에 전달할 파라미터
   */
  static calculateRenderParams(region: RegionState): RegionRenderParams {
    if (!region.audioFileUrl) {
      throw new Error('Region audioFileUrl is required for rendering');
    }
    return {
      url: region.audioFileUrl,
      startTime: region.startTime,
      startOffset: region.sourceStartTime,
      duration: region.endTime - region.startTime,
    };
  }

  /**
   * Export 범위에 따라 렌더링 파라미터 조정
   *
   * Export 범위가 Region의 일부만 포함하는 경우,
   * 파라미터를 조정하여 정확한 구간만 렌더링되도록 합니다.
   *
   * @param params - 원본 렌더링 파라미터
   * @param exportRange - Export 범위 (선택적)
   * @returns 조정된 렌더링 파라미터
   */
  static adjustForExportRange(params: RegionRenderParams, exportRange?: ExportRange): RegionRenderParams {
    if (!exportRange) {
      return params;
    }

    let { startTime, startOffset, duration } = params;
    const regionEndTime = startTime + duration;

    // 1. 리전이 Export 범위 밖인 경우: duration을 0으로
    if (regionEndTime <= exportRange.startTime || startTime >= exportRange.endTime) {
      return { ...params, duration: 0 };
    }

    // 2. 왼쪽이 잘리는 경우 (리전이 Export 시작점보다 앞에서 시작)
    if (startTime < exportRange.startTime) {
      const trimAmountFromLeft = exportRange.startTime - startTime;
      startOffset += trimAmountFromLeft;
      duration -= trimAmountFromLeft;
      startTime = exportRange.startTime;
    }

    // 3. 오른쪽이 잘리는 경우 (리전이 Export 끝점을 넘어감)
    if (regionEndTime > exportRange.endTime) {
      const trimAmountFromRight = regionEndTime - exportRange.endTime;
      duration -= trimAmountFromRight;
    }

    // 4. Export 시작점 기준으로 시간 조정
    const adjustedStartTime = startTime - exportRange.startTime;

    return {
      url: params.url,
      startTime: adjustedStartTime,
      startOffset,
      duration,
    };
  }

  /**
   * Region을 특정 시간에 두 개로 분할
   *
   * Split된 두 Region은 각각 올바른 sourceStartTime을 가지므로
   * 재생 시 연속적으로 들립니다.
   *
   * @param region - 분할할 Region
   * @param splitTime - 타임라인 상의 분할 시간 (초)
   * @returns 분할된 두 Region (left, right) 또는 null (분할 불가능한 경우)
   */
  static calculateSplitRegion(region: RegionState, splitTime: number): SplitRegionResult | null {
    // 1. 유효성 검사: 분할 시간이 Region 범위 내에 있어야 함 (양 끝점 제외)
    if (splitTime <= region.startTime || splitTime >= region.endTime) {
      return null;
    }

    const offsetAmount = splitTime - region.startTime;

    // 2. 왼쪽 Region 생성
    const leftRegion: RegionState = {
      ...region,
      id: crypto.randomUUID(),
      endTime: splitTime,
      duration: offsetAmount,
    };

    // 3. 오른쪽 Region 생성
    const rightRegion: RegionState = {
      ...region,
      id: crypto.randomUUID(),
      startTime: splitTime,
      sourceStartTime: region.sourceStartTime + offsetAmount,
      duration: region.duration - offsetAmount,
    };

    return {
      left: leftRegion,
      right: rightRegion,
    };
  }
}
