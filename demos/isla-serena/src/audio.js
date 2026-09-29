// Synthetischer V8-Sound + Fahrtwind + Meeresrauschen (WebAudio, keine Samples).
export class CarAudio {
  constructor() {
    this.ctx = null;
    this.muted = false;
  }

  start() {
    if (this.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = (this.ctx = new AC());
    this.master = ctx.createGain();
    this.master.gain.value = 0.0;
    this.master.connect(ctx.destination);
    this.master.gain.setTargetAtTime(0.5, ctx.currentTime, 1.5);

    // Motor: Grundton + Obertöne durch Verzerrung und Tiefpass
    this.engBus = ctx.createGain();
    this.engBus.gain.value = 0.28;
    const shaper = ctx.createWaveShaper();
    const curve = new Float32Array(1024);
    for (let i = 0; i < 1024; i++) { const x = (i / 512) - 1; curve[i] = Math.tanh(x * 2.6); }
    shaper.curve = curve;
    this.lp = ctx.createBiquadFilter();
    this.lp.type = 'lowpass'; this.lp.frequency.value = 900; this.lp.Q.value = 2.5;
    this.engBus.connect(shaper); shaper.connect(this.lp); this.lp.connect(this.master);
    this.oscs = [];
    const parts = [[1, 'sawtooth', 0.5], [0.5, 'square', 0.35], [2, 'sawtooth', 0.18], [1.5, 'triangle', 0.15]];
    for (const [mul, type, g] of parts) {
      const o = ctx.createOscillator(); o.type = type;
      const gg = ctx.createGain(); gg.gain.value = g;
      o.connect(gg); gg.connect(this.engBus); o.start();
      this.oscs.push({ o, mul });
    }
    // Zylinder-"Blubbern": Amplitudenmodulation
    this.am = ctx.createOscillator(); this.am.type = 'sine';
    const amG = ctx.createGain(); amG.gain.value = 0.12;
    this.am.connect(amG); amG.connect(this.engBus.gain); this.am.start();

    // Rauschen für Wind und Meer
    const len = ctx.sampleRate * 2;
    const nb = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = nb.getChannelData(0);
    let b = 0;
    for (let i = 0; i < len; i++) { b = 0.97 * b + 0.03 * (Math.random() * 2 - 1); d[i] = b * 4; }
    const mkNoise = () => { const s = ctx.createBufferSource(); s.buffer = nb; s.loop = true; s.start(); return s; };
    this.wind = ctx.createGain(); this.wind.gain.value = 0;
    const wf = ctx.createBiquadFilter(); wf.type = 'bandpass'; wf.frequency.value = 700; wf.Q.value = 0.5;
    mkNoise().connect(wf); wf.connect(this.wind); this.wind.connect(this.master);
    this.sea = ctx.createGain(); this.sea.gain.value = 0.05;
    const sf = ctx.createBiquadFilter(); sf.type = 'lowpass'; sf.frequency.value = 500;
    mkNoise().connect(sf); sf.connect(this.sea); this.sea.connect(this.master);
    this.t = 0;
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.ctx) this.master.gain.setTargetAtTime(this.muted ? 0 : 0.5, this.ctx.currentTime, 0.2);
    return this.muted;
  }

  update(dt, driver, camDist, seaNear) {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    this.t += dt;
    const f0 = (driver.rpm / 60) * 4 * 0.5; // V8: 4 Zündungen pro Umdrehung, halbiert für tieferen Klang
    for (const { o, mul } of this.oscs) o.frequency.setTargetAtTime(f0 * mul, now, 0.03);
    this.am.frequency.setTargetAtTime(f0 * 0.25, now, 0.05);
    this.lp.frequency.setTargetAtTime(500 + driver.throttle * 2600 + driver.rpm * 0.12, now, 0.05);
    const distAtt = 1 / (1 + Math.max(0, camDist - 3) * 0.12);
    this.engBus.gain.setTargetAtTime((0.12 + driver.throttle * 0.22) * distAtt, now, 0.08);
    this.wind.gain.setTargetAtTime(Math.min(0.25, (driver.v / 45) ** 2 * 0.22) * (camDist < 12 ? 1 : 0.3), now, 0.2);
    this.sea.gain.setTargetAtTime(0.03 + 0.09 * seaNear * (0.7 + 0.3 * Math.sin(this.t * 0.4)), now, 0.5);
  }
}
