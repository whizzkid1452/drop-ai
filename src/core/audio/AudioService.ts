import * as Tone from 'tone';
import { Session } from '../session/Session';
import { Track } from '../track/Track';
import { Region } from '../region/Region';
import {
    PLAYER_CONFIG,
    configurePlayerLoop,
    startPlayer
} from '../../logics/audio/playerConfig';

type AudioServiceEvent = 'playbackStateChanged' | 'trackUpdated';

/**
 * AudioService (Core + Engine Integration)
 * 
 * "Married" implementation of Domain Logic and Tone.js Engine.
 * - Manages the lifecycle of Tone.js objects (Channel, Player).
 * - Syncs Domain Model state (Tracks, Regions) with Audio Graph.
 */
export class AudioService {
    private static instance: AudioService;
    private listeners: Map<AudioServiceEvent, Set<Function>> = new Map();

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

    // --- Event System ---

    public on(event: AudioServiceEvent, callback: Function) {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, new Set());
        }
        this.listeners.get(event)?.add(callback);
    }

    public off(event: AudioServiceEvent, callback: Function) {
        this.listeners.get(event)?.delete(callback);
    }

    private emit(event: AudioServiceEvent, data: any) {
        this.listeners.get(event)?.forEach(cb => cb(data));
    }

    // --- Transport Control ---

    async play(): Promise<void> {
        if (Tone.getContext().state !== 'running') {
            await Tone.start();
        }
        await Tone.getTransport().start();
        this.emit('playbackStateChanged', { isPlaying: true });
    }

    pause(): void {
        Tone.getTransport().pause();
        this.emit('playbackStateChanged', { isPlaying: false });
    }

    stop(): void {
        Tone.getTransport().stop();
        this.emit('playbackStateChanged', { isPlaying: false, currentTime: 0 });
    }

    setTime(time: number): void {
        Tone.getTransport().seconds = time;
        this.emit('playbackStateChanged', { currentTime: time });
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

        // 3. Notify UI
        this.emit('trackUpdated', { trackId, volume });
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
        this.emit('trackUpdated', { trackId, pan });
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
        // 1. Ensure Track exists in Domain
        let track = this.session.getTrack(trackId);
        if (!track) {
            track = new Track({ id: trackId });
            this.session.addTrack(track);
        }

        // 2. Ensure Channel exists in Engine
        const channel = this.getOrInitChannel(trackId);
        const trackPlayers = this.players.get(trackId)!;

        // 3. Check if player already exists
        if (trackPlayers.has(regionData.id)) {
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

        // 5. Create & Load Tone.Player (Engine)
        return new Promise((resolve, reject) => {
            const player = new Tone.Player({
                url: regionData.url,
                loop: false,
                ...PLAYER_CONFIG,
                onload: () => {
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

                    resolve();
                },
                onerror: (e) => reject(e)
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
    }
}
