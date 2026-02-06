import { AudioPort } from './io/AudioPort';
import * as Tone from 'tone';
import { createStore } from 'zustand/vanilla';
import type { AudioSnapshot } from '@/types/audioTypes';
import { Session } from '../session/Session';
import { Track, type TrackData } from '../track/Track';
import { Region } from '../region/Region';
import {
    PLAYER_CONFIG,
    configurePlayerLoop,
    startPlayer
} from '../../logics/audio/playerConfig';
import { LiveAudioEngine } from './live/LiveAudioEngine';
import { AudioExporter } from './export/AudioExporter';
import type { ExportOptions } from './export/ExportOptions';

/**
 * AudioService (Facade Pattern)
 * 
 * 프론트엔드와 오디오 엔진 사이의 레이어.
 * 모든 오디오 관련 기능의 단일 진입점을 제공합니다.
 * 
 * 설계 목적:
 * - 프론트엔드는 AudioService만 알면 되고, 내부 구현(Tone.js, AudioExporter 등)을 몰라도 됨
 * - 오디오 엔진 교체 시 프론트엔드 수정 불필요
 * - 레이어 분리 원칙 준수
 * 
 * 책임:
 * 1. 실시간 오디오 재생 관리 (핵심)
 *    - Transport 제어 (play/pause/stop)
 *    - 오디오 그래프 관리 (Channel/Player)
 * 2. 트랙/리전 관리 (핵심)
 *    - 도메인 모델(Session/Track/Region)과 Tone.js 엔진 동기화
 *    - 상태 동기화 (도메인 → Store)
 * 3. Export (위임)
 *    - 오디오 관련 기능이므로 Facade를 통해 접근
 *    - 내부 구현은 AudioExporter에 위임
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
        tracks: []
    }));

    // Tone.js Objects
    // Key: TrackId
    private ports: Map<string, AudioPort> = new Map();
    // Key: TrackId -> RegionId -> Tone.Player
    private players: Map<string, Map<string, Tone.Player>> = new Map();

    // Export 기능은 AudioExporter에 위임
    private exporter: AudioExporter;

    // Live Playback 위임
    private liveAudio: LiveAudioEngine;

    private constructor(private session: Session) {
        // Initialize Global Transport Loop?
        // For now, we rely on Tone.Transport events if needed.
        this.exporter = new AudioExporter();
        this.liveAudio = new LiveAudioEngine();

        this.setupAutomationLoop();
    }

    private setupAutomationLoop() {
        // Update automation every 0.1 seconds (approx 10Hz control rate)
        // Higher rate = smoother curves but more CPU
        Tone.Transport.scheduleRepeat((_time) => {
            // Use the precise time of the event
            // Note: Tone.Transport.seconds might differ slightly from 'time' during lookahead
            const currentTime = Tone.Transport.seconds;

            this.session.tracks.forEach(track => {
                const port = this.ports.get(track.id);
                if (!port) return;

                // 1. Volume Automation
                const volConfig = track.automations.get('volume');
                if (volConfig && volConfig.getPoints().length > 0) {
                    const val = volConfig.getValueAt(currentTime);
                    port.volume = val;
                    // Note: We are NOT updating track.volume or UI store here to avoid performance issues.
                    // If UI needs to reflect this, we should use a separate animation frame loop in UI.
                }

                // 2. Pan Automation
                const panConfig = track.automations.get('pan');
                if (panConfig && panConfig.getPoints().length > 0) {
                    const val = panConfig.getValueAt(currentTime);
                    port.pan = val;
                }
            });
        }, "0.1");
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
                isPlaying: Tone.getTransport().state === 'started',
                currentTime: Tone.getTransport().seconds,
                tracks: this.session.tracks.map(t => t.toSnapshot())
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
        Tone.Transport.bpm.value = tempo;
        this.store.setState({ tempo });
    }

    // --- Transport Control ---

    async play(): Promise<void> {
        if (Tone.getContext().state !== 'running') {
            await Tone.start();
        }
        await Tone.getTransport().start();
        this.store.setState({ isPlaying: true });
    }

    pause(): void {
        Tone.getTransport().pause();
        this.store.setState({ isPlaying: false });
    }

    stop(): void {
        Tone.getTransport().stop();
        this.store.setState({ isPlaying: false, currentTime: 0 });
    }

    setTime(time: number): void {
        Tone.getTransport().seconds = time;
        this.store.setState({ currentTime: time });
    }

    getCurrentTime(): number {
        return Tone.getTransport().seconds;
    }

    // --- Live Performance ---

    playNote(note: string | number, velocity: number = 1): void {
        this.liveAudio.triggerAttack(note, velocity);
    }

    stopNote(note: string | number): void {
        this.liveAudio.triggerRelease(note);
    }

    // --- Track Management ---

    removeTrack(trackId: string): void {
        // 1. Update Domain
        this.session.removeTrack(trackId);

        // 2. Update Engine
        // Dispose AudioPort (disconnects nodes)
        const port = this.ports.get(trackId);
        if (port) {
            port.dispose();
            this.ports.delete(trackId);
        }

        // Dispose Players
        const trackPlayers = this.players.get(trackId);
        if (trackPlayers) {
            trackPlayers.forEach(p => {
                p.stop();
                p.dispose();
            });
            this.players.delete(trackId);
        }

        // 3. Notify UI
        this.syncStore();
    }

    private getOrInitPort(trackId: string): AudioPort {
        let port = this.ports.get(trackId);
        if (!port) {
            port = new AudioPort({
                volume: 0,
                pan: 0,
            });
            this.ports.set(trackId, port);
            this.players.set(trackId, new Map());
        }
        return port;
    }

    setTrackVolume(trackId: string, volume: number): void {
        // 1. Update Domain
        const track = this.session.getTrack(trackId);
        if (track) {
            track.volume = volume;
        }

        // 2. Update Engine
        const port = this.getOrInitPort(trackId);
        // AudioPort handles linear -> dB conversion
        port.volume = volume;

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
        const port = this.getOrInitPort(trackId);
        port.pan = pan;

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
        const port = this.ports.get(trackId);
        if (!port) return null;

        return {
            volume: port.volume,
            pan: port.pan
        };
    }

    // --- Region Management ---

    async addRegion(
        trackId: string,
        regionData: {
            id: string;
            url: string;
            startTime: number;
            sourceStartTime: number;
            duration?: number;
            audioFile?: { url: string; duration?: number };
        }
    ): Promise<void> {
        console.log('[AudioService] addRegion called', { trackId, regionData });

        // 1. Ensure Track exists in Domain
        let track = this.session.getTrack(trackId);
        if (!track) {
            track = new Track({ id: trackId, status: [] });
            this.session.addTrack(track);
            console.log('[AudioService] Created new track', trackId);
        }

        // 2. Ensure Channel exists in Engine
        const channel = this.getOrInitPort(trackId);
        const trackPlayers = this.players.get(trackId)!;

        // 3. Check if player already exists
        if (trackPlayers.has(regionData.id)) {
            console.log('[AudioService] Player already exists for region', regionData.id);
            return;
        }

        // 4. Region creation moved to player.onload to ensure duration is available

        // 5. Create & Load Tone.Player (Engine)
        return new Promise((resolve, reject) => {
            const player = new Tone.Player({
                url: regionData.url,
                loop: false,
                ...PLAYER_CONFIG,
                onload: () => {
                    console.log('[AudioService] Player loaded for region', regionData.id);

                    // Determine duration (provided or from buffer)
                    const duration = regionData.duration ?? player.buffer.duration;

                    // Create Domain Region (now that we have duration)
                    const region = new Region({
                        id: regionData.id,
                        startTime: regionData.startTime,
                        sourceStartTime: regionData.sourceStartTime,
                        duration: duration,
                        audioFile: regionData.audioFile,
                        status: []
                    });

                    try {
                        track.addRegion(region);
                    } catch (e) {
                        console.error('[AudioService] Failed to add region to track', e);
                        player.dispose(); // Cleanup potentially created player
                        reject(e);
                        return;
                    }

                    console.log('[AudioService] Region added to track', { trackId, regionId: regionData.id });

                    if (regionData.duration !== undefined) {
                        configurePlayerLoop(player, regionData.sourceStartTime, regionData.duration);
                    } else {
                        // Ensure loop config if full duration
                        configurePlayerLoop(player, regionData.sourceStartTime, duration);
                    }

                    startPlayer({
                        player,
                        syncMode: true,
                        startTime: regionData.startTime,
                        startOffset: regionData.sourceStartTime,
                        duration: duration
                    });

                    // Notify UI of new track/region
                    console.log('[AudioService] Calling syncStore after region load');
                    this.syncStore();

                    resolve();
                },
                onerror: (e) => {
                    console.error('[AudioService] Player load error', e);
                    reject(e);
                }
            }).connect(channel.inputNode); // Connect to AudioPort input

            trackPlayers.set(regionData.id, player);
        });
    }

    removeRegion(trackId: string, regionId: string): void {
        // 1. Update Domain
        const track = this.session.getTrack(trackId);
        if (track) {
            track.removeRegion(regionId);
        }

        // 2. Update Engine
        const trackPlayers = this.players.get(trackId);
        const player = trackPlayers?.get(regionId);

        if (player) {
            player.unsync();
            player.stop();
            player.disconnect();
            player.dispose();
            trackPlayers?.delete(regionId);
        }

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
        const region = track.regions.find(r =>
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
}
