// ─── Canvas ─────────────────────────────────────────────
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const HUD = document.getElementById('hud');
const TB = document.getElementById('topbar');
const scoreEl = document.getElementById('score');
const speedLabel = document.getElementById('speed-label');
const overlay = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlay-title');
const overlaySub = document.getElementById('overlay-sub');
const btnNext = document.getElementById('btn-next');
const toastBox = document.getElementById('toast-container');

/* ── audio (WebAudio) ── */
let actx = null;
let muted = localStorage.getItem('race.muted') === '1';
let engOsc = null, engGain = null;
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
function engineStart() {
  if (muted || engOsc) return;
  const ac = audio(); if (!ac) return;
  engOsc = ac.createOscillator(); engGain = ac.createGain();
  engOsc.type = 'sawtooth'; engOsc.frequency.value = 55;
  engGain.gain.value = 0.018;
  const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 240;
  engOsc.connect(f); f.connect(engGain); engGain.connect(ac.destination);
  engOsc.start();
}
function engineStop() {
  if (engOsc) { try { engOsc.stop(); } catch (e) {} engOsc = null; engGain = null; }
}
const sfx = {
  crash: () => { tone(160, .35, 'sawtooth', .09, -110); tone(70, .4, 'square', .06, -30); },
  star:  () => { tone(980, .08, 'sine', .05); setTimeout(() => tone(1470, .1, 'sine', .045), 50); },
  record:() => [659, 784, 1047, 1319].forEach((f, i) => setTimeout(() => tone(f, .18, 'sine', .06), i * 105)),
  click: () => tone(600, .05, 'square', .03),
};
function updateMuteBtn() { document.getElementById('btn-mute').textContent = muted ? '🔇' : '🔊'; }
document.getElementById('btn-mute').addEventListener('click', () => {
  muted = !muted;
  localStorage.setItem('race.muted', muted ? '1' : '0');
  updateMuteBtn();
  if (muted) engineStop(); else { sfx.click(); if (!gameOver) engineStart(); }
});
updateMuteBtn();
['keydown', 'pointerdown', 'touchstart'].forEach(ev =>
  document.addEventListener(ev, () => { audio(); if (!gameOver) engineStart(); }, { passive: true }));

function toast(msg) {
  const t = document.createElement('div');
  t.className = 'toast'; t.textContent = msg;
  toastBox.appendChild(t);
  setTimeout(() => t.classList.add('out'), 1900);
  setTimeout(() => t.remove(), 2300);
}

let cw, ch, dpr = window.devicePixelRatio || 1;

// ─── Road Layout ────────────────────────────────────────
const ROAD_F = 0.78;
const LANES = 4;
let roadL, roadW, laneW, carW, carH;

function calcLayout() {
  roadL = (cw - cw * ROAD_F) / 2;
  roadW = cw * ROAD_F;
  laneW = roadW / LANES;
  carW = laneW * 0.68;
  carH = carW * 1.7;
}

// ─── State ──────────────────────────────────────────────
let player = { x: 0, y: 0 };
let enemies = [];
let stars = [];
let lives = 3;
let gameOver = false;
let gameTime = 0;
let score = 0;
let roadOffset = 0;
let touchX = null;
let spawnTimer = 0;
let starTimer = 0;
let pendingSpawn = null;
let invulnTimer = 0;
let animId = null;
let frameId = 0;
let particles = [];
let shake = 0;
let recordBeaten = false;
let best = +(localStorage.getItem('race.best') || 0);

// ─── Cars ───────────────────────────────────────────────
const COLORS = ['#C96A6A','#8B9D83','#7A6A8F','#A8763E','#5F7E8A','#B0563F','#4F6B5C'];

function drawCar(x, y, w, h, color, isPlayer) {
  const r = w * 0.15;
  ctx.save();
  if (isPlayer && invulnTimer > 0 && Math.floor(invulnTimer / 100) % 2 === 0) {
    ctx.globalAlpha = 0.4;
  }
  ctx.fillStyle = color;
  roundRect(ctx, x - w / 2, y - h / 2, w, h, r);
  ctx.fill();
  ctx.fillStyle = 'rgba(0,0,0,0.2)';
  roundRect(ctx, x - w / 2 + 2, y - h / 2 + 2, w, h, r);
  ctx.fill();
  ctx.fillStyle = color;
  roundRect(ctx, x - w / 2, y - h / 2, w, h, r);
  ctx.fill();

  const ws = w * 0.72, wh = h * 0.22;
  ctx.fillStyle = isPlayer ? 'rgba(150,220,255,0.5)' : 'rgba(200,230,255,0.35)';
  roundRect(ctx, x - ws / 2, y - h / 2 + h * 0.12, ws, wh, 3);
  ctx.fill();

  ctx.fillStyle = 'rgba(200,230,255,0.2)';
  roundRect(ctx, x - ws * 0.7 / 2, y + h / 2 - h * 0.30, ws * 0.7, wh * 0.7, 2);
  ctx.fill();

  const whW = w * 0.12, whH = h * 0.18;
  ctx.fillStyle = '#222';
  const wx = w / 2 - 2, wy1 = -h * 0.22, wy2 = h * 0.18;
  for (const side of [-1, 1]) {
    ctx.fillRect(x + side * wx - whW / 2, y + wy1 - whH / 2, whW, whH);
    ctx.fillRect(x + side * wx - whW / 2, y + wy2 - whH / 2, whW, whH);
  }

  const lr = w * 0.06;
  for (const side of [-1, 1]) {
    ctx.fillStyle = isPlayer ? '#ffd700' : '#ff4444';
    ctx.beginPath();
    ctx.arc(x + side * w * 0.3, y - h / 2 + lr + 2, lr, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + h - r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

// ─── Game Loop ─────────────────────────────────────────

function resetGame() {
  const vh = window.visualViewport ? window.visualViewport.height : window.innerHeight;
  cw = Math.min(window.innerWidth, 420);
  ch = vh - HUD.offsetHeight - (TB ? TB.offsetHeight : 0);
  canvas.width = cw * dpr;
  canvas.height = ch * dpr;
  canvas.style.width = cw + 'px';
  canvas.style.height = ch + 'px';
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  calcLayout();

  player.x = cw / 2;
  player.y = ch - carH;
  enemies = [];
  stars = [];
  lives = 3;
  gameOver = false;
  gameTime = 0;
  score = 0;
  roadOffset = 0;
  spawnTimer = 0;
  starTimer = 0;
  touchX = null;
  pendingSpawn = null;
  invulnTimer = 0;
  frameId = 0;
  particles = [];
  shake = 0;
  recordBeaten = false;
  overlay.classList.add('hidden');
  if (animId) { cancelAnimationFrame(animId); animId = null; }
  engineStart();
  loop();
}

function loop() {
  if (gameOver) return;

  const dt = 1;
  frameId++;

  gameTime += dt / 60;
  if (frameId % 3 === 0) score++;
  roadOffset = (roadOffset + 2.5 + gameTime * 6) % 80;

  const baseSpeed = 2.5 + gameTime * 0.3;

  // engine pitch follows speed
  if (engOsc && !muted) engOsc.frequency.value = 50 + baseSpeed * 9;

  // Invulnerability timer
  if (invulnTimer > 0) invulnTimer -= dt;

  // record toast (once per run)
  if (!recordBeaten && best > 0 && score > best) {
    recordBeaten = true;
    toast('🏆 Рекорд побит: ' + score + '!');
    sfx.record();
  }

  // exhaust puffs
  if (frameId % 5 === 0)
    particles.push({ x: player.x + (Math.random() - .5) * carW * .4, y: player.y + carH / 2,
      vx: (Math.random() - .5) * .3, vy: 1.2 + Math.random() * .8,
      life: 16, max: 16, r: 2 + Math.random() * 2, c: 'rgba(180,180,190,.35)', grav: 0 });

  // speed lines on INSANE
  if (baseSpeed > 8.6 && frameId % 3 === 0)
    particles.push({ x: roadL + Math.random() * roadW, y: -8, vx: 0, vy: 9 + Math.random() * 4,
      life: 14, max: 14, r: 1, c: 'rgba(212,165,116,.4)', grav: 0, line: true });

  // Player follow touch
  if (touchX !== null) {
    const target = Math.max(roadL + carW / 2, Math.min(roadL + roadW - carW / 2, touchX));
    player.x += (target - player.x) * 0.18;
  }

  // Spawn warning → actual spawn
  if (pendingSpawn) {
    pendingSpawn.delay -= dt;
    if (pendingSpawn.delay <= 0) {
      enemies.push({
        x: pendingSpawn.x, y: -carH, w: carW, h: carH,
        speed: 1.5 + Math.random() * 0.8 + (gameTime * 0.0003),
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
      });
      pendingSpawn = null;
    }
  }

  // Trigger new spawn with warning
  const interval = Math.max(350, 1200 - gameTime * 10);
  spawnTimer += dt;
  if (spawnTimer >= interval && !pendingSpawn) {
    if (Math.random() < 0.65 + gameTime * 0.005) {
      pendingSpawn = {
        x: roadL + carW / 2 + Math.random() * (roadW - carW),
        delay: Math.max(300, 700 - gameTime * 3),
      };
    }
    spawnTimer = 0;
  }

  // Stars
  starTimer += dt;
  if (starTimer > 2000 + Math.random() * 1500) {
    starTimer = 0;
    stars.push({ x: roadL + 10 + Math.random() * (roadW - 20), y: -12, r: 10 });
  }
  for (let i = stars.length - 1; i >= 0; i--) {
    const s = stars[i];
    s.y += baseSpeed * 0.7;
    if (s.y > ch + 20) { stars.splice(i, 1); continue; }
    const dx = player.x - s.x, dy = player.y - s.y;
    if (Math.abs(dx) < carW / 2 + s.r && Math.abs(dy) < carH / 2 + s.r) {
      score += 15;
      sfx.star();
      for (let i = 0; i < 10; i++) {
        const a = Math.random() * Math.PI * 2, v = 1 + Math.random() * 2;
        particles.push({ x: s.x, y: s.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v,
          life: 24, max: 24, r: 1.5 + Math.random() * 1.5, c: '#E8B04B', grav: .05 });
      }
      stars.splice(i, 1);
    }
  }

  // Move enemies + collision
  for (let i = enemies.length - 1; i >= 0; i--) {
    const e = enemies[i];
    e.y += e.speed + baseSpeed * 0.3;
    if (e.y - e.h / 2 > ch + 50) { enemies.splice(i, 1); continue; }

    if (invulnTimer <= 0) {
      const pw = carW * 0.6, ph = carH * 0.6;
      if (player.x - pw / 2 < e.x + e.w / 2 && player.x + pw / 2 > e.x - e.w / 2 &&
          player.y - ph / 2 < e.y + e.h / 2 && player.y + ph / 2 > e.y - e.h / 2) {
        lives--;
        invulnTimer = 1200;
        sfx.crash();
        shake = 9;
        for (let i = 0; i < 16; i++) {
          const a = Math.random() * Math.PI * 2, v = 1.5 + Math.random() * 3;
          particles.push({ x: player.x, y: player.y - carH * .3, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 1,
            life: 30, max: 30, r: 1.5 + Math.random() * 2.5, c: ['#C96A6A', '#E8B04B', '#8E8E93'][(Math.random() * 3) | 0], grav: .1 });
        }
        enemies.splice(i, 1);
        if (lives <= 0) {
          gameOver = true;
          engineStop();
          showGameOver();
          return;
        }
        continue;
      }
    }
  }

  updateHUD();
  draw();
  animId = requestAnimationFrame(loop);
}

// ─── Particles update ─────────────────────────────────
function updateParticles() {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x += p.vx; p.y += p.vy;
    if (p.grav) p.vy += p.grav;
    if (--p.life <= 0) particles.splice(i, 1);
  }
}

// ─── Drawing ────────────────────────────────────────────

function draw() {
  ctx.clearRect(0, 0, cw, ch);

  // shake
  const sx = shake > 0.3 ? (Math.random() - .5) * shake * 2 : 0;
  const sy = shake > 0.3 ? (Math.random() - .5) * shake * 2 : 0;
  ctx.save();
  ctx.translate(sx, sy);

  // night grass
  ctx.fillStyle = '#0C1014';
  ctx.fillRect(0, 0, cw, ch);
  ctx.fillStyle = 'rgba(139,157,131,.14)';
  for (let gy = ((frameId * 2.5) % 46) - 46; gy < ch; gy += 46)
    for (let gx = 6; gx < roadL; gx += 34) {
      ctx.fillRect(gx, gy, 2, 5);
      ctx.fillRect(roadL + roadW + (gx % 27) + 8, gy + 20, 2, 5);
    }

  // road
  ctx.fillStyle = '#16161E';
  ctx.fillRect(roadL, 0, roadW, ch);

  ctx.fillStyle = 'rgba(212,165,116,.45)';
  ctx.fillRect(roadL - 2, 0, 3, ch);
  ctx.fillRect(roadL + roadW - 1, 0, 3, ch);

  ctx.fillStyle = 'rgba(212,165,116,.22)';
  const dashH = 30, gapH = 30, totalH = dashH + gapH;
  for (let lane = 1; lane < LANES; lane++) {
    const lx = roadL + lane * laneW - 1;
    for (let y = -gapH + roadOffset % totalH; y < ch + dashH; y += totalH) {
      ctx.fillRect(lx, y, 2, dashH);
    }
  }

  // Spawn warning (красная подсветка на дороге)
  if (pendingSpawn) {
    const warnW = carW * 1.5, warnH = carH * 0.4;
    const alpha = 0.3 + 0.5 * Math.sin(pendingSpawn.delay * 0.08);
    ctx.fillStyle = `rgba(255,0,0,${alpha})`;
    roundRect(ctx, pendingSpawn.x - warnW / 2, 4, warnW, warnH, 5);
    ctx.fill();
    ctx.fillStyle = `rgba(255,200,0,${alpha * 0.6})`;
    roundRect(ctx, pendingSpawn.x - warnW / 2 + 3, 7, warnW - 6, warnH * 0.4, 3);
    ctx.fill();
    // Треугольник-указатель
    ctx.fillStyle = `rgba(255,0,0,${alpha * 0.7})`;
    ctx.beginPath();
    ctx.moveTo(pendingSpawn.x, 4 + warnH + 8);
    ctx.lineTo(pendingSpawn.x - 6, 4 + warnH + 1);
    ctx.lineTo(pendingSpawn.x + 6, 4 + warnH + 1);
    ctx.closePath();
    ctx.fill();
  }

  // Stars
  for (const s of stars) {
    const pulse = 0.8 + 0.2 * Math.sin(frameId * 0.1 + s.x);
    ctx.fillStyle = '#ffd700';
    ctx.beginPath();
    drawStar(ctx, s.x, s.y, 5, s.r * pulse, s.r * 0.45 * pulse);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,215,0,0.3)';
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.r * 1.3 * pulse, 0, Math.PI * 2);
    ctx.fill();
  }

  // Enemies
  for (const e of enemies) {
    drawCar(e.x, e.y, e.w, e.h, e.color, false);
  }

  // Player
  drawCar(player.x, player.y, carW, carH, '#D4A574', true);

  // particles
  for (const p of particles) {
    ctx.globalAlpha = Math.max(0, p.life / p.max);
    ctx.fillStyle = p.c;
    if (p.line) ctx.fillRect(p.x, p.y, 1.5, 14);
    else { ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill(); }
  }
  ctx.globalAlpha = 1;

  ctx.restore();

  // Lives
  ctx.font = `${Math.max(14, cw * 0.04)}px sans-serif`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  let livesStr = '';
  for (let i = 0; i < lives; i++) livesStr += '❤️';
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.fillText(livesStr || '💀', 8, 6);

  if (shake > 0) shake *= 0.86;
  updateParticles();
}

function drawStar(ctx, cx, cy, spikes, outerR, innerR) {
  let rot = -Math.PI / 2;
  const step = Math.PI / spikes;
  ctx.moveTo(cx + Math.cos(rot) * outerR, cy + Math.sin(rot) * outerR);
  for (let i = 0; i < spikes; i++) {
    ctx.lineTo(cx + Math.cos(rot) * outerR, cy + Math.sin(rot) * outerR);
    rot += step;
    ctx.lineTo(cx + Math.cos(rot) * innerR, cy + Math.sin(rot) * innerR);
    rot += step;
  }
  ctx.closePath();
}

function updateHUD() {
  scoreEl.textContent = score;
  const s = 2.5 + gameTime * 0.3;
  if (s < 4) speedLabel.textContent = '⏱ NORMAL';
  else if (s < 6) speedLabel.textContent = '⏱ FAST';
  else if (s < 9) speedLabel.textContent = '⏱ VERY FAST';
  else speedLabel.textContent = '⏱ INSANE!';
}

function showGameOver() {
  draw();
  var isRec = score > best;
  if (isRec) { best = Math.round(score); try { localStorage.setItem('race.best', String(best)); } catch (e) {} }
  overlayTitle.textContent = isRec ? '🏆 Новый рекорд!' : '💥 Game Over';
  overlaySub.textContent = 'Счёт: ' + score + ' | Звёзд: ' + Math.floor(score / 15) + ' | Рекорд: ' + Math.round(best);
  if (isRec) sfx.record();
  btnNext.textContent = 'Заново';
  btnNext.onclick = resetGame;
  overlay.classList.remove('hidden');
}

// ─── Debug hooks (headless) ─────────────────────────────
window.__rc = {
  get state() { return gameOver ? 'over' : 'play'; },
  get score() { return score; },
  get lives() { return lives; },
  get best() { return best; },
  get enemies() { return enemies.length; },
  crash() {
    if (!enemies.length) enemies.push({ x: player.x, y: player.y, w: carW, h: carH, speed: 1, color: '#C96A6A' });
    lives = 1; invulnTimer = 0;
    enemies[0].x = player.x; enemies[0].y = player.y;
  },
  setScore(v) { score = v; },
};

// ─── Touch / Mouse ─────────────────────────────────────

function onPointer(clientX) {
  const rect = canvas.getBoundingClientRect();
  touchX = clientX - rect.left;
}

canvas.addEventListener('touchstart', (e) => {
  e.preventDefault();
  onPointer(e.touches[0].clientX);
});
canvas.addEventListener('touchmove', (e) => {
  e.preventDefault();
  onPointer(e.touches[0].clientX);
});
canvas.addEventListener('touchend', () => { touchX = null; });
canvas.addEventListener('touchcancel', () => { touchX = null; });

canvas.addEventListener('mousedown', (e) => onPointer(e.clientX));
canvas.addEventListener('mousemove', (e) => { if (e.buttons & 1) onPointer(e.clientX); });
canvas.addEventListener('mouseup', () => { touchX = null; });
canvas.addEventListener('mouseleave', () => { touchX = null; });

// ─── Resize ─────────────────────────────────────────────

function resize() {
  if (gameOver) return;
  const vh = window.visualViewport ? window.visualViewport.height : window.innerHeight;
  cw = Math.min(window.innerWidth, 420);
  ch = vh - HUD.offsetHeight - (TB ? TB.offsetHeight : 0);
  if (ch < 100) return;
  canvas.width = cw * dpr;
  canvas.height = ch * dpr;
  canvas.style.width = cw + 'px';
  canvas.style.height = ch + 'px';
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  calcLayout();
  player.y = ch - carH;
}

window.addEventListener('resize', resize);
if (window.visualViewport) window.visualViewport.addEventListener('resize', resize);

// ─── Start ──────────────────────────────────────────────
resetGame();
