export interface CliCommand {
  description: string;
  usage: string;
  fn: (...args: any[]) => string | Promise<string>;
}

export type CliCommands = Record<string, CliCommand>;

// Minimal Track interface for CLI usage
export interface Track {
  id: string;
  regions: { id: string; startTime: number; endTime: number; duration: number; }[];
}

export interface CliState {
  isPlaying: boolean;
  tracks: Map<string, Track>;
  currentTime: number;
  tempo: number;
}
