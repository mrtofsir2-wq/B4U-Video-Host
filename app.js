const video = document.getElementById('video');
const status = document.getElementById('status');
const title = document.getElementById('video-title');
const list = document.getElementById('video-list');
const count = document.getElementById('count');
const qualityBox = document.getElementById('quality');
const errorBox = document.getElementById('error');

const REPO = 'mrtofsir2-wq/B4U-Video-Host';
const QUALITY_OPTIONS = ['144p', '240p', '360p', '480p', '720p', '1080p'];
let videos = [];
let current = null;
let currentQuality = 'original';

function cleanName(name) {
  return name.replace(/\.[^.]+$/, '').replace(/[._-]+/g, ' ').replace(/\s+/g, ' ').trim();
}
function qualityFromName(name) {
  const m = name.match(/(?:^|[._-])(144|240|360|480|720|1080|1440|2160)p(?:[._-]|$)/i);
  return m ? `${m[1]}p` : 'original';
}
function baseName(name) {
  return name.replace(/\.[^.]+$/, '').replace(/(?:[._-])(144|240|360|480|720|1080|1440|2160)p$/i, '');
}
function makeId(name) {
  return baseName(name).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}
function chooseTitle(name) {
  return cleanName(baseName(name)).replace(/^From Klickpin com /i, '').replace(/^YTDown com YouTube /i, '');
}

function buildLibrary(assets) {
  const images = new Map();
  const groups = new Map();
  for (const a of assets) {
    const ext = a.name.split('.').pop().toLowerCase();
    if (['jpg','jpeg','png','webp','avif'].includes(ext)) images.set(baseName(a.name).toLowerCase(), a.browser_download_url);
  }
  for (const a of assets) {
    if (a.content_type !== 'video/mp4' && !a.name.toLowerCase().endsWith('.mp4')) continue;
    const key = makeId(a.name);
    if (!groups.has(key)) groups.set(key, { id:key, title:chooseTitle(a.name), thumbnail:null, qualities:{} });
    const g = groups.get(key);
    const q = qualityFromName(a.name);
    g.qualities[q] = a.browser_download_url;
    const img = images.get(baseName(a.name).toLowerCase());
    if (img) g.thumbnail = img;
  }
  return [...groups.values()];
}

function makeThumbnail(item) {
  const wrap = document.createElement('div');
  wrap.className = 'thumb';
  if (item.thumbnail) {
    const img = document.createElement('img');
    img.src = item.thumbnail; img.alt = ''; img.loading = 'lazy';
    wrap.appendChild(img);
  } else {
    const tv = document.createElement('video');
    tv.className = 'thumb-video'; tv.muted = true; tv.playsInline = true; tv.preload = 'metadata';
    tv.src = item.qualities.original || Object.values(item.qualities)[0];
    tv.addEventListener('loadedmetadata', () => {
      if (Number.isFinite(tv.duration) && tv.duration > 0) {
        try { tv.currentTime = Math.max(0.1, tv.duration * 0.2); } catch (_) {}
      }
    }, {once:true});
    wrap.appendChild(tv);
  }
  const play = document.createElement('span'); play.className = 'thumb-play'; play.textContent = '▶';
  wrap.appendChild(play);
  return wrap;
}

function renderQuality(item) {
  qualityBox.innerHTML = '';
  qualityBox.hidden = false;

  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'quality-trigger';
  button.textContent = `⚙ Quality${currentQuality !== 'original' ? `: ${currentQuality}` : ''}`;
  button.setAttribute('aria-haspopup', 'menu');
  button.setAttribute('aria-expanded', 'false');

  const menu = document.createElement('div');
  menu.className = 'quality-menu';
  menu.hidden = true;
  menu.setAttribute('role', 'menu');

  QUALITY_OPTIONS.forEach(q => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = q === currentQuality ? 'selected' : '';
    b.textContent = q;
    b.setAttribute('role', 'menuitem');
    const available = Boolean(item.qualities[q]);
    b.disabled = !available;
    b.title = available ? `Switch to ${q}` : `${q} is not available for this video`;
    b.onclick = () => {
      if (!available) return;
      currentQuality = q;
      menu.hidden = true;
      button.setAttribute('aria-expanded', 'false');
      setSource(item, q, true);
      renderQuality(item);
    };
    menu.appendChild(b);
  });

  if (item.qualities.original) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = currentQuality === 'original' ? 'selected' : '';
    b.textContent = 'Original';
    b.setAttribute('role', 'menuitem');
    b.onclick = () => {
      currentQuality = 'original';
      menu.hidden = true;
      button.setAttribute('aria-expanded', 'false');
      setSource(item, 'original', true);
      renderQuality(item);
    };
    menu.appendChild(b);
  }

  button.onclick = (e) => {
    e.stopPropagation();
    menu.hidden = !menu.hidden;
    button.setAttribute('aria-expanded', String(!menu.hidden));
    if (!menu.hidden) {
      const firstEnabled = [...menu.querySelectorAll('button')].find(b => !b.disabled);
      firstEnabled?.focus();
    }
  };

  qualityBox.append(button, menu);
}

function setSource(item, q, autoplay=false) {
  const url = item.qualities[q] || item.qualities.original || Object.values(item.qualities)[0];
  if (!url) return;
  const wasPlaying = autoplay || !video.paused;
  const time = video.currentTime || 0;
  video.src = url; video.load();
  video.addEventListener('loadedmetadata', function restore() {
    video.removeEventListener('loadedmetadata', restore);
    if (Number.isFinite(time) && time > 0 && time < video.duration) video.currentTime = time;
    if (wasPlaying) video.play().catch(()=>{});
  });
}

function playVideo(item) {
  current = item;
  const available = QUALITY_OPTIONS.filter(q => item.qualities[q]);
  currentQuality = available.length ? available[available.length - 1] : 'original';
  title.textContent = item.title; status.textContent = 'Loading…';
  setSource(item, currentQuality, true); renderQuality(item);
  document.querySelectorAll('.video-item').forEach(x => x.classList.toggle('active', x.dataset.id === item.id));
  window.scrollTo({top:0, behavior:'smooth'});
}

function render() {
  count.textContent = `${videos.length} video${videos.length === 1 ? '' : 's'}`;
  list.innerHTML = '';
  videos.forEach((item, i) => {
    const card = document.createElement('button'); card.className = 'video-item'; card.dataset.id = item.id;
    card.appendChild(makeThumbnail(item));
    const meta = document.createElement('div'); meta.className = 'meta';
    const strong = document.createElement('strong'); strong.textContent = item.title;
    const small = document.createElement('small');
    const qualityCount = Object.keys(item.qualities).filter(q => q !== 'original').length;
    small.textContent = qualityCount ? `${qualityCount} qualities` : 'GitHub Release';
    meta.append(strong, small); card.appendChild(meta);
    card.addEventListener('click', () => playVideo(item)); list.appendChild(card);
    if (i === 0) playVideo(item);
  });
}

async function loadReleases() {
  const r = await fetch(`https://api.github.com/repos/${REPO}/releases?per_page=100`, {headers:{Accept:'application/vnd.github+json'}});
  if (!r.ok) throw new Error(`GitHub Releases API returned ${r.status}`);
  const releases = await r.json();
  const assets = releases.filter(x => !x.draft).flatMap(x => x.assets || []);
  videos = buildLibrary(assets);
  if (!videos.length) throw new Error('No MP4 videos found in releases');
  render();
}

document.addEventListener('click', (e) => {
  if (!qualityBox.contains(e.target)) {
    const menu = qualityBox.querySelector('.quality-menu');
    const trigger = qualityBox.querySelector('.quality-trigger');
    if (menu && !menu.hidden) {
      menu.hidden = true;
      trigger?.setAttribute('aria-expanded', 'false');
    }
  }
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    const menu = qualityBox.querySelector('.quality-menu');
    const trigger = qualityBox.querySelector('.quality-trigger');
    if (menu && !menu.hidden) {
      menu.hidden = true;
      trigger?.setAttribute('aria-expanded', 'false');
      trigger?.focus();
    }
  }
});

loadReleases().catch(e => {
  status.textContent = 'Could not load video library'; errorBox.hidden = false; errorBox.textContent = e.message; console.error(e);
});
video.addEventListener('loadedmetadata', () => status.textContent = `Ready • ${Math.round(video.duration)}s`);
video.addEventListener('play', () => status.textContent = 'Playing');
video.addEventListener('pause', () => status.textContent = 'Paused');
video.addEventListener('ended', () => status.textContent = 'Finished');
video.addEventListener('error', () => status.textContent = 'Video could not be loaded');
