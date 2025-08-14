// Minimal, interaction-only audio (no ambient music, no UI)
type Nullable<T> = T | null;

class AudioManager {
  private context: Nullable<AudioContext> = null;
  private sfxGain: Nullable<GainNode> = null;
  private volume = 0.6;
  private muted = false;
  private lastCollisionAt = 0;
  private lastScrollAt = 0;
  private lastWaterAt = 0;

  private ensureContext() {
    if (this.context) return;
    const Ctx: any = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const sfx = ctx.createGain();
    sfx.gain.value = this.muted ? 0 : this.volume;
    sfx.connect(ctx.destination);
    this.context = ctx;
    this.sfxGain = sfx;
  }

  setVolume(v: number) {
    this.volume = Math.max(0, Math.min(1, v));
    if (!this.sfxGain) return;
    this.sfxGain.gain.value = this.muted ? 0 : this.volume;
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.sfxGain) this.sfxGain.gain.value = this.muted ? 0 : this.volume;
  }

  click() {
    this.ensureContext(); if (!this.context || !this.sfxGain) return;
    const ctx = this.context;
    const o = ctx.createOscillator(); const g = ctx.createGain();
    o.type = 'square'; o.frequency.value = 660; g.gain.value = 0.0001;
    o.connect(g); g.connect(this.sfxGain);
    const t = ctx.currentTime;
    g.gain.exponentialRampToValueAtTime(0.08, t + 0.001);
    g.gain.exponentialRampToValueAtTime(0.00001, t + 0.08);
    o.start(t); o.stop(t + 0.1);
  }

  collision(impact: number) {
    const nowMs = performance.now(); if (nowMs - this.lastCollisionAt < 24) return; this.lastCollisionAt = nowMs;
    this.ensureContext(); if (!this.context || !this.sfxGain) return;
    const ctx = this.context;
    const o = ctx.createOscillator(); const g = ctx.createGain();
    o.type = 'sine'; const f = 90 + Math.min(20, Math.max(0, impact)) * 7.5; o.frequency.value = f; g.gain.value = 0.0001;
    o.connect(g); g.connect(this.sfxGain);
    const t = ctx.currentTime; const peak = Math.min(0.22, 0.04 + (impact / 20) * 0.18);
    g.gain.exponentialRampToValueAtTime(peak, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.00001, t + 0.18);
    o.start(t); o.stop(t + 0.22);
  }

  scrollWhoosh(amount: number) {
    const nowMs = performance.now(); if (nowMs - this.lastScrollAt < 30) return; this.lastScrollAt = nowMs;
    this.ensureContext(); if (!this.context || !this.sfxGain) return;
    const ctx = this.context; const noise = this.createNoise();
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 800; bp.Q.value = 0.6;
    const g = ctx.createGain(); g.gain.value = 0.0001; noise.connect(bp); bp.connect(g); g.connect(this.sfxGain);
    const t = ctx.currentTime; const mag = Math.min(1, Math.abs(amount) / 200);
    g.gain.linearRampToValueAtTime(0.04 + mag * 0.12, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.00001, t + 0.18 + mag * 0.12);
    noise.start(t); noise.stop(t + 0.35);
  }

  waterPlop(strength: number) {
    const nowMs = performance.now(); if (nowMs - this.lastWaterAt < 24) return; this.lastWaterAt = nowMs;
    this.ensureContext(); if (!this.context || !this.sfxGain) return;
    const ctx = this.context; const o = ctx.createOscillator(); o.type = 'sine';
    const g = ctx.createGain(); g.gain.value = 0.0001; const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1200;
    o.connect(g); g.connect(lp); lp.connect(this.sfxGain);
    const t = ctx.currentTime; const f0 = 240 + Math.min(1, Math.max(0, strength)) * 260;
    o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(110, f0 * 0.5), t + 0.14);
    g.gain.linearRampToValueAtTime(0.06 + strength * 0.12, t + 0.01); g.gain.exponentialRampToValueAtTime(0.00001, t + 0.22);
    o.start(t); o.stop(t + 0.26);
  }

  private createNoise() {
    const ctx = this.context!; const bufferSize = 2 * ctx.sampleRate;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate); const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
    const node = ctx.createBufferSource(); node.buffer = buffer; node.loop = true; return node;
  }
}

export const audio = new AudioManager();
declare global { interface Window { audio?: AudioManager } }
;(window as any).audio = audio;


