import { createConsoleApp } from '../../main-factory';

async function main() {
    console.log('Initializing App...');

    // Apps layer only sees the Controller (and Session if needed for initial state)
    // It does NOT see the AudioEngine implementation directly.
    const { controller } = createConsoleApp();

    // 4. Simulate User Interaction
    console.log('\n--- Simulation Start ---');

    await controller.playback.handlePlay();

    setTimeout(() => {
        controller.playback.handleStop();
        console.log('--- Simulation End ---');
    }, 1000);
}

main().catch(console.error);
