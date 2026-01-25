import * as Tone from 'tone';
import { createStore } from 'zustand/vanilla';
import type { AudioSnapshot } from '@/types/audioTypes';
import { Session } from '../session/Session';
import { Track } from '../track/Track';
import { Region } from '../region/Region';
import {
    PLAYER_CONFIG,
    configurePlayerLoop,
    startPlayer
} from '../../logics/audio/playerConfig';

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
                tracks: this.session.tracks.map(t => ({
                    id: t.id,
                    name: t.name,
                    volume: t.volume,
                    pan: t.pan,
                    isMuted: t.isMuted,
                    isSoloed: t.isSoloed,
                    status: [] as any[],
                    regions: t.regions.map(r => ({
                        id: r.id,
                        startTime: r.startTime,
                        endTime: r.endTime, 
                        sourceStartTime: r.sourceStartTime,
                        duration: r.duration,
                        audioFile: r.audioFile,
                        status: [] as any[]
                    }))
                }))
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

        // 3. Notify UI (Full Sync needed for track volume change)
        this.syncStore();
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

        // 3. Notify UI
        this.syncStore();
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
            audioFile?: any; // To be compatible with old code
        }
    ): Promise<void> {
        console.log('[AudioService] addRegion called', { trackId, regionData });

        // 1. Ensure Track exists in Domain
        let track = this.session.getTrack(trackId);
        if (!track) {
            track = new Track({ id: trackId });
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

        // 4. Create Domain Region
        // Note: In a pure flow, we should create Region first, then call addRegion.
        // But here we are adapting to the old flow where AudioEngine created everything.
        const region = new Region({
            id: regionData.id,
            startTime: regionData.startTime,
            sourceStartTime: regionData.sourceStartTime,
            duration: regionData.duration,
            audioFile: regionData.audioFile
        });
        track.addRegion(region);
        console.log('[AudioService] Region added to track', { trackId, regionId: regionData.id });

        // 5. Create & Load Tone.Player (Engine)
        return new Promise((resolve, reject) => {
            const player = new Tone.Player({
                url: regionData.url,
                loop: false,
                ...PLAYER_CONFIG,
                onload: () => {
                    console.log('[AudioService] Player loaded for region', regionData.id);
                    if (regionData.duration !== undefined) {
                        configurePlayerLoop(player, regionData.sourceStartTime, regionData.duration);
                    }

                    startPlayer({
                        player,
                        syncMode: true,
                        startTime: regionData.startTime,
                        startOffset: regionData.sourceStartTime,
                        duration: regionData.duration
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
}
