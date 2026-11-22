// Vice Bay's sound: everything is synthesized with WebAudio, no audio files.
// Engine hum, a two-tone police siren, gunshots, pickup blips and a mission
// jingle. Nothing plays until the first key or click (browsers demand a
// gesture), and every call is guarded so a headless run never throws.

export class SoundBank {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.engineOsc = null;
    this.engineGain = null;
    this.sirenOsc = null;
    this.sirenGain = null;
    this.sirenHigh = false;
    this.sirenTimer = 0;
    this.sirenOn = false;
  }

  /** Creates (or resumes) the audio context after a user gesture. */
  ensure() {
    try {
      if (!this.ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        this.ctx = new AC();
      }
      if (this.ctx.state === 'suspended') void this.ctx.resume();
    } catch (e) {
      this.ctx = null;
    }
  }

  setMuted(muted) {
    this.muted = muted;
    if (this.engineGain) this.engineGain.gain.value = 0;
    if (this.sirenGain) this.sirenGain.gain.value = 0;
  }

  /** One short tone that slides from f0 to f1. */
  tone(f0, f1, dur, type, vol) {
    if (!this.ctx || this.muted) return;
    try {
      const t = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(f0, t);
      osc.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
      gain.gain.setValueAtTime(vol, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
      osc.connect(gain).connect(this.ctx.destination);
      osc.start(t);
      osc.stop(t + dur + 0.02);
    } catch (e) { /* silent */ }
  }

  /** A burst of filtered noise (gunshot, thud). */
  noise(dur, vol, lowpass) {
    if (!this.ctx || this.muted) return;
    try {
      const t = this.ctx.currentTime;
      const len = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
      const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = this.ctx.createBufferSource();
      src.buffer = buf;
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = lowpass;
      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(vol, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
      src.connect(filter).connect(gain).connect(this.ctx.destination);
      src.start(t);
    } catch (e) { /* silent */ }
  }

  shot() { this.noise(0.12, 0.5, 2400); }
  punch() { this.noise(0.09, 0.35, 900); }
  pickup() { this.tone(880, 1320, 0.12, 'sine', 0.25); }
  jingle() {
    this.tone(523, 523, 0.14, 'triangle', 0.3);
    setTimeout(() => this.tone(659, 659, 0.14, 'triangle', 0.3), 130);
    setTimeout(() => this.tone(784, 784, 0.22, 'triangle', 0.3), 260);
  }

  /** Engine hum tied to speed (0..1). Call every frame while driving. */
  setEngine(on, speedNorm) {
    if (!this.ctx) return;
    try {
      if (on && !this.muted) {
        if (!this.engineOsc) {
          this.engineOsc = this.ctx.createOscillator();
          this.engineOsc.type = 'sawtooth';
          this.engineGain = this.ctx.createGain();
          this.engineGain.gain.value = 0;
          this.engineOsc.connect(this.engineGain).connect(this.ctx.destination);
          this.engineOsc.start();
        }
        this.engineOsc.frequency.value = 55 + speedNorm * 150;
        this.engineGain.gain.value = 0.045 + speedNorm * 0.05;
      } else if (this.engineGain) {
        this.engineGain.gain.value = 0;
      }
    } catch (e) { /* silent */ }
  }

  /** Two-tone siren while any cruiser is active. */
  setSiren(on) {
    this.sirenOn = on;
    if (!this.ctx) return;
    try {
      if (on && !this.muted) {
        if (!this.sirenOsc) {
          this.sirenOsc = this.ctx.createOscillator();
          this.sirenOsc.type = 'square';
          this.sirenGain = this.ctx.createGain();
          this.sirenGain.gain.value = 0.02;
          this.sirenOsc.connect(this.sirenGain).connect(this.ctx.destination);
          this.sirenOsc.start();
        }
        this.sirenGain.gain.value = 0.02;
      } else if (this.sirenGain) {
        this.sirenGain.gain.value = 0;
      }
    } catch (e) { /* silent */ }
  }

  /** Alternates the siren tone; call every frame. */
  tick(dt) {
    if (!this.sirenOsc || !this.sirenOn || this.muted) return;
    this.sirenTimer -= dt;
    if (this.sirenTimer <= 0) {
      this.sirenHigh = !this.sirenHigh;
      this.sirenOsc.frequency.value = this.sirenHigh ? 950 : 700;
      this.sirenTimer = 0.42;
    }
  }
}
