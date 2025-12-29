import { z } from 'zod';

export const SetVolumeSchema = z.object({
    trackId: z.string().describe('Target track ID'),
    volume: z.number().min(-60).max(6).describe('Volume in dB'),
});

export const AUDIO_TOOLS: any[] = [
    {
        type: 'function',
        function: {
            name: 'play',
            description: 'Start playback of the audio engine',
            parameters: {
                type: 'object',
                properties: {},
                required: []
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'pause',
            description: 'Pause playback of the audio engine',
            parameters: {
                type: 'object',
                properties: {},
                required: []
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'set_volume',
            description: 'Set volume for a specific track',
            parameters: {
                type: 'object',
                properties: {
                    trackId: { type: 'string', description: 'Target track ID' },
                    volume: { type: 'number', description: 'Volume in dB (e.g. -20)' },
                },
                required: ['trackId', 'volume']
            },
        },
    },
];
