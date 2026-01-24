import { Region, type RegionId } from '../region/Region';

export type TrackId = string;

export interface TrackProps {
    id: TrackId;
    name?: string;
    volume?: number;
    pan?: number;
    isMuted?: boolean;
    isSoloed?: boolean;
}

/**
 * Domain Model: Track
 * 
 * Represents a single audio track containing multiple regions.
 * Manages volume, pan, mute/solo state, and region collection.
 */
export class Track {
    public readonly id: TrackId;
    public name: string;

    private _regions: Map<RegionId, Region> = new Map();

    // Audio Properties
    private _volume: number = 1.0; // Linear 0.0 ~ 1.0
    private _pan: number = 0;      // -1.0 (Left) ~ 1.0 (Right)

    // State
    public isMuted: boolean = false;
    public isSoloed: boolean = false;

    constructor(props: TrackProps) {
        this.id = props.id;
        this.name = props.name ?? `Track ${props.id}`;
        if (props.volume !== undefined) this.volume = props.volume;
        if (props.pan !== undefined) this.pan = props.pan;
        if (props.isMuted !== undefined) this.isMuted = props.isMuted;
        if (props.isSoloed !== undefined) this.isSoloed = props.isSoloed;
    }

    // --- Region Management ---

    addRegion(region: Region) {
        // TODO: Check for overlaps? For now, we allow overlaps in model, 
        // but UI/Service might prevent it.
        this._regions.set(region.id, region);
    }

    removeRegion(regionId: RegionId) {
        this._regions.delete(regionId);
    }

    getRegion(regionId: RegionId): Region | undefined {
        return this._regions.get(regionId);
    }

    get regions(): Region[] {
        return Array.from(this._regions.values());
    }

    // --- Audio Properties Accessors ---

    get volume(): number {
        return this._volume;
    }

    set volume(value: number) {
        this._volume = Math.max(0, Math.min(1, value));
    }

    get pan(): number {
        return this._pan;
    }

    set pan(value: number) {
        this._pan = Math.max(-1, Math.min(1, value));
    }
}
