export const CommandsType = {
  play: 'play',
  stop: 'stop',
  track: 'track',
  status: 'status',
  help: 'help',
  upload: 'upload',
} as const;

export type CommandsType = keyof typeof CommandsType;

export function isCommandsType(value: string): value is CommandsType {
  return value in CommandsType;
}
