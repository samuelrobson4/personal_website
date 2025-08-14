// Simple site-wide audio manager using WebAudio. No external assets by default.
// Provides: ambient loop, click sound, collision thump, and a small UI.

type Nullable<T> = T | null;

// Optional: set a default embedded ambient track URL (e.g., 'audio/ambient.mp3').
// Place your file in the site and set this to its relative path.
const DEFAULT_AMBIENT_URL: string = 'audio/ambient.mp3';

class AudioManager {
  private context: Nullable<AudioContext> = null;
  private masterGain: Nullable<GainNode> = null;
  private sfxGain: Nullable<GainNode> = null;
  private musicGain: Nullable<GainNode> = null;
  private started = false;
  private uiInited = false;
  private ambientNodes: { o1?: OscillatorNode; o2?: OscillatorNode; lfo?: OscillatorNode; lp?: BiquadFilterNode } = {};
  private lastCollisionAt = 0;
  private lastScrollAt = 0;
  private lastWaterAt = 0;
  private beatTimer?: number;
  private beatNextTime = 0;
  private beatLookaheadMs = 25; // scheduler tick
  private beatScheduleAheadSec = 0.12; // how far to schedule ahead
  private beatTempo = 84; // BPM
  private beatStep = 0; // 16th steps
  private beatGain: Nullable<GainNode> = null;
  private externalEl: Nullable<HTMLAudioElement> = null;
  private externalSrc: Nullable<MediaElementAudioSourceNode> = null;
  private volume = 0.6; // default
  private muted = false;

  constructor() {
    try {
      const saved = localStorage.getItem('audio.volume');
      if (saved != null) this.volume = Math.max(0, Math.min(1, parseFloat(saved)));
      const m = localStorage.getItem('audio.muted');
      if (m === '1') this.muted = true;
    } catch {}
  }

  private ensureContext() {
    if (this.context) return;
    const Ctx: any = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const master = ctx.createGain();
    const sfx = ctx.createGain();
    const music = ctx.createGain();
    sfx.connect(master);
    music.connect(master);
    master.connect(ctx.destination);
    // Use per-bus volume; keep master at 1 so changes are immediate and predictable
    master.gain.value = 1;
    sfx.gain.value = this.muted ? 0 : this.volume;
    music.gain.value = this.muted ? 0 : this.volume;
    this.context = ctx;
    this.masterGain = master;
    this.sfxGain = sfx;
    this.musicGain = music;
  }

  private async resumeOnInteraction() {
    this.ensureContext();
    if (!this.context) return;
    if (this.context.state === 'suspended') {
      try { await this.context.resume(); } catch {}
    }
    if (!this.started) {
      this.started = true;
      this.startAmbient();
    }
  }

  initUI() {
    if (this.uiInited) return;
    this.uiInited = true;
    // Gooey vertical slider: black dot moving up/down with a goo filter
    const root = document.createElement('div');
    root.className = 'audio-goo';
    root.setAttribute('role', 'slider');
    root.setAttribute('aria-valuemin', '0');
    root.setAttribute('aria-valuemax', '100');
    root.setAttribute('aria-label', 'volume');
    const H = 140; // slider height
    const P = 12;  // padding inside SVG
    const usable = H - P * 2;
    const cyFromVol = (v: number) => P + (1 - v) * usable;
    const volFromCy = (cy: number) => Math.max(0, Math.min(1, 1 - (cy - P) / usable));

    root.innerHTML = `
      <button class="audio-speaker" aria-label="toggle sound" title="toggle sound">${this.iconSvg(this.muted)}</button>
      <svg class="audio-goo-svg" viewBox="0 0 28 ${H}" width="28" height="${H}" aria-hidden="false">
        <defs>
          <filter id="ag-goo">
            <feGaussianBlur in="SourceGraphic" stdDeviation="2" result="blur" />
            <feColorMatrix in="blur" mode="matrix" values="
              1 0 0 0 0
              0 1 0 0 0
              0 0 1 0 0
              0 0 0 18 -8" result="goo" />
            <feComposite in="SourceGraphic" in2="goo" operator="atop" />
          </filter>
        </defs>
        <g id="ag-group" filter="url(#ag-goo)">
          <rect x="12" y="${P}" width="4" height="${usable}" rx="2" fill="#000"></rect>
          <circle cx="14" cy="${cyFromVol(this.volume)}" r="8" fill="#000" id="ag-knob" style="pointer-events:auto"></circle>
          <circle cx="14" cy="${Math.min(H - P - 4, cyFromVol(this.volume) + 16)}" r="5" fill="#000" opacity="0.9"></circle>
          <circle cx="14" cy="${Math.max(P + 4, cyFromVol(this.volume) - 16)}" r="4" fill="#000" opacity="0.8"></circle>
        </g>
      </svg>
    `;
    document.body.appendChild(root);

    const knob = root.querySelector('#ag-knob') as SVGCircleElement;
    const svg = root.querySelector('svg') as SVGSVGElement;
    const speakerBtn = root.querySelector('.audio-speaker') as HTMLButtonElement;
    const group = root.querySelector('#ag-group') as SVGGElement;

    const setKnob = (v: number) => {
      const clamped = Math.max(0, Math.min(1, v));
      const cy = cyFromVol(clamped);
      knob.setAttribute('cy', String(cy));
      root.setAttribute('aria-valuenow', String(Math.round(clamped * 100)));
    };
    setKnob(this.volume);

    let dragging = false; let moved = false; let startY = 0;
    const onMove = (clientY: number) => {
      const rect = svg.getBoundingClientRect();
      const y = Math.max(rect.top + P, Math.min(rect.bottom - P, clientY));
      const v = volFromCy(y - rect.top);
      this.setVolume(v); setKnob(v);
      if (this.muted && this.volume > 0) { this.muted = false; this.applyMasterGain(); if (speakerBtn) speakerBtn.innerHTML = this.iconSvg(false); }
      this.resumeOnInteraction();
    };
    const onPointerMove = (e: PointerEvent) => { if (!dragging) return; if (Math.abs(e.clientY - startY) > 2) moved = true; onMove(e.clientY); };
    const onPointerUp = (e: PointerEvent) => { if (!dragging) return; dragging = false; window.removeEventListener('pointermove', onPointerMove); window.removeEventListener('pointerup', onPointerUp); if (!moved) { this.toggleMute(); if (speakerBtn) speakerBtn.innerHTML = this.iconSvg(this.muted); } };
    const startDrag = (e: PointerEvent) => { dragging = true; moved = false; startY = e.clientY; (e.target as Element).setPointerCapture?.((e as any).pointerId); onMove(e.clientY); window.addEventListener('pointermove', onPointerMove); window.addEventListener('pointerup', onPointerUp); e.preventDefault(); };
    svg.addEventListener('pointerdown', startDrag);
    group.addEventListener('pointerdown', startDrag);
    knob.addEventListener('pointerdown', startDrag);
    svg.addEventListener('wheel', (e) => { e.preventDefault(); const dv = -Math.sign((e as WheelEvent).deltaY) * 0.05; const v = Math.max(0, Math.min(1, this.volume + dv)); this.setVolume(v); setKnob(v); }, { passive: false });

    // Speaker toggle
    speakerBtn.addEventListener('click', () => {
      this.toggleMute();
      speakerBtn.innerHTML = this.iconSvg(this.muted);
      this.resumeOnInteraction();
    });

    // Keyboard accessibility
    (root as any).tabIndex = 0;
    root.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowUp') { const v = Math.min(1, this.volume + 0.05); this.setVolume(v); setKnob(v); }
      if (e.key === 'ArrowDown') { const v = Math.max(0, this.volume - 0.05); this.setVolume(v); setKnob(v); }
      if (e.key === 'm') { this.toggleMute(); }
    });

    // Any pointerdown should resume audio context
    const resume = () => this.resumeOnInteraction();
    window.addEventListener('pointerdown', resume, { passive: true });
  }

  private iconSvg(muted: boolean) {
    // Simple speaker with waves icon
    const waves = muted ? '' : '<path d="M15 8c1.5 1 2.5 2.5 2.5 4s-1 3-2.5 4" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" />\n<path d="M18 6c2.4 1.7 4 4 4 6s-1.6 4.3-4 6" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" />';
    return `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
        <path d="M3 10v4h4l5 4V6L7 10H3z" />
        ${waves}
      </svg>`;
  }

  private applyMasterGain() {
    if (!this.masterGain) return;
    // Master stays at 1; scale busses directly with volume
    if (this.sfxGain) this.sfxGain.gain.value = this.muted ? 0 : this.volume;
    if (this.musicGain) this.musicGain.gain.value = this.muted ? 0 : this.volume;
    // If using a MediaElement, also set its element volume as a fallback
    if (this.externalEl) this.externalEl.volume = this.muted ? 0 : this.volume;
    try {
      localStorage.setItem('audio.volume', String(this.volume));
      localStorage.setItem('audio.muted', this.muted ? '1' : '0');
    } catch {}
  }

  setVolume(v: number) {
    this.volume = Math.max(0, Math.min(1, v));
    this.ensureContext();
    this.applyMasterGain();
  }

  toggleMute() {
    this.muted = !this.muted;
    this.applyMasterGain();
  }

  click() {
    this.ensureContext();
    if (!this.context || !this.sfxGain) return;
    const ctx = this.context;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'square';
    o.frequency.value = 660; // retro UI click
    g.gain.value = 0.0001;
    o.connect(g); g.connect(this.sfxGain);
    const now = ctx.currentTime;
    g.gain.exponentialRampToValueAtTime(0.08, now + 0.001);
    g.gain.exponentialRampToValueAtTime(0.00001, now + 0.08);
    o.start(now);
    o.stop(now + 0.1);
  }

  collision(impact: number) {
    // Rate-limit to avoid noise flood
    const t = performance.now();
    if (t - this.lastCollisionAt < 24) return;
    this.lastCollisionAt = t;
    this.ensureContext();
    if (!this.context || !this.sfxGain) return;
    const ctx = this.context;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'sine';
    // Map impact (~0..20) to frequency 90..240
    const f = 90 + Math.min(20, Math.max(0, impact)) * 7.5;
    o.frequency.value = f;
    g.gain.value = 0.0001;
    o.connect(g); g.connect(this.sfxGain);
    const now = ctx.currentTime;
    const peak = Math.min(0.22, 0.04 + (impact / 20) * 0.18);
    g.gain.exponentialRampToValueAtTime(peak, now + 0.005);
    g.gain.exponentialRampToValueAtTime(0.00001, now + 0.18);
    o.start(now);
    o.stop(now + 0.22);
  }

  scrollWhoosh(amount: number) {
    const nowMs = performance.now();
    if (nowMs - this.lastScrollAt < 30) return;
    this.lastScrollAt = nowMs;
    this.ensureContext(); if (!this.context || !this.sfxGain) return;
    const ctx = this.context;
    const noise = this.createNoise();
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 800; bp.Q.value = 0.6;
    const g = ctx.createGain(); g.gain.value = 0.0001;
    noise.connect(bp); bp.connect(g); g.connect(this.sfxGain);
    const t = ctx.currentTime;
    const mag = Math.min(1, Math.abs(amount) / 200);
    g.gain.linearRampToValueAtTime(0.04 + mag * 0.12, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.00001, t + 0.18 + mag * 0.12);
    noise.start(t);
    noise.stop(t + 0.35);
  }

  waterPlop(strength: number) {
    const nowMs = performance.now();
    if (nowMs - this.lastWaterAt < 24) return;
    this.lastWaterAt = nowMs;
    this.ensureContext(); if (!this.context || !this.sfxGain) return;
    const ctx = this.context;
    const o = ctx.createOscillator(); o.type = 'sine';
    const g = ctx.createGain(); g.gain.value = 0.0001;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1200;
    o.connect(g); g.connect(lp); lp.connect(this.sfxGain);
    const t = ctx.currentTime;
    const f0 = 240 + Math.min(1, Math.max(0, strength)) * 260;
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(110, f0 * 0.5), t + 0.14);
    g.gain.linearRampToValueAtTime(0.06 + strength * 0.12, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.00001, t + 0.22);
    o.start(t); o.stop(t + 0.26);
  }

  private createNoise() {
    const ctx = this.context!;
    const bufferSize = 2 * ctx.sampleRate;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
    const node = ctx.createBufferSource(); node.buffer = buffer; node.loop = true;
    return node;
  }

  private startAmbient() {
    this.ensureContext();
    if (!this.context || !this.musicGain) return;
    // If already running, skip
    if (this.ambientNodes.o1) return;
    const ctx = this.context;

    // If an external ambient URL is provided, use that instead of the synth/beat
    const externalUrl = (window as any).AMBIENT_URL as string | undefined;
    if (externalUrl) { try { this.startExternalAmbient(externalUrl); } catch {} return; }
    // If a default embedded file exists, try it; otherwise synth fallback
    this.startExternalAmbient(DEFAULT_AMBIENT_URL);
  }

  private startSynthAmbient() {
    this.ensureContext(); if (!this.context || !this.musicGain) return;
    const ctx = this.context;
    // Create a gentle lofi pad: two detuned triangles through a lowpass with slow wobble, plus soft tape hiss.
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 800; lp.Q.value = 0.3; lp.connect(this.musicGain);
    const o1 = ctx.createOscillator(); o1.type = 'triangle'; o1.frequency.value = 138.59; // C#3
    const g1 = ctx.createGain(); g1.gain.value = 0.05; o1.connect(g1); g1.connect(lp);
    const o2 = ctx.createOscillator(); o2.type = 'triangle'; o2.frequency.value = 207.65; // G#3
    const g2 = ctx.createGain(); g2.gain.value = 0.045; o2.connect(g2); g2.connect(lp);
    o1.detune.value = -6; o2.detune.value = +7;
    const hiss = this.createNoise();
    const hissGain = ctx.createGain(); hissGain.gain.value = 0.006; // very low
    const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 500; hiss.connect(hp); hp.connect(hissGain); hissGain.connect(this.musicGain);
    const lfo = ctx.createOscillator(); lfo.type = 'sine'; lfo.frequency.value = 0.06;
    const lfoGain = ctx.createGain(); lfoGain.gain.value = 260; lfo.connect(lfoGain); lfoGain.connect(lp.frequency);
    const pump = ctx.createOscillator(); pump.type = 'sine'; pump.frequency.value = 0.45; const pumpGain = ctx.createGain(); pumpGain.gain.value = 0.015; pump.connect(pumpGain); pumpGain.connect(this.musicGain!.gain);
    const now = ctx.currentTime; o1.start(now); o2.start(now); lfo.start(now); pump.start(now); hiss.start(now);
    this.ambientNodes = { o1, o2, lfo, lp };
    this.startLofiBeat();
  }

  private startExternalAmbient(url: string) {
    this.ensureContext(); if (!this.context || !this.musicGain) return;
    if (this.externalEl) return;
    const el = new Audio();
    el.src = url;
    el.loop = true;
    el.crossOrigin = 'anonymous';
    el.preload = 'auto';
    const src = this.context!.createMediaElementSource(el);
    const g = this.context!.createGain();
    g.gain.value = 1; // controlled by musicGain bus which already reflects volume
    src.connect(g); g.connect(this.musicGain!);
    this.externalEl = el; this.externalSrc = src;
    // Defer play until first interaction
    const tryPlay = () => { el.play().catch(() => {}); };
    document.addEventListener('pointerdown', tryPlay, { once: true, passive: true });
    // Fallback to synth if the URL fails
    el.onerror = () => { this.stopAmbient(); this.startSynthAmbient(); };
    // If autoplay allowed, attempt immediately too
    el.play().catch(() => {});
  }

  // Public helper: allow setting ambient URL from the outside (e.g., SoundCloud stream link)
  setAmbientUrl(url: string) {
    // Stop synth/beat if running
    this.stopAmbient();
    (window as any).AMBIENT_URL = url;
    this.startAmbient();
  }

  private stopAmbient() {
    try {
      if (this.beatTimer) { clearInterval(this.beatTimer); this.beatTimer = undefined; }
      if (this.externalEl) { this.externalEl.pause(); this.externalEl.src = ''; this.externalEl = null; }
      if (this.externalSrc) { try { this.externalSrc.disconnect(); } catch {} this.externalSrc = null; }
      // Stop oscillators if created
      const n = this.ambientNodes; if (n.o1) { try { n.o1.stop(); } catch {} } if (n.o2) { try { n.o2.stop(); } catch {} }
      if (n.lfo) { try { n.lfo.stop(); } catch {} }
      this.ambientNodes = {};
    } catch {}
  }

  private startLofiBeat() {
    this.ensureContext(); if (!this.context || !this.musicGain) return;
    if (this.beatTimer) return; // already running

    // output gain for the beat
    const g = this.context.createGain();
    g.gain.value = 0.28; // gentle
    g.connect(this.musicGain);
    this.beatGain = g;

    // initialize scheduler state
    this.beatNextTime = this.context.currentTime + 0.05;
    this.beatStep = 0;
    const tick = () => {
      const secondsPerBeat = 60.0 / this.beatTempo; // quarter note
      while (this.beatNextTime < (this.context as AudioContext).currentTime + this.beatScheduleAheadSec) {
        this.scheduleBeatStep(this.beatStep, this.beatNextTime);
        this.beatNextTime += secondsPerBeat / 4; // 16th note resolution
        this.beatStep = (this.beatStep + 1) % 16;
      }
    };
    this.beatTimer = window.setInterval(tick, this.beatLookaheadMs);
  }

  private scheduleBeatStep(step: number, time: number) {
    // Basic lofi pattern:
    // Kick on 0, 8; Snare on 4, 12; Hats on all 8th with some ghost notes
    const v = 0.9;
    if (step === 0 || step === 8) this.makeKick(time, v);
    if (step === 4 || step === 12) this.makeSnare(time, 0.7);
    // 8ths: steps 0,2,4,... plus some off-hats
    if (step % 2 === 0) this.makeHat(time, 0.25);
    if (step === 3 || step === 11) this.makeHat(time, 0.12);
  }

  private makeKick(time: number, velocity: number) {
    if (!this.context || !this.beatGain) return;
    const ctx = this.context;
    const o = ctx.createOscillator(); o.type = 'sine';
    const g = ctx.createGain(); g.gain.value = 0.0001;
    o.connect(g); g.connect(this.beatGain);
    // Pitch envelope: 120Hz down to 35Hz
    o.frequency.setValueAtTime(120, time);
    o.frequency.exponentialRampToValueAtTime(38, time + 0.12);
    // Amplitude envelope
    const peak = 0.8 * velocity;
    g.gain.linearRampToValueAtTime(peak, time + 0.002);
    g.gain.exponentialRampToValueAtTime(0.00001, time + 0.22);
    o.start(time); o.stop(time + 0.24);
  }

  private makeSnare(time: number, velocity: number) {
    if (!this.context || !this.beatGain) return;
    const ctx = this.context;
    const n = this.createNoise();
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1900; bp.Q.value = 0.6;
    const g = ctx.createGain(); g.gain.value = 0.0001;
    n.connect(bp); bp.connect(g); g.connect(this.beatGain);
    const peak = 0.35 * velocity;
    g.gain.linearRampToValueAtTime(peak, time + 0.005);
    g.gain.exponentialRampToValueAtTime(0.00001, time + 0.18);
    n.start(time); n.stop(time + 0.2);
  }

  private makeHat(time: number, velocity: number) {
    if (!this.context || !this.beatGain) return;
    const ctx = this.context;
    const n = this.createNoise();
    const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 6000; hp.Q.value = 0.7;
    const g = ctx.createGain(); g.gain.value = 0.0001;
    n.connect(hp); hp.connect(g); g.connect(this.beatGain);
    const peak = 0.18 * velocity;
    g.gain.linearRampToValueAtTime(peak, time + 0.001);
    g.gain.exponentialRampToValueAtTime(0.00001, time + 0.06);
    n.start(time); n.stop(time + 0.08);
  }
}

export const audio = new AudioManager();

declare global { interface Window { audio?: AudioManager } }
;(window as any).audio = audio;


