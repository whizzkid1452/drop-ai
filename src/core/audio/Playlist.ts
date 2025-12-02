import type { Region } from './Region';

/**
 * PlaylistItem - Playlist에 배치된 Region 참조
 * 
 * Region은 데이터를 나타내고,
 * PlaylistItem은 타임라인에 배치된 Region의 위치와 레이어 정보를 담습니다.
 */
export interface PlaylistItem {
  region: Region;
  position: number; // 타임라인에서의 시작 위치 (초)
  layer: number; // 레이어 번호 (낮을수록 위에 표시)
}

/**
 * Playlist - 타임라인에 배치된 Region 목록 관리
 * 
 * Ardour의 Playlist 개념:
 * - 각 트랙마다 하나의 Playlist를 가짐
 * - Region을 타임라인에 배치하고 위치/레이어 관리
 * - 같은 Region을 여러 번 배치할 수 있음
 * - Region은 공유되므로 메모리 효율적
 */
export class Playlist {
  private name: string;
  private items: PlaylistItem[] = [];
  private nextLayerIndex: number = 0;

  constructor(name: string) {
    this.name = name;
  }

  /**
   * Playlist 이름
   */
  getName(): string {
    return this.name;
  }

  /**
   * Playlist 이름 설정
   */
  setName(name: string): void {
    this.name = name;
  }

  /**
   * Region 추가 (타임라인에 배치)
   * @param region 추가할 Region
   * @param position 타임라인에서의 시작 위치 (초)
   * @param layer 레이어 번호 (지정하지 않으면 자동 할당)
   */
  addRegion(region: Region, position: number, layer?: number): void {
    if (region.isLocked()) {
      throw new Error('Cannot add locked region to playlist');
    }

    const assignedLayer = layer ?? this.nextLayerIndex++;
    const item: PlaylistItem = {
      region,
      position,
      layer: assignedLayer,
    };

    this.items.push(item);
    this.sortItems();
  }

  /**
   * Region 제거
   * @param item 제거할 PlaylistItem
   */
  removeItem(item: PlaylistItem): void {
    const index = this.items.indexOf(item);
    if (index > -1) {
      this.items.splice(index, 1);
    }
  }

  /**
   * 모든 PlaylistItem 가져오기
   */
  getItems(): ReadonlyArray<PlaylistItem> {
    return [...this.items];
  }

  /**
   * 특정 시간에 있는 Region들 가져오기
   * @param time 타임라인 시간 (초)
   */
  getRegionsAtTime(time: number): PlaylistItem[] {
    return this.items.filter(item => {
      const start = item.position;
      const end = start + item.region.getLength();
      return time >= start && time < end;
    });
  }

  /**
   * 특정 범위와 겹치는 Region들 가져오기
   * @param start 시작 시간 (초)
   * @param end 종료 시간 (초)
   */
  getRegionsInRange(start: number, end: number): PlaylistItem[] {
    return this.items.filter(item => {
      const itemStart = item.position;
      const itemEnd = itemStart + item.region.getLength();
      return !(itemEnd <= start || itemStart >= end);
    });
  }

  /**
   * Region 위치 이동
   * @param item 이동할 PlaylistItem
   * @param newPosition 새로운 위치 (초)
   */
  moveItem(item: PlaylistItem, newPosition: number): void {
    if (item.region.isLocked()) {
      throw new Error('Cannot move locked region');
    }
    item.position = newPosition;
    this.sortItems();
  }

  /**
   * Region 레이어 변경
   * @param item 변경할 PlaylistItem
   * @param newLayer 새로운 레이어 번호
   */
  setItemLayer(item: PlaylistItem, newLayer: number): void {
    item.layer = newLayer;
    this.sortItems();
  }

  /**
   * Region 분할
   * @param item 분할할 PlaylistItem
   * @param splitTime 타임라인에서의 분할 지점 (초)
   * @returns [leftItem, rightItem] 또는 [null, rightItem] 또는 [leftItem, null]
   */
  splitItem(item: PlaylistItem, splitTime: number): [PlaylistItem | null, PlaylistItem | null] {
    if (item.region.isLocked()) {
      throw new Error('Cannot split locked region');
    }

    const itemStart = item.position;
    const itemEnd = itemStart + item.region.getLength();

    if (splitTime <= itemStart) {
      return [null, item];
    }
    if (splitTime >= itemEnd) {
      return [item, null];
    }

    // Region을 소스 기준으로 분할
    const regionRelativeSplit = splitTime - itemStart;
    const sourceSplit = item.region.getStart() + regionRelativeSplit;
    const [leftRegion, rightRegion] = item.region.split(sourceSplit);

    if (!leftRegion || !rightRegion) {
      return [leftRegion ? item : null, rightRegion ? item : null];
    }

    // 기존 item 제거
    this.removeItem(item);

    // 새로운 items 생성
    const leftItem: PlaylistItem = {
      region: leftRegion,
      position: itemStart,
      layer: item.layer,
    };

    const rightItem: PlaylistItem = {
      region: rightRegion,
      position: splitTime,
      layer: item.layer,
    };

    this.items.push(leftItem, rightItem);
    this.sortItems();

    return [leftItem, rightItem];
  }

  /**
   * Playlist 비우기
   */
  clear(): void {
    this.items = [];
    this.nextLayerIndex = 0;
  }

  /**
   * Playlist 복제
   */
  clone(name: string): Playlist {
    const cloned = new Playlist(name);
    this.items.forEach(item => {
      cloned.addRegion(item.region.clone(), item.position, item.layer);
    });
    return cloned;
  }

  /**
   * Items를 시간순으로 정렬 (레이어 순서 유지)
   */
  private sortItems(): void {
    this.items.sort((a, b) => {
      // 먼저 시간순 정렬
      if (a.position !== b.position) {
        return a.position - b.position;
      }
      // 같은 시간이면 레이어 순서 (낮을수록 위)
      return a.layer - b.layer;
    });
  }

  /**
   * 타임라인 범위 계산
   */
  getExtent(): { start: number; end: number } {
    if (this.items.length === 0) {
      return { start: 0, end: 0 };
    }

    let minStart = Infinity;
    let maxEnd = -Infinity;

    this.items.forEach(item => {
      const start = item.position;
      const end = start + item.region.getLength();
      minStart = Math.min(minStart, start);
      maxEnd = Math.max(maxEnd, end);
    });

    return { start: minStart, end: maxEnd };
  }
}

