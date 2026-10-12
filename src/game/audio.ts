// Procedural score: a cathedral organ drone + a clock that ticks faster as time dilates.
const CHORDS: number[][] = [
  [57, 64, 69, 72, 76], // Am
  [53, 60, 65, 69, 72], // F
  [48, 55, 60, 64, 67], // C
  [55, 62, 67, 71, 74], // G
  [52, 59, 64, 67, 71], // Em
  [53, 60, 65, 69, 74], // Fadd
];
const mtof = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

export class CosmicAudio {
  ctx: AudioContext | null = null;
  master!: GainNode;
  organBus!: GainNode;
  organFilter!: BiquadFilterNode;
  reverb!: ConvolverNode;
  thrustGain!: GainNode;
  voices: { oscs: OscillatorNode[]; gain: GainNode }[] = [];
  chordIndex = 0;
  chordTimer = 0;
  tickTimer = 0;
  tickInterval = 1;
  muted = false;

  init() {
    if (this.ctx) return;
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new AC();
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.gain.value = 0.0;
    this.master.gain.linearRampToValueAtTime(0.8, ctx.currentTime + 3);
    this.master.connect(ctx.destination);

    this.reverb = ctx.createConvolver();
    this.reverb.buffer = this.makeImpulse(5.5, 2.2);
    const wet = ctx.createGain();
    wet.gain.value = 0.7;
    this.reverb.connect(wet).connect(this.master);

    this.organFilter = ctx.createBiquadFilter();
    this.organFilter.type = "lowpass";
    this.organFilter.frequency.value = 900;
    this.organFilter.Q.value = 0.6;
    this.organBus = ctx.createGain();
    this.organBus.gain.value = 0.16;
    this.organFilter.connect(this.organBus);
    this.organBus.connect(this.master);
    this.organBus.connect(this.reverb);

    const noise = ctx.createBufferSource();
    noise.buffer = this.makeNoise(2);
    noise.loop = true;
    const nf = ctx.createBiquadFilter();
    nf.type = "lowpass";
    nf.frequency.value = 260;
    this.thrustGain = ctx.createGain();
    this.thrustGain.gain.value = 0;
    noise.connect(nf).connect(this.thrustGain).connect(this.master);
    noise.start();

    this.playChord(0);
  }

  makeNoise(sec: number) {
    const ctx = this.ctx!;
    const b = ctx.createBuffer(1, ctx.sampleRate * sec, ctx.sampleRate);
    const d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return b;
  }

  makeImpulse(sec: number, decay: number) {
    const ctx = this.ctx!;
    const len = ctx.sampleRate * sec;
    const b = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = b.getChannelData(c);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
    }
    return b;
  }

  playChord(idx: number) {
    const ctx = this.ctx!;
    const t = ctx.currentTime;
    for (const v of this.voices) {
      v.gain.gain.cancelScheduledValues(t);
      v.gain.gain.setValueAtTime(v.gain.gain.value, t);
      v.gain.gain.linearRampToValueAtTime(0, t + 4);
      v.oscs.forEach((o) => o.stop(t + 4.2));
    }
    this.voices = [];
    const notes = CHORDS[idx % CHORDS.length];
    notes.forEach((m, i) => {
      const g = ctx.createGain();
      g.gain.value = 0;
      g.gain.linearRampToValueAtTime(i === 0 ? 0.5 : 0.28, t + 4);
      const oscs: OscillatorNode[] = [];
      const parts: [OscillatorType, number, number][] = [
        ["sine", 1, 1],
        ["triangle", 2, 0.35],
        ["sine", 0.5, i === 0 ? 0.6 : 0],
        ["sawtooth", 1, 0.05],
      ];
      parts.forEach(([type, mult, amp]) => {
        if (amp === 0) return;
        const o = ctx.createOscillator();
        o.type = type;
        o.frequency.value = mtof(m) * mult;
        o.detune.value = (Math.random() - 0.5) * 8;
        const og = ctx.createGain();
        og.gain.value = amp;
        o.connect(og).connect(g);
        o.start(t);
        oscs.push(o);
      });
      g.connect(this.organFilter);
      this.voices.push({ oscs, gain: g });
    });
  }

  tick(strong = false) {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = "square";
    o.frequency.value = strong ? 2400 : 1800;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0, t);
    g.gain.linearRampToValueAtTime(strong ? 0.07 : 0.045, t + 0.002);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.04);
    const f = ctx.createBiquadFilter();
    f.type = "bandpass";
    f.frequency.value = 3000;
    o.connect(f).connect(g).connect(this.master);
    g.connect(this.reverb);
    o.start(t);
    o.stop(t + 0.06);
  }

  chime(pitch = 76, vol = 0.12) {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    [0, 7, 12, 19].forEach((iv, k) => {
      const o = ctx.createOscillator();
      o.type = "sine";
      o.frequency.value = mtof(pitch + iv);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, t + k * 0.06);
      g.gain.linearRampToValueAtTime(vol, t + k * 0.06 + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + k * 0.06 + 1.6);
      o.connect(g);
      g.connect(this.master);
      g.connect(this.reverb);
      o.start(t + k * 0.06);
      o.stop(t + k * 0.06 + 1.7);
    });
  }

  boom() {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = "sine";
    o.frequency.setValueAtTime(90, t);
    o.frequency.exponentialRampToValueAtTime(25, t + 3);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.5, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 4);
    o.connect(g);
    g.connect(this.master);
    g.connect(this.reverb);
    o.start(t);
    o.stop(t + 4);
  }

  /** dilation: time multiplier; proximity 0..1; thrust 0..1 */
  update(dt: number, dilation: number, proximity: number, thrust: number, ticking: boolean) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.organFilter.frequency.setTargetAtTime(500 + proximity * 3200, t, 0.5);
    this.organBus.gain.setTargetAtTime(0.13 + proximity * 0.12, t, 0.8);
    this.thrustGain.gain.setTargetAtTime(thrust * 0.35, t, 0.08);

    this.chordTimer += dt;
    if (this.chordTimer > 9) {
      this.chordTimer = 0;
      this.chordIndex++;
      this.playChord(this.chordIndex);
    }
    if (ticking) {
      this.tickInterval = Math.max(0.06, 1.25 / dilation);
      this.tickTimer += dt;
      if (this.tickTimer >= this.tickInterval) {
        this.tickTimer = 0;
        this.tick(dilation > 3);
      }
    }
  }

  setMuted(m: boolean) {
    this.muted = m;
    if (!this.ctx) return;
    this.master.gain.setTargetAtTime(m ? 0 : 0.8, this.ctx.currentTime, 0.2);
  }
}
