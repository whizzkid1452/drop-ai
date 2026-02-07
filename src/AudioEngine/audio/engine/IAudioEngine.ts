/**
 * IAudioEngine
 * 
 * 오디오 엔진의 인터페이스 정의.
 * FACADE는 이 인터페이스에만 의존하며, 구체적인 구현(Tone.js 등)은 알지 못합니다.
 * 
 * 이를 통해:
 * - 엔진 교체 가능 (Tone.js → 다른 라이브러리)
 * - 테스트 용이 (Mock Engine 주입)
 * - 관심사 분리 (Facade vs Engine)
 */

export interface RegionData {
    id: string;
    url: string;
    startTime: number;
    sourceStartTime: number;
    duration?: number;
    audioFile?: { url: string; duration?: number };
}

export interface IAudioEngine {
    // --- Transport 제어 ---
    play(): Promise<void>;
    pause(): void;
    stop(): void;
    setTime(seconds: number): void;
    getCurrentTime(): number;
    setTempo(bpm: number): void;
    getTransportState(): 'started' | 'paused' | 'stopped';

    // --- Track 관리 ---
    removeTrack(trackId: string): void;
    setTrackVolume(trackId: string, volume: number): void;
    setTrackPan(trackId: string, pan: number): void;
    getTrackParams(trackId: string): { volume: number; pan: number } | null;

    // --- Region 관리 ---
    addRegion(trackId: string, regionData: RegionData): Promise<void>;
    removeRegion(trackId: string, regionId: string): void;

    // --- Live Performance ---
    playNote(note: string | number, velocity: number): void;
    stopNote(note: string | number): void;

    // --- 리소스 정리 ---
    dispose(): void;
}
