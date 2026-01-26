import type { AudioFile } from '@/types/audioFile';
import { type RegionStatus } from '@/types/statusTypes';

export type RegionId = string;

interface RegionProps {
  id: RegionId;
  startTime: number;
  duration: number;
  sourceStartTime: number;
  audioFile?: AudioFile;
  status: RegionStatus[]; 
}

export interface RegionData extends RegionProps {
    endTime: number;
}

/**
 * Domain Model: Region
 * 
 * Represents a clip of audio on a timeline.
 * It encapsulates logic for timing, duration, and splitting.
 */
export class Region implements RegionData {
  public readonly id: RegionId;
  public startTime: number;
  public sourceStartTime: number;
  public readonly audioFile?: AudioFile;
  public status: RegionStatus[];
  public duration: number;

  constructor(props: RegionProps) {
    this.id = props.id;
    this.startTime = props.startTime;
    this.sourceStartTime = props.sourceStartTime;
    this.audioFile = props.audioFile;
    this.duration = props.duration;
    this.status = props.status;
  }

  /**
   * Get end time on the timeline.
   */
  get endTime(): number {
    return this.startTime + this.duration;
  }

  /**
   * Split the region at a specific timeline position.
   * Returns two new Region instances (left, right) or null if split is invalid.
   */
  split(sysTime: number): { left: Region; right: Region } | null {
    // 1. Validation: Time must be within region boundaries
    // We strictly use > and < to avoid creating zero-length regions at edges
    if (sysTime <= this.startTime || sysTime >= this.endTime) {
      return null;
    }

    // 2. Calculate local split point relative to the start
    const offsetFromStart = sysTime - this.startTime;

    // 3. Create Left Region
    // Start: same
    // Offset: same
    // Duration: offsetFromStart
    const left = new Region({
      id: crypto.randomUUID(), // In real app, ID generation might be external
      startTime: this.startTime,
      sourceStartTime: this.sourceStartTime,
      duration: offsetFromStart,
      audioFile: this.audioFile,
      status: [],
    });

    // 4. Create Right Region
    // Start: sysTime
    // Offset: originalOffset + offsetFromStart
    // Duration: remaining duration
    const right = new Region({
      id: crypto.randomUUID(),
      startTime: sysTime,
      sourceStartTime: this.sourceStartTime + offsetFromStart,
      duration: this.duration - offsetFromStart,
      audioFile: this.audioFile,
      status: [],
    });

    return { left, right };
  }
  /**
   * Returns a plain object representation for the store.
   */
  toSnapshot(): RegionData {
    return {
      id: this.id,
      startTime: this.startTime,
      endTime: this.endTime,
      sourceStartTime: this.sourceStartTime,
      duration: this.duration,
      audioFile: this.audioFile,
      status: this.status,
    };
  }
}
