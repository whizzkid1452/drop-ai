import { Clip } from './Clip';
import { Playlist } from './Playlist';
import { AudioRegion } from './AudioRegion';
import type { Region } from './Region';
import type { PlaylistItem } from './Playlist';
import { Route } from './Route';
import { TRACK_COLOR_PALETTE } from '../../constants/audio';

/**
 * Track - DAW의 개별 트랙
 * Ardour의 Track 클래스를 참고하여 구현
 *
 * Track은 Route를 상속받아 믹싱 기능을 제공하고,
 * Playlist를 사용하여 Region을 관리합니다.
 * 기존 Clip과의 호환성을 위해 getClips() 메서드를 제공합니다.
 */
export class Track extends Route {
  private playlist: Playlist;
  private activeClips: Map<PlaylistItem, Clip> = new Map(); // 재생용 Clip 인스턴스
  private muteOverride: boolean = false; // solo 등에 의한 강제 mute
  private isPlaying: boolean = false;
  private isPaused: boolean = false;

  constructor(context: AudioContext, name: string, index: number = 0) {
    super(context, name);

    // Playlist 생성
    this.playlist = new Playlist(`${name} Playlist`);

    // 색상 할당 (인덱스 기반)
    this.setColor(TRACK_COLOR_PALETTE[index % TRACK_COLOR_PALETTE.length]);
  }

  /**
   * Playlist 가져오기
   */
  getPlaylist(): Playlist {
    return this.playlist;
  }

  /**
   * 현재 상태에 따른 실제 게인 적용 (Route의 applyGain 오버라이드)
   */
  protected applyGain(): void {
    const shouldMute = this.isMutedState() || this.muteOverride;
    // Route의 applyGain 로직 사용
    if (shouldMute) {
      this.gainNode.gain.value = 0;
    } else {
      this.gainNode.gain.value = this.getVolume() / 100;
    }
  }

  /**
   * Region 추가 (Playlist에 배치)
   * @param region 추가할 Region
   * @param position 타임라인에서의 시작 위치 (초)
   * @param layer 레이어 번호 (지정하지 않으면 자동 할당)
   */
  addRegion(region: Region, position: number, layer?: number): void {
    this.playlist.addRegion(region, position, layer);
  }

  /**
   * PlaylistItem 제거
   */
  removeItem(item: PlaylistItem): void {
    // 재생 중인 Clip이 있으면 정리
    const clip = this.activeClips.get(item);
    if (clip) {
      clip.disconnect();
      clip.dispose();
      this.activeClips.delete(item);
    }
    this.playlist.removeItem(item);
  }

  /**
   * 호환성: 기존 Clip 추가 (내부적으로 Region으로 변환)
   * @deprecated addRegion을 사용하세요
   */
  addClip(clip: Clip): void {
    const buffer = clip.getBuffer();
    const startTime = clip.getStartTime();

    // AudioRegion 생성
    const region = new AudioRegion(buffer, `source_${Date.now()}`, {
      name: `Clip ${startTime}`,
      start: 0,
      length: buffer.duration,
      muted: false,
      locked: false,
    });

    // Playlist에 추가
    this.playlist.addRegion(region, startTime);

    // Clip 연결 (ProcessorChain을 거치도록 수정)
    // Route의 입력 노드에 연결하면 ProcessorChain을 거쳐 처리됨
    clip.connect(this.getInputNode());
  }

  /**
   * 호환성: 모든 클립 가져오기 (PlaylistItem 기반으로 생성)
   * @deprecated getPlaylist().getItems()를 사용하세요
   */
  getClips(): Clip[] {
    // PlaylistItem을 기반으로 Clip 배열 생성 (호환성)
    const items = this.playlist.getItems();
    return items
      .map(item => {
        // 이미 활성화된 Clip이 있으면 반환
        let clip = this.activeClips.get(item);
        if (!clip && item.region instanceof AudioRegion) {
          // 새로운 Clip 생성 (재생용)
          const context = this.context as AudioContext;
          clip = new Clip(context, item.region.getBuffer(), item.position);
          clip.connect(this.getInputNode());
          this.activeClips.set(item, clip);
        }
        return clip!;
      })
      .filter((clip): clip is Clip => clip !== undefined);
  }

  /**
   * PlaylistItem 가져오기 (새로운 방식)
   */
  getPlaylistItems(): ReadonlyArray<PlaylistItem> {
    return this.playlist.getItems();
  }

  // Route에서 이미 제공하는 메서드들이므로 제거
  // setVolume, getVolume, setMuted, isMutedState, setSolo, isSoloState는 Route에서 상속

  /**
   * Solo 상태가 적용되었을 때의 mute override 설정
   */
  setMuteOverride(muted: boolean): void {
    this.muteOverride = muted;
    this.applyGain();
  }

  // Route에서 이미 제공하는 메서드들이므로 제거
  // setPan, getPan, setColor, getColor는 Route에서 상속

  /**
   * 트랙 재생 시작
   */
  play(_context: AudioContext, currentTime: number, position: number): void {
    // 이미 재생 중이면 위치만 업데이트
    if (this.isPlaying && !this.isPaused) {
      this.updatePosition(position);
      return;
    }

    this.isPlaying = true;
    this.isPaused = false;

    // Playlist에서 현재 위치에 있는 Region들 재생
    const items = this.playlist.getRegionsAtTime(position);
    items.forEach(item => {
      if (item.region instanceof AudioRegion && !item.region.isMuted()) {
        let clip = this.activeClips.get(item);
        if (!clip) {
          clip = new Clip(_context, item.region.getBuffer(), item.position);
          clip.connect(this.getInputNode());
          this.activeClips.set(item, clip);
        }
        clip.play(currentTime, position);
      }
    });
  }

  /**
   * 트랙 재생 정지
   */
  stop(): void {
    this.isPlaying = false;
    this.isPaused = false;
    this.activeClips.forEach(clip => {
      clip.stop();
      clip.disconnect();
      clip.dispose();
    });
    this.activeClips.clear();
  }

  /**
   * 트랙 일시정지
   */
  pause(transportPosition: number): void {
    if (this.isPlaying) {
      this.isPaused = true;
      this.activeClips.forEach(clip => {
        // transport position을 사용하여 정확한 pause position 계산
        clip.pause(transportPosition);
      });
    }
  }

  /**
   * 트랙 재개
   */
  resume(_context: AudioContext, currentTime: number): void {
    if (this.isPaused) {
      this.isPlaying = true;
      this.isPaused = false;
      this.activeClips.forEach(clip => clip.resume(currentTime));
    }
  }

  /**
   * 재생 위치 업데이트
   * 재생 중일 때만 Clip을 재생하고, 정지 상태에서는 플레이헤드만 이동
   * Ardour처럼: 정지 상태에서는 Clip을 정리하지 않고, 재생 시작 시 play()에서 처리
   */
  updatePosition(position: number): void {
    // 재생 중일 때만 Clip 재생 및 업데이트
    if (this.isPlaying && !this.isPaused) {
      // 현재 위치에 있는 Region들 가져오기
      const itemsAtPosition = this.playlist.getRegionsAtTime(position);
      const itemsInRange = new Set(itemsAtPosition);

      // 범위를 벗어난 Clip들 정리
      const clipsToRemove: Array<[PlaylistItem, Clip]> = [];
      this.activeClips.forEach((clip, item) => {
        if (!itemsInRange.has(item)) {
          clipsToRemove.push([item, clip]);
        }
      });

      clipsToRemove.forEach(([item, clip]) => {
        clip.stop();
        clip.disconnect();
        clip.dispose();
        this.activeClips.delete(item);
      });

      // 범위 내에 있는 기존 Clip들도 위치가 변경되었을 수 있으므로 재시작
      this.activeClips.forEach((clip, item) => {
        if (itemsInRange.has(item)) {
          // 위치가 변경되었을 수 있으므로 재시작 필요
          clip.stop();
          clip.disconnect();
          clip.dispose();
          this.activeClips.delete(item);
        }
      });

      // 재시작할 Clip들과 새로운 Clip들 모두 재생 시작
      itemsAtPosition.forEach(item => {
        if (item.region instanceof AudioRegion && !item.region.isMuted()) {
          const context = this.context as AudioContext;
          const clip = new Clip(
            context,
            item.region.getBuffer(),
            item.position
          );
          clip.connect(this.getInputNode());
          clip.play(context.currentTime, position);
          this.activeClips.set(item, clip);
        }
      });
    }
    // 정지 상태에서는 아무것도 하지 않음 (플레이헤드만 이동)
    // 재생 시작 시 play() 메서드에서 현재 위치의 Region들을 재생함
  }

  /**
   * 리소스 정리
   */
  dispose(): void {
    this.activeClips.forEach(clip => {
      clip.disconnect();
      clip.dispose();
    });
    this.activeClips.clear();
    this.playlist.clear();
    super.dispose(); // Route의 dispose 호출
  }

  /**
   * Track인지 확인 (Route 추상 메서드 구현)
   */
  isTrack(): boolean {
    return true;
  }

  /**
   * Bus인지 확인 (Route 추상 메서드 구현)
   */
  isBus(): boolean {
    return false;
  }
}
