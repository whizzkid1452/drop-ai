import { Region, type RegionProperties } from './Region';
import { BufferManager } from './BufferManager';

/**
 * AudioRegion - 오디오 Region 구현
 * 
 * AudioBuffer를 캐싱하고 관리합니다.
 * 여러 Playlist에서 같은 AudioRegion을 재사용할 수 있습니다.
 * BufferManager를 통해 메모리 효율적인 버퍼 관리를 수행합니다.
 */
export class AudioRegion extends Region {
  private buffer: AudioBuffer;
  private sourceId: string; // 원본 파일 ID (캐싱용)

  constructor(
    buffer: AudioBuffer,
    sourceId: string,
    properties: Omit<RegionProperties, 'id'> & { id?: string }
  ) {
    const id = properties.id || `region_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    super({
      ...properties,
      id,
      // start와 length가 지정되지 않으면 전체 버퍼 사용
      start: properties.start ?? 0,
      length: properties.length ?? buffer.duration,
    });

    this.buffer = buffer;
    this.sourceId = sourceId;

    // BufferManager에 버퍼 캐싱
    BufferManager.cacheBuffer(sourceId, buffer);
  }

  /**
   * AudioBuffer 가져오기
   * BufferManager 캐시에서 가져오거나 직접 반환
   */
  getBuffer(): AudioBuffer {
    // BufferManager 캐시에서 확인 (AudioContext가 필요한 경우)
    // 현재는 직접 버퍼를 반환하지만, 향후 캐시 우선 사용 가능
    return this.buffer;
  }

  /**
   * 소스 ID 가져오기 (캐싱용)
   */
  getSourceId(): string {
    return this.sourceId;
  }

  /**
   * Region 복제
   */
  clone(): AudioRegion {
    const props = this.getProperties();
    return new AudioRegion(
      this.buffer,
      this.sourceId,
      {
        id: `region_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        name: `${props.name} (copy)`,
        start: props.start,
        length: props.length,
        muted: props.muted,
        locked: props.locked,
        fadeIn: props.fadeIn,
        fadeOut: props.fadeOut,
      }
    );
  }

  /**
   * Region 트리밍 (새로운 Region 생성)
   * @param newStart 새로운 시작 위치 (소스 내에서)
   * @param newLength 새로운 길이
   */
  trim(newStart: number, newLength: number): AudioRegion {
    const props = this.getProperties();
    const maxStart = props.start + props.length;
    const clampedStart = Math.max(props.start, Math.min(newStart, maxStart));
    const clampedLength = Math.min(newLength, maxStart - clampedStart);

    return new AudioRegion(
      this.buffer,
      this.sourceId,
      {
        id: `region_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        name: props.name,
        start: clampedStart,
        length: clampedLength,
        muted: props.muted,
        locked: props.locked,
        fadeIn: props.fadeIn,
        fadeOut: props.fadeOut,
      }
    );
  }

  /**
   * Region 분할 (새로운 Region 생성)
   * @param splitPoint 분할 지점 (소스 내에서)
   * @returns [leftRegion, rightRegion] 또는 [null, rightRegion] 또는 [leftRegion, null]
   */
  split(splitPoint: number): [AudioRegion | null, AudioRegion | null] {
    const props = this.getProperties();
    const regionStart = props.start;
    const regionEnd = props.start + props.length;

    if (splitPoint <= regionStart) {
      return [null, this.clone()];
    }
    if (splitPoint >= regionEnd) {
      return [this.clone(), null];
    }

    const leftRegion = this.trim(regionStart, splitPoint - regionStart);
    const rightRegion = this.trim(splitPoint, regionEnd - splitPoint);

    return [leftRegion, rightRegion];
  }
}

