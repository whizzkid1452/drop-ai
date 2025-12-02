/**
 * BufferManager - 오디오 버퍼 관리 시스템
 * 
 * Ardour의 BufferManager를 참고하여 구현
 * - AudioBuffer 풀링 시스템
 * - 파일별 캐싱 (Source 개념)
 * - 메모리 효율적인 버퍼 관리
 * - 실시간 안전 할당
 */

export interface BufferPoolConfig {
  /** 풀에 유지할 최대 버퍼 수 */
  maxPoolSize?: number;
  /** 기본 버퍼 크기 (샘플 수) */
  defaultBufferSize?: number;
  /** 최대 캐시된 파일 수 */
  maxCachedFiles?: number;
}

type BufferAllocator = (channels: number, length: number) => AudioBuffer | null;

interface CachedBuffer {
  buffer: AudioBuffer;
  sourceId: string;
  lastAccessed: number;
  referenceCount: number;
}

const zeroBuffer = (buffer: AudioBuffer): void => {
  for (let channel = 0; channel < buffer.numberOfChannels; channel += 1) {
    buffer.getChannelData(channel).fill(0);
  }
};

/**
 * ThreadBuffers 개념을 웹 환경에 맞게 구현
 * 각 스레드(또는 작업)마다 사용할 수 있는 버퍼 세트
 */
export class ThreadBuffers {
  private buffers: Map<string, AudioBuffer[]> = new Map();
  private config: Required<BufferPoolConfig>;

  constructor(config: BufferPoolConfig = {}) {
    this.config = {
      maxPoolSize: config.maxPoolSize ?? 10,
      defaultBufferSize: config.defaultBufferSize ?? 4096,
      maxCachedFiles: config.maxCachedFiles ?? 50,
    };
  }

  private getPoolKey(channels: number, length: number): string {
    return `${channels}_${length}`;
  }

  /**
   * 특정 크기의 버퍼를 가져오거나 풀에서 할당
   */
  getBuffer(channels: number, length: number): AudioBuffer | null {
    const key = this.getPoolKey(channels, length);
    const pool = this.buffers.get(key);

    if (pool && pool.length > 0) {
      return pool.pop() ?? null;
    }

    return null;
  }

  /**
   * 버퍼를 풀에 반환
   */
  putBuffer(buffer: AudioBuffer): void {
    const key = this.getPoolKey(buffer.numberOfChannels, buffer.length);
    let pool = this.buffers.get(key);

    if (!pool) {
      pool = [];
      this.buffers.set(key, pool);
    }

    if (pool.length >= this.config.maxPoolSize) {
      return;
    }

    zeroBuffer(buffer);
    pool.push(buffer);
  }

  /**
   * 특정 채널 수와 크기의 버퍼가 충분히 있는지 확인하고 필요시 할당
   */
  ensureBuffers(
    channels: number,
    length: number,
    count: number,
    allocator?: BufferAllocator
  ): void {
    if (count <= 0) {
      return;
    }

    const key = this.getPoolKey(channels, length);
    let pool = this.buffers.get(key);

    if (!pool) {
      pool = [];
      this.buffers.set(key, pool);
    }

    const target = Math.min(count, this.config.maxPoolSize);

    while (pool.length < target) {
      if (!allocator) {
        break;
      }

      const buffer = allocator(channels, length);
      if (!buffer) {
        break;
      }

      zeroBuffer(buffer);
      pool.push(buffer);
    }
  }

  /**
   * 모든 버퍼 정리
   */
  clear(): void {
    this.buffers.clear();
  }
}

/**
 * BufferManager - 싱글톤 버퍼 관리자
 * 
 * Ardour의 BufferManager를 웹 환경에 맞게 구현
 */
export class BufferManager {
  private static instance: BufferManager | null = null;
  private static mutex: boolean = false;

  private threadBuffersPool: ThreadBuffers[] = [];
  private threadBuffersAvailable: ThreadBuffers[] = [];
  private cachedBuffers: Map<string, CachedBuffer> = new Map();
  private config: Required<BufferPoolConfig>;
  private audioContext: AudioContext | null = null;

  private constructor(config: BufferPoolConfig = {}) {
    this.config = {
      maxPoolSize: config.maxPoolSize ?? 10,
      defaultBufferSize: config.defaultBufferSize ?? 4096,
      maxCachedFiles: config.maxCachedFiles ?? 50,
    };
  }

  /**
   * BufferManager 초기화
   * @param size 풀에 생성할 ThreadBuffers 수
   * @param audioContext AudioContext (버퍼 생성에 필요)
   */
  static init(size: number, audioContext: AudioContext, config?: BufferPoolConfig): void {
    if (BufferManager.instance) {
      console.warn('BufferManager already initialized');
      return;
    }

    BufferManager.instance = new BufferManager(config);
    BufferManager.instance.audioContext = audioContext;

    // ThreadBuffers 풀 생성
    for (let i = 0; i < size; i++) {
      const threadBuffers = new ThreadBuffers(config);
      BufferManager.instance.threadBuffersPool.push(threadBuffers);
      BufferManager.instance.threadBuffersAvailable.push(threadBuffers);
    }

    // 기본 버퍼 확보
    BufferManager.ensureBuffers(2, BufferManager.instance.config.defaultBufferSize);
  }

  /**
   * BufferManager 인스턴스 가져오기
   */
  static getInstance(): BufferManager {
    if (!BufferManager.instance) {
      throw new Error('BufferManager not initialized. Call BufferManager.init() first.');
    }
    return BufferManager.instance;
  }

  /**
   * ThreadBuffers 가져오기 (풀에서 할당)
   * Ardour의 get_thread_buffers()와 동일
   */
  static getThreadBuffers(): ThreadBuffers | null {
    const instance = BufferManager.getInstance();

    // Mutex 시뮬레이션 (단일 스레드이지만 순서 보장)
    if (BufferManager.mutex) {
      return null;
    }

    BufferManager.mutex = true;

    if (instance.threadBuffersAvailable.length > 0) {
      const threadBuffers = instance.threadBuffersAvailable.pop()!;
      BufferManager.mutex = false;
      return threadBuffers;
    }

    BufferManager.mutex = false;
    return null;
  }

  /**
   * ThreadBuffers 반환 (풀에 반환)
   * Ardour의 put_thread_buffers()와 동일
   */
  static putThreadBuffers(threadBuffers: ThreadBuffers): void {
    const instance = BufferManager.getInstance();

    BufferManager.mutex = true;
    instance.threadBuffersAvailable.push(threadBuffers);
    BufferManager.mutex = false;
  }

  /**
   * 모든 ThreadBuffers에 대해 버퍼 크기 보장
   * Ardour의 ensure_buffers()와 동일
   * @param channels 필요한 채널 수
   * @param customSize 커스텀 버퍼 크기 (0이면 기본값 사용)
   */
  static ensureBuffers(
    channels: number = 2,
    customSize: number = 0,
    count: number = 1
  ): void {
    const instance = BufferManager.getInstance();
    const size = customSize > 0 ? customSize : instance.config.defaultBufferSize;
    const allocator = instance.createAudioBuffer.bind(instance);

    instance.threadBuffersPool.forEach(threadBuffers => {
      threadBuffers.ensureBuffers(channels, size, count, allocator);
    });
  }

  /**
   * AudioBuffer 생성 (AudioContext 사용)
   */
  private createAudioBuffer(channels: number, length: number): AudioBuffer | null {
    if (!this.audioContext) {
      console.error('AudioContext not set in BufferManager');
      return null;
    }

    try {
      const buffer = this.audioContext.createBuffer(
        channels,
        length,
        this.audioContext.sampleRate
      );
      zeroBuffer(buffer);
      return buffer;
    } catch (error) {
      console.error('Failed to create AudioBuffer:', error);
      return null;
    }
  }

  private trimCache(): void {
    if (this.cachedBuffers.size < this.config.maxCachedFiles) {
      return;
    }

    const candidates = Array.from(this.cachedBuffers.entries())
      .filter(([, entry]) => entry.referenceCount === 0)
      .sort((a, b) => a[1].lastAccessed - b[1].lastAccessed);

    for (const [key] of candidates) {
      this.cachedBuffers.delete(key);
      if (this.cachedBuffers.size < this.config.maxCachedFiles) {
        return;
      }
    }

    if (this.cachedBuffers.size >= this.config.maxCachedFiles) {
      const fallbackKey = this.cachedBuffers.keys().next().value;
      if (fallbackKey) {
        this.cachedBuffers.delete(fallbackKey);
      }
    }
  }

  /**
   * 파일별 캐싱된 AudioBuffer 가져오기
   * @param sourceId 파일 ID (파일명 또는 해시)
   * @param audioContext AudioContext (향후 확장용, 현재는 사용하지 않음)
   */
  static getCachedBuffer(sourceId: string, _audioContext: AudioContext): AudioBuffer | null {
    const instance = BufferManager.getInstance();
    const cached = instance.cachedBuffers.get(sourceId);

    if (cached) {
      cached.lastAccessed = Date.now();
      return cached.buffer;
    }

    return null;
  }

  /**
   * 파일별 AudioBuffer 캐싱
   * @param sourceId 파일 ID
   * @param buffer AudioBuffer
   */
  static cacheBuffer(sourceId: string, buffer: AudioBuffer): void {
    const instance = BufferManager.getInstance();

    if (!buffer) {
      return;
    }

    const cached = instance.cachedBuffers.get(sourceId);
    if (cached) {
      cached.buffer = buffer;
      cached.referenceCount += 1;
      cached.lastAccessed = Date.now();
      return;
    }

    instance.trimCache();

    instance.cachedBuffers.set(sourceId, {
      buffer,
      sourceId,
      lastAccessed: Date.now(),
      referenceCount: 1,
    });
  }

  /**
   * 캐시된 버퍼의 참조 카운트 감소
   * @param sourceId 파일 ID
   */
  static releaseCachedBuffer(sourceId: string): void {
    const instance = BufferManager.getInstance();
    const cached = instance.cachedBuffers.get(sourceId);

    if (!cached) {
      return;
    }

    cached.referenceCount = Math.max(0, cached.referenceCount - 1);

    if (cached.referenceCount === 0) {
      instance.trimCache();
    }
  }

  /**
   * 캐시된 버퍼 제거
   * @param sourceId 파일 ID
   */
  static removeCachedBuffer(sourceId: string): void {
    const instance = BufferManager.getInstance();
    instance.cachedBuffers.delete(sourceId);
  }

  /**
   * 모든 캐시 정리
   */
  static clearCache(): void {
    const instance = BufferManager.getInstance();
    instance.cachedBuffers.clear();
  }

  /**
   * AudioBuffer 풀에서 버퍼 가져오기 또는 생성
   * @param channels 채널 수
   * @param length 샘플 수
   */
  static getPooledBuffer(channels: number, length: number): AudioBuffer | null {
    const instance = BufferManager.getInstance();
    const threadBuffers = BufferManager.getThreadBuffers();

    if (threadBuffers) {
      const buffer = threadBuffers.getBuffer(channels, length);
      BufferManager.putThreadBuffers(threadBuffers);

      if (buffer) {
        return buffer;
      }
    }

    return instance.createAudioBuffer(channels, length);
  }

  /**
   * AudioBuffer를 풀에 반환
   * @param buffer 반환할 AudioBuffer
   */
  static putPooledBuffer(buffer: AudioBuffer): void {
    const threadBuffers = BufferManager.getThreadBuffers();

    if (threadBuffers) {
      threadBuffers.putBuffer(buffer);
      BufferManager.putThreadBuffers(threadBuffers);
    }
  }

  /**
   * AudioContext 설정
   */
  static setAudioContext(audioContext: AudioContext): void {
    const instance = BufferManager.getInstance();
    instance.audioContext = audioContext;
  }

  /**
   * 현재 캐시 상태 가져오기
   */
  static getCacheStats(): {
    cachedCount: number;
    totalReferences: number;
    maxCacheSize: number;
  } {
    const instance = BufferManager.getInstance();
    let totalReferences = 0;

    instance.cachedBuffers.forEach(cached => {
      totalReferences += cached.referenceCount;
    });

    return {
      cachedCount: instance.cachedBuffers.size,
      totalReferences,
      maxCacheSize: instance.config.maxCachedFiles,
    };
  }

  /**
   * 리소스 정리
   */
  static dispose(): void {
    if (!BufferManager.instance) {
      return;
    }

    const instance = BufferManager.instance;
    instance.threadBuffersPool.forEach(tb => tb.clear());
    instance.threadBuffersPool = [];
    instance.threadBuffersAvailable = [];
    instance.cachedBuffers.clear();
    instance.audioContext = null;
    BufferManager.instance = null;
    BufferManager.mutex = false;
  }
}

