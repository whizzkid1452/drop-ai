/**
 * Region - 오디오 데이터 참조 (Ardour Region 개념)
 * 
 * Region은 실제 오디오 데이터를 참조하는 불변 객체입니다.
 * 여러 Playlist에서 같은 Region을 재사용할 수 있습니다.
 * 
 * 주요 특징:
 * - AudioBuffer 캐싱 (같은 파일은 하나의 Region으로 공유)
 * - 페이드 정보 관리
 * - 트리밍 정보 (start, length)
 * - 위치 정보는 Playlist에서 관리 (position은 Playlist에만 존재)
 */

export interface FadeInfo {
  in: {
    enabled: boolean;
    duration: number; // 초 단위
    curve: 'linear' | 'logarithmic' | 'exponential';
  };
  out: {
    enabled: boolean;
    duration: number; // 초 단위
    curve: 'linear' | 'logarithmic' | 'exponential';
  };
}

export interface RegionProperties {
  id: string;
  name: string;
  start: number; // 소스 내에서의 시작 위치 (초)
  length: number; // 길이 (초)
  muted: boolean;
  locked: boolean;
  fadeIn?: FadeInfo['in'];
  fadeOut?: FadeInfo['out'];
}

/**
 * Region 베이스 클래스
 * 실제 오디오 데이터는 AudioRegion에서 구현
 */
export abstract class Region {
  protected properties: RegionProperties;

  constructor(properties: RegionProperties) {
    this.properties = {
      ...properties,
      muted: properties.muted ?? false,
      locked: properties.locked ?? false,
    };
  }

  /**
   * Region ID
   */
  getId(): string {
    return this.properties.id;
  }

  /**
   * Region 이름
   */
  getName(): string {
    return this.properties.name;
  }

  /**
   * Region 이름 설정
   */
  setName(name: string): void {
    this.properties.name = name;
  }

  /**
   * 소스 내에서의 시작 위치 (초)
   */
  getStart(): number {
    return this.properties.start;
  }

  /**
   * 길이 (초)
   */
  getLength(): number {
    return this.properties.length;
  }

  /**
   * 소스 내에서의 종료 위치 (초)
   */
  getEnd(): number {
    return this.properties.start + this.properties.length;
  }

  /**
   * Mute 상태
   */
  isMuted(): boolean {
    return this.properties.muted;
  }

  /**
   * Mute 설정
   */
  setMuted(muted: boolean): void {
    this.properties.muted = muted;
  }

  /**
   * Lock 상태
   */
  isLocked(): boolean {
    return this.properties.locked;
  }

  /**
   * Lock 설정
   */
  setLocked(locked: boolean): void {
    this.properties.locked = locked;
  }

  /**
   * 페이드 인 정보
   */
  getFadeIn(): FadeInfo['in'] | undefined {
    return this.properties.fadeIn;
  }

  /**
   * 페이드 인 설정
   */
  setFadeIn(fadeIn: FadeInfo['in']): void {
    this.properties.fadeIn = fadeIn;
  }

  /**
   * 페이드 아웃 정보
   */
  getFadeOut(): FadeInfo['out'] | undefined {
    return this.properties.fadeOut;
  }

  /**
   * 페이드 아웃 설정
   */
  setFadeOut(fadeOut: FadeInfo['out']): void {
    this.properties.fadeOut = fadeOut;
  }

  /**
   * Region 복제 (새로운 ID로)
   */
  abstract clone(): Region;

  /**
   * Region 분할 (새로운 Region 생성)
   * @param splitPoint 분할 지점 (소스 내에서)
   * @returns [leftRegion, rightRegion] 또는 [null, rightRegion] 또는 [leftRegion, null]
   */
  abstract split(splitPoint: number): [Region | null, Region | null];

  /**
   * Region 속성 가져오기
   */
  getProperties(): Readonly<RegionProperties> {
    return { ...this.properties };
  }
}

