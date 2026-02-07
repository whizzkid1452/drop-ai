import * as Tone from 'tone';
import { AudioPort } from '../../io/AudioPort';
import type { IAudioEngine, RegionData } from './IAudioEngine';
import { LiveAudioEngine } from '../../live/LiveAudioEngine';
import {
    PLAYER_CONFIG,
    configurePlayerLoop,
    startPlayer
} from '../../logics/playerConfig';

/**
 * ToneAudioEngine
 * 
 * IAudioEngine의 Tone.js 구현체.
 * 모든 Tone.js 관련 로직(Transport, Player, AudioPort)을 캡슐화합니다.
 * AudioService는 이 클래스의 존재를 인터페이스를 통해서만 알 수 있습니다.
 */
export class ToneAudioEngine implements IAudioEngine {
    // Tone.js Objects
    private ports: Map<string, AudioPort> = new Map();
    private players: Map<string, Map<string, Tone.Player>> = new Map();
    private liveAudio: LiveAudioEngine;

    constructor() {
        this.liveAudio = new LiveAudioEngine();
    }

    // --- Transport 제어 ---

    async play(): Promise<void> {
        if (Tone.getContext().state !== 'running') {
            await Tone.start();
        }
        await Tone.getTransport().start();
    }

    pause(): void {
        Tone.getTransport().pause();
    }

    stop(): void {
        Tone.getTransport().stop();
    }

    setTime(seconds: number): void {
        Tone.getTransport().seconds = seconds;
    }

    getCurrentTime(): number {
        return Tone.getTransport().seconds;
    }

    setTempo(bpm: number): void {
        Tone.Transport.bpm.value = bpm;
    }

    getTransportState(): 'started' | 'paused' | 'stopped' {
        return Tone.getTransport().state as 'started' | 'paused' | 'stopped';
    }

    // --- Track 관리 ---

    removeTrack(trackId: string): void {
        // Dispose AudioPort
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
    }

    setTrackVolume(trackId: string, volume: number): void {
        const port = this.getOrInitPort(trackId);
        port.volume = volume;
    }

    setTrackPan(trackId: string, pan: number): void {
        const port = this.getOrInitPort(trackId);
        port.pan = pan;
    }

    getTrackParams(trackId: string): { volume: number; pan: number } | null {
        const port = this.ports.get(trackId);
        if (!port) return null;

        return {
            volume: port.volume,
            pan: port.pan
        };
    }

    // --- Region 관리 ---

    async addRegion(trackId: string, regionData: RegionData): Promise<void> {
        const channel = this.getOrInitPort(trackId);
        const trackPlayers = this.players.get(trackId)!;

        // Check if player already exists
        if (trackPlayers.has(regionData.id)) {
            console.log('[ToneAudioEngine] Player already exists for region', regionData.id);
            return;
        }

        return new Promise((resolve, reject) => {
            const player = new Tone.Player({
                url: regionData.url,
                loop: false,
                ...PLAYER_CONFIG,
                onload: () => {
                    console.log('[ToneAudioEngine] Player loaded for region', regionData.id);

                    const duration = regionData.duration ?? player.buffer.duration;

                    if (regionData.duration !== undefined) {
                        configurePlayerLoop(player, regionData.sourceStartTime, regionData.duration);
                    } else {
                        configurePlayerLoop(player, regionData.sourceStartTime, duration);
                    }

                    startPlayer({
                        player,
                        syncMode: true,
                        startTime: regionData.startTime,
                        startOffset: regionData.sourceStartTime,
                        duration: duration
                    });

                    resolve();
                },
                onerror: (e: Error) => {
                    console.error('[ToneAudioEngine] Player load error', e);
                    reject(e);
                }
            }).connect(channel.inputNode);

            trackPlayers.set(regionData.id, player);
        });
    }

    removeRegion(trackId: string, regionId: string): void {
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

    // --- Live Performance ---

    playNote(note: string | number, velocity: number = 1): void {
        this.liveAudio.triggerAttack(note, velocity);
    }

    stopNote(note: string | number): void {
        this.liveAudio.triggerRelease(note);
    }

    // --- 리소스 정리 ---

    dispose(): void {
        // Dispose all ports
        this.ports.forEach(port => port.dispose());
        this.ports.clear();

        // Dispose all players
        this.players.forEach(trackPlayers => {
            trackPlayers.forEach(player => {
                player.stop();
                player.dispose();
            });
        });
        this.players.clear();
    }

    // --- Private Helpers ---

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

    /**
     * AutomationEngine에서 사용하기 위해 AudioPort를 가져오는 메서드
     */
    getPort(trackId: string): AudioPort | undefined {
        return this.ports.get(trackId);
    }
}
