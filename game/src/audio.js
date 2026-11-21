// All sound is synthesized with WebAudio — no audio files. Engine hum,
// gunshots, punches, sirens, pickup chimes, a mission jingle and a bassline
// radio loop for driving. The context starts on the first user gesture.

export class GameAudio {
  constructor() {
    this.ctx = null;
    this.engine = null;
    this.siren = null;
    this.radioTimer = null;
    this.radioStep = 0;
    this.muted = false;
  }

  ensure() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return true;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.5;
    this.master.connect(this.ctx.destination);
    return true;
  }

  tone(freq, dur, type = 'sine', vol = 0.2, slideTo = null, delay = 0) {
    if (!this.ensure() || this.muted) return;
    const t0 = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
    gain.gain.setValueAtTime(vol, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    osc.connect(gain).connect(this.master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  noise(dur, vol = 0.25, filterFreq = 1800, delay = 0) {
    if (!this.ensure() || this.muted) return;
    const t0 = this.ctx.currentTime + delay;
    const len = Math.floor(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = filterFreq;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(vol, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    src.connect(filter).connect(gain).connect(this.master);
    src.start(t0);
  }

  shot() {
    this.noise(0.14, 0.5, 3200);
    this.tone(140, 0.1, 'square', 0.18, 60);
  }

  punch() {
    this.noise(0.09, 0.3, 500);
    this.tone(90, 0.09, 'sine', 0.25, 50);
  }

  crash() {
    this.noise(0.25, 0.4, 900);
    this.tone(70, 0.2, 'sawtooth', 0.15, 40);
  }

  chime() {
    this.tone(880, 0.12, 'sine', 0.18);
    this.tone(1320, 0.18, 'sine', 0.14, null, 0.08);
  }

  jingle() {
    [523, 659, 784, 1046].forEach((f, i) => this.tone(f, 0.22, 'triangle', 0.2, null, i * 0.11));
  }

  wasted() {
    this.tone(220, 0.9, 'sawtooth', 0.16, 55);
  }

  setEngine(on, rpm01 = 0) {
    if (!this.ensure()) return;
    if (on && !this.engine) {
      const osc = this.ctx.createOscillator();
      osc.type = 'sawtooth';
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 420;
      const gain = this.ctx.createGain();
      gain.gain.value = 0.05;
      osc.connect(filter).connect(gain).connect(this.master);
      osc.start();
      this.engine = { osc, gain, filter };
    }
    if (this.engine) {
      const f = 55 + rpm01 * 165;
      this.engine.osc.frequency.setTargetAtTime(f, this.ctx.currentTime, 0.06);
      this.engine.filter.frequency.setTargetAtTime(320 + rpm01 * 700, this.ctx.currentTime, 0.06);
      this.engine.gain.gain.setTargetAtTime(on && !this.muted ? 0.055 : 0.0001, this.ctx.currentTime, 0.1);
    }
  }

  setSiren(on) {
    if (!this.ensure()) return;
    if (on && !this.siren) {
      const osc = this.ctx.createOscillator();
      osc.type = 'square';
      const gain = this.ctx.createGain();
      gain.gain.value = 0.028;
      osc.connect(gain).connect(this.master);
      osc.start();
      this.siren = { osc, gain, phase: 0 };
    }
    if (this.siren) {
      this.siren.phase += 0.12;
      const f = Math.sin(this.siren.phase) > 0 ? 880 : 660;
      this.siren.osc.frequency.setTargetAtTime(f, this.ctx.currentTime, 0.03);
      this.siren.gain.gain.setTargetAtTime(on && !this.muted ? 0.028 : 0.0001, this.ctx.currentTime, 0.1);
    }
  }

  setRadio(on) {
    if (on && !this.radioTimer) {
      const bass = [55, 55, 82.4, 55, 65.4, 55, 98, 73.4];
      this.radioTimer = setInterval(() => {
        if (this.muted) return;
        const step = this.radioStep % 8;
        this.tone(bass[step], 0.24, 'triangle', 0.16);
        if (step % 2 === 0) this.noise(0.03, 0.05, 6000);
        this.radioStep += 1;
      }, 260);
    } else if (!on && this.radioTimer) {
      clearInterval(this.radioTimer);
      this.radioTimer = null;
    }
  }
}
