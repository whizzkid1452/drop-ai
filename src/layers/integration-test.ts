import { MockAudioEngine } from './audio-engine/mock-audio-engine';
import { createApp } from './apps/create-app';

async function runIntegrationTest() {
  console.log('--- Starting Layers Integration Test ---');

  // 1. Setup with Mock Engine
  const mockEngine = new MockAudioEngine();
  const { session, controller } = createApp(mockEngine);

  let notificationCount = 0;
  // Zustand vanilla store subscribe
  session.subscribe(state => {
    notificationCount++;
    console.log(
      `[Test] Session updated! Count: ${notificationCount}, isPlaying: ${state.isPlaying}, Tracks: ${state.tracks.size}`
    );
  });

  // 2. Test Playback
  console.log('\n[Test] Testing Playback Controller...');
  await controller.playback.handlePlay();
  if (session.getState().isPlaying !== true) {
    throw new Error('Playback failed to update session');
  }

  controller.playback.handleStop();
  if (session.getState().isPlaying !== false) {
    throw new Error('Stop failed to update session');
  }

  // 3. Test Track Management
  console.log('\n[Test] Testing Track Controller...');
  await controller.track.addTrack('test-url', 'track-1');
  if (session.getState().tracks.size !== 1) throw new Error('Track addition failed');

  const track = session.getState().tracks.get('track-1');
  if (track?.id !== 'track-1') throw new Error('Track ID mismatch');

  controller.track.setVolume('track-1', 0.5);
  if (session.getState().tracks.get('track-1')?.volume !== 0.5) throw new Error('Track volume update failed');

  controller.track.removeTrack('track-1');
  if (session.getState().tracks.size !== 0) throw new Error('Track removal failed');

  console.log('\n--- Integration Test Passed Successfully! ---');
  console.log(`Total notifications received: ${notificationCount}`);
}

runIntegrationTest().catch(err => {
  console.error('Test Failed:', err);
  process.exit(1);
});
