import type { IAudioEngine } from '../audio-engine/i-audio-engine';
import { type SessionStore } from '../session/session';

export class TrackController {
  constructor(
    private sessionStore: SessionStore,
    private audioEngine: IAudioEngine
  ) {}
  // id를 내부에서 반환하도록 처리
  //async : 함수가 비동기 작업을 처리하고 Promise를 반환한다는 것을 나타낸다는 선언 
  //addTrack 함수는 비동기 함수로 선언되어 Promise를 반환한다.
  async addTrack() { 
    const id = crypto.randomUUID(); //고유한 id 문자열을 만들어주는 브라우저 api
    console.log(`[TrackController] Adding track: ${id}`);

    // 1. AudioEngine에서 트랙(채널) 미리 생성
    this.audioEngine.createTrack(id);

    // 2. Update Session via Zustand
    //세션스토어에 트랙추가, 초기화 트랙상태를 인자로 받아 추가한다.
    this.sessionStore.getState().addTrack({  //초기 트랙 상태 객체
      id,
      name: `Track ${id.slice(0, 4)}`, // Default name
      volume: 1.0,
      isMuted: false,
      isSoloed: false,
      pan: 0,
      regions: [],
    });

    return { id }; //id 객체를 반환 (Promise<{ id: string }> 형태)
  }//addTrack 내부에는 await가 없어서 기능적으로는 동기처럼 작동하지만, 반환 타입은 Promise
  //사용처에서 await 가능

  async addRegion(trackId: string, file: File, startTime: number) {
    const regionId = crypto.randomUUID();
    console.log(`[TrackController] Adding region: ${regionId} to ${trackId}`);

    // 1. Load file and get duration
    const { src, duration } = await this.audioEngine.loadFile(file);

    const region = {
      id: regionId,
      trackId,
      src,
      startTime,
      duration,
      offset: 0,
    };

    // 2. Add to AudioEngine
    this.audioEngine.addRegion(trackId, region);

    // 3. Update Session
    this.sessionStore.getState().addRegion(trackId, region);

    return { regionId };
  }

  moveRegion(trackId: string, regionId: string, newStartTime: number) {
    console.log(
      `[TrackController] Moving region: ${regionId} to ${newStartTime}s`
    );

    const track = this.sessionStore.getState().tracks.get(trackId);
    //세션스토어의 현재 상태에서  track id를 키로 트랙을 조회해 track 변수에 할당한다. 
    const region = track?.regions.find(r => r.id === regionId);
    //track이 존재하면 track.regions 배열에서 regionId와 일치하는 region을 찾아서 반환한다.

    if (!region) {
      console.warn(`[TrackController] Region not found: ${regionId}`);
      return;
    }

    // Audio Engine 업데이트 (moveRegion 활용)
    this.audioEngine.moveRegion(trackId, regionId, newStartTime);

    const updatedRegion = { ...region, startTime: newStartTime };

    if (track) {
      this.sessionStore.getState().updateTrack(trackId, {
        regions: track.regions.map(r =>
          r.id === regionId ? updatedRegion : r
        ),
      });
    }
  }

  removeRegion(trackId: string, regionId: string) {
    console.log(`[TrackController] Removing region: ${regionId}`);
    this.audioEngine.removeRegion(trackId, regionId);
    this.sessionStore.getState().removeRegion(trackId, regionId);
  }

  splitRegion(trackId: string, regionId: string, splitTime: number) {
    const track = this.sessionStore.getState().tracks.get(trackId);
    if (!track) {
      throw new Error(`Track ${trackId} not found`);
    }

    const region = track.regions.find(r => r.id === regionId);
    if (!region) {
      throw new Error(`Region ${regionId} not found in track ${trackId}`);
    }

    if (
      splitTime <= region.startTime ||
      splitTime >= region.startTime + region.duration
    ) {
      throw new Error('Split time must be within region duration');
    }

    console.log(
      `[TrackController] Splitting region: ${regionId} at ${splitTime}s`
    );

    //원본 오디오에서 어디부터 재생해야하나
    //splitTime: 원본 오디오에서 리전을 분할할 시간 (타임라인 상 절대시간)
    // splitOffset: 잘랐을때, 원본 음원 기준 오프셋 (오른쪽 조각이 원본 오디오에서 시작해야할 지점 (오디오 파일에서))
    // region.offset: 원본 오디오에서 리전이 시작하는 지점
    const splitOffset = region.offset + (splitTime - region.startTime); //리전 시작 지점 + |분할된 시간(왼쪽 리전 길이)| = 잘린시간 절댓값
    const leftSplitRegionDuration = splitTime - region.startTime;
    const rightSplitRegionDuration = region.duration - leftSplitRegionDuration;

    // 1. Resize original region (Left)
    this.resizeRegion(trackId, regionId, leftSplitRegionDuration);

    // 2. Create Right Region
    const rightRegion = {
      ...region,
      id: crypto.randomUUID(),
      startTime: splitTime,
      offset: splitOffset,//잘린 오프셋 적용
      duration: rightSplitRegionDuration,
    };

    // 3. Add Right Region
    this.audioEngine.addRegion(trackId, rightRegion);
    this.sessionStore.getState().addRegion(trackId, rightRegion);

    return { leftId: regionId, rightId: rightRegion.id };
  }

  resizeRegion(trackId: string, regionId: string, newDuration: number) {
    const track = this.sessionStore.getState().tracks.get(trackId);
    if (!track) {
      throw new Error(`Track ${trackId} not found`);
    }

    const region = track.regions.find(r => r.id === regionId);

    if (!region) {
      throw new Error(`Region ${regionId} not found`);
    }

    if (newDuration <= 0) {
      throw new Error('Duration must be positive');
    }

    console.log(
      `[TrackController] Resizing region: ${regionId} to ${newDuration}s`
    );

    // Update Session
    this.sessionStore
      .getState()
      .updateRegion(trackId, regionId, { duration: newDuration });

    // Update AudioEngine
    // Reuse remove/add pattern
    const newRegion = { ...region, duration: newDuration };
    this.audioEngine.removeRegion(trackId, regionId);
    this.audioEngine.addRegion(trackId, newRegion);
  }

  removeTrack(id: string): void {
    console.log(`[TrackController] Removing track: ${id}`);
    this.audioEngine.removeTrack(id);
    this.sessionStore.getState().removeTrack(id);
  }

  setTrackVolume(id: string, volume: number): void {
    this.audioEngine.setTrackVolume(id, volume);
    this.sessionStore.getState().updateTrack(id, { volume });
  }

  setTrackMute(id: string, isMuted: boolean): void {
    this.audioEngine.setTrackMute(id, isMuted);
    this.sessionStore.getState().updateTrack(id, { isMuted });
  }

  setTrackSolo(id: string, isSoloed: boolean): void {
    this.audioEngine.setTrackSolo(id, isSoloed);
    this.sessionStore.getState().updateTrack(id, { isSoloed });
  }

  setTrackPan(id: string, pan: number): void {
    this.audioEngine.setTrackPan(id, pan);
    this.sessionStore.getState().updateTrack(id, { pan });
  }
}
