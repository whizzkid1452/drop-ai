export const CommandsType = {
  play: 'play',
  stop: 'stop',
  track: 'track',
  region: 'region',
  status: 'status',
  help: 'help',
  upload: 'upload',
  volume: 'volume',
  mute: 'mute',
  solo: 'solo',
} as const;

export type CommandsType = keyof typeof CommandsType;

export function isCommandsType(value: string): value is CommandsType {
  return value in CommandsType;
}
