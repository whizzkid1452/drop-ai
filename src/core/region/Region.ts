import type { AudioFile } from '@/types/audioFile';

export type RegionId = string;

export interface RegionProps {
  id: RegionId;
  startTime: number;
  duration?: number;
  sourceStartTime: number;
  audioFile?: AudioFile;
}

/**
 * Domain Model: Region
 * 
 * Represents a clip of audio on a timeline.
 * It encapsulates logic for timing, duration, and splitting.
 */
export class Region {
  public readonly id: RegionId;
  public startTime: number;
  public sourceStartTime: number;
  public readonly audioFile?: AudioFile;
  private _duration?: number;

  constructor(props: RegionProps) {
    this.id = props.id;
    this.startTime = props.startTime;
    this.sourceStartTime = props.sourceStartTime;
    this.audioFile = props.audioFile;
    this._duration = props.duration;
  }

  /**
   * Get effective duration.
   * If duration is explicitly set, return it.
   * Otherwise, calculate based on audio file length and offset.
   */
  get duration(): number {
    if (this._duration !== undefined) {
      return this._duration;
    }
    if (this.audioFile?.duration) {
      return Math.max(0, this.audioFile.duration - this.sourceStartTime);
    }
    return 0;
  }

  set duration(value: number) {
    this._duration = value;
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
    });

    return { left, right };
  }
}
