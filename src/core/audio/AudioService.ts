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
import { RegionRenderer } from '@/logics/audio/regionRenderer';
import { loadAndDecodeAudioBuffer } from '@/logics/audio/loadAndDecodeAudioBuffer';
import { AudioEngineError, AudioEngineErrorCode } from '@/logics/audio/audioEngine.errors';
import { audioBufferToWav } from '@/components/Daw/components/ExportButton/utils/wavConverter';

/**
 * AudioService (Core + Engine Integration)
 * 
 * "Married" implementation of Domain Logic and Tone.js Engine.
 * - Manages the lifecycle of Tone.js objects (Channel, Player).
 * - Syncs Domain Model state (Tracks, Regions) with Audio Graph.
 */
export class AudioService {
    private static instance: AudioService;
    
    // ✅ Zustand Vanilla Store for Logic-State Binding
    public readonly store = createStore<AudioSnapshot>(() => ({
        isPlaying: false,
        currentTime: 0,
        tempo: 120,
        pixelsPerSecond: 20,
        exportStartTime: null,
        exportEndTime: null,
        tracks: []
    }));

    // Tone.js Objects
    // Key: TrackId
    private channels: Map<string, Tone.Channel> = new Map();
    // Key: TrackId -> RegionId -> Tone.Player
    private players: Map<string, Map<string, Tone.Player>> = new Map();

    private constructor(private session: Session) {
        // Initialize Global Transport Loop?
        // For now, we rely on Tone.Transport events if needed.
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
    get pixelsPerSecond() { return this.store.getState().pixelsPerSecond; }

    // --- State Setters ---

    setExportRange(startTime: number | null, endTime: number | null) {
        this.store.setState({ exportStartTime: startTime, exportEndTime: endTime });
    }

    setTempo(tempo: number) {
        Tone.Transport.bpm.value = tempo;
        this.store.setState({ tempo });
    }

    setPixelsPerSecond(pixels: number) {
        this.store.setState({ pixelsPerSecond: pixels });
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

    // --- Track Management ---

    private getOrInitChannel(trackId: string): Tone.Channel {
        let channel = this.channels.get(trackId);
        if (!channel) {
            channel = new Tone.Channel({
                volume: 0,
                pan: 0,
            }).toDestination();
            this.channels.set(trackId, channel);
            this.players.set(trackId, new Map());
        }
        return channel;
    }

    setTrackVolume(trackId: string, volume: number): void {
        // 1. Update Domain
        const track = this.session.getTrack(trackId);
        if (track) {
            track.volume = volume;
        }

        // 2. Update Engine
        const channel = this.getOrInitChannel(trackId);
        const volumeInDb = Tone.gainToDb(volume);
        channel.volume.rampTo(volumeInDb, 0.1);

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
        const channel = this.getOrInitChannel(trackId);
        channel.pan.rampTo(pan, 0.1);

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
        const channel = this.channels.get(trackId);
        if (!channel) return null;

        return {
            volume: channel.volume.value,
            pan: channel.pan.value
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
            audioFile?: unknown;
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
        const channel = this.getOrInitChannel(trackId);
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
                        audioFile: regionData.audioFile as any,
                        status: []
                    });
                    track.addRegion(region);
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
            }).connect(channel);

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

        // Find region at splitTime
        // (Simple find, assuming no overlaps for now)
        const region = track.regions.find(r =>
            splitTime > r.startTime && splitTime < r.endTime
        );

        if (!region) {
            console.warn(`[AudioService] No region found at ${splitTime} on track ${trackId}`);
            return;
        }

        // Domain Logic: Split
        const splitResult = region.split(splitTime);
        if (!splitResult) return;

        const { left, right } = splitResult;

        // Update Domain
        track.removeRegion(region.id);
        track.addRegion(left);
        track.addRegion(right);

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
     * Tone.Offline을 사용하여 정확한 타이밍과 이펙트를 반영합니다.
     * @todo 추후에 별도 파일로 분리하기(너무 큼)
     */
    async exportProject(options?: {
        tracks?: TrackData[];
        range?: { startTime: number; endTime: number };
    }): Promise<Blob> {
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

        if (tracksToExport.length === 0) {
            throw new AudioEngineError(
                AudioEngineErrorCode.EXPORT_NO_TRACKS,
                'No tracks to export'
            );
        }

        // 1. Preload Audio Buffers
        const audioBuffers = await this.preloadAudioBuffers(tracksToExport);

        // 2. Calculate Duration
        const totalDuration = exportRange
            ? exportRange.endTime - exportRange.startTime
            : this.getTotalDuration(tracksToExport);

        if (totalDuration <= 0) {
            throw new AudioEngineError(
                AudioEngineErrorCode.EXPORT_ZERO_DURATION,
                'Export duration must be greater than 0',
                { totalDuration, range: exportRange }
            );
        }

        // 3. Offline Rendering
        const renderedBuffer = await Tone.Offline(({ transport }) => {
            tracksToExport.forEach(track => {
                const channel = new Tone.Channel({
                    volume: track.volume ? Tone.gainToDb(track.volume) : 0,
                    pan: track.pan ?? 0,
                }).toDestination();

                track.regions.forEach((region) => {
                    if (!region.audioFile) return;
                    
                    const buffer = audioBuffers.get(region.audioFile.url);
                    if (!buffer) return;

                    // region.audioFile이 확인됐으므로 Region으로 타입 단언 가능
                    const baseParams = RegionRenderer.calculateRenderParams(region as any);
                    const adjustedParams = RegionRenderer.adjustForExportRange(baseParams, exportRange);

                    if (adjustedParams.duration <= 0) return;

                    const player = new Tone.Player({
                        url: buffer,
                        loop: false,
                        ...PLAYER_CONFIG,
                    }).connect(channel);

                    configurePlayerLoop(
                        player,
                        adjustedParams.startOffset,
                        adjustedParams.duration
                    );

                    startPlayer({
                        player,
                        syncMode: false,
                        startTime: adjustedParams.startTime,
                        startOffset: adjustedParams.startOffset,
                        duration: adjustedParams.duration,
                    });
                });
            });

            transport.start();
        }, totalDuration);

        // 4. Convert to WAV
        const audioBuffer = renderedBuffer.get();
        if (!audioBuffer) {
            throw new AudioEngineError(
                AudioEngineErrorCode.RENDER_FAILED,
                'Failed to render audio buffer'
            );
        }

        return audioBufferToWav(audioBuffer);
    }

    private async preloadAudioBuffers(tracks: TrackData[]) {
        const audioBuffers = new Map<string, AudioBuffer>();
        const context = Tone.getContext();
      
        await Promise.all(
          tracks.flatMap(track =>
            track.regions.map(async (region) => {
              if (!region.audioFile) return;
              const audioUrl = region.audioFile.url;
              if (audioBuffers.has(audioUrl)) return;
              
              const audioBuffer = await loadAndDecodeAudioBuffer({
                audioContext: context,
                audioUrl,
              });
              audioBuffers.set(audioUrl, audioBuffer);
            })
          )
        );
      
        return audioBuffers;
    }

    private getTotalDuration(tracks: TrackData[]): number {
        let totalDuration = 0;
      
        tracks.forEach(track => {
          track.regions.forEach((region) => {
            if (!region.audioFile) return;
            const duration = region.audioFile.duration ?? 0;
            const endPoint = region.startTime + duration;
            if (endPoint > totalDuration) {
              totalDuration = endPoint;
            }
          });
        });
        
        return totalDuration;
    }
}
