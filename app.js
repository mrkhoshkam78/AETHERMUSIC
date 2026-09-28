/* ========== AetherMusic v2.1 ==========
   - Web Audio processing so each creation SOUNDS different
   - 3 real art directions (Classic / Nocturne / Prism brutalist)
   - Robust local playback
*/

const GENRES = {
  'پاپ فارسی': { key: 'PersianPop', subs: ['پاپ مدرن', 'پاپ کلاسیک', 'پاپ الکترونیک', 'پاپ عاشقانه'], color: ['#f472b6', '#c084fc'], bpmBias: 110, character: 'bright' },
  'سنتی': { key: 'Traditional', subs: ['دستگاهی', 'محلی', 'تلفیقی سنتی', 'تصنیف'], color: ['#f59e0b', '#d97706'], bpmBias: 80, character: 'warm' },
  'فیوژن': { key: 'Fusion', subs: ['شرق و غرب', 'جز فیوژن', 'ورلد فیوژن', 'الکترونیک سنتی'], color: ['#2dd4bf', '#14b8a6'], bpmBias: 100, character: 'wide' },
  Pop: { key: 'Pop', subs: ['Dance Pop', 'Indie Pop', 'Synth Pop', 'K-Pop', 'Electropop'], color: ['#f472b6', '#c084fc'], bpmBias: 120, character: 'bright' },
  Rock: { key: 'Rock', subs: ['Alternative', 'Indie Rock', 'Hard Rock', 'Classic Rock', 'Punk'], color: ['#f87171', '#fb923c'], bpmBias: 130, character: 'aggressive' },
  'Hip-Hop': { key: 'Hip-Hop', subs: ['Trap', 'Boom Bap', 'Cloud Rap', 'Old School', 'Drill'], color: ['#a78bfa', '#818cf8'], bpmBias: 140, character: 'punchy' },
  Rap: { key: 'Rap', subs: ['Melodic Rap', 'Conscious', 'Gangsta', 'Freestyle', 'Trap Rap'], color: ['#c084fc', '#e879f9'], bpmBias: 95, character: 'punchy' },
  Electronic: { key: 'Electronic', subs: ['EDM', 'Synthwave', 'Future Bass', 'Dubstep', 'Trance'], color: ['#22d3ee', '#67e8f9'], bpmBias: 128, character: 'bright' },
  House: { key: 'House', subs: ['Deep House', 'Tech House', 'Progressive', 'Tropical', 'Afro House'], color: ['#34d399', '#2dd4bf'], bpmBias: 122, character: 'rhythmic' },
  Techno: { key: 'Techno', subs: ['Minimal', 'Industrial', 'Detroit', 'Hard Techno', 'Ambient Techno'], color: ['#60a5fa', '#818cf8'], bpmBias: 135, character: 'rhythmic' },
  Jazz: { key: 'Jazz', subs: ['Smooth Jazz', 'Bebop', 'Fusion', 'Cool Jazz', 'Nu Jazz'], color: ['#fbbf24', '#f59e0b'], bpmBias: 90, character: 'warm' },
  Blues: { key: 'Blues', subs: ['Delta Blues', 'Chicago Blues', 'Electric Blues', 'Soul Blues'], color: ['#94a3b8', '#64748b'], bpmBias: 85, character: 'warm' },
  Classical: { key: 'Classical', subs: ['Baroque', 'Romantic', 'Modern Classical', 'Chamber', 'Orchestral'], color: ['#e2e8f0', '#94a3b8'], bpmBias: 72, character: 'wide' },
  Ambient: { key: 'Ambient', subs: ['Dark Ambient', 'Space Ambient', 'Drone', 'New Age', 'Atmospheric'], color: ['#67e8f9', '#a5b4fc'], bpmBias: 70, character: 'wide' },
  'Lo-Fi': { key: 'Lo-Fi', subs: ['Lo-Fi Hip-Hop', 'Chillhop', 'Study Beats', 'Jazz Lo-Fi', 'Vinyl'], color: ['#fdba74', '#fbbf24'], bpmBias: 85, character: 'warm' },
  'R&B': { key: 'R&B', subs: ['Contemporary R&B', 'Neo-Soul', 'Quiet Storm', 'Alternative R&B'], color: ['#f9a8d4', '#e879f9'], bpmBias: 95, character: 'warm' },
  Soul: { key: 'Soul', subs: ['Classic Soul', 'Northern Soul', 'Psychedelic Soul', 'Modern Soul'], color: ['#fca5a5', '#fb7185'], bpmBias: 100, character: 'warm' },
  Metal: { key: 'Metal', subs: ['Heavy Metal', 'Metalcore', 'Doom', 'Progressive Metal', 'Thrash'], color: ['#78716c', '#a8a29e'], bpmBias: 150, character: 'aggressive' },
  Cinematic: { key: 'Cinematic', subs: ['Epic Trailer', 'Emotional Score', 'Action', 'Fantasy', 'Suspense'], color: ['#c4b5fd', '#a78bfa'], bpmBias: 110, character: 'wide' }
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

/* Base stems — each creation applies unique processing recipe */
const AUDIO_LIB = [
  { src: 'audio/track1.mp3', baseBpm: 128, energy: 0.72, tags: ['bright', 'rhythmic', 'electronic'] },
  { src: 'audio/track2.mp3', baseBpm: 85, energy: 0.32, tags: ['warm', 'calm', 'lofi'] },
  { src: 'audio/track3.mp3', baseBpm: 110, energy: 0.55, tags: ['rhythmic', 'electronic', 'mid'] }
];

const SAMPLE_TRACKS = [
  { id: 's1', title: 'سپیده‌دم دیجیتال', genre: 'Electronic', sub: 'Synthwave', mood: 'Energetic', duration: 180, bpm: 128, instruments: ['synth', 'drums', 'bass'], audio: 'audio/track1.mp3', energy: 'high', complexity: 'standard', space: 'wide', isSample: true, recipe: null },
  { id: 's2', title: 'آرامش نیمه‌شب', genre: 'Lo-Fi', sub: 'Chillhop', mood: 'Calm', duration: 150, bpm: 85, instruments: ['piano', 'drums', 'bass'], audio: 'audio/track2.mp3', energy: 'low', complexity: 'minimal', space: 'intimate', isSample: true, recipe: null },
  { id: 's3', title: 'حماسه‌ی ستارگان', genre: 'Cinematic', sub: 'Epic Trailer', mood: 'Epic', duration: 180, bpm: 110, instruments: ['strings', 'violin', 'drums'], audio: 'audio/track1.mp3', energy: 'high', complexity: 'rich', space: 'wide', isSample: true, recipe: null },
  { id: 's4', title: 'نبض شهر', genre: 'Hip-Hop', sub: 'Trap', mood: 'Dark', duration: 150, bpm: 140, instruments: ['synth', 'drums', 'bass'], audio: 'audio/track3.mp3', energy: 'high', complexity: 'standard', space: 'balanced', isSample: true, recipe: null },
  { id: 's5', title: 'عشق در باران', genre: 'R&B', sub: 'Contemporary R&B', mood: 'Romantic', duration: 180, bpm: 95, instruments: ['piano', 'guitar', 'bass'], audio: 'audio/track2.mp3', energy: 'low', complexity: 'standard', space: 'intimate', isSample: true, recipe: null },
  { id: 's6', title: 'رقص در تاریکی', genre: 'House', sub: 'Deep House', mood: 'Mysterious', duration: 150, bpm: 122, instruments: ['synth', 'drums', 'bass'], audio: 'audio/track3.mp3', energy: 'medium', complexity: 'standard', space: 'wide', isSample: true, recipe: null }
];

const THEME_LOGO = {
  classic: ['#a78bfa', '#22d3ee'],
  nocturne: ['#f59e0b', '#2dd4bf'],
  prism: ['#ec4899', '#a3e635']
};

function toPersianDigits(n) {
  return String(n).replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[d]);
}

let state = {
  selectedGenre: null,
  selectedSub: null,
  selectedMood: null,
  selectedInstruments: ['piano', 'drums', 'bass'],
  duration: 60,
  bpm: 120,
  energy: 'medium',
  complexity: 'standard',
  space: 'balanced',
  creations: [],
  currentTrack: null,
  isPlaying: false,
  audioEl: null,
  wavesurfer: null,
  menuTrackId: null,
  playToken: 0,
  // Web Audio graph
  audioCtx: null,
  sourceNode: null,
  filterNode: null,
  filterNode2: null,
  gainNode: null,
  panNode: null,
  delayNode: null,
  delayGain: null,
  compressor: null,
  graphReady: false
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
  initPlayer();
});

/* ========== Themes ========== */
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
  const colors = THEME_LOGO[art] || THEME_LOGO.classic;
  const s1 = $('#logoStop1');
  const s2 = $('#logoStop2');
  if (s1) s1.setAttribute('stop-color', colors[0]);
  if (s2) s2.setAttribute('stop-color', colors[1]);
}

/* ========== Data ========== */
function loadCreations() {
  try {
    const saved = localStorage.getItem('aethermusic_creations');
    let list = saved ? JSON.parse(saved) : [];
    list = list.map((t) => {
      if (!t.audio || String(t.audio).includes('http')) {
        t.audio = pickStem(t).src;
      }
      if (t.audio && !t.audio.startsWith('audio/') && !t.audio.startsWith('blob:')) {
        t.audio = 'audio/' + t.audio.replace(/^.*\//, '');
      }
      // Ensure every creation has a processing recipe
      if (!t.recipe) t.recipe = buildRecipe(t);
      return t;
    });
    state.creations = list;
    saveCreations();
  } catch {
    state.creations = [];
  }
}

function saveCreations() {
  localStorage.setItem('aethermusic_creations', JSON.stringify(state.creations));
}

/* ========== Composition recipe — unique sonic fingerprint ========== */
function buildRecipe(opts) {
  const genre = opts.genre || state.selectedGenre || 'Electronic';
  const mood = opts.mood || state.selectedMood || 'Calm';
  const energy = opts.energy || state.energy || 'medium';
  const space = opts.space || state.space || 'balanced';
  const complexity = opts.complexity || state.complexity || 'standard';
  const bpm = opts.bpm || state.bpm || 120;
  const gMeta = GENRES[genre] || {};
  const character = gMeta.character || 'bright';

  // Pick stem by character affinity
  const stem = pickStem({ mood, energy, bpm, character, genre });

  // Playback rate from BPM vs stem base (clamped for usability)
  const rate = Math.max(0.72, Math.min(1.35, bpm / (stem.baseBpm || 110)));

  // Filter frequency from mood + energy
  const moodFilter = {
    Happy: 4200, Sad: 1800, Dark: 1400, Energetic: 5500,
    Romantic: 2800, Epic: 4800, Calm: 1600, Mysterious: 2200
  };
  let filterFreq = moodFilter[mood] || 3000;
  if (energy === 'high') filterFreq *= 1.25;
  if (energy === 'low') filterFreq *= 0.7;
  if (character === 'aggressive') filterFreq = Math.max(filterFreq, 4000);
  if (character === 'warm') filterFreq = Math.min(filterFreq, 2800);

  // Highpass for punchy/aggressive
  let highpass = 40;
  if (character === 'punchy' || character === 'aggressive') highpass = 80;
  if (mood === 'Dark') highpass = 60;
  if (energy === 'low') highpass = 30;

  // Gain
  let gain = 0.85;
  if (energy === 'high') gain = 0.95;
  if (energy === 'low') gain = 0.7;

  // Delay / space
  let delayTime = 0.12;
  let delayFeedback = 0.12;
  if (space === 'wide') { delayTime = 0.28; delayFeedback = 0.22; }
  if (space === 'intimate') { delayTime = 0.06; delayFeedback = 0.05; }
  if (complexity === 'rich') delayFeedback += 0.06;
  if (complexity === 'minimal') delayFeedback *= 0.5;

  // Pan slight variation from genre hash
  const pan = ((hashStr(genre + mood) % 21) - 10) / 50; // -0.2 .. 0.2

  // Detune-ish via rate micro-variation
  const micro = 1 + ((hashStr(String(opts.id || opts.title || Date.now())) % 9) - 4) * 0.008;
  const finalRate = rate * micro;

  return {
    stem: stem.src,
    rate: +finalRate.toFixed(4),
    filterFreq: Math.round(filterFreq),
    highpass: Math.round(highpass),
    gain: +gain.toFixed(3),
    delayTime: +delayTime.toFixed(3),
    delayFeedback: +delayFeedback.toFixed(3),
    pan: +pan.toFixed(3),
    character,
    label: `${genre} · ${mood} · ${bpm}BPM · ${energy}`
  };
}

function hashStr(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function pickStem(opts = {}) {
  const mood = opts.mood || 'Calm';
  const energy = opts.energy || 'medium';
  const character = opts.character || '';
  const targetEnergy = {
    Happy: 0.7, Sad: 0.3, Dark: 0.45, Energetic: 0.9,
    Romantic: 0.4, Epic: 0.75, Calm: 0.25, Mysterious: 0.5
  }[mood] || 0.5;
  const boost = { low: -0.2, medium: 0, high: 0.25 }[energy] || 0;
  const target = Math.max(0.1, Math.min(1, targetEnergy + boost));

  const scored = AUDIO_LIB.map((a) => {
    let score = 1 - Math.abs(a.energy - target);
    if (character && a.tags.includes(character)) score += 0.35;
    if ((mood === 'Calm' || mood === 'Sad' || mood === 'Romantic') && a.tags.includes('calm')) score += 0.3;
    if ((mood === 'Energetic' || mood === 'Happy') && a.tags.includes('bright')) score += 0.3;
    if ((opts.bpm || 120) >= 125 && a.tags.includes('rhythmic')) score += 0.15;
    score += (hashStr((opts.genre || '') + a.src) % 10) * 0.02;
    return { a, score };
  });
  scored.sort((x, y) => y.score - x.score);
  return scored[0].a;
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
  const map = {
    Happy: 'شاد', Sad: 'غمگین', Dark: 'تاریک', Energetic: 'پرانرژی',
    Romantic: 'رمانتیک', Epic: 'حماسی', Calm: 'آرام', Mysterious: 'مرموز'
  };
  return map[m] || m;
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
      if (idx >= 0) {
        if (state.selectedInstruments.length > 1) state.selectedInstruments.splice(idx, 1);
      } else state.selectedInstruments.push(inst.id);
      btn.classList.toggle('active', state.selectedInstruments.includes(inst.id));
    });
    grid.appendChild(btn);
  });
}

function renderSamples() {
  const grid = $('#samplesGrid');
  if (!grid) return;
  grid.innerHTML = '';
  SAMPLE_TRACKS.forEach((t) => {
    if (!t.recipe) t.recipe = buildRecipe(t);
    grid.appendChild(createTrackCard(t));
  });
}

function renderCreations() {
  const grid = $('#creationsGrid');
  const empty = $('#emptyCreations');
  if (!grid || !empty) return;
  const filtered = filterCreations();
  grid.innerHTML = '';
  if (filtered.length === 0) {
    empty.style.display = 'block';
    if (state.creations.length > 0) {
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
  if (d === 'short') list = list.filter((t) => t.duration < 60);
  if (d === 'medium') list = list.filter((t) => t.duration >= 60 && t.duration <= 120);
  if (d === 'long') list = list.filter((t) => t.duration > 120);
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
  const recipeHint = track.recipe
    ? `${toPersianDigits(Math.round((track.recipe.rate || 1) * 100))}% سرعت · فیلتر ${toPersianDigits(track.recipe.filterFreq)}`
    : '';
  card.innerHTML = `
    <div class="track-header">
      <div class="track-cover" style="--c1:${colors[0]};--c2:${colors[1]}">${getGenreEmoji(track.genre)}</div>
      <div class="track-info">
        <div class="track-name">${escapeHtml(track.title)}</div>
        <div class="track-meta">
          <span>${toPersianDigits(track.bpm)} BPM</span>
          <span>•</span>
          <span>${formatDuration(track.duration)}</span>
          ${track.isFavorite ? '<span>❤️</span>' : ''}
        </div>
      </div>
    </div>
    <div class="track-tags">
      <span class="tag genre">${track.genre}${track.sub ? ' · ' + track.sub : ''}</span>
      <span class="tag mood">${translateMood(track.mood)}</span>
      ${recipeHint ? `<span class="tag" title="پردازش صوتی">${recipeHint}</span>` : ''}
    </div>
    <div class="track-actions">
      <button class="action-btn play-track" data-action="play" title="پخش">${state.currentTrack?.id === track.id && state.isPlaying ? '⏸️' : '▶️'}</button>
      <button class="action-btn fav ${track.isFavorite ? 'active' : ''}" data-action="favorite" title="علاقه‌مندی">${track.isFavorite ? '❤️' : '🤍'}</button>
      <button class="action-btn" data-action="download" title="دانلود">⬇️</button>
      <button class="action-btn" data-action="more" title="بیشتر">⋯</button>
    </div>
  `;
  card.querySelectorAll('.action-btn').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      handleTrackAction(btn.dataset.action, track, btn);
    });
  });
  card.addEventListener('click', () => playTrack(track));
  return card;
}

function getGenreEmoji(g) {
  const map = {
    Pop: '🎤', Rock: '🤘', 'Hip-Hop': '🎧', Rap: '🎙️', Electronic: '⚡',
    House: '🏠', Techno: '🤖', Jazz: '🎷', Blues: '🎸', Classical: '🎻',
    Ambient: '🌌', 'Lo-Fi': '☕', 'R&B': '💜', Soul: '🔥', Metal: '☠️', Cinematic: '🎬',
    'پاپ فارسی': '🎤', 'سنتی': '🪕', 'فیوژن': '🌍'
  };
  return map[g] || '🎵';
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
    opt.value = g;
    opt.textContent = g;
    genreSel.appendChild(opt);
  });
  const moodSel = $('#filterMood');
  MOODS.forEach((m) => {
    const opt = document.createElement('option');
    opt.value = m;
    opt.textContent = translateMood(m);
    moodSel.appendChild(opt);
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
  const slider = $('#bpmSlider');
  if (slider) slider.value = val;
  const label = $('#bpmValue');
  if (label) label.textContent = toPersianDigits(val);
  $$('#tempoPresets .tempo-preset').forEach((p) => {
    p.classList.toggle('active', +p.dataset.bpm === val);
  });
}

function setupChipGroup(selector, stateKey) {
  $$(selector + ' .chip').forEach((chip) => {
    chip.addEventListener('click', () => {
      state[stateKey] = chip.dataset.value;
      $$(selector + ' .chip').forEach((c) => c.classList.toggle('active', c === chip));
    });
  });
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
  $$('#tempoPresets .tempo-preset').forEach((btn) => {
    btn.addEventListener('click', () => setBpm(+btn.dataset.bpm));
  });
  $$('#durationChips .chip').forEach((chip) => {
    chip.addEventListener('click', () => {
      state.duration = +chip.dataset.value;
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
    const v = +e.target.value;
    if (state.gainNode) state.gainNode.gain.value = v * (state.currentTrack?.recipe?.gain || 0.85);
    else if (state.audioEl) state.audioEl.volume = v;
  });
  $('#volumeBtn')?.addEventListener('click', () => {
    const sl = $('#volumeSlider');
    if (!sl) return;
    if (+sl.value > 0) { sl.dataset.prev = sl.value; sl.value = 0; }
    else sl.value = sl.dataset.prev || 0.85;
    const v = +sl.value;
    if (state.gainNode) state.gainNode.gain.value = v * (state.currentTrack?.recipe?.gain || 0.85);
    else if (state.audioEl) state.audioEl.volume = v;
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

/* ========== Web Audio Player ========== */
function ensureAudioContext() {
  if (!state.audioCtx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    state.audioCtx = new AC();
  }
  if (state.audioCtx.state === 'suspended') {
    state.audioCtx.resume().catch(() => {});
  }
  return state.audioCtx;
}

function buildAudioGraph() {
  const ctx = ensureAudioContext();
  if (state.graphReady && state.sourceNode) return;

  // Tear down old
  try { state.sourceNode?.disconnect(); } catch (_) {}

  const el = state.audioEl;
  const source = ctx.createMediaElementSource(el);
  const highpass = ctx.createBiquadFilter();
  highpass.type = 'highpass';
  highpass.frequency.value = 40;
  highpass.Q.value = 0.7;

  const lowpass = ctx.createBiquadFilter();
  lowpass.type = 'lowpass';
  lowpass.frequency.value = 12000;
  lowpass.Q.value = 0.8;

  const delay = ctx.createDelay(1.0);
  delay.delayTime.value = 0.12;
  const delayGain = ctx.createGain();
  delayGain.gain.value = 0.12;

  const pan = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
  const gain = ctx.createGain();
  gain.gain.value = 0.85;

  const compressor = ctx.createDynamicsCompressor();
  compressor.threshold.value = -24;
  compressor.knee.value = 18;
  compressor.ratio.value = 3;
  compressor.attack.value = 0.01;
  compressor.release.value = 0.2;

  // source -> highpass -> lowpass -> gain -> compressor -> destination
  //                  \-> delay -> delayGain -> gain
  source.connect(highpass);
  highpass.connect(lowpass);
  lowpass.connect(gain);

  lowpass.connect(delay);
  delay.connect(delayGain);
  delayGain.connect(gain);

  if (pan) {
    gain.connect(pan);
    pan.connect(compressor);
  } else {
    gain.connect(compressor);
  }
  compressor.connect(ctx.destination);

  state.sourceNode = source;
  state.filterNode = lowpass;
  state.filterNode2 = highpass;
  state.delayNode = delay;
  state.delayGain = delayGain;
  state.panNode = pan;
  state.gainNode = gain;
  state.compressor = compressor;
  state.graphReady = true;
}

function applyRecipe(recipe) {
  if (!recipe || !state.graphReady) return;
  const ctx = state.audioCtx;
  const now = ctx.currentTime;
  try {
    state.filterNode.frequency.cancelScheduledValues(now);
    state.filterNode.frequency.setValueAtTime(recipe.filterFreq, now);
    state.filterNode2.frequency.setValueAtTime(recipe.highpass, now);
    state.delayNode.delayTime.setValueAtTime(recipe.delayTime, now);
    state.delayGain.gain.setValueAtTime(recipe.delayFeedback, now);
    if (state.panNode) state.panNode.pan.setValueAtTime(recipe.pan, now);
    const vol = +($('#volumeSlider')?.value || 0.85);
    state.gainNode.gain.setValueAtTime(vol * recipe.gain, now);
    if (state.audioEl) {
      state.audioEl.playbackRate = recipe.rate;
      state.audioEl.preservesPitch = true; // keep pitch more stable when rate changes
    }
  } catch (e) {
    console.warn('applyRecipe', e);
  }
}

function initPlayer() {
  state.audioEl = new Audio();
  state.audioEl.preload = 'auto';
  state.audioEl.volume = 1; // volume controlled by gain node
  // crossOrigin only if needed for remote CORS
  // state.audioEl.crossOrigin = 'anonymous'; // needed for Web Audio MediaElementSource on some hosts

  state.audioEl.addEventListener('play', () => {
    state.isPlaying = true;
    updatePlayUI(true);
  });
  state.audioEl.addEventListener('pause', () => {
    state.isPlaying = false;
    updatePlayUI(false);
  });
  state.audioEl.addEventListener('ended', () => {
    state.isPlaying = false;
    updatePlayUI(false);
  });
  state.audioEl.addEventListener('timeupdate', () => {
    const cur = state.audioEl.currentTime || 0;
    const dur = state.audioEl.duration || 0;
    const ct = $('#currentTime');
    const tt = $('#totalTime');
    if (ct) ct.textContent = formatTime(cur);
    if (tt && dur && isFinite(dur)) tt.textContent = formatTime(dur);
  });
  state.audioEl.addEventListener('error', () => {
    console.error('Audio error', state.audioEl.error);
    showToast('خطا در بارگذاری فایل صوتی', 'error');
    state.isPlaying = false;
    updatePlayUI(false);
  });

  try {
    if (typeof WaveSurfer !== 'undefined' && $('#waveform')) {
      state.wavesurfer = WaveSurfer.create({
        container: '#waveform',
        waveColor: 'rgba(167, 139, 250, 0.35)',
        progressColor: 'rgba(34, 211, 238, 0.9)',
        cursorColor: '#f1f0f5',
        barWidth: 2,
        barGap: 2,
        barRadius: 2,
        height: 48,
        normalize: true,
        backend: 'MediaElement',
        media: state.audioEl,
        interact: true
      });
    }
  } catch (e) {
    state.wavesurfer = null;
  }
}

function formatTime(sec) {
  if (!isFinite(sec) || sec < 0) return '۰:۰۰';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return toPersianDigits(`${m}:${s.toString().padStart(2, '0')}`);
}

function updatePlayUI(playing) {
  const playIcon = $('#playPauseBtn .icon-play');
  const pauseIcon = $('#playPauseBtn .icon-pause');
  if (playIcon) playIcon.style.display = playing ? 'none' : 'block';
  if (pauseIcon) pauseIcon.style.display = playing ? 'block' : 'none';
  $$('.track-card').forEach((c) => {
    const id = c.dataset.id;
    const isCur = state.currentTrack && id === state.currentTrack.id;
    c.classList.toggle('playing', isCur && playing);
    const playBtn = c.querySelector('[data-action="play"]');
    if (playBtn) playBtn.textContent = isCur && playing ? '⏸️' : '▶️';
  });
}

function togglePlay() {
  if (!state.currentTrack || !state.audioEl) return;
  ensureAudioContext();
  if (state.isPlaying) state.audioEl.pause();
  else state.audioEl.play().catch((err) => {
    console.error(err);
    showToast('پخش ممکن نشد', 'error');
  });
}

function closePlayer() {
  if (state.audioEl) {
    state.audioEl.pause();
    state.audioEl.removeAttribute('src');
    try { state.audioEl.load(); } catch (_) {}
  }
  state.currentTrack = null;
  state.isPlaying = false;
  $('#playerBar')?.classList.remove('visible');
  updatePlayUI(false);
}

function resolveAudioUrl(path) {
  if (!path) return null;
  if (path.startsWith('http') || path.startsWith('blob:') || path.startsWith('data:')) return path;
  try { return new URL(path, window.location.href).href; }
  catch { return path; }
}

async function playTrack(track) {
  if (!track) return;
  if (!track.recipe) track.recipe = buildRecipe(track);
  const recipe = track.recipe;
  const audioPath = recipe.stem || track.audio;
  if (!audioPath) {
    showToast('فایل صوتی موجود نیست', 'error');
    return;
  }

  const token = ++state.playToken;
  state.currentTrack = track;

  const titleEl = $('#playerTitle');
  const subEl = $('#playerSubtitle');
  const cover = $('#coverVisual');
  if (titleEl) titleEl.textContent = track.title;
  if (subEl) {
    subEl.textContent = `${track.genre}${track.sub ? ' · ' + track.sub : ''} · ${translateMood(track.mood)} · ${toPersianDigits(Math.round(recipe.rate * 100))}٪`;
  }
  if (cover) {
    cover.textContent = getGenreEmoji(track.genre);
    const colors = GENRES[track.genre]?.color || ['#7c3aed', '#06b6d4'];
    cover.style.background = `linear-gradient(135deg, ${colors[0]}, ${colors[1]})`;
  }
  $('#playerBar')?.classList.add('visible');

  ensureAudioContext();
  try { buildAudioGraph(); } catch (e) {
    console.warn('graph build', e);
    // Fallback: plain element playback without graph
    state.graphReady = false;
  }

  const url = resolveAudioUrl(audioPath);
  const audio = state.audioEl;

  try {
    audio.pause();
    // Reset rate before load
    audio.playbackRate = 1;
    audio.src = url;
    audio.load();

    await new Promise((resolve, reject) => {
      let done = false;
      const finish = (fn) => (ev) => {
        if (done) return;
        done = true;
        cleanup();
        fn(ev);
      };
      const cleanup = () => {
        audio.removeEventListener('canplaythrough', onReady);
        audio.removeEventListener('canplay', onReady);
        audio.removeEventListener('error', onErr);
      };
      const onReady = finish(() => resolve());
      const onErr = finish(() => reject(audio.error || new Error('load failed')));
      audio.addEventListener('canplaythrough', onReady);
      audio.addEventListener('canplay', onReady);
      audio.addEventListener('error', onErr);
      setTimeout(() => {
        if (!done && audio.readyState >= 2) {
          done = true;
          cleanup();
          resolve();
        }
      }, 5000);
    });

    if (token !== state.playToken) return;

    applyRecipe(recipe);
    await audio.play();
    state.isPlaying = true;
    updatePlayUI(true);
  } catch (err) {
    console.error('playTrack failed', err, url, recipe);
    if (token === state.playToken) {
      // Try fallback without web audio constraints
      try {
        audio.crossOrigin = null;
        audio.src = url;
        audio.playbackRate = recipe.rate || 1;
        await audio.play();
        state.isPlaying = true;
        updatePlayUI(true);
        return;
      } catch (e2) {
        console.error(e2);
      }
      showToast('خطا در پخش — با سرور محلی باز کنید', 'error');
      state.isPlaying = false;
      updatePlayUI(false);
    }
  }
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
  const next = list[(idx + 1) % list.length];
  if (next) playTrack(next);
}

function playPrev() {
  const list = getPlaylist();
  if (!list.length || !state.currentTrack) return;
  const idx = list.findIndex((t) => t.id === state.currentTrack.id);
  const prev = list[(idx - 1 + list.length) % list.length];
  if (prev) playTrack(prev);
}

/* ========== Actions ========== */
function handleTrackAction(action, track, btn) {
  if (action === 'play') {
    if (state.currentTrack?.id === track.id && state.isPlaying) state.audioEl.pause();
    else playTrack(track);
  } else if (action === 'favorite') {
    if (track.isSample) {
      const copy = { ...track, id: 'c_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7), isSample: false, isFavorite: true, createdAt: Date.now(), recipe: track.recipe || buildRecipe(track) };
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
  } else if (action === 'download') downloadTrack(track);
  else if (action === 'more') {
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
        else if (a === 'download') downloadTrack(track);
        else if (a === 'duplicate') duplicateTrack(track);
        else if (a === 'favorite') handleTrackAction('favorite', track, btn);
        else if (a === 'delete') deleteTrack(track);
      };
    });
  }
}

function openRename(track) {
  if (track.isSample) { showToast('نمونه‌های آماده قابل تغییر نام نیستند', 'error'); return; }
  state.menuTrackId = track.id;
  $('#renameInput').value = track.title;
  $('#renameModal').classList.add('open');
  setTimeout(() => $('#renameInput').focus(), 100);
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

function downloadTrack(track) {
  showToast('در حال آماده‌سازی دانلود...');
  const a = document.createElement('a');
  a.href = resolveAudioUrl(track.recipe?.stem || track.audio);
  a.download = `${(track.title || 'track').replace(/[^\w\s\u0600-\u06FF-]/g, '')}.mp3`;
  a.target = '_blank';
  document.body.appendChild(a);
  a.click();
  a.remove();
  showToast('دانلود شروع شد ⬇️', 'success');
}

function duplicateTrack(track) {
  const copy = {
    ...track,
    id: 'c_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
    title: track.title + ' (کپی)',
    isSample: false,
    createdAt: Date.now(),
    isFavorite: false,
    recipe: track.recipe ? { ...track.recipe } : buildRecipe(track)
  };
  state.creations.unshift(copy);
  saveCreations();
  renderCreations();
  showToast('کپی ساخته شد', 'success');
  $$('.nav-btn').forEach((b) => b.classList.toggle('active', b.dataset.section === 'creations'));
  $$('.section').forEach((s) => s.classList.remove('active'));
  $('#creationsSection').classList.add('active');
}

function deleteTrack(track) {
  if (track.isSample) { showToast('نمونه‌های آماده قابل حذف نیستند', 'error'); return; }
  if (!confirm(`آیا از حذف «${track.title}» مطمئن هستید؟`)) return;
  state.creations = state.creations.filter((t) => t.id !== track.id);
  saveCreations();
  if (state.currentTrack?.id === track.id) closePlayer();
  renderCreations();
  showToast('موزیک حذف شد');
}

/* ========== Create ========== */
function generateTitle(genre, mood, prompt) {
  if (prompt && prompt.length >= 4) {
    const cleaned = prompt.replace(/[،,.]/g, ' ').trim();
    const words = cleaned.split(/\s+/).filter(Boolean);
    if (words.length <= 5) return cleaned.slice(0, 42);
    return words.slice(0, 4).join(' ') + '…';
  }
  const prefixes = {
    Happy: ['آفتاب', 'رقص', 'شادمانی', 'طلوع'],
    Sad: ['باران', 'خاطره', 'غروب', 'تنهایی'],
    Dark: ['سایه', 'شب', 'مه', 'عمیق'],
    Energetic: ['آتش', 'سرعت', 'نبض', 'انفجار'],
    Romantic: ['عشق', 'نگاه', 'قلب', 'ستاره'],
    Epic: ['حماسه', 'فتح', 'قهرمان', 'افسانه'],
    Calm: ['آرامش', 'دریا', 'مهتاب', 'نسیم'],
    Mysterious: ['راز', 'مه', 'ناشناخته', 'پژواک']
  };
  const p = prefixes[mood] || ['موزیک'];
  return `${p[Math.floor(Math.random() * p.length)]} ${genre}`;
}

function buildCompositionSteps(genre, mood, energy, complexity) {
  const steps = [
    { text: 'تحلیل ایده و سبک...', pct: 12 },
    { text: `انتخاب ساختار هارمونیک (${genre})...`, pct: 26 },
    { text: `تولید ملودی با حال‌وهوای ${translateMood(mood)}...`, pct: 42 },
    { text: 'لایه‌بندی سازها و ریتم...', pct: 58 }
  ];
  if (complexity === 'rich') steps.push({ text: 'افزودن لایه‌های ارکسترال...', pct: 74 });
  else if (complexity === 'minimal') steps.push({ text: 'تنظیم مینیمال...', pct: 74 });
  else steps.push({ text: 'بالانس لایه‌ها...', pct: 74 });
  steps.push({ text: energy === 'high' ? 'تقویت دینامیک...' : 'میکس و مسترینگ...', pct: 90 });
  steps.push({ text: 'آماده شد!', pct: 100 });
  return steps;
}

async function createMusic() {
  const prompt = ($('#promptInput')?.value || '').trim();
  if (!state.selectedGenre) { showToast('لطفاً یک ژانر انتخاب کنید', 'error'); return; }
  if (!state.selectedMood) { showToast('لطفاً حال‌وهوا را انتخاب کنید', 'error'); return; }

  const btn = $('#createBtn');
  btn.disabled = true;
  const modal = $('#generateModal');
  modal.classList.add('open');
  const status = $('#generateStatus');
  const fill = $('#progressFill');

  const steps = buildCompositionSteps(state.selectedGenre, state.selectedMood, state.energy, state.complexity);
  for (const step of steps) {
    if (status) status.textContent = step.text;
    if (fill) fill.style.width = step.pct + '%';
    await sleep(450 + Math.random() * 280);
  }

  const id = 'c_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
  const draft = {
    id,
    title: generateTitle(state.selectedGenre, state.selectedMood, prompt),
    genre: state.selectedGenre,
    sub: state.selectedSub || GENRES[state.selectedGenre].subs[0],
    mood: state.selectedMood,
    duration: state.duration,
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
    isSample: false
  };

  // Unique sonic recipe from ALL parameters
  draft.recipe = buildRecipe(draft);
  draft.audio = draft.recipe.stem;

  state.creations.unshift(draft);
  saveCreations();

  await sleep(250);
  modal.classList.remove('open');
  if (fill) fill.style.width = '0%';
  btn.disabled = false;

  showToast(`ساخته شد · سرعت ${toPersianDigits(Math.round(draft.recipe.rate * 100))}٪ · فیلتر ${toPersianDigits(draft.recipe.filterFreq)}Hz`, 'success');

  $$('.nav-btn').forEach((b) => b.classList.toggle('active', b.dataset.section === 'creations'));
  $$('.section').forEach((s) => s.classList.remove('active'));
  $('#creationsSection')?.classList.add('active');
  renderCreations();
  setTimeout(() => playTrack(draft), 180);
}

function showToast(msg, type = '') {
  const t = $('#toast');
  if (!t) return;
  t.textContent = msg;
  t.className = 'toast show' + (type ? ' ' + type : '');
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.remove('show'), 3200);
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}
