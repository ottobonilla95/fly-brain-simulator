import type { NeuralState } from "./types";

export class NeuralAudio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private voices: {
    osc: OscillatorNode;
    gain: GainNode;
    filter: BiquadFilterNode;
    pan: StereoPannerNode;
  }[] = [];
  private analyser: AnalyserNode | null = null;
  private destination: MediaStreamAudioDestinationNode | null = null;
  private recorder: MediaRecorder | null = null;
  private lastHit = 0;
  private priorEscape = 0;
  enabled = false;
  volume = 0.45;
  mix = [0.6, 0.55, 0.5];
  get ready() {
    return !!this.ctx;
  }
  async start() {
    if (!this.ctx) {
      this.ctx = new AudioContext();
      const ctx = this.ctx;
      this.master = ctx.createGain();
      this.master.gain.value = 0;
      const limiter = ctx.createDynamicsCompressor();
      limiter.threshold.value = -12;
      limiter.knee.value = 16;
      limiter.ratio.value = 8;
      this.analyser = ctx.createAnalyser();
      this.analyser.fftSize = 2048;
      this.destination = ctx.createMediaStreamDestination();
      this.master.connect(limiter);
      limiter.connect(this.analyser);
      this.analyser.connect(ctx.destination);
      this.analyser.connect(this.destination);
      this.voices = [130.81, 196, 261.63].map((freq, i) => {
        const osc = ctx.createOscillator(),
          gain = ctx.createGain(),
          filter = ctx.createBiquadFilter(),
          pan = ctx.createStereoPanner();
        osc.type = i === 0 ? "sine" : "triangle";
        osc.frequency.value = freq;
        gain.gain.value = 0;
        filter.type = "lowpass";
        filter.frequency.value = 600;
        osc.connect(filter);
        filter.connect(gain);
        gain.connect(pan);
        pan.connect(this.master!);
        osc.start();
        return { osc, gain, filter, pan };
      });
    }
    await this.ctx.resume();
    this.enabled = true;
  }
  update(n: NeuralState, running: boolean) {
    if (!this.ctx || !this.master) return;
    const t = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(
      this.enabled && running ? this.volume * 0.55 : 0,
      t,
      0.08,
    );
    const pan = Math.tanh((n.right - n.left) / 4);
    this.voices.forEach((v, i) =>
      v.pan.pan.setTargetAtTime(i === 0 ? pan : pan * 0.5, t, 0.09),
    );
    const gains = [
      Math.min(1, (n.left + n.right) / 12) * 0.3 * this.mix[0],
      Math.min(1, n.wing / 15) * 0.22 * this.mix[1],
      0,
    ];
    this.voices.forEach((v, i) =>
      v.gain.gain.setTargetAtTime(gains[i], t, 0.045),
    );
    this.voices[0].filter.frequency.setTargetAtTime(
      300 + Math.min(n.sensory, 50) * 55,
      t,
      0.09,
    );
    // Musical tuning is a designed mapping. Only amplitudes/pan/filter and escape triggers read neural activity.
    this.voices[1].osc.frequency.setTargetAtTime(
      196 + Math.min(n.wing, 30) * 2,
      t,
      0.12,
    );
    if (
      this.enabled &&
      running &&
      n.escape > 5 &&
      this.priorEscape <= 5 &&
      t - this.lastHit > 0.3
    )
      this.hit();
    this.priorEscape = n.escape;
  }
  private hit() {
    const ctx = this.ctx!,
      t = ctx.currentTime;
    this.lastHit = t;
    const osc = ctx.createOscillator(),
      amp = ctx.createGain();
    osc.frequency.setValueAtTime(160, t);
    osc.frequency.exponentialRampToValueAtTime(38, t + 0.3);
    amp.gain.setValueAtTime(0.6 * this.mix[2], t);
    amp.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
    osc.connect(amp);
    amp.connect(this.master!);
    osc.start(t);
    osc.stop(t + 0.55);
    osc.onended = () => {
      osc.disconnect();
      amp.disconnect();
    };
  }
  waveform(data: Uint8Array<ArrayBuffer>) {
    if (this.analyser) this.analyser.getByteTimeDomainData(data);
    else data.fill(128);
  }
  record(onDone: (blob: Blob, extension: string) => void) {
    if (!this.destination || typeof MediaRecorder === "undefined")
      throw new Error(
        "Audio recording is unavailable in this browser. Try a recent desktop browser.",
      );
    const mime = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"].find(
      (m) => MediaRecorder.isTypeSupported(m),
    );
    const recorder = new MediaRecorder(
      this.destination.stream,
      mime ? { mimeType: mime } : undefined,
    );
    const chunks: Blob[] = [];
    recorder.ondataavailable = (e) => {
      if (e.data.size) chunks.push(e.data);
    };
    recorder.onstop = () =>
      onDone(
        new Blob(chunks, { type: recorder.mimeType }),
        recorder.mimeType.includes("mp4") ? "m4a" : "webm",
      );
    recorder.start(1000);
    this.recorder = recorder;
  }
  stopRecording() {
    if (this.recorder?.state === "recording") this.recorder.stop();
    this.recorder = null;
  }
  dispose() {
    this.stopRecording();
    void this.ctx?.close();
  }
}
