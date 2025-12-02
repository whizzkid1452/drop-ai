/**
 * SessionSerializer - 세션 직렬화/역직렬화 유틸리티
 * Ardour의 session.cc save_state/load_state를 참고하여 구현
 * 
 * 주요 기능:
 * - IndexedDB를 통한 세션 저장/로드
 * - 자동 저장 (Auto-save)
 * - 세션 버전 관리
 * - 세션 검증
 */

import type { SessionData, SessionSnapshot } from '../models/SessionData';
import { BufferManager } from '../audio/BufferManager';

/**
 * IndexedDB 데이터베이스 이름 및 버전
 */
const DB_NAME = 'daw_sessions';
const DB_VERSION = 2; // 버전 증가 (AudioBuffer 저장소 추가)
const STORE_SESSIONS = 'sessions';
const STORE_SNAPSHOTS = 'snapshots';
const STORE_AUDIO_BUFFERS = 'audioBuffers'; // AudioBuffer 저장소

/**
 * IndexedDB 데이터베이스 초기화
 */
async function initDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      reject(new Error(`IndexedDB 오픈 실패: ${request.error}`));
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      // 세션 저장소 생성
      if (!db.objectStoreNames.contains(STORE_SESSIONS)) {
        const sessionStore = db.createObjectStore(STORE_SESSIONS, {
          keyPath: 'id',
        });
        sessionStore.createIndex('name', 'name', { unique: false });
        sessionStore.createIndex('modifiedAt', 'modifiedAt', { unique: false });
      }

      // 스냅샷 저장소 생성
      if (!db.objectStoreNames.contains(STORE_SNAPSHOTS)) {
        const snapshotStore = db.createObjectStore(STORE_SNAPSHOTS, {
          keyPath: 'id',
        });
        snapshotStore.createIndex('sessionId', 'sessionId', { unique: false });
        snapshotStore.createIndex('timestamp', 'timestamp', { unique: false });
      }

      // AudioBuffer 저장소 생성
      if (!db.objectStoreNames.contains(STORE_AUDIO_BUFFERS)) {
        const bufferStore = db.createObjectStore(STORE_AUDIO_BUFFERS, {
          keyPath: 'sourceId',
        });
        bufferStore.createIndex('sessionId', 'sessionId', { unique: false });
      }
    };
  });
}

/**
 * 세션 저장 인터페이스
 */
export interface SavedSession {
  id: string;
  name: string;
  data: SessionData;
  createdAt: string;
  modifiedAt: string;
  version: string;
}

/**
 * 저장된 스냅샷 인터페이스
 */
export interface SavedSnapshot {
  id: string;
  sessionId: string;
  name: string;
  timestamp: string;
  data: SessionData;
}

/**
 * SessionSerializer 클래스
 */
export class SessionSerializer {
  private db: IDBDatabase | null = null;

  /**
   * 초기화
   */
  async init(): Promise<void> {
    this.db = await initDB();
  }

  /**
   * AudioBuffer를 ArrayBuffer로 변환
   */
  private async audioBufferToArrayBuffer(buffer: AudioBuffer): Promise<ArrayBuffer> {
    const numberOfChannels = buffer.numberOfChannels;
    const length = buffer.length;
    
    // 각 채널의 데이터를 합침 (인터리브드 형식)
    const arrayBuffer = new ArrayBuffer(length * numberOfChannels * 4); // Float32 = 4 bytes
    const view = new DataView(arrayBuffer);
    
    let offset = 0;
    for (let i = 0; i < length; i++) {
      for (let channel = 0; channel < numberOfChannels; channel++) {
        const sample = buffer.getChannelData(channel)[i];
        view.setFloat32(offset, sample, true); // little-endian
        offset += 4;
      }
    }
    
    return arrayBuffer;
  }

  /**
   * ArrayBuffer를 AudioBuffer로 변환
   */
  private async arrayBufferToAudioBuffer(
    arrayBuffer: ArrayBuffer,
    numberOfChannels: number,
    length: number,
    sampleRate: number,
    audioContext: AudioContext
  ): Promise<AudioBuffer> {
    const buffer = audioContext.createBuffer(numberOfChannels, length, sampleRate);
    const view = new DataView(arrayBuffer);
    
    let offset = 0;
    for (let i = 0; i < length; i++) {
      for (let channel = 0; channel < numberOfChannels; channel++) {
        const sample = view.getFloat32(offset, true); // little-endian
        buffer.getChannelData(channel)[i] = sample;
        offset += 4;
      }
    }
    
    return buffer;
  }

  /**
   * 세션 저장
   * @param sessionId 세션 ID (없으면 자동 생성)
   * @param sessionData 세션 데이터
   * @param audioContext AudioContext (AudioBuffer 변환용, 선택적)
   * @returns 저장된 세션 ID
   */
  async saveSession(
    sessionId: string | null,
    sessionData: SessionData,
    audioContext?: AudioContext
  ): Promise<string> {
    if (!this.db) {
      await this.init();
    }

    const id = sessionId || `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date().toISOString();

    const savedSession: SavedSession = {
      id,
      name: sessionData.metadata.name,
      data: sessionData,
      createdAt: sessionData.metadata.createdAt || now,
      modifiedAt: now,
      version: sessionData.metadata.version || '1.0.0',
    };

    // 메타데이터 업데이트
    savedSession.data.metadata.modifiedAt = now;

    // AudioBuffer 저장 (sourceId별로)
    if (audioContext && sessionData.project.regions) {
      const bufferPromises: Promise<void>[] = [];
      
      for (const regionData of sessionData.project.regions) {
        // BufferManager 캐시에서 AudioBuffer 가져오기
        const cachedBuffer = BufferManager.getCachedBuffer(regionData.sourceId, audioContext);
        
        if (cachedBuffer) {
          const promise = this.audioBufferToArrayBuffer(cachedBuffer).then(arrayBuffer => {
            return new Promise<void>((resolve, reject) => {
              const transaction = this.db!.transaction([STORE_AUDIO_BUFFERS], 'readwrite');
              const store = transaction.objectStore(STORE_AUDIO_BUFFERS);
              
              const bufferData = {
                sourceId: regionData.sourceId,
                sessionId: id,
                arrayBuffer: arrayBuffer,
                numberOfChannels: cachedBuffer.numberOfChannels,
                length: cachedBuffer.length,
                sampleRate: cachedBuffer.sampleRate,
              };
              
              const request = store.put(bufferData);
              request.onsuccess = () => resolve();
              request.onerror = () => reject(new Error(`AudioBuffer 저장 실패: ${request.error}`));
            });
          });
          
          bufferPromises.push(promise);
        }
      }
      
      // 모든 AudioBuffer 저장 완료 대기
      await Promise.all(bufferPromises);
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_SESSIONS], 'readwrite');
      const store = transaction.objectStore(STORE_SESSIONS);
      const request = store.put(savedSession);

      request.onsuccess = () => {
        resolve(id);
      };

      request.onerror = () => {
        reject(new Error(`세션 저장 실패: ${request.error}`));
      };
    });
  }

  /**
   * 세션 로드
   * @param sessionId 세션 ID
   * @param audioContext AudioContext (AudioBuffer 복원용)
   * @returns 세션 데이터 및 AudioBuffer 맵
   */
  async loadSession(
    sessionId: string,
    audioContext?: AudioContext
  ): Promise<{ data: SessionData; audioBuffers: Map<string, AudioBuffer> }> {
    if (!this.db) {
      await this.init();
    }

    // 세션 데이터 로드
    const sessionData = await new Promise<SessionData>((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_SESSIONS], 'readonly');
      const store = transaction.objectStore(STORE_SESSIONS);
      const request = store.get(sessionId);

      request.onsuccess = () => {
        const result = request.result as SavedSession | undefined;
        if (!result) {
          reject(new Error(`세션을 찾을 수 없습니다: ${sessionId}`));
          return;
        }
        resolve(result.data);
      };

      request.onerror = () => {
        reject(new Error(`세션 로드 실패: ${request.error}`));
      };
    });

    // AudioBuffer 복원
    const audioBuffers = new Map<string, AudioBuffer>();
    
    if (audioContext && sessionData.project.regions) {
      const bufferPromises: Promise<void>[] = [];
      
      for (const regionData of sessionData.project.regions) {
        const promise = new Promise<void>((resolve) => {
          const transaction = this.db!.transaction([STORE_AUDIO_BUFFERS], 'readonly');
          const store = transaction.objectStore(STORE_AUDIO_BUFFERS);
          const request = store.get(regionData.sourceId);

          request.onsuccess = async () => {
            const bufferData = request.result as {
              sourceId: string;
              arrayBuffer: ArrayBuffer;
              numberOfChannels: number;
              length: number;
              sampleRate: number;
            } | undefined;

            if (bufferData) {
              try {
                const audioBuffer = await this.arrayBufferToAudioBuffer(
                  bufferData.arrayBuffer,
                  bufferData.numberOfChannels,
                  bufferData.length,
                  bufferData.sampleRate,
                  audioContext
                );
                audioBuffers.set(regionData.sourceId, audioBuffer);
                
                // BufferManager 캐시에도 저장
                BufferManager.cacheBuffer(regionData.sourceId, audioBuffer);
              } catch (error) {
                console.error(`AudioBuffer 복원 실패 (${regionData.sourceId}):`, error);
              }
            }
            resolve();
          };

          request.onerror = () => {
            console.warn(`AudioBuffer 로드 실패 (${regionData.sourceId}):`, request.error);
            resolve(); // 실패해도 계속 진행
          };
        });

        bufferPromises.push(promise);
      }

      await Promise.all(bufferPromises);
    }

    return { data: sessionData, audioBuffers };
  }

  /**
   * 모든 세션 목록 가져오기
   * @returns 세션 목록
   */
  async listSessions(): Promise<Array<{ id: string; name: string; modifiedAt: string }>> {
    if (!this.db) {
      await this.init();
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_SESSIONS], 'readonly');
      const store = transaction.objectStore(STORE_SESSIONS);
      const index = store.index('modifiedAt');
      const request = index.getAll();

      request.onsuccess = () => {
        const sessions = (request.result as SavedSession[]).map(session => ({
          id: session.id,
          name: session.name,
          modifiedAt: session.modifiedAt,
        }));
        // 최신순 정렬
        sessions.sort((a, b) => new Date(b.modifiedAt).getTime() - new Date(a.modifiedAt).getTime());
        resolve(sessions);
      };

      request.onerror = () => {
        reject(new Error(`세션 목록 가져오기 실패: ${request.error}`));
      };
    });
  }

  /**
   * 세션 삭제
   * @param sessionId 세션 ID
   */
  async deleteSession(sessionId: string): Promise<void> {
    if (!this.db) {
      await this.init();
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_SESSIONS], 'readwrite');
      const store = transaction.objectStore(STORE_SESSIONS);
      const request = store.delete(sessionId);

      request.onsuccess = () => {
        resolve();
      };

      request.onerror = () => {
        reject(new Error(`세션 삭제 실패: ${request.error}`));
      };
    });
  }

  /**
   * 스냅샷 저장 (자동 저장용)
   * @param sessionId 세션 ID
   * @param sessionData 세션 데이터
   * @param snapshotName 스냅샷 이름 (기본값: "Auto-save")
   */
  async saveSnapshot(
    sessionId: string,
    sessionData: SessionData,
    snapshotName: string = 'Auto-save'
  ): Promise<string> {
    if (!this.db) {
      await this.init();
    }

    const id = `snapshot_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const timestamp = new Date().toISOString();

    const snapshot: SavedSnapshot = {
      id,
      sessionId,
      name: snapshotName,
      timestamp,
      data: sessionData,
    };

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_SNAPSHOTS], 'readwrite');
      const store = transaction.objectStore(STORE_SNAPSHOTS);
      const request = store.put(snapshot);

      request.onsuccess = () => {
        resolve(id);
      };

      request.onerror = () => {
        reject(new Error(`스냅샷 저장 실패: ${request.error}`));
      };
    });
  }

  /**
   * 세션의 최신 스냅샷 가져오기
   * @param sessionId 세션 ID
   * @returns 스냅샷 데이터
   */
  async getLatestSnapshot(sessionId: string): Promise<SessionSnapshot | null> {
    if (!this.db) {
      await this.init();
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_SNAPSHOTS], 'readonly');
      const store = transaction.objectStore(STORE_SNAPSHOTS);
      const index = store.index('sessionId');
      const request = index.getAll(sessionId);

      request.onsuccess = () => {
        const snapshots = request.result as SavedSnapshot[];
        if (snapshots.length === 0) {
          resolve(null);
          return;
        }

        // 최신순 정렬
        snapshots.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        const latest = snapshots[0];

        resolve({
          name: latest.name,
          timestamp: latest.timestamp,
          data: latest.data,
        });
      };

      request.onerror = () => {
        reject(new Error(`스냅샷 가져오기 실패: ${request.error}`));
      };
    });
  }

  /**
   * 세션의 모든 스냅샷 가져오기
   * @param sessionId 세션 ID
   * @returns 스냅샷 목록
   */
  async listSnapshots(sessionId: string): Promise<SessionSnapshot[]> {
    if (!this.db) {
      await this.init();
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_SNAPSHOTS], 'readonly');
      const store = transaction.objectStore(STORE_SNAPSHOTS);
      const index = store.index('sessionId');
      const request = index.getAll(sessionId);

      request.onsuccess = () => {
        const snapshots = (request.result as SavedSnapshot[]).map(snapshot => ({
          name: snapshot.name,
          timestamp: snapshot.timestamp,
          data: snapshot.data,
        }));
        // 최신순 정렬
        snapshots.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        resolve(snapshots);
      };

      request.onerror = () => {
        reject(new Error(`스냅샷 목록 가져오기 실패: ${request.error}`));
      };
    });
  }

  /**
   * 오래된 스냅샷 정리 (최근 N개만 유지)
   * @param sessionId 세션 ID
   * @param keepCount 유지할 스냅샷 수 (기본값: 10)
   */
  async cleanupSnapshots(sessionId: string, keepCount: number = 10): Promise<void> {
    if (!this.db) {
      await this.init();
    }

    const snapshots = await this.listSnapshots(sessionId);
    if (snapshots.length <= keepCount) {
      return;
    }

    if (!this.db) {
      throw new Error('Database not initialized');
    }

    const transaction = this.db.transaction([STORE_SNAPSHOTS], 'readwrite');
    const store = transaction.objectStore(STORE_SNAPSHOTS);

    // 삭제할 스냅샷 ID 찾기
    const index = store.index('sessionId');
    const request = index.getAll(sessionId);

    return new Promise((resolve, reject) => {
      request.onsuccess = () => {
        const allSnapshots = request.result as SavedSnapshot[];
        const sorted = allSnapshots.sort(
          (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        );
        const toDeleteIds = sorted.slice(keepCount).map(s => s.id);

        let deleted = 0;
        if (toDeleteIds.length === 0) {
          resolve();
          return;
        }

        toDeleteIds.forEach(id => {
          const deleteRequest = store.delete(id);
          deleteRequest.onsuccess = () => {
            deleted++;
            if (deleted === toDeleteIds.length) {
              resolve();
            }
          };
          deleteRequest.onerror = () => {
            reject(new Error(`스냅샷 삭제 실패: ${deleteRequest.error}`));
          };
        });
      };

      request.onerror = () => {
        reject(new Error(`스냅샷 정리 실패: ${request.error}`));
      };
    });
  }

  /**
   * JSON 문자열로 세션 내보내기 (파일 다운로드용)
   * @param sessionData 세션 데이터
   * @returns JSON 문자열
   */
  exportToJSON(sessionData: SessionData): string {
    return JSON.stringify(sessionData, null, 2);
  }

  /**
   * JSON 문자열에서 세션 가져오기 (파일 업로드용)
   * @param json JSON 문자열
   * @returns 세션 데이터
   */
  importFromJSON(json: string): SessionData {
    try {
      const data = JSON.parse(json) as SessionData;
      // 기본 검증
      if (!data.metadata || !data.project) {
        throw new Error('잘못된 세션 파일 형식입니다.');
      }
      return data;
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`JSON 파싱 실패: ${error.message}`);
      }
      throw new Error('JSON 파싱 실패: 알 수 없는 오류');
    }
  }

  /**
   * 세션 데이터 검증
   * @param sessionData 세션 데이터
   * @returns 검증 결과
   */
  validateSession(sessionData: SessionData): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!sessionData.metadata) {
      errors.push('메타데이터가 없습니다.');
    } else {
      if (!sessionData.metadata.name) {
        errors.push('세션 이름이 없습니다.');
      }
      if (!sessionData.metadata.sampleRate || sessionData.metadata.sampleRate <= 0) {
        errors.push('유효하지 않은 샘플레이트입니다.');
      }
      if (!sessionData.metadata.bpm || sessionData.metadata.bpm <= 0) {
        errors.push('유효하지 않은 BPM입니다.');
      }
    }

    if (!sessionData.project) {
      errors.push('프로젝트 데이터가 없습니다.');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}

/**
 * 싱글톤 인스턴스
 */
let serializerInstance: SessionSerializer | null = null;

/**
 * SessionSerializer 인스턴스 가져오기
 */
export function getSessionSerializer(): SessionSerializer {
  if (!serializerInstance) {
    serializerInstance = new SessionSerializer();
  }
  return serializerInstance;
}

