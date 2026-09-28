/* AetherMusic v2.2 — Procedural generation + visible progress */

const GENRES = {
  'پاپ فارسی': { key: 'PersianPop', subs: ['پاپ مدرن', 'پاپ کلاسیک', 'پاپ الکترونیک', 'پاپ عاشقانه'], color: ['#f472b6', '#c084fc'], bpmBias: 110, scale: 'major', drum: 'pop' },
  'سنتی': { key: 'Traditional', subs: ['دستگاهی', 'محلی', 'تلفیقی سنتی', 'تصنیف'], color: ['#f59e0b', '#d97706'], bpmBias: 80, scale: 'hijaz', drum: 'soft' },
  'فیوژن': { key: 'Fusion', subs: ['شرق و غرب', 'جز فیوژن', 'ورلد فیوژن', 'الکترونیک سنتی'], color: ['#2dd4bf', '#14b8a6'], bpmBias: 100, scale: 'dorian', drum: 'groove' },
  Pop: { key: 'Pop', subs: ['Dance Pop', 'Indie Pop', 'Synth Pop', 'K-Pop', 'Electropop'], color: ['#f472b6', '#c084fc'], bpmBias: 120, scale: 'major', drum: 'pop' },
  Rock: { key: 'Rock', subs: ['Alternative', 'Indie Rock', 'Hard Rock', 'Classic Rock', 'Punk'], color: ['#f87171', '#fb923c'], bpmBias: 130, scale: 'minor', drum: 'rock' },
  'Hip-Hop': { key: 'Hip-Hop', subs: ['Trap', 'Boom Bap', 'Cloud Rap', 'Old School', 'Drill'], color: ['#a78bfa', '#818cf8'], bpmBias: 140, scale: 'minor', drum: 'trap' },
  Rap: { key: 'Rap', subs: ['Melodic Rap', 'Conscious', 'Gangsta', 'Freestyle', 'Trap Rap'], color: ['#c084fc', '#e879f9'], bpmBias: 95, scale: 'minor', drum: 'trap' },
  Electronic: { key: 'Electronic', subs: ['EDM', 'Synthwave', 'Future Bass', 'Dubstep', 'Trance'], color: ['#22d3ee', '#67e8f9'], bpmBias: 128, scale: 'minor', drum: 'edm' },
  House: { key: 'House', subs: ['Deep House', 'Tech House', 'Progressive', 'Tropical', 'Afro House'], color: ['#34d399', '#2dd4bf'], bpmBias: 122, scale: 'minor', drum: 'house' },
  Techno: { key: 'Techno', subs: ['Minimal', 'Industrial', 'Detroit', 'Hard Techno', 'Ambient Techno'], color: ['#60a5fa', '#818cf8'], bpmBias: 135, scale: 'chromatic', drum: 'techno' },
  Jazz: { key: 'Jazz', subs: ['Smooth Jazz', 'Bebop', 'Fusion', 'Cool Jazz', 'Nu Jazz'], color: ['#fbbf24', '#f59e0b'], bpmBias: 90, scale: 'dorian', drum: 'jazz' },
  Blues: { key: 'Blues', subs: ['Delta Blues', 'Chicago Blues', 'Electric Blues', 'Soul Blues'], color: ['#94a3b8', '#64748b'], bpmBias: 85, scale: 'blues', drum: 'soft' },
  Classical: { key: 'Classical', subs: ['Baroque', 'Romantic', 'Modern Classical', 'Chamber', 'Orchestral'], color: ['#e2e8f0', '#94a3b8'], bpmBias: 72, scale: 'major', drum: 'none' },
  Ambient: { key: 'Ambient', subs: ['Dark Ambient', 'Space Ambient', 'Drone', 'New Age', 'Atmospheric'], color: ['#67e8f9', '#a5b4fc'], bpmBias: 70, scale: 'pentatonic', drum: 'none' },
  'Lo-Fi': { key: 'Lo-Fi', subs: ['Lo-Fi Hip-Hop', 'Chillhop', 'Study Beats', 'Jazz Lo-Fi', 'Vinyl'], color: ['#fdba74', '#fbbf24'], bpmBias: 85, scale: 'major', drum: 'lofi' },
  'R&B': { key: 'R&B', subs: ['Contemporary R&B', 'Neo-Soul', 'Quiet Storm', 'Alternative R&B'], color: ['#f9a8d4', '#e879f9'], bpmBias: 95, scale: 'minor', drum: 'groove' },
  Soul: { key: 'Soul', subs: ['Classic Soul', 'Northern Soul', 'Psychedelic Soul', 'Modern Soul'], color: ['#fca5a5', '#fb7185'], bpmBias: 100, scale: 'major', drum: 'groove' },
  Metal: { key: 'Metal', subs: ['Heavy Metal', 'Metalcore', 'Doom', 'Progressive Metal', 'Thrash'], color: ['#78716c', '#a8a29e'], bpmBias: 150, scale: 'minor', drum: 'rock' },
  Cinematic: { key: 'Cinematic', subs: ['Epic Trailer', 'Emotional Score', 'Action', 'Fantasy', 'Suspense'], color: ['#c4b5fd', '#a78bfa'], bpmBias: 110, scale: 'minor', drum: 'epic' }
};

const MOODS = ['Happy', 'Sad', 'Dark', 'Energetic', 'Romantic', 'Epic', 'Calm', 'Mysterious'];
const INSTRUMENTS = [
  { id: 'piano', name: 'پیانو', icon: '🎹' },
  { id: 'guitar', name: 'گیتار', icon: '🎸' },
  { id: 'bass', name: 'بیس', icon: '🔉' },
  { id: 'drums', name: 'درامز', icon: '🥁' },
  { id: 'synth', name: 'سینث', icon: '🎛️' },
  { id: 'violin', name: 'ویولن', icon: '🎻' },
  { id: 'strings', name: 'استرینگ', icon: '🎼' },
  { id: 'santur', name: 'سنتور', icon: '🪕' },
  { id: 'ney', name: 'نی', icon: '🎶' }
];

const SAMPLE_TRACKS = [
  { id: 's1', title: 'سپیده‌دم دیجیتال', genre: 'Electronic', sub: 'Synthwave', mood: 'Energetic', duration: 16, bpm: 128, instruments: ['synth', 'drums', 'bass'], energy: 'high', complexity: 'standard', space: 'wide', isSample: true, procedural: true },
  { id: 's2', title: 'آرامش نیمه‌شب', genre: 'Lo-Fi', sub: 'Chillhop', mood: 'Calm', duration: 16, bpm: 85, instruments: ['piano', 'drums', 'bass'], energy: 'low', complexity: 'minimal', space: 'intimate', isSample: true, procedural: true },
  { id: 's3', title: 'حماسه‌ی ستارگان', genre: 'Cinematic', sub: 'Epic Trailer', mood: 'Epic', duration: 20, bpm: 110, instruments: ['strings', 'violin', 'drums'], energy: 'high', complexity: 'rich', space: 'wide', isSample: true, procedural: true },
  { id: 's4', title: 'نبض شهر', genre: 'Hip-Hop', sub: 'Trap', mood: 'Dark', duration: 16, bpm: 140, instruments: ['synth', 'drums', 'bass'], energy: 'high', complexity: 'standard', space: 'balanced', isSample: true, procedural: true },
  { id: 's5', title: 'عشق در باران', genre: 'R&B', sub: 'Contemporary R&B', mood: 'Romantic', duration: 16, bpm: 95, instruments: ['piano', 'guitar', 'bass'], energy: 'low', complexity: 'standard', space: 'intimate', isSample: true, procedural: true },
  { id: 's6', title: 'رقص در تاریکی', genre: 'House', sub: 'Deep House', mood: 'Mysterious', duration: 16, bpm: 122, instruments: ['synth', 'drums', 'bass'], energy: 'medium', complexity: 'standard', space: 'wide', isSample: true, procedural: true }
];

const THEME_LOGO = {
  classic: ['#a78bfa', '#22d3ee'],
  nocturne: ['#f59e0b', '#2dd4bf'],
  prism: ['#ec4899', '#a3e635']
};

const SCALES = {
  major: [0, 2, 4, 5, 7, 9, 11],
  minor: [0, 2, 3, 5, 7, 8, 10],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  pentatonic: [0, 2, 4, 7, 9],
  blues: [0, 3, 5, 6, 7, 10],
  hijaz: [0, 1, 4, 5, 7, 8, 10],
  chromatic: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]
};

const ROOTS = {
  Happy: 60, Sad: 57, Dark: 55, Energetic: 62,
  Romantic: 58, Epic: 53, Calm: 55, Mysterious: 56
};

function toPersianDigits(n) {
  return String(n).replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[d]);
}
function hashStr(s) {
  let h = 0;
  for (let i = 0; i < String(s).length; i++) h = ((h << 5) - h + String(s).charCodeAt(i)) | 0;
  return Math.abs(h);
}
function midiToFreq(m) { return 440 * Math.pow(2, (m - 69) / 12); }

/* ========== Procedural Music Engine ========== */
class ProceduralEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.filter = null;
    this.delay = null;
    this.delayGain = null;
    this.comp = null;
    this.playing = false;
    this.startTime = 0;
    const duration = 16;
    this.duration = duration;
    this.timer = null;
    this.onProgress = null;
    this.onEnded = null;
    this.nodes = [];
  }

  ensure() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AC();
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
    return this.ctx;
  }

  stop() {
    this.playing = false;
    if (this.timer) { clearInterval(this.timer); this.timer = null; }
    this.nodes.forEach((n) => {
      try { n.stop?.(); } catch (_) {}
      try { n.disconnect?.(); } catch (_) {}
    });
    this.nodes = [];
    try { this.master?.disconnect(); } catch (_) {}
    try { this.filter?.disconnect(); } catch (_) {}
    try { this.delay?.disconnect(); } catch (_) {}
    try { this.delayGain?.disconnect(); } catch (_) {}
    try { this.comp?.disconnect(); } catch (_) {}
    this.master = this.filter = this.delay = this.delayGain = this.comp = null;
  }

  buildChain(track) {
    const ctx = this.ensure();
    this.stop();

    const energy = track.energy || 'medium';
    const space = track.space || 'balanced';
    const mood = track.mood || 'Calm';

    this.master = ctx.createGain();
    this.master.gain.value = energy === 'high' ? 0.55 : energy === 'low' ? 0.35 : 0.45;

    this.filter = ctx.createBiquadFilter();
    this.filter.type = 'lowpass';
    const filtMap = { Happy: 5000, Sad: 2200, Dark: 1800, Energetic: 6500, Romantic: 3200, Epic: 4800, Calm: 2000, Mysterious: 2600 };
    this.filter.frequency.value = filtMap[mood] || 3500;
    if (energy === 'high') this.filter.frequency.value *= 1.2;
    if (energy === 'low') this.filter.frequency.value *= 0.75;

    this.delay = ctx.createDelay(1.0);
    this.delay.delayTime.value = space === 'wide' ? 0.28 : space === 'intimate' ? 0.08 : 0.16;
    this.delayGain = ctx.createGain();
    this.delayGain.gain.value = space === 'wide' ? 0.28 : space === 'intimate' ? 0.08 : 0.15;

    this.comp = ctx.createDynamicsCompressor();
    this.comp.threshold.value = -18;
    this.comp.knee.value = 12;
    this.comp.ratio.value = 4;
    this.comp.attack.value = 0.01;
    this.comp.release.value = 0.15;

    this.master.connect(this.filter);
    this.filter.connect(this.comp);
    this.filter.connect(this.delay);
    this.delay.connect(this.delayGain);
    this.delayGain.connect(this.comp);
    this.comp.connect(ctx.destination);
  }

  scheduleNote(freq, time, dur, type, gainVal, opts = {}) {
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type || 'sine';
    osc.frequency.value = freq;
    if (opts.detune) osc.detune.value = opts.detune;

    const atk = opts.atk ?? 0.02;
    const rel = opts.rel ?? 0.15;
    g.gain.setValueAtTime(0, time);
    g.gain.linearRampToValueAtTime(gainVal, time + atk);
    g.gain.setValueAtTime(gainVal, time + Math.max(atk, dur - rel));
    g.gain.linearRampToValueAtTime(0, time + dur);

    osc.connect(g);
    g.connect(this.master);
    osc.start(time);
    osc.stop(time + dur + 0.05);
    this.nodes.push(osc, g);
  }

  scheduleNoise(time, dur, gainVal, bpFreq) {
    const ctx = this.ctx;
    const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = bpFreq || 4000;
    bp.Q.value = 1.2;
    const g = ctx.createGain();
    g.gain.setValueAtTime(gainVal, time);
    g.gain.exponentialRampToValueAtTime(0.001, time + dur);
    src.connect(bp);
    bp.connect(g);
    g.connect(this.master);
    src.start(time);
    src.stop(time + dur + 0.02);
    this.nodes.push(src, bp, g);
  }

  kick(time, gain) {
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(150, time);
    osc.frequency.exponentialRampToValueAtTime(45, time + 0.12);
    g.gain.setValueAtTime(gain, time);
    g.gain.exponentialRampToValueAtTime(0.001, time + 0.35);
    osc.connect(g);
    g.connect(this.master);
    osc.start(time);
    osc.stop(time + 0.4);
    this.nodes.push(osc, g);
  }

  snare(time, gain) {
    this.scheduleNoise(time, 0.12, gain * 0.7, 1800);
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.value = 180;
    g.gain.setValueAtTime(gain * 0.35, time);
    g.gain.exponentialRampToValueAtTime(0.001, time + 0.1);
    osc.connect(g);
    g.connect(this.master);
    osc.start(time);
    osc.stop(time + 0.12);
    this.nodes.push(osc, g);
  }

  hat(time, gain, open) {
    this.scheduleNoise(time, open ? 0.15 : 0.04, gain * 0.25, open ? 7000 : 9000);
  }

  getPattern(drumStyle, seed) {
    // 16-step patterns [kick, snare, hat] as arrays of 0/1
    const patterns = {
      pop:   { k: [1,0,0,0, 1,0,0,0, 1,0,0,0, 1,0,0,0], s: [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0], h: [1,0,1,0, 1,0,1,0, 1,0,1,0, 1,0,1,1] },
      rock:  { k: [1,0,0,0, 1,0,1,0, 1,0,0,0, 1,0,0,0], s: [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,1], h: [1,1,1,1, 1,1,1,1, 1,1,1,1, 1,1,1,1] },
      trap:  { k: [1,0,0,0, 0,0,1,0, 0,0,1,0, 0,0,0,0], s: [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0], h: [0,0,1,0, 0,0,1,1, 0,0,1,0, 0,1,1,0] },
      house: { k: [1,0,0,0, 1,0,0,0, 1,0,0,0, 1,0,0,0], s: [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0], h: [0,0,1,0, 0,0,1,0, 0,0,1,0, 0,0,1,0] },
      techno:{ k: [1,0,0,0, 1,0,0,0, 1,0,0,0, 1,0,0,0], s: [0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0], h: [1,0,1,0, 1,0,1,0, 1,0,1,0, 1,0,1,0] },
      edm:   { k: [1,0,0,0, 1,0,0,0, 1,0,0,0, 1,0,1,0], s: [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0], h: [1,1,1,1, 1,1,1,1, 1,1,1,1, 1,1,1,1] },
      lofi:  { k: [1,0,0,0, 0,0,1,0, 1,0,0,0, 0,0,0,0], s: [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0], h: [0,0,1,0, 0,0,0,1, 0,0,1,0, 0,0,1,0] },
      jazz:  { k: [1,0,0,0, 0,0,1,0, 0,0,0,0, 1,0,0,0], s: [0,0,0,0, 1,0,0,0, 0,0,1,0, 0,0,0,0], h: [1,0,1,1, 0,1,0,1, 1,0,1,0, 1,0,1,1] },
      groove:{ k: [1,0,0,1, 0,0,1,0, 1,0,0,0, 0,0,1,0], s: [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0], h: [1,0,1,0, 1,0,1,1, 1,0,1,0, 1,0,1,0] },
      soft:  { k: [1,0,0,0, 0,0,0,0, 1,0,0,0, 0,0,0,0], s: [0,0,0,0, 0,0,0,0, 0,0,0,0, 1,0,0,0], h: [0,0,1,0, 0,0,1,0, 0,0,1,0, 0,0,0,1] },
      epic:  { k: [1,0,0,0, 1,0,0,0, 1,0,1,0, 1,0,0,0], s: [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,1,0], h: [1,0,1,0, 1,0,1,0, 1,1,1,0, 1,0,1,1] },
      none:  { k: [0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0], s: [0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0], h: [0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0] }
    };
    const p = patterns[drumStyle] || patterns.pop;
    // seed-based variation: flip one hat
    const h = p.h.slice();
    h[seed % 16] = h[seed % 16] ? 0 : 1;
    return { k: p.k, s: p.s, h };
  }

  melodyDegrees(seed, complexity) {
    const lens = { minimal: 4, standard: 8, rich: 12 };
    const len = lens[complexity] || 8;
    const deg = [];
    let d = seed % 5;
    for (let i = 0; i < len; i++) {
      deg.push(d);
      d = (d + [0, 1, 2, -1, 3, -2, 1][(seed + i * 3) % 7] + 7) % 7;
    }
    return deg;
  }

  play(track) {
    this.ensure();
    this.buildChain(track);

    const ctx = this.ctx;
    const bpm = track.bpm || 120;
    const beat = 60 / bpm;
    const step = beat / 4; // 16th
    const bars = Math.max(4, Math.ceil((track.duration || 16) / (beat * 4)));
    const totalSteps = bars * 16;
    this.duration = totalSteps * step;
    this.startTime = ctx.currentTime + 0.08;
    this.playing = true;

    const gMeta = GENRES[track.genre] || {};
    const scale = SCALES[gMeta.scale || 'minor'] || SCALES.minor;
    const root = ROOTS[track.mood] || 57;
    const seed = hashStr(track.id || track.title || 'x');
    const drumStyle = gMeta.drum || 'pop';
    const pat = this.getPattern(drumStyle, seed);
    const inst = new Set(track.instruments || ['piano', 'drums', 'bass']);
    const complexity = track.complexity || 'standard';
    const melDeg = this.melodyDegrees(seed, complexity);

    // Chord progression (4 chords looping)
    const prog = [
      [0, 2, 4],
      [3, 5, 0],
      [4, 6, 1],
      [0, 2, 4]
    ];
    if ((seed % 3) === 1) prog[1] = [5, 0, 2];
    if ((seed % 3) === 2) prog[2] = [2, 4, 6];

    const t0 = this.startTime;
    const hasDrums = inst.has('drums') && drumStyle !== 'none';
    const hasBass = inst.has('bass') || inst.has('synth');
    const hasLead = inst.has('piano') || inst.has('synth') || inst.has('guitar') || inst.has('violin') || inst.has('santur') || inst.has('ney');
    const hasPad = inst.has('strings') || complexity === 'rich' || track.mood === 'Epic' || track.mood === 'Calm';

    for (let i = 0; i < totalSteps; i++) {
      const time = t0 + i * step;
      const bar = Math.floor(i / 16);
      const st = i % 16;
      const chordIdx = Math.floor(st / 4) % 4;
      const chord = prog[chordIdx];

      // Drums
      if (hasDrums) {
        if (pat.k[st]) this.kick(time, 0.9);
        if (pat.s[st]) this.snare(time, 0.55);
        if (pat.h[st]) this.hat(time, 0.35, st % 8 === 7);
      }

      // Bass on quarters / eighths
      if (hasBass && (st % 2 === 0)) {
        const deg = chord[0];
        const midi = root - 12 + scale[deg % scale.length];
        const wave = inst.has('synth') ? 'sawtooth' : 'triangle';
        this.scheduleNote(midiToFreq(midi), time, step * 1.6, wave, 0.22, { atk: 0.01, rel: 0.08 });
      }

      // Pad on bar start
      if (hasPad && st === 0) {
        chord.forEach((d, ci) => {
          const midi = root + scale[d % scale.length];
          this.scheduleNote(midiToFreq(midi), time, beat * 3.5, 'sine', 0.08, { atk: 0.4, rel: 0.8, detune: ci * 4 });
        });
      }

      // Melody
      if (hasLead && (st % 2 === 0)) {
        const mi = Math.floor(i / 2) % melDeg.length;
        const deg = melDeg[mi];
        const oct = (seed + i) % 5 === 0 ? 12 : 0;
        const midi = root + scale[deg % scale.length] + oct;
        let wave = 'triangle';
        if (inst.has('synth')) wave = 'square';
        if (inst.has('violin') || inst.has('ney')) wave = 'sine';
        if (inst.has('guitar') || inst.has('santur')) wave = 'triangle';
        const g = complexity === 'minimal' ? 0.12 : 0.16;
        this.scheduleNote(midiToFreq(midi), time, step * 1.8, wave, g, { atk: 0.02, rel: 0.12 });
      }
    }

    // Progress ticker
    if (this.timer) clearInterval(this.timer);
    this.timer = setInterval(() => {
      if (!this.playing || !this.ctx) return;
      const elapsed = this.ctx.currentTime - this.startTime;
      const pct = Math.min(1, Math.max(0, elapsed / this.duration));
      if (this.onProgress) this.onProgress(elapsed, this.duration, pct);
      if (elapsed >= this.duration) {
        this.playing = false;
        clearInterval(this.timer);
        this.timer = null;
        if (this.onProgress) this.onProgress(this.duration, this.duration, 1);
        if (this.onEnded) this.onEnded();
      }
    }, 50);

    return this.duration;
  }

  getCurrentTime() {
    if (!this.playing || !this.ctx) return 0;
    return Math.min(this.duration, Math.max(0, this.ctx.currentTime - this.startTime));
  }
}

/* ========== App State ========== */
let state = {
  selectedGenre: null,
  selectedSub: null,
  selectedMood: null,
  selectedInstruments: ['piano', 'drums', 'bass'],
  duration: 16,
  bpm: 120,
  energy: 'medium',
  complexity: 'standard',
  space: 'balanced',
  creations: [],
  currentTrack: null,
  isPlaying: false,
  engine: new ProceduralEngine(),
  menuTrackId: null,
  seeking: false
};

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

document.addEventListener('DOMContentLoaded', () => {
  loadTheme();
  loadCreations();
  renderGenres();
  renderMoods();
  renderInstruments();
  renderSamples();
  renderCreations();
  setupFilters();
  setupEvents();
  setupProgressUI();

  state.engine.onProgress = (cur, dur, pct) => {
    updateProgressUI(cur, dur, pct);
  };
  state.engine.onEnded = () => {
    state.isPlaying = false;
    updatePlayUI(false);
    updateProgressUI(state.engine.duration, state.engine.duration, 1);
  };
});

function loadTheme() {
  const art = localStorage.getItem('aethermusic_art') || 'classic';
  const mode = localStorage.getItem('aethermusic_mode');
  document.body.setAttribute('data-theme', art);
  if (mode === 'light') document.body.classList.add('light');
  const sel = $('#themeSelect');
  if (sel) sel.value = art;
  applyLogoColors(art);
}
function setArtTheme(name) {
  document.body.setAttribute('data-theme', name);
  localStorage.setItem('aethermusic_art', name);
  applyLogoColors(name);
}
function toggleLightDark() {
  document.body.classList.toggle('light');
  localStorage.setItem('aethermusic_mode', document.body.classList.contains('light') ? 'light' : 'dark');
}
function applyLogoColors(art) {
  const c = THEME_LOGO[art] || THEME_LOGO.classic;
  $('#logoStop1')?.setAttribute('stop-color', c[0]);
  $('#logoStop2')?.setAttribute('stop-color', c[1]);
}

function loadCreations() {
  try {
    const saved = localStorage.getItem('aethermusic_creations');
    let list = saved ? JSON.parse(saved) : [];
    list = list.map((t) => {
      t.procedural = true;
      delete t.audio;
      delete t.recipe;
      if (!t.duration || t.duration > 60) t.duration = 16;
      return t;
    });
    state.creations = list;
    saveCreations();
  } catch { state.creations = []; }
}
function saveCreations() {
  localStorage.setItem('aethermusic_creations', JSON.stringify(state.creations));
}

/* ========== Render ========== */
function renderGenres() {
  const grid = $('#genreGrid');
  if (!grid) return;
  grid.innerHTML = '';
  Object.keys(GENRES).forEach((g) => {
    const card = document.createElement('button');
    card.className = 'genre-card';
    card.type = 'button';
    card.dataset.genre = g;
    card.style.setProperty('--g-from', GENRES[g].color[0]);
    card.style.setProperty('--g-to', GENRES[g].color[1]);
    card.innerHTML = `<span>${g}</span>`;
    card.addEventListener('click', () => selectGenre(g));
    grid.appendChild(card);
  });
}
function selectGenre(genre) {
  state.selectedGenre = genre;
  state.selectedSub = null;
  $$('.genre-card').forEach((c) => c.classList.toggle('active', c.dataset.genre === genre));
  const group = $('#subgenreGroup');
  const chips = $('#subgenreChips');
  chips.innerHTML = '';
  GENRES[genre].subs.forEach((sub) => {
    const btn = document.createElement('button');
    btn.className = 'chip';
    btn.type = 'button';
    btn.textContent = sub;
    btn.dataset.sub = sub;
    btn.addEventListener('click', () => {
      state.selectedSub = sub;
      $$('#subgenreChips .chip').forEach((c) => c.classList.toggle('active', c.dataset.sub === sub));
    });
    chips.appendChild(btn);
  });
  group.style.display = 'flex';
  const bias = GENRES[genre].bpmBias || 120;
  if (Math.abs(state.bpm - bias) > 20) setBpm(bias);
}
function renderMoods() {
  const row = $('#moodChips');
  if (!row) return;
  MOODS.forEach((m) => {
    const btn = document.createElement('button');
    btn.className = 'chip';
    btn.type = 'button';
    btn.dataset.mood = m;
    btn.textContent = translateMood(m);
    btn.addEventListener('click', () => {
      state.selectedMood = m;
      $$('#moodChips .chip').forEach((c) => c.classList.toggle('active', c.dataset.mood === m));
    });
    row.appendChild(btn);
  });
}
function translateMood(m) {
  return { Happy: 'شاد', Sad: 'غمگین', Dark: 'تاریک', Energetic: 'پرانرژی', Romantic: 'رمانتیک', Epic: 'حماسی', Calm: 'آرام', Mysterious: 'مرموز' }[m] || m;
}
function renderInstruments() {
  const grid = $('#instrumentGrid');
  if (!grid) return;
  INSTRUMENTS.forEach((inst) => {
    const btn = document.createElement('button');
    btn.className = 'instrument-chip' + (state.selectedInstruments.includes(inst.id) ? ' active' : '');
    btn.type = 'button';
    btn.dataset.id = inst.id;
    btn.innerHTML = `<span class="inst-icon">${inst.icon}</span> ${inst.name}`;
    btn.addEventListener('click', () => {
      const idx = state.selectedInstruments.indexOf(inst.id);
      if (idx >= 0) { if (state.selectedInstruments.length > 1) state.selectedInstruments.splice(idx, 1); }
      else state.selectedInstruments.push(inst.id);
      btn.classList.toggle('active', state.selectedInstruments.includes(inst.id));
    });
    grid.appendChild(btn);
  });
}
function renderSamples() {
  const grid = $('#samplesGrid');
  if (!grid) return;
  grid.innerHTML = '';
  SAMPLE_TRACKS.forEach((t) => grid.appendChild(createTrackCard(t)));
}
function renderCreations() {
  const grid = $('#creationsGrid');
  const empty = $('#emptyCreations');
  if (!grid || !empty) return;
  const filtered = filterCreations();
  grid.innerHTML = '';
  if (!filtered.length) {
    empty.style.display = 'block';
    if (state.creations.length) {
      empty.querySelector('h3').textContent = 'نتیجه‌ای یافت نشد';
      empty.querySelector('p').textContent = 'فیلترها را تغییر دهید یا پاک کنید';
      empty.querySelector('button').style.display = 'none';
    } else {
      empty.querySelector('h3').textContent = 'هنوز موزیکی نساختی';
      empty.querySelector('p').textContent = 'از بخش ساخت موزیک شروع کن و اولین اثر خودت را خلق کن';
      empty.querySelector('button').style.display = 'inline-block';
    }
  } else {
    empty.style.display = 'none';
    filtered.forEach((t) => grid.appendChild(createTrackCard(t)));
  }
}
function filterCreations() {
  let list = [...state.creations];
  const q = ($('#searchInput')?.value || '').trim().toLowerCase();
  const g = $('#filterGenre')?.value || '';
  const m = $('#filterMood')?.value || '';
  const d = $('#filterDuration')?.value || '';
  const date = $('#filterDate')?.value || '';
  if (q) list = list.filter((t) => t.title.toLowerCase().includes(q));
  if (g) list = list.filter((t) => t.genre === g);
  if (m) list = list.filter((t) => t.mood === m);
  if (d === 'short') list = list.filter((t) => t.duration < 20);
  if (d === 'medium') list = list.filter((t) => t.duration >= 20 && t.duration <= 40);
  if (d === 'long') list = list.filter((t) => t.duration > 40);
  if (date) {
    const now = Date.now();
    list = list.filter((t) => {
      const diff = now - (t.createdAt || 0);
      if (date === 'today') return diff < 86400000;
      if (date === 'week') return diff < 604800000;
      if (date === 'month') return diff < 2592000000;
      return true;
    });
  }
  return list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
}
function createTrackCard(track) {
  const card = document.createElement('div');
  card.className = 'track-card' + (state.currentTrack?.id === track.id && state.isPlaying ? ' playing' : '');
  card.dataset.id = track.id;
  const colors = GENRES[track.genre]?.color || ['#7c3aed', '#06b6d4'];
  card.innerHTML = `
    <div class="track-header">
      <div class="track-cover" style="--c1:${colors[0]};--c2:${colors[1]}">${getGenreEmoji(track.genre)}</div>
      <div class="track-info">
        <div class="track-name">${escapeHtml(track.title)}</div>
        <div class="track-meta">
          <span>${toPersianDigits(track.bpm)} BPM</span>
          <span>•</span>
          <span>${formatDuration(track.duration)}</span>
          <span>•</span>
          <span>ساخته‌شده</span>
          ${track.isFavorite ? '<span>❤️</span>' : ''}
        </div>
      </div>
    </div>
    <div class="track-tags">
      <span class="tag genre">${track.genre}${track.sub ? ' · ' + track.sub : ''}</span>
      <span class="tag mood">${translateMood(track.mood)}</span>
    </div>
    <div class="track-actions">
      <button class="action-btn play-track" data-action="play" title="پخش">${state.currentTrack?.id === track.id && state.isPlaying ? '⏸️' : '▶️'}</button>
      <button class="action-btn fav ${track.isFavorite ? 'active' : ''}" data-action="favorite" title="علاقه‌مندی">${track.isFavorite ? '❤️' : '🤍'}</button>
      <button class="action-btn" data-action="more" title="بیشتر">⋯</button>
    </div>`;
  card.querySelectorAll('.action-btn').forEach((btn) => {
    btn.addEventListener('click', (e) => { e.stopPropagation(); handleTrackAction(btn.dataset.action, track, btn); });
  });
  card.addEventListener('click', () => playTrack(track));
  return card;
}
function getGenreEmoji(g) {
  return { Pop: '🎤', Rock: '🤘', 'Hip-Hop': '🎧', Rap: '🎙️', Electronic: '⚡', House: '🏠', Techno: '🤖', Jazz: '🎷', Blues: '🎸', Classical: '🎻', Ambient: '🌌', 'Lo-Fi': '☕', 'R&B': '💜', Soul: '🔥', Metal: '☠️', Cinematic: '🎬', 'پاپ فارسی': '🎤', 'سنتی': '🪕', 'فیوژن': '🌍' }[g] || '🎵';
}
function formatDuration(sec) {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return toPersianDigits(`${m}:${s.toString().padStart(2, '0')}`);
}
function escapeHtml(str) {
  const d = document.createElement('div');
  d.textContent = str || '';
  return d.innerHTML;
}
function setupFilters() {
  const genreSel = $('#filterGenre');
  if (!genreSel) return;
  Object.keys(GENRES).forEach((g) => {
    const opt = document.createElement('option');
    opt.value = g; opt.textContent = g;
    genreSel.appendChild(opt);
  });
  MOODS.forEach((m) => {
    const opt = document.createElement('option');
    opt.value = m; opt.textContent = translateMood(m);
    $('#filterMood').appendChild(opt);
  });
  ['searchInput', 'filterGenre', 'filterMood', 'filterDuration', 'filterDate'].forEach((id) => {
    $(`#${id}`)?.addEventListener('input', renderCreations);
    $(`#${id}`)?.addEventListener('change', renderCreations);
  });
  $('#clearFilters')?.addEventListener('click', () => {
    $('#searchInput').value = '';
    $('#filterGenre').value = '';
    $('#filterMood').value = '';
    $('#filterDuration').value = '';
    $('#filterDate').value = '';
    renderCreations();
  });
}
function setBpm(val) {
  state.bpm = val;
  if ($('#bpmSlider')) $('#bpmSlider').value = val;
  if ($('#bpmValue')) $('#bpmValue').textContent = toPersianDigits(val);
  $$('#tempoPresets .tempo-preset').forEach((p) => p.classList.toggle('active', +p.dataset.bpm === val));
}
function setupChipGroup(selector, stateKey) {
  $$(selector + ' .chip').forEach((chip) => {
    chip.addEventListener('click', () => {
      state[stateKey] = chip.dataset.value;
      $$(selector + ' .chip').forEach((c) => c.classList.toggle('active', c === chip));
    });
  });
}

/* ========== Progress UI ========== */
function setupProgressUI() {
  const track = $('#progressTrack');
  if (!track) return;
  const seek = (e) => {
    if (!state.currentTrack || !state.engine.duration) return;
    const rect = track.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    // Restart from approximate position by replaying (simple approach)
    // Full scrubbing mid-synthesis is complex; show visual feedback
    updateProgressUI(pct * state.engine.duration, state.engine.duration, pct);
  };
  track.addEventListener('click', (e) => {
    if (!state.isPlaying) return;
    // For procedural, restart is cleaner than mid-seek
    showToast('برای جابه‌جایی، پخش را از نو شروع کنید');
  });
}
function updateProgressUI(cur, dur, pct) {
  const fill = $('#progressFillBar');
  const thumb = $('#progressThumb');
  const ct = $('#currentTime');
  const tt = $('#totalTime');
  const p = Math.max(0, Math.min(100, (pct || 0) * 100));
  if (fill) fill.style.width = p + '%';
  if (thumb) thumb.style.left = p + '%';
  if (ct) ct.textContent = formatTime(cur || 0);
  if (tt) tt.textContent = formatTime(dur || 0);
}
function formatTime(sec) {
  if (!isFinite(sec) || sec < 0) return '۰:۰۰';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return toPersianDigits(`${m}:${s.toString().padStart(2, '0')}`);
}

function setupEvents() {
  $$('.nav-btn, [data-section]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const sec = btn.dataset.section;
      if (!sec) return;
      $$('.nav-btn').forEach((b) => b.classList.toggle('active', b.dataset.section === sec));
      $$('.section').forEach((s) => s.classList.remove('active'));
      $(`#${sec}Section`)?.classList.add('active');
      if (sec === 'creations') renderCreations();
    });
  });
  $('#bpmSlider')?.addEventListener('input', (e) => setBpm(+e.target.value));
  $$('#tempoPresets .tempo-preset').forEach((btn) => btn.addEventListener('click', () => setBpm(+btn.dataset.bpm)));
  // Duration chips map to procedural lengths
  const durMap = { 30: 12, 60: 16, 120: 24, 180: 32 };
  $$('#durationChips .chip').forEach((chip) => {
    chip.addEventListener('click', () => {
      const v = +chip.dataset.value;
      state.duration = durMap[v] || 16;
      $$('#durationChips .chip').forEach((c) => c.classList.toggle('active', c === chip));
    });
  });
  setupChipGroup('#energyChips', 'energy');
  setupChipGroup('#complexityChips', 'complexity');
  setupChipGroup('#spaceChips', 'space');
  $('#createBtn')?.addEventListener('click', createMusic);
  $('#themeToggle')?.addEventListener('click', toggleLightDark);
  $('#themeSelect')?.addEventListener('change', (e) => setArtTheme(e.target.value));
  $('#playPauseBtn')?.addEventListener('click', togglePlay);
  $('#closePlayer')?.addEventListener('click', closePlayer);
  $('#prevBtn')?.addEventListener('click', playPrev);
  $('#nextBtn')?.addEventListener('click', playNext);
  $('#volumeSlider')?.addEventListener('input', (e) => {
    if (state.engine.master) {
      const base = state.currentTrack?.energy === 'high' ? 0.55 : state.currentTrack?.energy === 'low' ? 0.35 : 0.45;
      state.engine.master.gain.value = base * (+e.target.value);
    }
  });
  $('#renameCancel')?.addEventListener('click', () => $('#renameModal')?.classList.remove('open'));
  $('#renameConfirm')?.addEventListener('click', confirmRename);
  document.addEventListener('click', () => $('#trackMenu')?.classList.remove('open'));
  $('#logoLink')?.addEventListener('click', (e) => {
    e.preventDefault();
    $$('.nav-btn').forEach((b) => b.classList.toggle('active', b.dataset.section === 'creator'));
    $$('.section').forEach((s) => s.classList.remove('active'));
    $('#creatorSection')?.classList.add('active');
  });
}

/* ========== Playback ========== */
function playTrack(track) {
  if (!track) return;
  state.currentTrack = track;
  const titleEl = $('#playerTitle');
  const subEl = $('#playerSubtitle');
  const cover = $('#coverVisual');
  if (titleEl) titleEl.textContent = track.title;
  if (subEl) subEl.textContent = `${track.genre}${track.sub ? ' · ' + track.sub : ''} · ${translateMood(track.mood)} · ${toPersianDigits(track.bpm)} BPM`;
  if (cover) {
    cover.textContent = getGenreEmoji(track.genre);
    const colors = GENRES[track.genre]?.color || ['#7c3aed', '#06b6d4'];
    cover.style.background = `linear-gradient(135deg, ${colors[0]}, ${colors[1]})`;
  }
  $('#playerBar')?.classList.add('visible');
  updateProgressUI(0, track.duration || 16, 0);

  try {
    const dur = state.engine.play(track);
    state.isPlaying = true;
    updatePlayUI(true);
    updateProgressUI(0, dur, 0);
  } catch (err) {
    console.error(err);
    showToast('خطا در پخش — تعامل کاربر لازم است', 'error');
    state.isPlaying = false;
    updatePlayUI(false);
  }
}
function togglePlay() {
  if (!state.currentTrack) return;
  if (state.isPlaying) {
    state.engine.stop();
    state.isPlaying = false;
    updatePlayUI(false);
  } else {
    playTrack(state.currentTrack);
  }
}
function closePlayer() {
  state.engine.stop();
  state.currentTrack = null;
  state.isPlaying = false;
  $('#playerBar')?.classList.remove('visible');
  updatePlayUI(false);
  updateProgressUI(0, 0, 0);
}
function updatePlayUI(playing) {
  const playIcon = $('#playPauseBtn .icon-play');
  const pauseIcon = $('#playPauseBtn .icon-pause');
  if (playIcon) playIcon.style.display = playing ? 'none' : 'block';
  if (pauseIcon) pauseIcon.style.display = playing ? 'block' : 'none';
  $$('.track-card').forEach((c) => {
    const isCur = state.currentTrack && c.dataset.id === state.currentTrack.id;
    c.classList.toggle('playing', isCur && playing);
    const playBtn = c.querySelector('[data-action="play"]');
    if (playBtn) playBtn.textContent = isCur && playing ? '⏸️' : '▶️';
  });
}
function getPlaylist() {
  const section = document.querySelector('.section.active')?.id;
  if (section === 'samplesSection') return SAMPLE_TRACKS;
  return state.creations.length ? state.creations : SAMPLE_TRACKS;
}
function playNext() {
  const list = getPlaylist();
  if (!list.length || !state.currentTrack) return;
  const idx = list.findIndex((t) => t.id === state.currentTrack.id);
  playTrack(list[(idx + 1) % list.length]);
}
function playPrev() {
  const list = getPlaylist();
  if (!list.length || !state.currentTrack) return;
  const idx = list.findIndex((t) => t.id === state.currentTrack.id);
  playTrack(list[(idx - 1 + list.length) % list.length]);
}

function handleTrackAction(action, track, btn) {
  if (action === 'play') {
    if (state.currentTrack?.id === track.id && state.isPlaying) togglePlay();
    else playTrack(track);
  } else if (action === 'favorite') {
    if (track.isSample) {
      const copy = { ...track, id: 'c_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7), isSample: false, isFavorite: true, createdAt: Date.now(), procedural: true };
      state.creations.unshift(copy);
      saveCreations();
      showToast('به علاقه‌مندی‌ها اضافه شد', 'success');
    } else {
      const idx = state.creations.findIndex((t) => t.id === track.id);
      if (idx >= 0) {
        state.creations[idx].isFavorite = !state.creations[idx].isFavorite;
        saveCreations();
        showToast(state.creations[idx].isFavorite ? 'علاقه‌مندی شد' : 'از علاقه‌مندی حذف شد');
      }
    }
    renderCreations();
    renderSamples();
  } else if (action === 'more') {
    state.menuTrackId = track.id;
    const menu = $('#trackMenu');
    const rect = btn.getBoundingClientRect();
    menu.style.top = Math.min(rect.bottom + 4, window.innerHeight - 220) + 'px';
    menu.style.left = Math.max(8, rect.left - 120) + 'px';
    menu.classList.add('open');
    menu.querySelectorAll('button').forEach((b) => {
      b.onclick = (e) => {
        e.stopPropagation();
        menu.classList.remove('open');
        const a = b.dataset.action;
        if (a === 'rename') openRename(track);
        else if (a === 'duplicate') duplicateTrack(track);
        else if (a === 'favorite') handleTrackAction('favorite', track, btn);
        else if (a === 'delete') deleteTrack(track);
        else if (a === 'download') showToast('دانلود برای قطعات ساخته‌شده روی مرورگر در نسخه بعدی', 'error');
      };
    });
  }
}
function openRename(track) {
  if (track.isSample) { showToast('نمونه‌ها قابل تغییر نام نیستند', 'error'); return; }
  state.menuTrackId = track.id;
  $('#renameInput').value = track.title;
  $('#renameModal').classList.add('open');
  setTimeout(() => $('#renameInput').focus(), 80);
}
function confirmRename() {
  const name = $('#renameInput').value.trim();
  if (!name) return;
  const idx = state.creations.findIndex((t) => t.id === state.menuTrackId);
  if (idx >= 0) {
    state.creations[idx].title = name;
    saveCreations();
    if (state.currentTrack?.id === state.menuTrackId) {
      state.currentTrack.title = name;
      $('#playerTitle').textContent = name;
    }
    renderCreations();
    showToast('نام تغییر کرد');
  }
  $('#renameModal').classList.remove('open');
}
function duplicateTrack(track) {
  const copy = { ...track, id: 'c_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7), title: track.title + ' (کپی)', isSample: false, createdAt: Date.now(), isFavorite: false, procedural: true };
  state.creations.unshift(copy);
  saveCreations();
  renderCreations();
  showToast('کپی ساخته شد', 'success');
}
function deleteTrack(track) {
  if (track.isSample) { showToast('نمونه‌ها قابل حذف نیستند', 'error'); return; }
  if (!confirm(`حذف «${track.title}»؟`)) return;
  state.creations = state.creations.filter((t) => t.id !== track.id);
  saveCreations();
  if (state.currentTrack?.id === track.id) closePlayer();
  renderCreations();
  showToast('حذف شد');
}

function generateTitle(genre, mood, prompt) {
  if (prompt && prompt.length >= 4) {
    const words = prompt.replace(/[،,.]/g, ' ').trim().split(/\s+/).filter(Boolean);
    if (words.length <= 5) return prompt.slice(0, 42);
    return words.slice(0, 4).join(' ') + '…';
  }
  const prefixes = {
    Happy: ['آفتاب', 'رقص', 'شادمانی', 'طلوع'], Sad: ['باران', 'خاطره', 'غروب', 'تنهایی'],
    Dark: ['سایه', 'شب', 'مه', 'عمیق'], Energetic: ['آتش', 'سرعت', 'نبض', 'انفجار'],
    Romantic: ['عشق', 'نگاه', 'قلب', 'ستاره'], Epic: ['حماسه', 'فتح', 'قهرمان', 'افسانه'],
    Calm: ['آرامش', 'دریا', 'مهتاب', 'نسیم'], Mysterious: ['راز', 'مه', 'ناشناخته', 'پژواک']
  };
  const p = prefixes[mood] || ['موزیک'];
  return `${p[Math.floor(Math.random() * p.length)]} ${genre}`;
}

async function createMusic() {
  if (!state.selectedGenre) { showToast('لطفاً یک ژانر انتخاب کنید', 'error'); return; }
  if (!state.selectedMood) { showToast('لطفاً حال‌وهوا را انتخاب کنید', 'error'); return; }

  const prompt = ($('#promptInput')?.value || '').trim();
  const btn = $('#createBtn');
  btn.disabled = true;
  const modal = $('#generateModal');
  modal.classList.add('open');
  const status = $('#generateStatus');
  const fill = $('#progressFill');

  const steps = [
    { text: 'تحلیل ایده و سبک...', pct: 15 },
    { text: `ساخت الگوی ریتم (${GENRES[state.selectedGenre].drum})...`, pct: 35 },
    { text: `تولید ملودی در گام ${GENRES[state.selectedGenre].scale}...`, pct: 55 },
    { text: 'لایه‌بندی سازها...', pct: 75 },
    { text: 'میکس نهایی...', pct: 92 },
    { text: 'آماده شد!', pct: 100 }
  ];
  for (const s of steps) {
    if (status) status.textContent = s.text;
    if (fill) fill.style.width = s.pct + '%';
    await sleep(400 + Math.random() * 250);
  }

  const track = {
    id: 'c_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
    title: generateTitle(state.selectedGenre, state.selectedMood, prompt),
    genre: state.selectedGenre,
    sub: state.selectedSub || GENRES[state.selectedGenre].subs[0],
    mood: state.selectedMood,
    duration: state.duration || 16,
    bpm: state.bpm,
    energy: state.energy,
    complexity: state.complexity,
    space: state.space,
    instruments: [...state.selectedInstruments],
    vocalType: $('#vocalType')?.value || 'none',
    vocalLang: $('#vocalLang')?.value || 'none',
    prompt,
    isFavorite: false,
    createdAt: Date.now(),
    isSample: false,
    procedural: true
  };

  state.creations.unshift(track);
  saveCreations();

  await sleep(200);
  modal.classList.remove('open');
  if (fill) fill.style.width = '0%';
  btn.disabled = false;

  showToast('موزیک جدید ساخته شد — در حال پخش 🎵', 'success');
  $$('.nav-btn').forEach((b) => b.classList.toggle('active', b.dataset.section === 'creations'));
  $$('.section').forEach((s) => s.classList.remove('active'));
  $('#creationsSection')?.classList.add('active');
  renderCreations();
  setTimeout(() => playTrack(track), 120);
}

function showToast(msg, type = '') {
  const t = $('#toast');
  if (!t) return;
  t.textContent = msg;
  t.className = 'toast show' + (type ? ' ' + type : '');
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.remove('show'), 3000);
}
function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }
