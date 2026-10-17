/* ═══════════════════════════════════════════════════════════
   MINI PLATFORMER — канон AXIIOM
   8 уровней · монеты · шипы · движущиеся платформы · рекорд
   ─────────────────────────────────────────────────────────── */
'use strict';

/* ── canvas (DPR-aware) ── */
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const W = 400, H = 300;
const DPR = Math.min(window.devicePixelRatio || 1, 2);
canvas.width = W * DPR;
canvas.height = H * DPR;

/* ── DOM ── */
const $ = id => document.getElementById(id);
const stLevel = $('st-level'), stScore = $('st-score'),
      stCoins = $('st-coins'), stDeaths = $('st-deaths');
const levelIntro = $('level-intro');
const toastBox = $('toast-container');
const modalOverlay = $('modal-overlay');

/* ── constants ── */
const GRAVITY = 0.42, MOVE_ACC = 0.55, MOVE_MAX = 3.1,
      FRICTION = 0.82, JUMP_V = -8.3, JUMP_CUT = 0.42,
      COYOTE = 7, BUFFER = 7, MAX_FALL = 11;

/* ── audio (WebAudio, unlock on first gesture) ── */
let actx = null;
let muted = localStorage.getItem('platformer.muted') === '1';
function audio() {
  if (!actx) { try { actx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {} }
  if (actx && actx.state === 'suspended') actx.resume();
  return actx;
}
function tone(freq, dur, type = 'square', vol = 0.05, slide = 0) {
  if (muted) return;
  const ac = audio(); if (!ac) return;
  const o = ac.createOscillator(), g = ac.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, ac.currentTime);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), ac.currentTime + dur);
  g.gain.setValueAtTime(vol, ac.currentTime);
  g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + dur);
  o.connect(g); g.connect(ac.destination);
  o.start(); o.stop(ac.currentTime + dur + 0.02);
}
const sfx = {
  jump:   () => tone(340, .14, 'square', .045, 260),
  coin:   () => { tone(880, .09, 'sine', .06); setTimeout(() => tone(1320, .12, 'sine', .05), 55); },
  death:  () => { tone(220, .3, 'sawtooth', .06, -160); tone(110, .4, 'square', .04, -60); },
  win:    () => [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => tone(f, .16, 'sine', .06), i * 95)),
  record: () => [659, 784, 1047, 1319, 1568].forEach((f, i) => setTimeout(() => tone(f, .2, 'sine', .06), i * 110)),
  click:  () => tone(600, .05, 'square', .03),
};
function updateMuteBtn() { $('btn-mute').textContent = muted ? '🔇' : '🔊'; }
$('btn-mute').addEventListener('click', () => {
  muted = !muted;
  localStorage.setItem('platformer.muted', muted ? '1' : '0');
  updateMuteBtn(); if (!muted) sfx.click();
});
updateMuteBtn();

/* ── unlock audio on any gesture ── */
['keydown', 'pointerdown', 'touchstart'].forEach(ev =>
  document.addEventListener(ev, audio, { once: false, passive: true }));

/* ── input ── */
const keys = { left: false, right: false };
let jumpQueued = 0;

function pressJump() {
  jumpQueued = BUFFER;
  audio();
}

document.addEventListener('keydown', e => {
  if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'ф') keys.left = true;
  if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'в') keys.right = true;
  if (e.key === 'ArrowUp' || e.key === 'w' || e.key === ' ' || e.key === 'ц') { if (!e.repeat) pressJump(); e.preventDefault(); }
  if (e.key === 'r' || e.key === 'к') restartLevel();
  if (e.key === 'm' || e.key === 'ь') $('btn-mute').click();
});
document.addEventListener('keyup', e => {
  if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'ф') keys.left = false;
  if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'в') keys.right = false;
  if (e.key === 'ArrowUp' || e.key === 'w' || e.key === ' ') {
    if (player.vy < 0) player.vy *= JUMP_CUT; // variable jump height
  }
});

function bindHold(id, down, up) {
  const el = $(id);
  const d = e => { e.preventDefault(); down(); };
  const u = e => { e.preventDefault(); up && up(); };
  el.addEventListener('touchstart', d, { passive: false });
  el.addEventListener('touchend', u, { passive: false });
  el.addEventListener('touchcancel', u, { passive: false });
  el.addEventListener('mousedown', d);
  el.addEventListener('mouseup', u);
  el.addEventListener('mouseleave', () => up && up());
}
bindHold('btn-left',  () => keys.left = true,  () => keys.left = false);
bindHold('btn-right', () => keys.right = true, () => keys.right = false);
bindHold('btn-jump',  () => pressJump(),       () => { if (player.vy < 0) player.vy *= JUMP_CUT; });

/* ── level data ─────────────────────────────────────────────
   platform: {x,y,w,h, move?:{axis:'x'|'y',range,speed,phase}}
   spike:    {x,y,w,h}  (kill zone, drawn as triangles)
   coin:     {x,y}
   flag:     {x,y}      (bottom of pole)
────────────────────────────────────────────────────────────── */
const LEVELS = [
  { name: 'Разминка', w: 700, spawn: [40, 210], sky: '#0E0E16',
    platforms: [ {x:0,y:260,w:250,h:40}, {x:330,y:260,w:370,h:40}, {x:150,y:200,w:70,h:12} ],
    spikes: [], coins: [ {x:170,y:165}, {x:290,y:205}, {x:420,y:215} ], flag: {x:640,y:260} },

  { name: 'Ступени', w: 800, spawn: [30, 210], sky: '#10101A',
    platforms: [ {x:0,y:260,w:200,h:40}, {x:260,y:260,w:130,h:40}, {x:450,y:260,w:350,h:40},
                 {x:210,y:212,w:44,h:10}, {x:395,y:198,w:50,h:10}, {x:560,y:212,w:50,h:10} ],
    spikes: [], coins: [ {x:225,y:178}, {x:410,y:162}, {x:580,y:178}, {x:700,y:215} ], flag: {x:745,y:260} },

  { name: 'Пропасть', w: 860, spawn: [30, 210], sky: '#0D1018',
    platforms: [ {x:0,y:260,w:240,h:40}, {x:380,y:230,w:90,h:12}, {x:580,y:260,w:280,h:40} ],
    spikes: [ {x:620,y:246,w:60,h:14} ],
    coins: [ {x:300,y:190}, {x:405,y:190}, {x:510,y:200}, {x:640,y:200} ], flag: {x:810,y:260} },

  { name: 'Шипы', w: 820, spawn: [30, 210], sky: '#140D12',
    platforms: [ {x:0,y:260,w:820,h:40}, {x:150,y:196,w:60,h:12}, {x:490,y:196,w:60,h:12} ],
    spikes: [ {x:340,y:246,w:80,h:14}, {x:560,y:246,w:80,h:14} ],
    coins: [ {x:170,y:162}, {x:510,y:162}, {x:370,y:210}, {x:720,y:215} ], flag: {x:770,y:260} },

  { name: 'Плывун', w: 900, spawn: [30, 210], sky: '#0C1216',
    platforms: [ {x:0,y:260,w:200,h:40}, {x:260,y:215,w:80,h:12, move:{axis:'x',range:120,speed:.02,phase:0}},
                 {x:620,y:230,w:80,h:12}, {x:790,y:260,w:110,h:40} ],
    spikes: [], coins: [ {x:420,y:170}, {x:520,y:150}, {x:650,y:190}, {x:830,y:215} ], flag: {x:850,y:260} },

  { name: 'В небо', w: 700, spawn: [30, 210], sky: '#12101E',
    platforms: [ {x:0,y:260,w:150,h:40}, {x:190,y:215,w:70,h:12}, {x:320,y:165,w:70,h:12},
                 {x:450,y:120,w:70,h:12}, {x:580,y:170,w:120,h:14} ],
    spikes: [], coins: [ {x:215,y:180}, {x:345,y:130}, {x:475,y:85}, {x:640,y:135} ], flag: {x:650,y:170} },

  { name: 'Механика', w: 900, spawn: [30, 210], sky: '#101418',
    platforms: [ {x:0,y:260,w:190,h:40}, {x:240,y:170,w:70,h:12, move:{axis:'y',range:55,speed:.022,phase:0}},
                 {x:410,y:200,w:70,h:12}, {x:640,y:160,w:70,h:12, move:{axis:'x',range:80,speed:.02,phase:2}},
                 {x:820,y:260,w:80,h:40} ],
    spikes: [],
    coins: [ {x:265,y:110}, {x:435,y:165}, {x:700,y:110}, {x:850,y:215} ], flag: {x:850,y:260} },

  { name: 'Финал', w: 1000, spawn: [30, 210], sky: '#151020',
    platforms: [ {x:0,y:260,w:170,h:40}, {x:230,y:220,w:60,h:12}, {x:360,y:180,w:60,h:12},
                 {x:480,y:210,w:70,h:12, move:{axis:'x',range:90,speed:.02,phase:1}},
                 {x:660,y:170,w:60,h:12}, {x:780,y:220,w:60,h:12}, {x:900,y:260,w:100,h:40} ],
    spikes: [ {x:130,y:246,w:30,h:14}, {x:620,y:246,w:30,h:14}, {x:840,y:246,w:50,h:14} ],
    coins: [ {x:250,y:185}, {x:385,y:145}, {x:540,y:160}, {x:685,y:135}, {x:805,y:185}, {x:945,y:215} ],
    flag: {x:950,y:260} },
];

/* ── state ── */
const player = { x: 0, y: 0, w: 20, h: 22, vx: 0, vy: 0, grounded: false, coyote: 0, face: 1, squash: 0, onPlatform: null, fallV: 0 };
let level = 0, score = 0, coinCount = 0, deaths = 0, banked = 0;
let best = +(localStorage.getItem('platformer.best') || 0);
let coins = [], particles = [], camX = 0, shake = 0, time = 0;
let state = 'intro';           // intro | play | transition | done
let recordBeaten = false;
let trail = [];

/* ── level lifecycle ── */
function loadLevel(i, noIntro) {
  const L = LEVELS[i];
  player.x = L.spawn[0]; player.y = L.spawn[1];
  player.vx = 0; player.vy = 0; player.grounded = false; player.onPlatform = null; player.fallV = 0;
  coins = L.coins.map(c => ({ x: c.x, y: c.y, got: false, bob: Math.random() * 6 }));
  particles = []; camX = 0; shake = 0; trail = [];
  time = 0;
  stLevel.textContent = i + 1;
  if (noIntro) { state = 'play'; return; }
  state = 'intro';
  showIntro(`Уровень ${i + 1}`, L.name);
}

function showIntro(title, sub) {
  levelIntro.innerHTML = `${title}<small>${sub}</small>`;
  levelIntro.classList.remove('hidden', 'fade');
  setTimeout(() => levelIntro.classList.add('fade'), 900);
  setTimeout(() => { levelIntro.classList.add('hidden'); state = 'play'; }, 1400);
}

function restartLevel() {
  if (state !== 'play') return;
  sfx.click();
  score = banked; // current level coins are lost, no death counted
  updateHUD();
  loadLevel(level, true);
}

$('btn-reset').addEventListener('click', () => {
  sfx.click();
  score = 0; banked = 0; coinCount = 0; deaths = 0; level = 0;
  updateHUD();
  loadLevel(0);
});

/* ── HUD / toast / modal ── */
function updateHUD() {
  stScore.textContent = score;
  stCoins.textContent = coinCount;
  stDeaths.textContent = deaths;
}
function toast(msg) {
  const t = document.createElement('div');
  t.className = 'toast'; t.textContent = msg;
  toastBox.appendChild(t);
  setTimeout(() => t.classList.add('out'), 1900);
  setTimeout(() => t.remove(), 2300);
}
function showModal(icon, title, body) {
  $('modal-icon').textContent = icon;
  $('modal-title').textContent = title;
  $('modal-body').innerHTML = body;
  modalOverlay.classList.remove('hidden');
  state = 'done';
}
$('modal-btn').addEventListener('click', () => {
  modalOverlay.classList.add('hidden');
  sfx.click();
  score = 0; banked = 0; coinCount = 0; deaths = 0; level = 0; recordBeaten = false;
  updateHUD(); loadLevel(0);
});

/* ── particles ── */
function burst(x, y, n, colors, spd = 2.4, life = 34, grav = 0.12) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, v = (0.3 + Math.random() * 0.7) * spd;
    particles.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 0.6,
      life, max: life, grav, r: 1.5 + Math.random() * 2,
      c: colors[(Math.random() * colors.length) | 0] });
  }
}
function dust(x, y, n = 4) {
  for (let i = 0; i < n; i++)
    particles.push({ x: x + (Math.random() - .5) * 12, y, vx: (Math.random() - .5) * .8,
      vy: -Math.random() * .7, life: 20, max: 20, grav: -0.005, r: 1.5 + Math.random() * 1.5, c: 'rgba(200,200,210,.4)' });
}

/* ── physics helpers ── */
function collide(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}
function spikeHit(s) {
  return player.x + 4 < s.x + s.w && player.x + player.w - 4 > s.x &&
         player.y + 4 < s.y + s.h && player.y + player.h > s.y;
}

/* ── update ── */
function update() {
  time++;
  const L = LEVELS[level];

  // moving platforms
  for (const p of L.platforms) {
    if (!p.move) continue;
    p.t = (p.t || 0) + 1;
    const off = Math.sin(p.t * p.move.speed * 60 * 0.0166 + p.move.phase) * p.move.range;
    const nx = p.move.axis === 'x' ? p.baseX + off : p.baseX;
    const ny = p.move.axis === 'y' ? p.baseY + off : p.baseY;
    if (p._init) { p.dx = nx - p.x; p.dy = ny - p.y; }
    p.x = nx; p.y = ny; p._init = true;
  }
  // carry player on moving platform
  if (player.onPlatform && player.onPlatform.move) {
    player.x += player.onPlatform.dx || 0;
    player.y += player.onPlatform.dy || 0;
  }

  // horizontal
  if (keys.left)  { player.vx -= MOVE_ACC; player.face = -1; }
  if (keys.right) { player.vx += MOVE_ACC; player.face = 1; }
  if (!keys.left && !keys.right) player.vx *= FRICTION;
  player.vx = Math.max(-MOVE_MAX, Math.min(MOVE_MAX, player.vx));
  player.x += player.vx;
  for (const p of L.platforms) {
    if (collide(player, p)) {
      if (player.vx > 0) player.x = p.x - player.w;
      else if (player.vx < 0) player.x = p.x + p.w;
      player.vx = 0;
    }
  }

  // vertical
  player.vy = Math.min(player.vy + GRAVITY, MAX_FALL);
  const wasGrounded = player.grounded;
  player.grounded = false; player.onPlatform = null;
  player.y += player.vy;
  for (const p of L.platforms) {
    if (collide(player, p)) {
      if (player.vy > 0) {
        player.y = p.y - player.h; player.vy = 0;
        player.grounded = true; player.onPlatform = p;
      } else if (player.vy < 0) {
        player.y = p.y + p.h; player.vy = 0;
      }
    }
  }

  // land effects
  if (!wasGrounded && player.grounded) {
    if (player.fallV > 5) { dust(player.x + player.w / 2 - camX, player.y + player.h, 6); player.squash = 1; if (player.fallV > 9) shake = Math.max(shake, 3); }
    else if (player.fallV > 2) dust(player.x + player.w / 2 - camX, player.y + player.h, 3);
  }
  player.fallV = player.vy;

  // coyote + jump
  if (player.grounded) player.coyote = COYOTE; else if (player.coyote > 0) player.coyote--;
  if (jumpQueued > 0) {
    jumpQueued--;
    if (player.coyote > 0) {
      player.vy = JUMP_V; player.coyote = 0; jumpQueued = 0;
      player.squash = -1; sfx.jump();
      dust(player.x + player.w / 2 - camX, player.y + player.h, 5);
    }
  }

  // squash decay
  player.squash *= 0.82;

  // bounds
  if (player.x < 0) player.x = 0;
  if (player.x + player.w > L.w) player.x = L.w - player.w;

  // death: spikes / fall
  if (L.spikes.some(spikeHit) || player.y > H + 60) { die(); return; }

  // coins (world-space collision)
  for (const c of coins) {
    if (c.got) continue;
    c.bob += 0.09;
    const cy = c.y + Math.sin(c.bob) * 3;
    if (player.x < c.x + 9 && player.x + player.w > c.x - 9 &&
        player.y < cy + 9 && player.y + player.h > cy - 9) {
      c.got = true; coinCount++; score += 10;
      sfx.coin();
      burst(c.x - camX, cy, 10, ['#E8B04B', '#D4A574', '#F5D9A8'], 2, 26);
      updateHUD();
    }
  }

  // flag
  const fl = L.flag;
  if (player.x + player.w > fl.x && player.x < fl.x + 14 &&
      player.y + player.h > fl.y - 44 && player.y < fl.y) {
    completeLevel();
  }

  // camera
  const targetX = Math.max(0, Math.min(L.w - W, player.x + player.w / 2 - W / 2));
  camX += (targetX - camX) * 0.12;
  if (shake > 0) shake *= 0.85;

  // trail
  trail.push({ x: player.x + player.w / 2, y: player.y + player.h / 2, life: 10 });
  if (trail.length > 12) trail.shift();
  trail.forEach(t => t.life--);

  // particles
  particles = particles.filter(p => p.life > 0);
  for (const p of particles) { p.x += p.vx; p.y += p.vy; p.vy += p.grav; p.life--; }
}

function die() {
  sfx.death();
  deaths++;
  shake = 7;
  burst(player.x + player.w / 2 - camX, player.y + player.h / 2, 18, ['#C96A6A', '#D4A574', '#8E8E93'], 3, 30);
  score = banked; // lose current level's coins
  updateHUD();
  toast(`💀 Смерть ${deaths} · монеты уровня сброшены`);
  setTimeout(() => { if (state === 'transition') loadLevel(level, true); }, 350);
  state = 'transition';
}

function completeLevel() {
  sfx.win();
  const bonus = 50;
  banked = score + bonus;
  score = banked;
  burst(player.x + player.w / 2 - camX, LEVELS[level].flag.y - 30, 26, ['#E8B04B', '#8B9D83', '#F5F5F7'], 3.4, 46);
  if (level === LEVELS.length - 1) {
    finishGame();
    return;
  }
  toast(`✅ Уровень ${level + 1} пройден · +${bonus}`);
  if (!recordBeaten && banked > best && best > 0) { recordBeaten = true; toast(`🏆 Новый рекорд: ${banked}!`); sfx.record(); }
  if (banked > best) { best = banked; localStorage.setItem('platformer.best', best); }
  updateHUD();
  level++;
  state = 'transition';
  setTimeout(() => { if (state === 'transition') loadLevel(level); }, 600);
}

function finishGame() {
  if (score > best) {
    best = score;
    localStorage.setItem('platformer.best', best);
    sfx.record();
    showModal('🏆', 'Игра пройдена!',
      `Весь путь пройден!<br>Очки: <b>${score}</b> · Монеты: <b>${coinCount}</b> · Смерти: <b>${deaths}</b><br>Новый рекорд: <b>${best}</b>`);
  } else {
    showModal('🎖️', 'Игра пройдена!',
      `Весь путь пройден!<br>Очки: <b>${score}</b> · Монеты: <b>${coinCount}</b> · Смерти: <b>${deaths}</b><br>Рекорд: <b>${best}</b>`);
  }
}

/* ── moving platform init (snapshot base positions once) ── */
for (const L of LEVELS)
  for (const p of L.platforms)
    if (p.move) { p.baseX = p.x; p.baseY = p.y; p.dx = 0; p.dy = 0; }

/* ── render ── */
function draw() {
  const L = LEVELS[level];
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  ctx.clearRect(0, 0, W, H);

  // sky
  ctx.fillStyle = L.sky;
  ctx.fillRect(0, 0, W, H);

  // parallax dots (two layers)
  for (const [k, alpha, size] of [[0.25, 0.5, 1.4], [0.55, 0.3, 1]]) {
    ctx.fillStyle = `rgba(212,165,116,${alpha * 0.35})`;
    const off = (camX * k) % 80;
    for (let gx = -off; gx < W + 80; gx += 80)
      for (let gy = 30; gy < H - 40; gy += 55) {
        const jx = gx + ((gx * 7 + gy * 13) % 23), jy = gy + ((gx * 3 + gy * 5) % 17);
        ctx.fillRect(jx, jy, size, size);
      }
  }

  // shake
  const sx = shake > 0.3 ? (Math.random() - .5) * shake * 2 : 0;
  const sy = shake > 0.3 ? (Math.random() - .5) * shake * 2 : 0;
  ctx.translate(sx, sy);

  // platforms
  for (const p of L.platforms) {
    ctx.fillStyle = '#1A1A24';
    roundRect(p.x - camX, p.y, p.w, p.h, 4);
    ctx.fill();
    ctx.fillStyle = 'rgba(212,165,116,.35)';
    ctx.fillRect(p.x - camX + 2, p.y, p.w - 4, 2);
  }

  // spikes
  ctx.fillStyle = '#C96A6A';
  for (const s of L.spikes) {
    const n = Math.max(2, Math.round(s.w / 10));
    const step = s.w / n;
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      ctx.moveTo(s.x - camX + i * step, s.y + s.h);
      ctx.lineTo(s.x - camX + i * step + step / 2, s.y);
      ctx.lineTo(s.x - camX + (i + 1) * step, s.y + s.h);
    }
    ctx.fill();
  }

  // coins
  for (const c of coins) {
    if (c.got) continue;
    const cx = c.x - camX, cy = c.y + Math.sin(c.bob) * 3;
    const sq = Math.abs(Math.cos(c.bob * 0.7));
    ctx.fillStyle = '#E8B04B';
    ctx.beginPath();
    ctx.ellipse(cx, cy, 7 * (0.35 + 0.65 * sq), 7, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,240,200,.85)';
    ctx.beginPath();
    ctx.arc(cx - 2 * sq, cy - 2, 1.6, 0, Math.PI * 2);
    ctx.fill();
  }

  // flag
  {
    const fx = L.flag.x - camX, fy = L.flag.y;
    ctx.strokeStyle = '#8E8E93'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(fx + 2, fy); ctx.lineTo(fx + 2, fy - 46); ctx.stroke();
    const wave = Math.sin(time * 0.08) * 3;
    ctx.fillStyle = '#8B9D83';
    ctx.beginPath();
    ctx.moveTo(fx + 3, fy - 46);
    ctx.lineTo(fx + 22, fy - 39 + wave);
    ctx.lineTo(fx + 3, fy - 30);
    ctx.closePath(); ctx.fill();
  }

  // trail
  for (const t of trail) {
    if (t.life <= 0) continue;
    ctx.fillStyle = `rgba(212,165,116,${t.life / 40})`;
    ctx.beginPath();
    ctx.arc(t.x - camX, t.y, 3.5, 0, Math.PI * 2);
    ctx.fill();
  }

  // player (squash & stretch)
  {
    const sq = player.squash;
    const w = player.w * (1 + sq * 0.25), h = player.h * (1 - sq * 0.25);
    const px = player.x - camX + (player.w - w) / 2, py = player.y + (player.h - h);
    ctx.fillStyle = '#D4A574';
    roundRect(px, py, w, h, 5);
    ctx.fill();
    // eyes
    ctx.fillStyle = '#14100B';
    const ex = px + w / 2 + player.face * 3;
    ctx.beginPath();
    ctx.arc(ex - 3, py + 7, 1.8, 0, Math.PI * 2);
    ctx.arc(ex + 3, py + 7, 1.8, 0, Math.PI * 2);
    ctx.fill();
  }

  // particles
  for (const p of particles) {
    ctx.globalAlpha = Math.max(0, p.life / p.max);
    ctx.fillStyle = p.c;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function roundRect(x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/* ── main loop (fixed timestep) ── */
const STEP = 1000 / 60;
let acc = 0, last = performance.now();
function loop(now) {
  acc += Math.min(now - last, 100);
  last = now;
  while (acc >= STEP) {
    if (state === 'play') update();
    acc -= STEP;
  }
  draw();
  requestAnimationFrame(loop);
}

/* ── debug hooks (headless testing) ── */
window.__pl = {
  get state() { return state; },
  get level() { return level; },
  get score() { return score; },
  get deaths() { return deaths; },
  get best() { return best; },
  get player() { return player; },
  get coinsLeft() { return coins.filter(c => !c.got).length; },
  skipIntro() { levelIntro.classList.add('hidden'); state = 'play'; },
  win() { if (state === 'play') completeLevel(); },
  kill() { if (state === 'play') die(); },
  grabAll() { coins.forEach(c => { if (!c.got) { c.got = true; score += 10; coinCount++; } }); updateHUD(); },
  jump: pressJump,
  key: (k, v) => { keys[k] = v; },
};

/* ── boot ── */
updateHUD();
loadLevel(0);
requestAnimationFrame(loop);
