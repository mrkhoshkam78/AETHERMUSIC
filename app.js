/* ========== AetherMusic App ========== */

const GENRES = {
  Pop: { subs: ['Dance Pop', 'Indie Pop', 'Synth Pop', 'K-Pop', 'Electropop'], color: ['#f472b6', '#c084fc'] },
  Rock: { subs: ['Alternative', 'Indie Rock', 'Hard Rock', 'Classic Rock', 'Punk'], color: ['#f87171', '#fb923c'] },
  'Hip-Hop': { subs: ['Trap', 'Boom Bap', 'Cloud Rap', 'Old School', 'Drill'], color: ['#a78bfa', '#818cf8'] },
  Rap: { subs: ['Melodic Rap', 'Conscious', 'Gangsta', 'Freestyle', 'Trap Rap'], color: ['#c084fc', '#e879f9'] },
  Electronic: { subs: ['EDM', 'Synthwave', 'Future Bass', 'Dubstep', 'Trance'], color: ['#22d3ee', '#67e8f9'] },
  House: { subs: ['Deep House', 'Tech House', 'Progressive', 'Tropical', 'Afro House'], color: ['#34d399', '#2dd4bf'] },
  Techno: { subs: ['Minimal', 'Industrial', 'Detroit', 'Hard Techno', 'Ambient Techno'], color: ['#60a5fa', '#818cf8'] },
  Jazz: { subs: ['Smooth Jazz', 'Bebop', 'Fusion', 'Cool Jazz', 'Nu Jazz'], color: ['#fbbf24', '#f59e0b'] },
  Blues: { subs: ['Delta Blues', 'Chicago Blues', 'Electric Blues', 'Soul Blues'], color: ['#94a3b8', '#64748b'] },
  Classical: { subs: ['Baroque', 'Romantic', 'Modern Classical', 'Chamber', 'Orchestral'], color: ['#e2e8f0', '#94a3b8'] },
  Ambient: { subs: ['Dark Ambient', 'Space Ambient', 'Drone', 'New Age', 'Atmospheric'], color: ['#67e8f9', '#a5b4fc'] },
  'Lo-Fi': { subs: ['Lo-Fi Hip-Hop', 'Chillhop', 'Study Beats', 'Jazz Lo-Fi', 'Vinyl'], color: ['#fdba74', '#fbbf24'] },
  'R&B': { subs: ['Contemporary R&B', 'Neo-Soul', 'Quiet Storm', 'Alternative R&B'], color: ['#f9a8d4', '#e879f9'] },
  Soul: { subs: ['Classic Soul', 'Northern Soul', 'Psychedelic Soul', 'Modern Soul'], color: ['#fca5a5', '#fb7185'] },
  Metal: { subs: ['Heavy Metal', 'Metalcore', 'Doom', 'Progressive Metal', 'Thrash'], color: ['#78716c', '#a8a29e'] },
  Cinematic: { subs: ['Epic Trailer', 'Emotional Score', 'Action', 'Fantasy', 'Suspense'], color: ['#c4b5fd', '#a78bfa'] }
};

const MOODS = ['Happy', 'Sad', 'Dark', 'Energetic', 'Romantic', 'Epic', 'Calm', 'Mysterious'];

const INSTRUMENTS = [
  { id: 'piano', name: 'پیانو', icon: '🎹' },
  { id: 'guitar', name: 'گیتار', icon: '🎸' },
  { id: 'bass', name: 'بیس', icon: '🔉' },
  { id: 'drums', name: 'درامز', icon: '🥁' },
  { id: 'synth', name: 'سینث', icon: '🎛️' },
  { id: 'violin', name: 'ویولن', icon: '🎻' },
  { id: 'strings', name: 'استرینگ', icon: '🎼' }
];

const SAMPLE_AUDIO = [
  'audio/track1.mp3',
  'audio/track2.mp3',
  'audio/track1.mp3',
  'audio/track2.mp3',
  'audio/track1.mp3',
  'audio/track2.mp3',
  'audio/track1.mp3',
  'audio/track2.mp3',
  'audio/track1.mp3',
  'audio/track2.mp3'
];

const SAMPLE_TRACKS = [
  { id: 's1', title: 'سپیده‌دم دیجیتال', genre: 'Electronic', sub: 'Synthwave', mood: 'Energetic', duration: 180, bpm: 128, instruments: ['synth', 'drums', 'bass'], audio: 'audio/track1.mp3', isSample: true },
  { id: 's2', title: 'آرامش نیمه‌شب', genre: 'Lo-Fi', sub: 'Chillhop', mood: 'Calm', duration: 150, bpm: 85, instruments: ['piano', 'drums', 'bass'], audio: 'audio/track2.mp3', isSample: true },
  { id: 's3', title: 'حماسه‌ی ستارگان', genre: 'Cinematic', sub: 'Epic Trailer', mood: 'Epic', duration: 180, bpm: 110, instruments: ['strings', 'violin', 'drums'], audio: 'audio/track1.mp3', isSample: true },
  { id: 's4', title: 'نبض شهر', genre: 'Hip-Hop', sub: 'Trap', mood: 'Dark', duration: 150, bpm: 140, instruments: ['synth', 'drums', 'bass'], audio: 'audio/track2.mp3', isSample: true },
  { id: 's5', title: 'عشق در باران', genre: 'R&B', sub: 'Contemporary R&B', mood: 'Romantic', duration: 180, bpm: 95, instruments: ['piano', 'guitar', 'bass'], audio: 'audio/track1.mp3', isSample: true },
  { id: 's6', title: 'رقص در تاریکی', genre: 'House', sub: 'Deep House', mood: 'Mysterious', duration: 150, bpm: 122, instruments: ['synth', 'drums', 'bass'], audio: 'audio/track2.mp3', isSample: true }
];

// State
let state = {
  selectedGenre: null,
  selectedSub: null,
  selectedMood: null,
  selectedInstruments: ['piano', 'drums', 'bass'],
  duration: 60,
  bpm: 120,
  creations: [],
  currentTrack: null,
  isPlaying: false,
  wavesurfer: null,
  audioEl: null,
  menuTrackId: null
};

// DOM
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

// Init
document.addEventListener('DOMContentLoaded', () => {
  loadCreations();
  renderGenres();
  renderMoods();
  renderInstruments();
  renderSamples();
  renderCreations();
  setupFilters();
  setupEvents();
  initWaveSurfer();
});

function loadCreations() {
  try {
    const saved = localStorage.getItem('aethermusic_creations');
    let list = saved ? JSON.parse(saved) : [];
    // Migrate old remote URLs to local audio files
    list = list.map((t) => {
      if (t.audio && t.audio.includes('soundhelix.com')) {
        t.audio = SAMPLE_AUDIO[Math.floor(Math.random() * SAMPLE_AUDIO.length)];
      }
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

// Render Genres
function renderGenres() {
  const grid = $('#genreGrid');
  grid.innerHTML = '';
  Object.keys(GENRES).forEach((g) => {
    const card = document.createElement('button');
    card.className = 'genre-card';
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
    btn.textContent = sub;
    btn.dataset.sub = sub;
    btn.addEventListener('click', () => {
      state.selectedSub = sub;
      $$('#subgenreChips .chip').forEach((c) => c.classList.toggle('active', c.dataset.sub === sub));
    });
    chips.appendChild(btn);
  });
  group.style.display = 'flex';
}

function renderMoods() {
  const row = $('#moodChips');
  MOODS.forEach((m) => {
    const btn = document.createElement('button');
    btn.className = 'chip';
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
  INSTRUMENTS.forEach((inst) => {
    const btn = document.createElement('button');
    btn.className = 'instrument-chip' + (state.selectedInstruments.includes(inst.id) ? ' active' : '');
    btn.dataset.id = inst.id;
    btn.innerHTML = `<span class="inst-icon">${inst.icon}</span> ${inst.name}`;
    btn.addEventListener('click', () => {
      const idx = state.selectedInstruments.indexOf(inst.id);
      if (idx >= 0) {
        if (state.selectedInstruments.length > 1) state.selectedInstruments.splice(idx, 1);
      } else {
        state.selectedInstruments.push(inst.id);
      }
      btn.classList.toggle('active', state.selectedInstruments.includes(inst.id));
    });
    grid.appendChild(btn);
  });
}

function renderSamples() {
  const grid = $('#samplesGrid');
  grid.innerHTML = '';
  SAMPLE_TRACKS.forEach((t) => grid.appendChild(createTrackCard(t)));
}

function renderCreations() {
  const grid = $('#creationsGrid');
  const empty = $('#emptyCreations');
  const filtered = filterCreations();
  grid.innerHTML = '';
  if (filtered.length === 0) {
    empty.style.display = state.creations.length === 0 ? 'block' : 'block';
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
  const instNames = (track.instruments || []).map((id) => INSTRUMENTS.find((i) => i.id === id)?.name || id).slice(0, 3).join('، ');
  card.innerHTML = `
    <div class="track-header">
      <div class="track-cover" style="--c1:${colors[0]};--c2:${colors[1]}">${getGenreEmoji(track.genre)}</div>
      <div class="track-info">
        <div class="track-name">${escapeHtml(track.title)}</div>
        <div class="track-meta">
          <span>${track.bpm} BPM</span>
          <span>•</span>
          <span>${formatDuration(track.duration)}</span>
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
    Ambient: '🌌', 'Lo-Fi': '☕', 'R&B': '💜', Soul: '🔥', Metal: '☠️', Cinematic: '🎬'
  };
  return map[g] || '🎵';
}

function formatDuration(sec) {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function escapeHtml(str) {
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}

function setupFilters() {
  const genreSel = $('#filterGenre');
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

function setupEvents() {
  // Nav
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

  // BPM
  $('#bpmSlider').addEventListener('input', (e) => {
    state.bpm = +e.target.value;
    $('#bpmValue').textContent = state.bpm;
  });

  // Duration
  $$('#durationChips .chip').forEach((chip) => {
    chip.addEventListener('click', () => {
      state.duration = +chip.dataset.value;
      $$('#durationChips .chip').forEach((c) => c.classList.toggle('active', c === chip));
    });
  });

  // Create
  $('#createBtn').addEventListener('click', createMusic);

  // Player
  $('#playPauseBtn').addEventListener('click', togglePlay);
  $('#closePlayer').addEventListener('click', closePlayer);
  $('#volumeSlider').addEventListener('input', (e) => {
    const v = +e.target.value;
    if (state.audioEl) {
      state.audioEl.volume = v;
      state.audioEl.muted = v === 0;
    }
    if (state.wavesurfer) state.wavesurfer.setVolume(v);
  });
  $('#volumeBtn').addEventListener('click', () => {
    const sl = $('#volumeSlider');
    if (+sl.value > 0) {
      sl.dataset.prev = sl.value;
      sl.value = 0;
    } else {
      sl.value = sl.dataset.prev || 0.85;
    }
    const v = +sl.value;
    if (state.audioEl) {
      state.audioEl.volume = v;
      state.audioEl.muted = v === 0;
    }
    if (state.wavesurfer) state.wavesurfer.setVolume(v);
  });

  // Rename modal
  $('#renameCancel').addEventListener('click', () => $('#renameModal').classList.remove('open'));
  $('#renameConfirm').addEventListener('click', confirmRename);

  // Context menu close
  document.addEventListener('click', () => {
    $('#trackMenu').classList.remove('open');
  });

  // Logo
  $('#logoLink').addEventListener('click', (e) => {
    e.preventDefault();
    $$('.nav-btn').forEach((b) => b.classList.toggle('active', b.dataset.section === 'creator'));
    $$('.section').forEach((s) => s.classList.remove('active'));
    $('#creatorSection').classList.add('active');
  });
}

function initWaveSurfer() {
  // Create a reliable native audio element as primary source
  state.audioEl = new Audio();
  state.audioEl.preload = 'auto';
  state.audioEl.volume = 0.85;
  state.audioEl.crossOrigin = 'anonymous';

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
    media: state.audioEl,          // use our controlled audio element
    backend: 'MediaElement'
  });

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
    $('#currentTime').textContent = formatDuration(state.audioEl.currentTime || 0);
  });
  state.audioEl.addEventListener('loadedmetadata', () => {
    $('#totalTime').textContent = formatDuration(state.audioEl.duration || 0);
  });
  state.audioEl.addEventListener('error', (e) => {
    console.error('Audio error:', state.audioEl.error);
    showToast('خطا در بارگذاری فایل صوتی', 'error');
  });

  state.wavesurfer.on('error', (err) => {
    console.error('WaveSurfer error:', err);
  });
}

async function createMusic() {
  const prompt = $('#promptInput').value.trim();
  if (!state.selectedGenre) {
    showToast('لطفاً یک ژانر انتخاب کنید', 'error');
    return;
  }
  if (!state.selectedMood) {
    showToast('لطفاً حال‌وهوا را انتخاب کنید', 'error');
    return;
  }

  const btn = $('#createBtn');
  btn.disabled = true;

  const modal = $('#generateModal');
  modal.classList.add('open');
  const status = $('#generateStatus');
  const fill = $('#progressFill');

  const steps = [
    { text: 'تحلیل ایده و سبک...', pct: 15 },
    { text: 'انتخاب ساختار هارمونیک...', pct: 30 },
    { text: 'تولید ملودی و ریتم...', pct: 50 },
    { text: 'لایه‌بندی سازها...', pct: 70 },
    { text: 'میکس و مسترینگ نهایی...', pct: 90 },
    { text: 'آماده شد!', pct: 100 }
  ];

  for (const step of steps) {
    status.textContent = step.text;
    fill.style.width = step.pct + '%';
    await sleep(600 + Math.random() * 400);
  }

  const title = prompt
    ? prompt.slice(0, 40) + (prompt.length > 40 ? '…' : '')
    : generateTitle(state.selectedGenre, state.selectedMood);

  const track = {
    id: 'c_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
    title,
    genre: state.selectedGenre,
    sub: state.selectedSub || GENRES[state.selectedGenre].subs[0],
    mood: state.selectedMood,
    duration: state.duration,
    bpm: state.bpm,
    instruments: [...state.selectedInstruments],
    vocalType: $('#vocalType').value,
    vocalLang: $('#vocalLang').value,
    audio: SAMPLE_AUDIO[Math.floor(Math.random() * SAMPLE_AUDIO.length)],
    prompt,
    isFavorite: false,
    createdAt: Date.now(),
    isSample: false
  };

  state.creations.unshift(track);
  saveCreations();

  await sleep(400);
  modal.classList.remove('open');
  fill.style.width = '0%';
  btn.disabled = false;

  showToast('موزیک با موفقیت ساخته شد! 🎵', 'success');

  // Switch to creations and play
  $$('.nav-btn').forEach((b) => b.classList.toggle('active', b.dataset.section === 'creations'));
  $$('.section').forEach((s) => s.classList.remove('active'));
  $('#creationsSection').classList.add('active');
  renderCreations();
  playTrack(track);
}

function generateTitle(genre, mood) {
  const prefixes = {
    Happy: ['آفتاب', 'رقص', 'شادمانی', 'طلوع'],
    Sad: ['باران', 'خاطره', 'غروب', 'تنهایی'],
    Dark: ['سایه', 'شب', 'مه', 'عمیق'],
    Energetic: ['آتش', 'سرعت', 'نبض', 'انفجار'],
    Romantic: ['عشق', 'نگاه', 'قلب', 'ستاره'],
    Epic: ['حماسه', 'فتح', 'قهرمان', 'افسانه'],
    Calm: ['آرامش', 'دریا', 'مهتاب', 'نسیم'],
    Mysterious: ['راز', 'مه', 'ناشناخته', 'سایه']
  };
  const p = prefixes[mood] || ['موزیک'];
  const word = p[Math.floor(Math.random() * p.length)];
  return `${word} ${genre}`;
}

function playTrack(track) {
  if (!track || !track.audio) {
    showToast('فایل صوتی یافت نشد', 'error');
    return;
  }
  state.currentTrack = track;
  $('#playerBar').classList.add('visible');
  $('#playerTitle').textContent = track.title;
  $('#playerSubtitle').textContent = `${track.genre} · ${translateMood(track.mood)} · ${track.bpm} BPM`;
  const colors = GENRES[track.genre]?.color || ['#7c3aed', '#06b6d4'];
  $('#coverVisual').style.background = `linear-gradient(135deg, ${colors[0]}, ${colors[1]})`;
  $('#coverVisual').textContent = getGenreEmoji(track.genre);

  // Stop previous
  try {
    state.audioEl.pause();
    state.audioEl.currentTime = 0;
  } catch (e) {}

  const vol = +$('#volumeSlider').value;
  state.audioEl.volume = isNaN(vol) ? 0.85 : Math.max(0, Math.min(1, vol));
  state.audioEl.muted = false;

  // Load via WaveSurfer (which drives our audioEl)
  state.wavesurfer.load(track.audio);

  state.wavesurfer.once('ready', () => {
    // Force volume again after load
    state.audioEl.volume = +$('#volumeSlider').value || 0.85;
    state.audioEl.muted = false;
    state.wavesurfer.setVolume(state.audioEl.volume);

    // Attempt play – may be blocked by autoplay policy
    const playPromise = state.audioEl.play();
    if (playPromise !== undefined) {
      playPromise.catch((err) => {
        console.warn('Autoplay blocked:', err.message);
        showToast('برای پخش روی دکمه ▶️ کلیک کنید', 'error');
        updatePlayUI(false);
      });
    }
  });

  renderSamples();
  renderCreations();
}

function togglePlay() {
  if (!state.currentTrack || !state.audioEl) return;
  if (state.audioEl.paused) {
    state.audioEl.muted = false;
    state.audioEl.volume = +$('#volumeSlider').value || 0.85;
    state.audioEl.play().catch((err) => {
      console.error('Play failed:', err);
      showToast('پخش ممکن نشد. صفحه را رفرش کنید.', 'error');
    });
  } else {
    state.audioEl.pause();
  }
}

function updatePlayUI(playing) {
  const playIcon = $('#playPauseBtn .icon-play');
  const pauseIcon = $('#playPauseBtn .icon-pause');
  if (playing) {
    playIcon.style.display = 'none';
    pauseIcon.style.display = 'block';
  } else {
    playIcon.style.display = 'block';
    pauseIcon.style.display = 'none';
  }
  renderSamples();
  renderCreations();
}

function closePlayer() {
  try {
    if (state.audioEl) {
      state.audioEl.pause();
      state.audioEl.removeAttribute('src');
      state.audioEl.load();
    }
    if (state.wavesurfer) state.wavesurfer.empty();
  } catch (e) {}
  state.currentTrack = null;
  state.isPlaying = false;
  $('#playerBar').classList.remove('visible');
  updatePlayUI(false);
  renderSamples();
  renderCreations();
}

function handleTrackAction(action, track, btn) {
  if (action === 'play') {
    if (state.currentTrack?.id === track.id && state.isPlaying) {
      state.wavesurfer.pause();
    } else {
      playTrack(track);
    }
    return;
  }
  if (action === 'favorite') {
    track.isFavorite = !track.isFavorite;
    if (!track.isSample) {
      const idx = state.creations.findIndex((t) => t.id === track.id);
      if (idx >= 0) state.creations[idx].isFavorite = track.isFavorite;
      saveCreations();
    }
    showToast(track.isFavorite ? 'به علاقه‌مندی‌ها اضافه شد' : 'از علاقه‌مندی‌ها حذف شد');
    renderSamples();
    renderCreations();
    return;
  }
  if (action === 'download') {
    downloadTrack(track);
    return;
  }
  if (action === 'more') {
    showContextMenu(btn, track);
    return;
  }
}

function showContextMenu(btn, track) {
  const menu = $('#trackMenu');
  state.menuTrackId = track.id;
  const rect = btn.getBoundingClientRect();
  menu.style.top = Math.min(rect.bottom + 4, window.innerHeight - 220) + 'px';
  menu.style.left = Math.max(8, rect.left - 140) + 'px';
  menu.classList.add('open');

  menu.querySelectorAll('button').forEach((b) => {
    b.onclick = (e) => {
      e.stopPropagation();
      menu.classList.remove('open');
      const act = b.dataset.action;
      if (act === 'rename') openRename(track);
      else if (act === 'download') downloadTrack(track);
      else if (act === 'duplicate') duplicateTrack(track);
      else if (act === 'favorite') handleTrackAction('favorite', track);
      else if (act === 'delete') deleteTrack(track);
    };
  });
}

function openRename(track) {
  if (track.isSample) {
    showToast('نمونه‌های آماده قابل تغییر نام نیستند', 'error');
    return;
  }
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
  a.href = track.audio;
  a.download = `${track.title.replace(/[^\w\s\u0600-\u06FF]/g, '')}.mp3`;
  a.target = '_blank';
  a.click();
  showToast('دانلود شروع شد ⬇️', 'success');
}

function duplicateTrack(track) {
  if (track.isSample) {
    // Add sample to creations
    const copy = {
      ...track,
      id: 'c_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
      title: track.title + ' (کپی)',
      isSample: false,
      createdAt: Date.now(),
      isFavorite: false
    };
    state.creations.unshift(copy);
  } else {
    const copy = {
      ...track,
      id: 'c_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
      title: track.title + ' (کپی)',
      createdAt: Date.now(),
      isFavorite: false
    };
    state.creations.unshift(copy);
  }
  saveCreations();
  renderCreations();
  showToast('کپی ساخته شد', 'success');
  $$('.nav-btn').forEach((b) => b.classList.toggle('active', b.dataset.section === 'creations'));
  $$('.section').forEach((s) => s.classList.remove('active'));
  $('#creationsSection').classList.add('active');
}

function deleteTrack(track) {
  if (track.isSample) {
    showToast('نمونه‌های آماده قابل حذف نیستند', 'error');
    return;
  }
  if (!confirm(`آیا از حذف «${track.title}» مطمئن هستید؟`)) return;
  state.creations = state.creations.filter((t) => t.id !== track.id);
  saveCreations();
  if (state.currentTrack?.id === track.id) closePlayer();
  renderCreations();
  showToast('موزیک حذف شد');
}

function showToast(msg, type = '') {
  const t = $('#toast');
  t.textContent = msg;
  t.className = 'toast show' + (type ? ' ' + type : '');
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.remove('show'), 2800);
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}
