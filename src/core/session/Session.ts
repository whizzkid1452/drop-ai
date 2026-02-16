import { Track, type TrackId } from '../track/Track';

/**
 * Domain Model: Session (Project)
 * 
 * Represents the entire DAW project session.
 * Manages tracks and global settings like Tempo.
 * 
 * Equivalent to 'Session' in Ardour.
 */
export class Session {
    private _tracks: Map<TrackId, Track> = new Map();

    // Global Settings
    private _tempo: number = 120;
    private _timeSignature: [number, number] = [4, 4];

    constructor() { }

    // --- Track Management ---

    addTrack(track: Track) {
        if (this._tracks.has(track.id)) {
            throw new Error(`Track with ID ${track.id} already exists.`);
        }
        this._tracks.set(track.id, track);
    }

    removeTrack(trackId: TrackId) {
        this._tracks.delete(trackId);
    }

    getTrack(trackId: TrackId): Track | undefined {
        return this._tracks.get(trackId);
    }

    get tracks(): Track[] {
        return Array.from(this._tracks.values());
    }

    // --- Global Settings Accessors ---

    get tempo(): number {
        return this._tempo;
    }

    set tempo(bpm: number) {
        if (bpm <= 0) throw new Error("Tempo must be positive");
        this._tempo = bpm;
    }

    get timeSignature(): [number, number] {
        return this._timeSignature;
    }

    set timeSignature(value: [number, number]) {
        this._timeSignature = value;
    }
}
