import { createStore } from 'zustand/vanilla';
import type { AudioSnapshot } from '@/types/audioTypes';
import { Session } from '../session/Session';
import type { TrackData } from '../track/Track';
import { Track } from '../track/Track';
import { Region } from '../region/Region';
import { AudioExporter } from '../export/AudioExporter';
import type { ExportOptions } from '../export/ExportOptions';
import { AutomationEngine } from '../automation/AutomationEngine';
import type { IAudioEngine, RegionData } from '../audio/engine/IAudioEngine';
import { ToneAudioEngine } from '../audio/engine/ToneAudioEngine';

/**
 * AudioService (Pure Facade Pattern)
 * 
 * UI와 오디오 엔진 사이의 완전한 분리 레이어.
 * 모든 오디오 관련 기능의 단일 진입점을 제공합니다.
 * 
 * 설계 원칙:
 * - UI는 AudioService만 알고, 엔진 구현(Tone.js 등)을 모릅니다
 * - AudioService는 IAudioEngine 인터페이스에만 의존합니다
 * - 엔진 교체 시 UI와 AudioService 수정 불필요 (DI 가능)
 * 
 * 핵심 책임:
 * 1. 도메인 검증 (Session/Track/Region 모델)
 * 2. 엔진 오케스트레이션 (IAudioEngine 호출)
 * 3. UI 상태 동기화 (Zustand Store)
 */
export class AudioService {
    private static instance: AudioService;

    // ✅ Zustand Vanilla Store for Logic-State Binding
    public readonly store = createStore<AudioSnapshot>(() => ({
        isPlaying: false,
        currentTime: 0,
        tempo: 120,
        exportStartTime: null,
        exportEndTime: null,
        tracks: [],
        pixelsPerSecond: 20 // UI zoom level
    }));

    // 엔진 의존성 (인터페이스만 참조)
    private engine: IAudioEngine;

    // Export 기능은 AudioExporter에 위임
    private exporter: AudioExporter;

    // Automation Engine
    private automationEngine: AutomationEngine;

    private constructor(private session: Session) {
        // Initialize Audio Engine
        this.engine = new ToneAudioEngine();
        this.exporter = new AudioExporter();

        // Initialize Automation Engine
        this.automationEngine = new AutomationEngine(
            this.session,
            (trackId: string) => (this.engine as ToneAudioEngine).getPort(trackId)
        );
    }



    static initialize(session: Session): AudioService {
        if (!AudioService.instance) {
            AudioService.instance = new AudioService(session);
        }
        return AudioService.instance;
    }

    static getInstance(): AudioService {
        if (!AudioService.instance) {
            throw new Error('AudioService not initialized');
        }
        return AudioService.instance;
    }

    /**
     * Sync Domain State (Session/Tracks) to Zustand Store
     */
    private syncStore(partialState?: Partial<AudioSnapshot>) {
        if (partialState) {
            this.store.setState(partialState);
        } else {
            // Full sync of tracks
            this.store.setState({
                isPlaying: this.engine.getTransportState() === 'started',
                currentTime: this.engine.getCurrentTime(),
                tracks: this.session.tracks.map((t: Track) => t.toSnapshot())
            });
        }
    }

    // --- State Properties (Directly mapped to Store) ---
    get exportStartTime() { return this.store.getState().exportStartTime; }
    get exportEndTime() { return this.store.getState().exportEndTime; }
    get tempo() { return this.store.getState().tempo; }

    // --- State Setters ---

    setExportRange(startTime: number | null, endTime: number | null) {
        this.store.setState({ exportStartTime: startTime, exportEndTime: endTime });
    }

    setTempo(tempo: number) {
        this.engine.setTempo(tempo);
        this.store.setState({ tempo });
    }

    setPixelsPerSecond(pixelsPerSecond: number): void {
        this.store.setState({ pixelsPerSecond });
    }

    // --- Transport Control ---

    async play(): Promise<void> {
        await this.engine.play();
        this.store.setState({ isPlaying: true });
    }

    pause(): void {
        this.engine.pause();
        this.store.setState({ isPlaying: false });
    }

    stop(): void {
        this.engine.stop();
        this.store.setState({ isPlaying: false, currentTime: 0 });
    }

    setTime(time: number): void {
        this.engine.setTime(time);
        this.store.setState({ currentTime: time });
    }

    getCurrentTime(): number {
        return this.engine.getCurrentTime();
    }

    // --- Live Performance ---

    playNote(note: string | number, velocity: number = 1): void {
        this.engine.playNote(note, velocity);
    }

    stopNote(note: string | number): void {
        this.engine.stopNote(note);
    }

    // --- Track Management ---

    removeTrack(trackId: string): void {
        // 1. Update Domain
        this.session.removeTrack(trackId);

        // 2. Update Engine
        this.engine.removeTrack(trackId);

        // 3. Notify UI
        this.syncStore();
    }

    setTrackVolume(trackId: string, volume: number): void {
        // 1. Update Domain
        const track = this.session.getTrack(trackId);
        if (track) {
            track.volume = volume;
        }

        // 2. Update Engine
        this.engine.setTrackVolume(trackId, volume);

        // 3. Notify UI (Partial Update)
        this.updateTrackState(trackId, { volume });
    }

    setTrackPan(trackId: string, pan: number): void {
        // 1. Update Domain
        const track = this.session.getTrack(trackId);
        if (track) {
            track.pan = pan;
        }

        // 2. Update Engine
        this.engine.setTrackPan(trackId, pan);

        // 3. Notify UI (Partial Update)
        this.updateTrackState(trackId, { pan });
    }

    /**
     * Helper: Update specific track state without re-creating regions
     */
    private updateTrackState(trackId: string, updates: Partial<TrackData>) {
        this.store.setState(state => ({
            tracks: state.tracks.map(t => {
                if (t.id !== trackId) return t;
                return { ...t, ...updates };
            })
        }));
    }

    getTrackParams(trackId: string): { volume: number; pan: number } | null {
        return this.engine.getTrackParams(trackId);
    }

    // --- Region Management ---

    async addRegion(
        trackId: string,
        regionData: RegionData
    ): Promise<void> {
        console.log('[AudioService] addRegion called', { trackId, regionData });

        // 1. Ensure Track exists in Domain
        let track = this.session.getTrack(trackId);
        if (!track) {
            track = new Track({ id: trackId, status: [] });
            this.session.addTrack(track);
            console.log('[AudioService] Created new track', trackId);
        }

        // 2. Delegate to Engine (Engine will load player and return duration)
        await this.engine.addRegion(trackId, regionData);

        // 3. Create Domain Region 
        // Note: For now we assume duration is provided. Later ToneAudioEngine could expose duration callback.
        const region = new Region({
            id: regionData.id,
            startTime: regionData.startTime,
            sourceStartTime: regionData.sourceStartTime,
            duration: regionData.duration ?? 0, // TODO: Get actual duration from engine
            audioFile: regionData.audioFile,
            status: []
        });

        try {
            track.addRegion(region);
        } catch (e) {
            console.error('[AudioService] Failed to add region to track', e);
            // Clean up engine resources
            this.engine.removeRegion(trackId, regionData.id);
            throw e;
        }

        console.log('[AudioService] Region added to track', { trackId, regionId: regionData.id });

        // 4. Notify UI
        console.log('[AudioService] Calling syncStore after region load');
        this.syncStore();
    }

    removeRegion(trackId: string, regionId: string): void {
        // 1. Update Domain
        const track = this.session.getTrack(trackId);
        if (track) {
            track.removeRegion(regionId);
        }

        // 2. Update Engine
        this.engine.removeRegion(trackId, regionId);

        // 3. Notify UI
        this.syncStore();
    }

    async splitRegion(trackId: string, splitTime: number): Promise<void> {
        const track = this.session.getTrack(trackId);
        if (!track) return;

        // Domain Logic: Delegated to Track
        // Find region at splitTime (we need the ID first... wait, AudioService usually receives ID or Time?)
        // The signature is splitRegion(trackId, splitTime). 
        // We need to find the region ID first to call track.splitRegion(id, time).

        // Find region at splitTime (UI/Service responsibility to identify target?)
        // Ideally UI passes RegionId, but here we only have Time.
        // Let's keep the find logic here or move "findAt" to Track?
        // "Track.getRegionAt(time)" would be useful.

        // For now, let's keep the finding logic but use track.splitRegion for the operation.
        const region = track.regions.find((r: Region) =>
            splitTime > r.startTime && splitTime < r.endTime
        );

        if (!region) {
            console.warn(`[AudioService] No region found at ${splitTime} on track ${trackId}`);
            return;
        }

        const splitResult = track.splitRegion(region.id, splitTime);
        if (!splitResult) return;

        const { left, right } = splitResult;

        // Update Engine
        // Unload old
        this.removeRegion(trackId, region.id);

        // Load new
        // Note: We assume audioFile exists and has url.
        if (region.audioFile) {
            await this.addRegion(trackId, {
                id: left.id,
                url: region.audioFile.url,
                startTime: left.startTime,
                sourceStartTime: left.sourceStartTime,
                duration: left.duration,
                audioFile: left.audioFile
            });
            await this.addRegion(trackId, {
                id: right.id,
                url: region.audioFile.url,
                startTime: right.startTime,
                sourceStartTime: right.sourceStartTime,
                duration: right.duration,
                audioFile: right.audioFile
            });
        }

        this.syncStore();
    }

    // --- Export ---

    /**
     * 프로젝트 전체를 오디오 파일로 내보냅니다.
     * Export 로직은 AudioExporter에 위임합니다.
     * 
     * @param options - Export 옵션 (트랙 목록, 범위 등)
     * @returns WAV 형식의 Blob
     */
    async exportProject(options?: ExportOptions): Promise<Blob> {
        const snapshot = this.store.getState();
        const tracksToExport = options?.tracks ?? snapshot.tracks;

        // Resolve range: option -> store -> full
        let exportRange = options?.range;
        if (!exportRange && snapshot.exportStartTime !== null && snapshot.exportEndTime !== null) {
            exportRange = {
                startTime: snapshot.exportStartTime,
                endTime: snapshot.exportEndTime
            };
        }

        // AudioExporter에 위임
        return this.exporter.exportProject(tracksToExport, exportRange);
    }

    dispose() {
        this.engine.dispose();
        this.automationEngine.dispose();
    }
}
