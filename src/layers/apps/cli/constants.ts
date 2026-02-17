export const CommandsType = {
  play: 'play',
  stop: 'stop',
  pause: 'pause',
  track: 'track',
  region: 'region',
  status: 'status',
  help: 'help',
  upload: 'upload',
  volume: 'volume',
  mute: 'mute',
  solo: 'solo',
  seek: 'seek',
  loop: 'loop',
  bpm: 'bpm',
  master: 'master',
} as const;

export type CommandsType = keyof typeof CommandsType;

export function isCommandsType(value: string): value is CommandsType {
  return value in CommandsType;
}
