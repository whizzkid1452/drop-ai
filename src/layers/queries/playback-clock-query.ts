export interface IPlaybackClockQuery {
  getCurrentTime(): number;
}

export interface IPlaybackClockSource {
  getCurrentTime(): number;
}

export class PlaybackClockQuery implements IPlaybackClockQuery {
  constructor(private readonly playbackClockSource: IPlaybackClockSource) {}

  getCurrentTime(): number {
    return this.playbackClockSource.getCurrentTime();
  }
}
