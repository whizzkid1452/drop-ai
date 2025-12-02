/**
 * SessionData - 세션 직렬화용 데이터 모델
 * Ardour의 Session 저장 형식을 참고하여 JSON 기반 구조 정의
 */

import type { ProjectData } from '../../types/audio';

/**
 * 세션 메타데이터
 */
export interface SessionMetadata {
  /** 세션 이름 */
  name: string;
  /** 생성일시 (ISO 8601) */
  createdAt: string;
  /** 수정일시 (ISO 8601) */
  modifiedAt: string;
  /** 버전 정보 */
  version: string;
  /** 샘플레이트 */
  sampleRate: number;
  /** 기본 BPM */
  bpm: number;
  /** 마스터 볼륨 (0-100) */
  masterVolume: number;
}

/**
 * 세션 상태 플래그
 */
export enum SessionStateFlags {
  /** 세션 변경됨 (저장 필요) */
  Dirty = 1 << 0,
  /** 쓰기 가능 여부 */
  Writable = 1 << 1,
  /** 로딩 중 */
  Loading = 1 << 2,
  /** 삭제 진행 중 */
  DeletionInProgress = 1 << 3,
  /** 저장 불가능 */
  CannotSave = 1 << 4,
}

/**
 * 세션 전체 데이터 구조
 */
export interface SessionData {
  /** 메타데이터 */
  metadata: SessionMetadata;
  /** 프로젝트 데이터 */
  project: ProjectData;
  /** 세션 상태 플래그 */
  state: number;
}

/**
 * 세션 스냅샷 (자동 저장용)
 */
export interface SessionSnapshot {
  /** 스냅샷 이름 */
  name: string;
  /** 생성일시 */
  timestamp: string;
  /** 세션 데이터 */
  data: SessionData;
}
