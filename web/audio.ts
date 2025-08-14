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
    const nowMs = performance.now();
    if (nowMs - this.lastScrollAt < 28) return; // tiny throttle
    this.lastScrollAt = nowMs;
  
    this.ensureContext();
    if (!this.context || !this.sfxGain) return;
  
    const ctx = this.context;
  
    // Magnitude & direction
    const dir = Math.sign(amount) || 1;
    const mag = Math.min(1, Math.abs(amount) / 250); // slightly softer scaling
  
    // --- Source: white noise burst ---
    const noise = this.createNoise(); // AudioBufferSourceNode (mono or stereo)
    const inputGain = ctx.createGain();
    inputGain.gain.setValueAtTime(0.00001, ctx.currentTime);
  
    // --- Tone shaping: bandpass + subtle highshelf "air" ---
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    // slight randomization so repeats aren’t identical
    const bpStart = 500 + Math.random() * 200;   // Hz
    const bpEndBase = 1800 + Math.random() * 400;
    const bpEnd = dir > 0 ? bpEndBase * (1 + mag * 0.6)  // sweep up
                          : Math.max(400, bpEndBase * (1 - mag * 0.6)); // sweep down
    bp.Q.value = 0.6 + Math.random() * 0.2;
  
    const air = ctx.createBiquadFilter();
    air.type = "highshelf";
    air.frequency.value = 3500;
    air.gain.value = 2.5 * mag; // subtle sparkle with velocity
  
    // --- Width: stereo pan + Haas delay on a side-chain ---
    const pan = ctx.createStereoPanner?.() ?? null;
    if (pan) pan.pan.setValueAtTime(0.12 * dir * (0.3 + 0.7 * mag), ctx.currentTime);
  
    const split = ctx.createChannelSplitter(2);
    const merge = ctx.createChannelMerger(2);
    const haasSend = ctx.createGain(); haasSend.gain.value = 0.35; // send amount
    const haasDelay = ctx.createDelay(0.02); // 20ms max; we’ll set < 15ms
    haasDelay.delayTime.setValueAtTime(0.008 + 0.006 * mag, ctx.currentTime); // 8–14ms
  
    // --- Envelope: fast attack, eased decay (no clicks) ---
    const g = ctx.createGain();
    const t = ctx.currentTime;
    const attack = 0.007;
    const hold = 0.015 + mag * 0.015;
    const decay = 0.16 + mag * 0.12;
  
    // start very low to avoid click, then ramp
    g.gain.cancelScheduledValues(t);
    g.gain.setValueAtTime(0.00001, t);
    g.gain.linearRampToValueAtTime(0.05 + mag * 0.12, t + attack);
    g.gain.setTargetAtTime(0.00001, t + attack + hold, decay); // smooth tail
  
    // --- Filter sweep automation ---
    bp.frequency.setValueAtTime(bpStart, t);
    bp.frequency.exponentialRampToValueAtTime(Math.max(80, bpEnd), t + attack + hold + decay * 0.7);
  
    // --- Wiring ---
    // Noise -> inputGain -> bp -> air -> pan? -> g -> sfxGain
    noise.connect(inputGain);
    inputGain.connect(bp);
    bp.connect(air);
  
    const postPanNode = pan ? pan : air; // if no StereoPanner support, just use air
    air.connect(pan ?? g);
    if (pan) pan.connect(g);
  
    // Haas side path (split after air or pan)
    (pan ?? air).connect(split);
    // Left dry (0) straight through
    split.connect(merge, 0, 0);
    // Right channel gets a delayed copy for width
    split.connect(haasSend, 1);
    haasSend.connect(haasDelay);
    haasDelay.connect(merge, 0, 1);
  
    // Mix Haas path under the main signal
    const haasMix = ctx.createGain(); haasMix.gain.value = 0.5;
    merge.connect(haasMix);
    haasMix.connect(g);
  
    g.connect(this.sfxGain);
  
    // Prime input gain quickly to avoid initial click
    inputGain.gain.setValueAtTime(1, t);
  
    // Lifecycle
    const stopAt = t + attack + hold + decay + 0.12;
    noise.start(t);
    noise.stop(stopAt);
    noise.addEventListener("ended", () => {
      // defensive cleanup
      try {
        noise.disconnect(); inputGain.disconnect();
        bp.disconnect(); air.disconnect();
        pan?.disconnect(); split.disconnect(); merge.disconnect();
        haasSend.disconnect(); haasDelay.disconnect();
        haasMix.disconnect(); g.disconnect();
      } catch {}
    });
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


