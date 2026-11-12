// An original procedural organ score and an audible clock-comparison cue.
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
  solarGain?: GainNode;
  ionGain?: GainNode;
  lastIonAmount = -1;
  voices: { oscs: OscillatorNode[]; gain: GainNode }[] = [];
  chordIndex = 0;
  chordTimer = 0;
  tickTimer = 0;
  tickInterval = 1;
  muted = false;

  init() {
    if (this.ctx) {
      if (this.ctx.state === "suspended") void this.ctx.resume().catch(() => {});
      return;
    }
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new AC();
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.gain.value = 0.0;
    this.master.gain.linearRampToValueAtTime(this.muted ? 0 : 0.8, ctx.currentTime + 3);
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

    // thrust rumble
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
    // fade old voices
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
        o.onended = () => { o.disconnect(); og.disconnect(); g.disconnect(); };
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
    o.onended = () => { o.disconnect(); g.disconnect(); f.disconnect(); };
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
      o.onended = () => { o.disconnect(); g.disconnect(); };
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
    o.onended = () => { o.disconnect(); g.disconnect(); };
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

  /** Shimmering tone that tracks how much light the solar arrays are drinking in. */
  setSolar(amount: number) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    if (!this.solarGain) {
      const osc = this.ctx.createOscillator();
      osc.type = "triangle";
      osc.frequency.value = 1180;
      const lfo = this.ctx.createOscillator();
      lfo.type = "sine";
      lfo.frequency.value = 0.27;
      const lfoGain = this.ctx.createGain();
      lfoGain.gain.value = 180;
      lfo.connect(lfoGain).connect(osc.frequency);
      const f = this.ctx.createBiquadFilter();
      f.type = "bandpass";
      f.frequency.value = 1400;
      f.Q.value = 2.2;
      this.solarGain = this.ctx.createGain();
      this.solarGain.gain.value = 0;
      osc.connect(f).connect(this.solarGain);
      this.solarGain.connect(this.master);
      this.solarGain.connect(this.reverb);
      osc.start();
      lfo.start();
    }
    this.solarGain.gain.setTargetAtTime(Math.min(0.055, amount * 0.055), t, 0.35);
  }

  /** Level-complete fanfare: a rising arpeggio that adds a note and a shimmer per star earned. */
  fanfare(stars: 1 | 2 | 3) {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const notes = stars === 3 ? [60, 64, 67, 72, 76, 79] : stars === 2 ? [60, 64, 67, 72] : [60, 64, 67];
    notes.forEach((midi, i) => {
      const at = t + i * 0.13;
      const o = ctx.createOscillator();
      o.type = i === notes.length - 1 ? "triangle" : "sine";
      o.frequency.value = mtof(midi);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, at);
      g.gain.linearRampToValueAtTime(0.11, at + 0.015);
      g.gain.exponentialRampToValueAtTime(0.0001, at + (i === notes.length - 1 ? 2.6 : 0.9));
      o.connect(g);
      g.connect(this.master);
      g.connect(this.reverb);
      o.start(at);
      o.stop(at + 2.8);
    });
    if (stars === 3) {
      // A soft high shimmer under the final chord for a perfect run.
      [84, 88, 91].forEach((midi, i) => {
        const at = t + 0.75 + i * 0.05;
        const o = ctx.createOscillator();
        o.type = "sine";
        o.frequency.value = mtof(midi);
        const g = ctx.createGain();
        g.gain.setValueAtTime(0, at);
        g.gain.linearRampToValueAtTime(0.035, at + 0.4);
        g.gain.exponentialRampToValueAtTime(0.0001, at + 3.2);
        o.connect(g);
        g.connect(this.reverb);
        o.start(at);
        o.stop(at + 3.3);
      });
    }
  }

  /** The thin, steady whine of an ion thruster: a high tone with a slow beat, nothing like the chemical rumble. */
  setIon(amount: number) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const target = Math.min(0.04, amount * 0.04);
    if (Math.abs(target - this.lastIonAmount) < 0.002) return;
    this.lastIonAmount = target;
    if (!this.ionGain) {
      const osc = this.ctx.createOscillator();
      osc.type = "sawtooth";
      osc.frequency.value = 410;
      const beat = this.ctx.createOscillator();
      beat.type = "sine";
      beat.frequency.value = 3.1;
      const beatGain = this.ctx.createGain();
      beatGain.gain.value = 6;
      beat.connect(beatGain).connect(osc.frequency);
      const f = this.ctx.createBiquadFilter();
      f.type = "bandpass";
      f.frequency.value = 1900;
      f.Q.value = 3.4;
      this.ionGain = this.ctx.createGain();
      this.ionGain.gain.value = 0;
      osc.connect(f).connect(this.ionGain);
      this.ionGain.connect(this.master);
      this.ionGain.connect(this.reverb);
      osc.start();
      beat.start();
    }
    this.ionGain.gain.setTargetAtTime(target, t, 0.25);
  }

  setMuted(m: boolean) {
    this.muted = m;
    if (!this.ctx) return;
    this.master.gain.cancelScheduledValues(this.ctx.currentTime);
    this.master.gain.setTargetAtTime(m ? 0 : 0.8, this.ctx.currentTime, 0.2);
  }

  setSuspended(suspended: boolean) {
    if (!this.ctx || this.ctx.state === "closed") return;
    if (suspended) void this.ctx.suspend().catch(() => {});
    else void this.ctx.resume().catch(() => {});
  }
}
