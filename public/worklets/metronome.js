class MetronomeProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.bpm = 120;
    this.phase = 0;
    this.isStopped = false;
    this.enabled = true;
    this.port.onmessage = event => {
      const { type, value } = event.data || {};
      if (type === 'bpm') this.bpm = value || 120;
      if (type === 'stop') this.isStopped = true;
      if (type === 'enable') this.enabled = !!value;
    };
  }

  process(inputs, outputs) {
    const output = outputs[0];
    if (!output || output.length === 0) return true;

    const sr = globalThis.sampleRate; // AudioWorklet global
    const freq = this.bpm / 60; // beats per second
    const clickLen = Math.floor(sr * 0.01); // 10 ms click

    const frames = output[0] ? output[0].length : 128;
    for (let i = 0; i < frames; i++) {
      const isSilenced = this.isStopped || !this.enabled;
      const t = this.phase + i / sr;
      const beatPhase = (t * freq) % 1;
      const isClick = beatPhase < clickLen / sr;
      const env = isSilenced
        ? 0
        : isClick
          ? 1 - (beatPhase * sr) / clickLen
          : 0;
      const s = env * 0.6;
      for (let ch = 0; ch < output.length; ch++) {
        const channel = output[ch];
        if (channel) channel[i] = s;
      }
    }

    this.phase += frames / sr;
    return true;
  }
}

registerProcessor('metronome-processor', MetronomeProcessor);
