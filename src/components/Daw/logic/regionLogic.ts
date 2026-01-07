import type { Region } from '@/types/track';
import { RegionStatus } from '@/types/track';

interface SplitRegionResult {
    left: Region;
    right: Region;
}

/**
 * 하나의 Region을 특정 시간(splitTime)을 기준으로 두 개로 분할합니다.
 * @param region 대상 Region
 * @param splitTime 타임라인 상의 분할 시간 (초)
 */
export const calculateSplitRegion = (
    region: Region,
    splitTime: number
): SplitRegionResult | null => {
    // 1. 유효성 검사: 분할 시간이 Region 범위 내에 있어야 함 (양 끝점 제외)
    // 너무 작은 오차 범위(예: 0.01초 미만)는 분할하지 않도록 처리 가능
    if (splitTime <= region.startTime || splitTime >= region.endTime) {
        return null;
    }

    // 2. 왼쪽 Region 생성
    // startTime: 유지
    // endTime: splitTime
    // sourceStart: 유지
    const left: Region = {
        ...region,
        id: crypto.randomUUID(), // 새로운 ID 발급
        endTime: splitTime,
    };

    // 3. 오른쪽 Region 생성
    // startTime: splitTime
    // endTime: 유지
    // sourceStart: 기존 sourceStart + (splitTime - 기존 startTime)  <- 핵심 로직
    // (재생되는 오프셋이 잘린 시간만큼 뒤로 밀려야 함)
    const offset = splitTime - region.startTime;
    const right: Region = {
        ...region,
        id: crypto.randomUUID(), // 새로운 ID 발급
        startTime: splitTime,
        sourceStart: (region.sourceStart ?? 0) + offset,
    };

    return { left, right };
};
