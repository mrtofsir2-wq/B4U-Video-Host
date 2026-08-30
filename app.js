const player = document.getElementById('player');
const video = document.getElementById('video');
const status = document.getElementById('status');
const title = document.getElementById('video-title');
const list = document.getElementById('video-list');
const count = document.getElementById('count');
const errorBox = document.getElementById('error');
const playBtn = document.getElementById('play-btn');
const backBtn = document.getElementById('back-btn');
const forwardBtn = document.getElementById('forward-btn');
const muteBtn = document.getElementById('mute-btn');
const volume = document.getElementById('volume');
const progress = document.getElementById('progress');
const timeLabel = document.getElementById('time');
const centerPlay = document.getElementById('center-play');
const qualityBtn = document.getElementById('quality-btn');
const qualityMenu = document.getElementById('quality-menu');
const fullscreenBtn = document.getElementById('fullscreen-btn');

const REPO = 'mrtofsir2-wq/B4U-Video-Host';
const QUALITY_OPTIONS = ['144p', '240p', '360p', '480p', '720p', '1080p'];
let videos = [];
let current = null;
let currentQuality = 'original';
let hideTimer;

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
    const img = document.createElement('img'); img.src = item.thumbnail; img.alt = ''; img.loading = 'lazy'; wrap.appendChild(img);
  } else {
    const tv = document.createElement('video');
    tv.className = 'thumb-video'; tv.muted = true; tv.playsInline = true; tv.preload = 'metadata';
    tv.src = item.qualities.original || Object.values(item.qualities)[0];
    tv.addEventListener('loadedmetadata', () => { if (Number.isFinite(tv.duration) && tv.duration > 0) { try { tv.currentTime = Math.max(0.1, tv.duration * 0.2); } catch (_) {} } }, {once:true});
    wrap.appendChild(tv);
  }
  const play = document.createElement('span'); play.className = 'thumb-play'; play.textContent = '▶'; wrap.appendChild(play);
  return wrap;
}
function formatTime(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) seconds = 0;
  const s = Math.floor(seconds % 60).toString().padStart(2, '0');
  const m = Math.floor(seconds / 60);
  const h = Math.floor(m / 60);
  return h ? `${h}:${String(m % 60).padStart(2,'0')}:${s}` : `${m}:${s}`;
}
function updateTime() {
  const duration = Number.isFinite(video.duration) ? video.duration : 0;
  const currentTime = Number.isFinite(video.currentTime) ? video.currentTime : 0;
  timeLabel.textContent = `${formatTime(currentTime)} / ${formatTime(duration)}`;
  progress.value = duration ? Math.round((currentTime / duration) * 1000) : 0;
}
function updatePlayButton() {
  playBtn.textContent = video.paused ? '▶' : '⏸';
  playBtn.setAttribute('aria-label', video.paused ? 'Play' : 'Pause');
  centerPlay.classList.toggle('visible', video.paused && current);
}
function updateMuteButton() {
  muteBtn.textContent = video.muted || video.volume === 0 ? '🔇' : '🔊';
}
function showControls() {
  player.classList.remove('controls-hidden');
  clearTimeout(hideTimer);
  if (!video.paused) hideTimer = setTimeout(() => player.classList.add('controls-hidden'), 3000);
}
function togglePlay() {
  if (!current) return;
  if (video.paused) video.play().catch(() => {}); else video.pause();
  showControls();
}
function renderQuality() {
  qualityMenu.innerHTML = '';
  QUALITY_OPTIONS.forEach(q => {
    const b = document.createElement('button');
    b.type = 'button'; b.textContent = q; b.setAttribute('role','menuitem');
    const available = Boolean(current && current.qualities[q]);
    b.disabled = !available;
    b.className = q === currentQuality ? 'selected' : '';
    if (!available) b.title = `${q} is not available for this video`;
    b.onclick = () => { if (!available) return; currentQuality = q; closeQuality(); setSource(current, q, true); renderQuality(); };
    qualityMenu.appendChild(b);
  });
  if (current?.qualities.original) {
    const b = document.createElement('button');
    b.type = 'button'; b.textContent = 'Original'; b.setAttribute('role','menuitem');
    b.className = currentQuality === 'original' ? 'selected' : '';
    b.onclick = () => { currentQuality = 'original'; closeQuality(); setSource(current, 'original', true); renderQuality(); };
    qualityMenu.appendChild(b);
  }
  qualityBtn.textContent = `⚙ Quality${currentQuality !== 'original' ? `: ${currentQuality}` : ''}`;
}
function closeQuality() {
  qualityMenu.hidden = true;
  qualityBtn.setAttribute('aria-expanded','false');
}
function toggleQuality(e) {
  e.stopPropagation();
  qualityMenu.hidden = !qualityMenu.hidden;
  qualityBtn.setAttribute('aria-expanded', String(!qualityMenu.hidden));
  if (!qualityMenu.hidden) qualityMenu.querySelector('button:not(:disabled)')?.focus();
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
    if (wasPlaying) video.play().catch(() => {});
    updateTime(); updatePlayButton();
  });
}
function playVideo(item) {
  current = item;
  const available = QUALITY_OPTIONS.filter(q => item.qualities[q]);
  currentQuality = available.length ? available[available.length - 1] : 'original';
  title.textContent = item.title; status.textContent = 'Loading…';
  setSource(item, currentQuality, true); renderQuality();
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

playBtn.onclick = togglePlay;
centerPlay.onclick = togglePlay;
video.addEventListener('click', togglePlay);
backBtn.onclick = () => { video.currentTime = Math.max(0, video.currentTime - 10); showControls(); };
forwardBtn.onclick = () => { video.currentTime = Math.min(video.duration || Infinity, video.currentTime + 10); showControls(); };
muteBtn.onclick = () => { video.muted = !video.muted; updateMuteButton(); showControls(); };
volume.oninput = () => { video.volume = Number(volume.value); video.muted = video.volume === 0; updateMuteButton(); };
progress.oninput = () => { if (video.duration) video.currentTime = (Number(progress.value) / 1000) * video.duration; };
qualityBtn.onclick = toggleQuality;
fullscreenBtn.onclick = async () => {
  try {
    if (document.fullscreenElement) await document.exitFullscreen(); else await player.requestFullscreen();
  } catch (_) {}
};
player.addEventListener('mousemove', showControls);
player.addEventListener('touchstart', showControls, {passive:true});
document.addEventListener('click', e => { if (!document.getElementById('quality').contains(e.target)) closeQuality(); });
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') closeQuality();
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'BUTTON') return;
  if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); togglePlay(); }
  if (e.key === 'ArrowLeft') { video.currentTime = Math.max(0, video.currentTime - 5); showControls(); }
  if (e.key === 'ArrowRight') { video.currentTime = Math.min(video.duration || Infinity, video.currentTime + 5); showControls(); }
  if (e.key.toLowerCase() === 'f') fullscreenBtn.click();
});
video.addEventListener('loadedmetadata', () => { status.textContent = `Ready • ${Math.round(video.duration)}s`; updateTime(); });
video.addEventListener('timeupdate', updateTime);
video.addEventListener('play', () => { status.textContent = 'Playing'; updatePlayButton(); showControls(); });
video.addEventListener('pause', () => { status.textContent = 'Paused'; updatePlayButton(); showControls(); });
video.addEventListener('ended', () => { status.textContent = 'Finished'; updatePlayButton(); showControls(); });
video.addEventListener('volumechange', updateMuteButton);
video.addEventListener('error', () => status.textContent = 'Video could not be loaded');
updatePlayButton(); updateMuteButton(); renderQuality();
loadReleases().catch(e => { status.textContent = 'Could not load video library'; errorBox.hidden = false; errorBox.textContent = e.message; console.error(e); });
