import { style } from '@vanilla-extract/css';

export const regionContainer = style({
    position: 'absolute',
    top: 0,
    bottom: 0,
    overflow: 'hidden', // Crops the waveform that is pulled left
    backgroundColor: '#2b2b2b',
    border: '1px solid #3d3d3d',
    borderRadius: '4px',
});

export const waveformContainer = style({
    // The negative margin will be applied inline
    height: '100%',
});
