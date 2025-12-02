/**
 * Session - DAW 세션 관리 클래스
 * Ardour의 Session 클래스를 참고하여 구현
 *
 * 주요 기능:
 * - AudioEngine 통합 관리
 * - Track/Routes 관리
 * - 세션 상태 관리 (dirty, writable 등)
 * - Undo/Redo 스택 관리
 * - 세션 저장/로드 인터페이스
 */

import { AudioEngine } from './AudioEngine';
import { Track } from './Track';
import { Bus } from './Bus';
import { Route } from './Route';
import { UndoStack, type Command } from './UndoStack';
import { BufferManager } from './BufferManager';
import { AudioRegion } from './AudioRegion';
import type { AudioEngineConfig } from '../../types/audio';
import type { SessionData, SessionMetadata } from '../models/SessionData';
import { SessionStateFlags } from '../models/SessionData';
import { getSessionSerializer } from '../utils/sessionSerializer';

/**
 * RouteList 타입 (Ardour의 RouteList 개념)
 */
export type RouteList = Route[];

/**
 * 세션 이벤트 타입
 */
export type SessionEventType =
  | 'dirty-changed'
  | 'track-added'
  | 'track-removed'
  | 'session-loaded'
  | 'session-saved';

/**
 * 세션 이벤트 리스너
 */
export type SessionEventListener = (event: SessionEventType) => void;

/**
 * Session 클래스
 */
export class Session {
  private audioEngine: AudioEngine;
  private routes: Route[] = []; // RouteList (Track과 Bus 포함)
  private undoStack: UndoStack;
  private state: number = SessionStateFlags.Writable;
  private metadata: SessionMetadata;
  private eventListeners: Map<SessionEventType, Set<SessionEventListener>> =
    new Map();
  private addingRoutesInProgress: boolean = false; // Route 추가 중 플래그
  private routeDeletionInProgress: boolean = false; // Route 삭제 중 플래그
  private sessionId: string | null = null; // 현재 세션 ID (저장된 세션인 경우)

  /**
   * 생성자
   */
  constructor(config: AudioEngineConfig = {}) {
    // AudioEngine 초기화
    this.audioEngine = new AudioEngine(config);

    // BufferManager 초기화 (Ardour 스타일)
    // ThreadBuffers 풀 크기: 기본 4개 (웹 환경에서는 충분)
    const audioContext = this.audioEngine.getAudioContext();
    BufferManager.init(4, audioContext, {
      maxPoolSize: 10,
      defaultBufferSize: 4096,
      maxCachedFiles: 50,
    });

    // Undo 스택 초기화
    this.undoStack = new UndoStack();

    // 메타데이터 초기화
    this.metadata = {
      name: 'Untitled Session',
      createdAt: new Date().toISOString(),
      modifiedAt: new Date().toISOString(),
      version: '1.0.0',
      sampleRate: config.sampleRate || 44100,
      bpm: config.bpm || 120,
      masterVolume: config.masterVolume || 100,
    };

    // 이벤트 리스너 맵 초기화
    Object.values([
      'dirty-changed',
      'track-added',
      'track-removed',
      'session-loaded',
      'session-saved',
    ] as SessionEventType[]).forEach(eventType => {
      this.eventListeners.set(eventType, new Set());
    });
  }

  /**
   * AudioEngine 가져오기
   */
  getAudioEngine(): AudioEngine {
    return this.audioEngine;
  }

  /**
   * 세션 이름 가져오기
   */
  getName(): string {
    return this.metadata.name;
  }

  /**
   * 세션 이름 설정
   */
  setName(name: string): void {
    const oldName = this.metadata.name;
    this.executeCommand({
      execute: () => {
        this.metadata.name = name;
        this.metadata.modifiedAt = new Date().toISOString();
        this.setDirty(true);
      },
      undo: () => {
        this.metadata.name = oldName;
        this.metadata.modifiedAt = new Date().toISOString();
        this.setDirty(true);
      },
      description: `Rename session to "${name}"`,
    });
  }

  /**
   * BPM 가져오기
   */
  getBPM(): number {
    return this.metadata.bpm;
  }

  /**
   * BPM 설정
   */
  setBPM(bpm: number): void {
    const oldBPM = this.metadata.bpm;
    this.executeCommand({
      execute: () => {
        this.metadata.bpm = bpm;
        this.metadata.modifiedAt = new Date().toISOString();
        this.audioEngine.setBPM(bpm);
        this.setDirty(true);
      },
      undo: () => {
        this.metadata.bpm = oldBPM;
        this.metadata.modifiedAt = new Date().toISOString();
        this.audioEngine.setBPM(oldBPM);
        this.setDirty(true);
      },
      description: `Set BPM to ${bpm}`,
    });
  }

  /**
   * 마스터 볼륨 가져오기
   */
  getMasterVolume(): number {
    return this.metadata.masterVolume;
  }

  /**
   * 마스터 볼륨 설정
   */
  setMasterVolume(volume: number): void {
    const oldVolume = this.metadata.masterVolume;
    this.executeCommand({
      execute: () => {
        this.metadata.masterVolume = volume;
        this.metadata.modifiedAt = new Date().toISOString();
        this.audioEngine.setMasterVolume(volume);
        this.setDirty(true);
      },
      undo: () => {
        this.metadata.masterVolume = oldVolume;
        this.metadata.modifiedAt = new Date().toISOString();
        this.audioEngine.setMasterVolume(oldVolume);
        this.setDirty(true);
      },
      description: `Set master volume to ${volume}%`,
    });
  }

  /**
   * 트랙 추가 (내부 메서드)
   * @private
   */
  private addTrackInner(name?: string): Track {
    const trackName = name || `Track ${this.getTrackCount() + 1}`;
    const track = this.audioEngine.addTrack(trackName);

    this.routes.push(track);
    return track;
  }

  /**
   * 트랙 추가 (Ardour 스타일)
   */
  addTrack(name?: string): Track {
    const track = this.addTrackInner(name);
    this.setDirty(true);
    this.emitEvent('track-added');
    return track;
  }

  /**
   * Bus 추가
   */
  addBus(name?: string): Bus {
    const busName = name || `Bus ${this.getBusCount() + 1}`;
    const context = this.audioEngine.getAudioContext();
    const bus = new Bus(context, busName);

    this.routes.push(bus);
    this.setDirty(true);
    this.emitEvent('track-added'); // TODO: 'bus-added' 이벤트 추가
    return bus;
  }

  /**
   * Route 추가 (Ardour 스타일 - 여러 Route를 한 번에 추가)
   */
  addRoutes(routes: RouteList): RouteList {
    const addedRoutes: RouteList = [];

    try {
      this.addingRoutesInProgress = true;

      for (const route of routes) {
        // 이미 추가된 Route는 스킵
        if (this.routes.includes(route)) {
          continue;
        }

        this.routes.push(route);
        addedRoutes.push(route);
      }
    } finally {
      this.addingRoutesInProgress = false;
    }

    if (addedRoutes.length > 0) {
      this.setDirty(true);
      this.emitEvent('track-added');
    }

    return addedRoutes;
  }

  /**
   * Route 제거 (내부 메서드)
   * @private
   */
  private removeRouteInner(route: Route): void {
    const index = this.routes.indexOf(route);
    if (index === -1) {
      return;
    }

    // Track인 경우 AudioEngine에서 제거
    if (route instanceof Track) {
      this.audioEngine.removeTrack(route);
    }

    // RouteList에서 제거
    this.routes.splice(index, 1);
  }

  /**
   * 트랙 제거 (내부 메서드) - 호환성 유지
   * @private
   */
  private removeTrackInner(track: Track): void {
    this.removeRouteInner(track);
  }

  /**
   * 트랙 제거 (Undo 가능)
   */
  removeTrack(track: Track): void {
    const index = this.routes.indexOf(track);
    if (index === -1) {
      return;
    }

    this.executeCommand({
      execute: () => {
        this.removeTrackInner(track);
        this.setDirty(true);
        this.emitEvent('track-removed');
      },
      undo: () => {
        // 트랙 복원
        this.routes.splice(index, 0, track);
        // AudioEngine에 다시 연결
        const masterGain = (this.audioEngine as any).masterGain;
        if (masterGain) {
          track.connect(masterGain);
        }
        this.setDirty(true);
        this.emitEvent('track-added');
      },
      description: `Remove track "${track.getName()}"`,
    });
  }

  /**
   * Route 제거 (Ardour 스타일 - 여러 Route를 한 번에 제거)
   */
  removeRoutes(routes: RouteList): void {
    if (routes.length === 0) {
      return;
    }

    // 제거할 Route들의 인덱스와 정보 저장
    const routeInfos = routes
      .map(route => {
        const index = this.routes.indexOf(route);
        return { route, index };
      })
      .filter(info => info.index !== -1);

    if (routeInfos.length === 0) {
      return;
    }

    this.executeCommand({
      execute: () => {
        try {
          this.routeDeletionInProgress = true;

          for (const info of routeInfos) {
            this.removeRouteInner(info.route);
          }
        } finally {
          this.routeDeletionInProgress = false;
        }

        this.setDirty(true);
        this.emitEvent('track-removed');
      },
      undo: () => {
        // 역순으로 복원 (인덱스 유지)
        for (let i = routeInfos.length - 1; i >= 0; i--) {
          const info = routeInfos[i];
          this.routes.splice(info.index, 0, info.route);
          // AudioEngine에 다시 연결
          const masterGain = (this.audioEngine as any).masterGain;
          if (masterGain && info.route instanceof Track) {
            info.route.connect(masterGain);
          }
        }
        this.setDirty(true);
        this.emitEvent('track-added');
      },
      description: `Remove ${routeInfos.length} route(s)`,
    });
  }

  /**
   * Route 제거 (단일)
   */
  removeRoute(route: Route): void {
    this.removeRoutes([route]);
  }

  /**
   * 모든 트랙 가져오기
   */
  getTracks(): Track[] {
    return this.routes.filter(route => route instanceof Track) as Track[];
  }

  /**
   * 모든 Bus 가져오기
   */
  getBuses(): Bus[] {
    return this.routes.filter(route => route instanceof Bus) as Bus[];
  }

  /**
   * 모든 Route 가져오기 (Ardour 스타일)
   */
  getRoutes(): RouteList {
    return [...this.routes];
  }

  /**
   * 트랙 개수 가져오기
   */
  getTrackCount(): number {
    return this.routes.filter(route => route instanceof Track).length;
  }

  /**
   * Bus 개수 가져오기
   */
  getBusCount(): number {
    return this.routes.filter(route => route instanceof Bus).length;
  }

  /**
   * Route 개수 가져오기 (Ardour 스타일)
   */
  getRouteCount(): number {
    return this.routes.length;
  }

  /**
   * 이름으로 Route 찾기 (Ardour 스타일)
   */
  getRouteByName(name: string): Route | null {
    return this.routes.find(route => route.getName() === name) || null;
  }

  /**
   * Route 추가 중 여부
   */
  isAddingRoutes(): boolean {
    return this.addingRoutesInProgress;
  }

  /**
   * Route 삭제 중 여부
   */
  isDeletingRoutes(): boolean {
    return this.routeDeletionInProgress;
  }

  /**
   * 재생 시작
   */
  async play(): Promise<void> {
    await this.audioEngine.play();
  }

  /**
   * 재생 정지
   */
  stop(): void {
    this.audioEngine.stop();
  }

  /**
   * 일시정지/재개
   */
  async togglePause(): Promise<void> {
    await this.audioEngine.togglePause();
  }

  /**
   * 재생 중 여부
   */
  isPlaying(): boolean {
    return this.audioEngine.isPlaying();
  }

  /**
   * 현재 재생 위치 가져오기
   */
  getPosition(): number {
    return this.audioEngine.getPosition();
  }

  /**
   * 재생 위치 설정
   */
  setPosition(position: number): void {
    this.audioEngine.setPosition(position);
  }

  /**
   * 오디오 파일 로드
   */
  async loadAudioFile(file: File): Promise<AudioBuffer> {
    return this.audioEngine.loadAudioFile(file);
  }

  /**
   * Dirty 상태 가져오기
   */
  isDirty(): boolean {
    return (this.state & SessionStateFlags.Dirty) !== 0;
  }

  /**
   * Dirty 상태 설정
   */
  private setDirty(dirty: boolean): void {
    const wasDirty = this.isDirty();

    if (dirty) {
      this.state |= SessionStateFlags.Dirty;
    } else {
      this.state &= ~SessionStateFlags.Dirty;
    }

    if (wasDirty !== dirty) {
      this.emitEvent('dirty-changed');
    }
  }

  /**
   * 세션을 깨끗한 상태로 설정 (저장 완료)
   */
  setClean(): void {
    this.setDirty(false);
  }

  /**
   * 쓰기 가능 여부
   */
  isWritable(): boolean {
    return (this.state & SessionStateFlags.Writable) !== 0;
  }

  /**
   * Undo 실행
   */
  undo(): boolean {
    const result = this.undoStack.undo();
    if (result) {
      this.setDirty(true);
    }
    return result;
  }

  /**
   * Redo 실행
   */
  redo(): boolean {
    const result = this.undoStack.redo();
    if (result) {
      this.setDirty(true);
    }
    return result;
  }

  /**
   * Undo 가능 여부
   */
  canUndo(): boolean {
    return this.undoStack.canUndo();
  }

  /**
   * Redo 가능 여부
   */
  canRedo(): boolean {
    return this.undoStack.canRedo();
  }

  /**
   * 명령 실행 (Undo 스택에 추가)
   */
  executeCommand(command: Command): void {
    this.undoStack.execute(command);
    this.setDirty(true);
  }

  /**
   * 세션 데이터 직렬화 (Ardour 스타일)
   */
  serialize(): SessionData {
    // Region 정보를 중앙에서 관리 (여러 Playlist에서 재사용될 수 있음)
    const regionsMap = new Map<string, {
      id: string;
      sourceId: string;
      name: string;
      start: number;
      length: number;
      muted: boolean;
      locked: boolean;
    }>();

    // Track 데이터 변환 (Playlist 기반)
    const tracks = this.getTracks();
    const trackData = tracks.map(track => {
      const playlist = track.getPlaylist();
      const items = playlist.getItems();

      // Region 정보 수집
      items.forEach(item => {
        const region = item.region;
        if (!regionsMap.has(region.getId())) {
          const props = region.getProperties();
          if (region instanceof AudioRegion) {
            regionsMap.set(region.getId(), {
              id: region.getId(),
              sourceId: region.getSourceId(),
              name: props.name,
              start: props.start,
              length: props.length,
              muted: props.muted,
              locked: props.locked,
            });
          }
        }
      });

      return {
        id: `track-${tracks.indexOf(track)}`,
        name: track.getName(),
        volume: track.getVolume(),
        muted: track.isMutedState(),
        solo: track.isSoloState(),
        playlist: {
          name: playlist.getName(),
          items: items.map(item => ({
            regionId: item.region.getId(),
            position: item.position,
            layer: item.layer,
          })),
        },
        // 호환성: 기존 Clip 구조도 포함
        clips: items.map(item => ({
          id: `clip-${items.indexOf(item)}`,
          name: item.region.getName(),
          startTime: item.position,
          duration: item.region.getLength(),
          volume: 100,
          muted: item.region.isMuted(),
        })),
      };
    });

    return {
      metadata: { ...this.metadata },
      project: {
        name: this.metadata.name,
        bpm: this.metadata.bpm,
        sampleRate: this.metadata.sampleRate,
        tracks: trackData,
        regions: Array.from(regionsMap.values()), // Region 정보 추가
      },
      state: this.state,
    };
  }

  /**
   * 세션 데이터 역직렬화
   */
  async deserialize(data: SessionData): Promise<void> {
    // 상태 설정
    this.state = data.state;
    this.metadata = { ...data.metadata };

    // AudioEngine 설정
    this.audioEngine.setBPM(data.metadata.bpm);
    this.audioEngine.setMasterVolume(data.metadata.masterVolume);

    // 기존 Route 제거
    this.routes.forEach(route => {
      if (route instanceof Track) {
        this.audioEngine.removeTrack(route);
      }
    });
    this.routes = [];

    // Region 정보를 먼저 복원 (AudioBuffer는 BufferManager 캐시에서 가져오기)
    const regionsMap = new Map<string, AudioRegion>();
    const context = this.audioEngine.getAudioContext();

    if (data.project.regions) {
      for (const regionData of data.project.regions) {
        // BufferManager 캐시에서 AudioBuffer 가져오기 시도
        const cachedBuffer = BufferManager.getCachedBuffer(regionData.sourceId, context);
        
        if (cachedBuffer) {
          // 캐시에 있으면 Region 생성
          const region = new AudioRegion(
            cachedBuffer,
            regionData.sourceId,
            {
              id: regionData.id,
              name: regionData.name,
              start: regionData.start,
              length: regionData.length,
              muted: regionData.muted,
              locked: regionData.locked,
            }
          );
          regionsMap.set(regionData.id, region);
        } else {
          // 캐시에 없으면 경고 (나중에 파일을 다시 업로드해야 함)
          console.warn(`AudioBuffer not found in cache for sourceId: ${regionData.sourceId}. Region will be skipped.`);
        }
      }
    }

    // 트랙 복원
    for (const trackData of data.project.tracks) {
      const track = this.addTrack(trackData.name);
      track.setVolume(trackData.volume);
      track.setMuted(trackData.muted);
      track.setSolo(trackData.solo);

      // Playlist 복원
      if (trackData.playlist) {
        for (const itemData of trackData.playlist.items) {
          const region = regionsMap.get(itemData.regionId);
          if (region) {
            track.addRegion(region, itemData.position, itemData.layer);
          } else {
            console.warn(`Region not found: ${itemData.regionId}. Skipping playlist item.`);
          }
        }
      }
    }

    this.setClean();
    this.emitEvent('session-loaded');
  }

  /**
   * 세션 저장 (IndexedDB)
   * @param sessionId 세션 ID (없으면 자동 생성)
   * @returns 저장된 세션 ID
   */
  async save(sessionId?: string): Promise<string> {
    const serializer = getSessionSerializer();
    await serializer.init();
    
    const data = this.serialize();
    const audioContext = this.audioEngine.getAudioContext();
    const savedId = await serializer.saveSession(sessionId || this.sessionId, data, audioContext);
    this.sessionId = savedId;
    this.setClean();
    this.emitEvent('session-saved');
    return savedId;
  }

  /**
   * 세션 로드 (IndexedDB)
   * @param sessionId 세션 ID
   */
  async load(sessionId: string): Promise<void> {
    const serializer = getSessionSerializer();
    await serializer.init();
    
    const audioContext = this.audioEngine.getAudioContext();
    const { data, audioBuffers } = await serializer.loadSession(sessionId, audioContext);
    
    // AudioBuffer를 BufferManager 캐시에 미리 로드
    audioBuffers.forEach((buffer, sourceId) => {
      BufferManager.cacheBuffer(sourceId, buffer);
    });
    
    await this.deserialize(data);
    this.sessionId = sessionId;
  }

  /**
   * 세션을 JSON 문자열로 내보내기 (파일 다운로드용)
   * @returns JSON 문자열
   */
  async exportToJSON(): Promise<string> {
    const serializer = getSessionSerializer();
    const data = this.serialize();
    return serializer.exportToJSON(data);
  }

  /**
   * JSON 문자열에서 세션 가져오기 (파일 업로드용)
   * @param json JSON 문자열
   */
  async importFromJSON(json: string): Promise<void> {
    const serializer = getSessionSerializer();
    const data = serializer.importFromJSON(json);
    await this.deserialize(data);
    this.sessionId = null; // 새로 가져온 세션은 ID가 없음
  }

  /**
   * 현재 세션 ID 가져오기
   * @returns 세션 ID (저장되지 않은 경우 null)
   */
  getSessionId(): string | null {
    return this.sessionId;
  }

  /**
   * 세션 ID 설정
   * @param sessionId 세션 ID
   */
  setSessionId(sessionId: string | null): void {
    this.sessionId = sessionId;
  }

  /**
   * 자동 저장 (스냅샷)
   */
  async autoSave(): Promise<void> {
    if (!this.sessionId) {
      // 세션이 저장되지 않았으면 일반 저장
      await this.save();
      return;
    }

    const serializer = getSessionSerializer();
    await serializer.init();
    
    const data = this.serialize();
    await serializer.saveSnapshot(this.sessionId, data, 'Auto-save');
    
    // 오래된 스냅샷 정리 (최근 10개만 유지)
    await serializer.cleanupSnapshots(this.sessionId, 10);
  }

  /**
   * 이벤트 리스너 추가
   */
  addEventListener(
    eventType: SessionEventType,
    listener: SessionEventListener
  ): void {
    const listeners = this.eventListeners.get(eventType);
    if (listeners) {
      listeners.add(listener);
    }
  }

  /**
   * 이벤트 리스너 제거
   */
  removeEventListener(
    eventType: SessionEventType,
    listener: SessionEventListener
  ): void {
    const listeners = this.eventListeners.get(eventType);
    if (listeners) {
      listeners.delete(listener);
    }
  }

  /**
   * 이벤트 발생
   */
  private emitEvent(eventType: SessionEventType): void {
    const listeners = this.eventListeners.get(eventType);
    if (listeners) {
      listeners.forEach(listener => {
        try {
          listener(eventType);
        } catch (error) {
          console.error(`Error in event listener for ${eventType}:`, error);
        }
      });
    }
  }

  /**
   * 리소스 정리
   */
  dispose(): void {
    // 모든 Route 정리
    this.routes.forEach(route => {
      route.dispose();
    });

    this.audioEngine.dispose();
    
    // BufferManager 정리
    BufferManager.dispose();
    
    this.routes = [];
    this.undoStack.clear();
    this.eventListeners.clear();
  }
}
