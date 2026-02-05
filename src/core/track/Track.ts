import { Region, type RegionId } from '../region/Region';
import type { RegionData } from '../region/Region';
import { TRACK_STATUS, type TrackStatus } from '@/types/statusTypes';

export type TrackId = string;

interface TrackProps {
    id: TrackId;
    name?: string;
    volume?: number;
    pan?: number;
    status: TrackStatus[];
}

export interface TrackData extends Required<TrackProps> {
    regions: RegionData[];
}

/**
 * Domain Model: Track
 * 
 * Represents a single audio track containing multiple regions.
 * Manages volume, pan, mute/solo state, and region collection.
 */
export class Track implements TrackData {
    public readonly id: TrackId;
    public name: string;

    private _regions: Map<RegionId, Region> = new Map();

    // Audio Properties
    private _volume: number = 1.0; // Linear 0.0 ~ 1.0
    private _pan: number = 0;      // -1.0 (Left) ~ 1.0 (Right)

    // State
    public status: TrackStatus[] = [];

    constructor(props: TrackProps) {
        this.id = props.id;
        this.name = props.name ?? `Track ${props.id}`;
        if (props.volume !== undefined) this.volume = props.volume;
        if (props.pan !== undefined) this.pan = props.pan;
        this.status = props.status;
    }

    // --- Region Management ---

    canAddRegion(newRegion: Region): boolean {
        // Validation: Overlap check
        // Returns true if no region overlaps with newRegion
        return !this.regions.some(existingRegion => existingRegion.overlaps(newRegion));
    }

    addRegion(region: Region) {
        if (!this.canAddRegion(region)) {
            // TODO: Custom Error class would be better
            throw new Error(`Cannot add region: Overlaps with an existing region on Track ${this.id}`);
        }
        this._regions.set(region.id, region);
    }

    removeRegion(regionId: RegionId) {
        this._regions.delete(regionId);
    }

    splitRegion(regionId: RegionId, splitTime: number): { left: Region, right: Region } | null {
        const region = this.getRegion(regionId);
        if (!region) return null;

        const splitResult = region.split(splitTime);
        if (!splitResult) return null;

        const { left, right } = splitResult;

        // Transaction-like update: Remove old, Add new
        this.removeRegion(regionId);

        try {
            this.addRegion(left);
            this.addRegion(right);
        } catch (e) {
            // Rollback if something weird happens (unlikely for split)
            this.removeRegion(left.id);
            this.removeRegion(right.id);
            this.addRegion(region); // Restore original
            throw e;
        }

        return { left, right };
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

    // --- Status Helpers (Derived from status array) ---

    get isMuted(): boolean {
        return this.status.includes(TRACK_STATUS.MUTED);
    }

    set isMuted(value: boolean) {
        this.setMute(value);
    }

    get isSoloed(): boolean {
        return this.status.includes(TRACK_STATUS.SOLOED);
    }

    set isSoloed(value: boolean) {
        this.setSolo(value);
    }

    // Helper methods to manipulate status cleanly
    private setMute(muted: boolean) {
        if (muted) {
            if (!this.isMuted) this.status.push(TRACK_STATUS.MUTED);
        } else {
            this.status = this.status.filter(s => s !== TRACK_STATUS.MUTED);
        }
    }

    private setSolo(soloed: boolean) {
        if (soloed) {
            if (!this.isSoloed) this.status.push(TRACK_STATUS.SOLOED);
        } else {
            this.status = this.status.filter(s => s !== TRACK_STATUS.SOLOED);
        }
    }

    /**
     * Returns a plain object representation for the store.
     */
    toSnapshot(): TrackData {
        return {
            id: this.id,
            name: this.name,
            volume: this.volume,
            pan: this.pan,
            status: this.status,
            regions: this.regions.map(r => r.toSnapshot()),
        };
    }
}
