// ─── Canvas ─────────────────────────────────────────────
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const HUD = document.getElementById('hud');
const scoreEl = document.getElementById('score');
const livesEl = document.getElementById('lives');
const wlevelEl = document.getElementById('wlevel');
const overlay = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlay-title');
const overlaySub = document.getElementById('overlay-sub');
const btnNext = document.getElementById('btn-next');

let cw, ch, dpr = window.devicePixelRatio || 1;

// ─── Sizing ─────────────────────────────────────────────
let PW, PH, EW, EH;
function calcSizes() {
  PW = cw * 0.075; PH = PW * 1.35;
  EW = cw * 0.065; EH = EW * 1.0;
}

// ─── State ──────────────────────────────────────────────
let score = 0, lives = 3, wlevel = 1;
let player = { x: 0, y: 0 };
let bullets = [], enemyBullets = [];
let enemies = [], pickups = [], particles = [], paras = [];
let stars = [], groundTrees = [];
let gameOver = false, gameState = 'playing';
let frameId = 0, fireTimer = 0, invulnTimer = 0;
let scrollY = 0, groundY = 0;
let spawnTimer = 0, paraDropTimer = 0;
let touchX = null, touchY = null;
let animId = null;

// ─── Weapon Config ─────────────────────────────────────
function weaponConfig(lvl) {
  const cfg = { rate: 8, count: 1, spread: 0, speed: 7, dmg: 1, side: 0 };
  if (lvl >= 2) cfg.rate = 7;
  if (lvl >= 3) cfg.rate = 6;
  if (lvl >= 4) { cfg.count = 2; cfg.spread = 0.15; }
  if (lvl >= 5) { cfg.count = 3; cfg.spread = 0.12; }
  if (lvl >= 6) { cfg.count = 5; cfg.spread = 0.1; cfg.side = 1; }
  if (lvl >= 7) cfg.speed = 8;
  if (lvl >= 8) cfg.dmg = 2;
  if (lvl >= 9) cfg.speed = 10;
  return cfg;
}

// ─── Player ─────────────────────────────────────────────
function drawShip(x, y) {
  ctx.save();
  if (invulnTimer > 0 && Math.floor(invulnTimer / 80) % 2 === 0) ctx.globalAlpha = 0.3;
  ctx.fillStyle = '#4af';
  ctx.beginPath();
  ctx.moveTo(x, y - PH / 2);
  ctx.lineTo(x - PW / 2, y + PH / 2);
  ctx.lineTo(x + PW / 2, y + PH / 2);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = 'rgba(150,220,255,0.4)';
  ctx.beginPath();
  ctx.moveTo(x, y - PH / 3);
  ctx.lineTo(x - PW / 4, y + PH / 6);
  ctx.lineTo(x + PW / 4, y + PH / 6);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#38d';
  ctx.fillRect(x - PW / 2 - 2, y + PH / 6, 2, PH / 5);
  ctx.fillRect(x + PW / 2, y + PH / 6, 2, PH / 5);
  if (frameId % 6 < 3) {
    ctx.fillStyle = 'rgba(255,200,50,0.5)';
    ctx.beginPath();
    ctx.moveTo(x - PW / 4, y + PH / 2);
    ctx.lineTo(x, y + PH / 2 + 5);
    ctx.lineTo(x + PW / 4, y + PH / 2);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

// ─── Enemies ────────────────────────────────────────────
function drawTank(e) {
  const x = e.x, y = e.y;
  ctx.fillStyle = '#5a5a3a';
  roundRect(ctx, x - e.w / 2, y - e.h / 2, e.w, e.h, 3);
  ctx.fill();
  ctx.fillStyle = '#4a4a2a';
  ctx.fillRect(x - e.w * 0.15, y - e.h / 2 - 4, e.w * 0.3, 6);
  ctx.fillRect(x + e.w * 0.05, y - e.h / 2 - 2, 3, 6);
  if (e.hp > 1) { ctx.fillStyle = '#f44'; ctx.fillRect(x - e.w / 3, y + e.h / 2 - 5, e.w * 0.3, 3); }
}

function drawTurret(e) {
  const x = e.x, y = e.y;
  ctx.fillStyle = '#666';
  ctx.fillRect(x - e.w / 2, y - e.h / 2, e.w, e.h);
  ctx.fillStyle = '#555';
  ctx.beginPath();
  ctx.arc(x, y, e.w * 0.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#888';
  ctx.fillRect(x - 2, y - e.h / 2 - 6, 4, 8);
}

function drawFighter(e) {
  const x = e.x, y = e.y;
  ctx.fillStyle = e.color || '#c33';
  ctx.beginPath();
  ctx.moveTo(x, y + e.h / 2);
  ctx.lineTo(x - e.w / 2, y - e.h / 2);
  ctx.lineTo(x + e.w / 2, y - e.h / 2);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = 'rgba(255,200,50,0.4)';
  ctx.beginPath();
  ctx.arc(x, y + e.h * 0.1, e.w * 0.12, 0, Math.PI * 2);
  ctx.fill();
}

function drawPara(p) {
  const x = p.x, y = p.y;
  ctx.fillStyle = 'rgba(255,255,255,0.3)';
  ctx.beginPath();
  ctx.arc(x, y - 6, 7, Math.PI, 0);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.moveTo(x - 7, y - 6);
  ctx.lineTo(x - 3, y);
  ctx.lineTo(x + 3, y);
  ctx.lineTo(x + 7, y - 6);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#999';
  ctx.lineWidth = 0.5;
  for (const sx of [-4, 0, 4]) {
    ctx.beginPath();
    ctx.moveTo(x + sx, y);
    ctx.lineTo(x + sx, y + 8);
    ctx.stroke();
  }
  ctx.fillStyle = '#ffd700';
  ctx.font = '5px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('✦', x, y + 6);
}

// ─── Pickups ────────────────────────────────────────────
function drawPickup(p) {
  const pulse = 1 + 0.12 * Math.sin(frameId * 0.08 + p.x);
  if (p.type === 'coin') {
    ctx.fillStyle = '#ffd700';
    ctx.beginPath();
    ctx.arc(p.x, p.y, 7 * pulse, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#b8860b';
    ctx.font = '7px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('$', p.x, p.y + 0.5);
  } else if (p.type === 'life') {
    ctx.fillStyle = '#f44';
    ctx.font = '13px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('❤️', p.x, p.y);
  } else {
    ctx.fillStyle = '#8B4513';
    roundRect(ctx, p.x - 8, p.y - 7, 16, 14, 2);
    ctx.fill();
    ctx.fillStyle = '#ffd700';
    ctx.font = 'bold 9px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('P', p.x, p.y + 0.5);
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    ctx.fillRect(p.x - 7, p.y - 6, 14, 2);
  }
}

// ─── Particles ──────────────────────────────────────────
function burst(x, y, color, n) {
  for (let i = 0; i < n; i++) {
    particles.push({ x, y, vx: (Math.random() - 0.5) * 5, vy: (Math.random() - 0.5) * 5, life: 25 + Math.random() * 20, max: 45, color, r: 1.5 + Math.random() * 3 });
  }
}

// ─── Ground ─────────────────────────────────────────────
const GROUND_H = 0.35;

function initGround() {
  groundTrees = [];
  for (let i = 0; i < 20; i++) {
    groundTrees.push({ x: Math.random() * cw, y: Math.random() * ch, h: 6 + Math.random() * 10, w: 3 + Math.random() * 3 });
  }
}

function drawGround(scroll) {
  const gh = ch * GROUND_H;
  const gy = ch - gh;
  ctx.fillStyle = '#2a5a2a';
  ctx.fillRect(0, gy, cw, gh);
  ctx.fillStyle = '#3a6a2a';
  for (let y = -20 + scroll % 40; y < ch + 20; y += 20) {
    ctx.fillRect(0, gy + y, cw, 1);
  }
  ctx.fillStyle = '#1a4a1a';
  ctx.fillRect(0, gy, cw, 2);
  for (const t of groundTrees) {
    const ty = gy + ((t.y + scroll * 0.3) % gh);
    ctx.fillStyle = '#3a2a1a';
    ctx.fillRect(t.x - 1, ty - t.h, 2, t.h);
    ctx.fillStyle = '#2a6a2a';
    ctx.beginPath();
    ctx.arc(t.x, ty - t.h, t.w, 0, Math.PI * 2);
    ctx.fill();
  }
}

function groundTop() { return ch - ch * GROUND_H; }

// ─── Spawning ───────────────────────────────────────────
function spawnEnemy() {
  const gt = groundTop();
  const r = Math.random();
  if (r < 0.25) {
    enemies.push({ type: 'tank', x: 10 + Math.random() * (cw - 20), y: gt + 5, w: 22, h: 14, hp: 2, maxHp: 2, shootTimer: 60 + Math.random() * 80 });
  } else if (r < 0.45) {
    enemies.push({ type: 'turret', x: 10 + Math.random() * (cw - 20), y: gt + 5, w: 16, h: 18, hp: 1, shootTimer: 30 + Math.random() * 40 });
  } else {
    enemies.push({ type: 'fighter', x: Math.random() * cw, y: -20, w: EW, h: EH, hp: 1, vx: (Math.random() - 0.5) * 1.5, vy: 1 + Math.random() * 1.5, color: ['#c33','#c90','#a5a'][Math.floor(Math.random()*3)], shootTimer: 40 + Math.random() * 60 });
  }
}

function tryDropPara() {
  enemies.push({ type: 'bomber', x: Math.random() * cw, y: -20, w: EW * 1.3, h: EH * 0.8, hp: 3, vx: (Math.random() - 0.5) * 1, vy: 0.8, dropTimer: 30, color: '#884400' });
}

// ─── Game Loop ─────────────────────────────────────────

function resetGame() {
  const vh = window.visualViewport ? window.visualViewport.height : window.innerHeight;
  cw = Math.min(window.innerWidth, 420);
  ch = vh - HUD.offsetHeight;
  canvas.width = cw * dpr;
  canvas.height = ch * dpr;
  canvas.style.width = cw + 'px';
  canvas.style.height = ch + 'px';
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  calcSizes();

  player.x = cw / 2; player.y = ch * 0.7;
  bullets = []; enemyBullets = []; enemies = []; pickups = []; particles = []; paras = [];
  lives = 3; score = 0; wlevel = 1;
  gameOver = false; frameId = 0; fireTimer = 0; invulnTimer = 0;
  scrollY = 0; spawnTimer = 0; paraDropTimer = 0;
  touchX = null; touchY = null;
  initGround();
  overlay.classList.add('hidden');
  if (animId) { cancelAnimationFrame(animId); animId = null; }
  loop();
}

function loop() {
  if (gameOver) return;
  frameId++;
  const dt = 1;

  if (invulnTimer > 0) invulnTimer -= dt;
  scrollY += 0.8;

  // Stars
  for (const s of stars) { s.y += s.sp; if (s.y > ch) { s.y = -2; s.x = Math.random() * cw; } }

  // Player follow touch
  if (touchX !== null && touchY !== null) {
    const tx = Math.max(PW / 2, Math.min(cw - PW / 2, touchX));
    const ty = Math.max(PH / 2, Math.min(groundTop() - PH / 2, touchY));
    player.x += (tx - player.x) * 0.15;
    player.y += (ty - player.y) * 0.15;
  }

  // Auto-fire
  const w = weaponConfig(wlevel);
  if (++fireTimer >= w.rate) {
    fireTimer = 0;
    if (w.count === 1) {
      bullets.push({ x: player.x, y: player.y - PH / 2, vx: 0, vy: -w.speed, w: 3, h: 8, dmg: w.dmg });
    } else {
      const n = w.count - (w.side > 0 ? 2 : 0);
      for (let i = 0; i < n; i++) {
        const off = (i - (n - 1) / 2) * w.spread;
        bullets.push({ x: player.x + off * 15, y: player.y - PH / 2, vx: off * 0.5, vy: -w.speed, w: 3, h: 8, dmg: w.dmg });
      }
      if (w.side) {
        bullets.push({ x: player.x - PW / 2 - 4, y: player.y, vx: -w.speed * 0.7, vy: -w.speed * 0.1, w: 3, h: 6, dmg: w.dmg });
        bullets.push({ x: player.x + PW / 2 + 4, y: player.y, vx: w.speed * 0.7, vy: -w.speed * 0.1, w: 3, h: 6, dmg: w.dmg });
      }
    }
  }

  // Move bullets
  for (let i = bullets.length - 1; i >= 0; i--) {
    const b = bullets[i];
    b.x += b.vx; b.y += b.vy;
    if (b.y + 8 < 0 || b.x + 3 < 0 || b.x - 3 > cw) bullets.splice(i, 1);
  }
  for (let i = enemyBullets.length - 1; i >= 0; i--) {
    const b = enemyBullets[i];
    b.x += b.vx; b.y += b.vy;
    if (b.y > ch + 20 || b.x < -20 || b.x > cw + 20) enemyBullets.splice(i, 1);
  }

  // Spawn ground/air enemies
  const interval = Math.max(40, 120 - frameId * 0.02);
  spawnTimer += dt;
  if (spawnTimer >= interval) {
    spawnTimer = 0;
    spawnEnemy();
    if (frameId > 300 && Math.random() < 0.08) tryDropPara();
  }

  // Move enemies
  const gt = groundTop();
  for (let i = enemies.length - 1; i >= 0; i--) {
    const e = enemies[i];
    if (e.type === 'tank') {
      e.shootTimer -= dt;
      if (e.shootTimer <= 0) {
        e.shootTimer = 70 + Math.random() * 40;
        enemyBullets.push({ x: e.x, y: e.y - 8, vx: (Math.random() - 0.5) * 0.5, vy: -1.5, w: 3, h: 5 });
      }
      if (e.y > ch + 30) { enemies.splice(i, 1); continue; }
    } else if (e.type === 'turret') {
      e.shootTimer -= dt;
      if (e.shootTimer <= 0) {
        e.shootTimer = 25 + Math.random() * 20;
        const dx = player.x - e.x, dy = player.y - e.y;
        const d = Math.sqrt(dx * dx + dy * dy) || 1;
        enemyBullets.push({ x: e.x, y: e.y - 10, vx: dx / d * 2.5, vy: dy / d * 2.5, w: 3, h: 5 });
      }
    } else if (e.type === 'fighter') {
      e.x += e.vx; e.y += e.vy;
      if (e.x < -20 || e.x > cw + 20 || e.y > ch + 30) { enemies.splice(i, 1); continue; }
      e.shootTimer -= dt;
      if (e.shootTimer <= 0) {
        e.shootTimer = 50 + Math.random() * 40;
        enemyBullets.push({ x: e.x, y: e.y + EH / 2, vx: (Math.random() - 0.5) * 0.3, vy: 2, w: 3, h: 5 });
      }
    } else if (e.type === 'bomber') {
      e.x += e.vx; e.y += e.vy;
      if (e.y > ch + 30) { enemies.splice(i, 1); continue; }
      if (--e.dropTimer <= 0) {
        e.dropTimer = 50;
        const py = e.y + EH / 2;
        if (py < groundTop()) {
          paras.push({ x: e.x + (Math.random() - 0.5) * 10, y: py, vy: 0.6 });
        }
      }
    }
  }

  // Paratroopers
  for (let i = paras.length - 1; i >= 0; i--) {
    const p = paras[i];
    p.y += p.vy;
    if (p.y > gt - 4) { paras.splice(i, 1); continue; }
    if (Math.abs(p.x - player.x) < PW / 2 + 6 && Math.abs(p.y - player.y) < PH / 2 + 6) {
      score += 50;
      burst(p.x, p.y, '#ffd700', 8);
      paras.splice(i, 1);
    }
  }

  // Bullet-enemy collision
  for (let i = bullets.length - 1; i >= 0; i--) {
    const b = bullets[i];
    for (let j = enemies.length - 1; j >= 0; j--) {
      const e = enemies[j];
      if (Math.abs(b.x - e.x) < e.w / 2 + 3 && Math.abs(b.y - e.y) < e.h / 2 + 4) {
        bullets.splice(i, 1);
        e.hp -= b.dmg;
        burst(e.x, e.y, '#ff0', 4);
        if (e.hp <= 0) {
          score += 10 + frameId * 0.05;
          burst(e.x, e.y, '#f44', 12);
          const r = Math.random();
          if (r < 0.12) pickups.push({ x: e.x, y: e.y, type: 'coin' });
          else if (r < 0.16) pickups.push({ x: e.x, y: e.y, type: 'life' });
          else if (r < 0.22) pickups.push({ x: e.x, y: e.y, type: 'upgrade' });
          enemies.splice(j, 1);
        }
        break;
      }
    }
  }

  // Enemy/para bullet → player
  if (invulnTimer <= 0) {
    for (let i = enemyBullets.length - 1; i >= 0; i--) {
      const b = enemyBullets[i];
      if (Math.abs(b.x - player.x) < PW / 2 + 3 && Math.abs(b.y - player.y) < PH / 2 + 4) {
        enemyBullets.splice(i, 1);
        hitPlayer();
        if (gameOver) { draw(); showGameOver(); return; }
        break;
      }
    }
    if (invulnTimer <= 0) {
      for (const e of enemies) {
        if (Math.abs(e.x - player.x) < PW / 2 + e.w / 2 && Math.abs(e.y - player.y) < PH / 2 + e.h / 2) {
          hitPlayer();
          e.hp--;
          if (e.hp <= 0) { score += 5; enemies.splice(enemies.indexOf(e), 1); }
          if (gameOver) { draw(); showGameOver(); return; }
          break;
        }
      }
    }
  }

  // Pickup collection
  for (let i = pickups.length - 1; i >= 0; i--) {
    const p = pickups[i];
    p.y += 1.2;
    if (p.y > ch + 20) { pickups.splice(i, 1); continue; }
    if (Math.abs(p.x - player.x) < PW / 2 + 10 && Math.abs(p.y - player.y) < PH / 2 + 10) {
      if (p.type === 'coin') { score += 100; burst(p.x, p.y, '#ffd700', 8); }
      if (p.type === 'life') { lives = Math.min(5, lives + 1); burst(p.x, p.y, '#f44', 10); }
      if (p.type === 'upgrade') { wlevel = Math.min(9, wlevel + 1); burst(p.x, p.y, '#4af', 10); }
      pickups.splice(i, 1);
    }
  }

  // Particles
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x += p.vx; p.y += p.vy; p.life--;
    if (p.life <= 0) particles.splice(i, 1);
  }

  updateHUD();
  draw();
  animId = requestAnimationFrame(loop);
}

function hitPlayer() {
  lives--;
  invulnTimer = 90;
  burst(player.x, player.y, '#4af', 10);
  if (lives <= 0) { gameOver = true; burst(player.x, player.y, '#f44', 30); }
}

// ─── Drawing ────────────────────────────────────────────

function draw() {
  ctx.clearRect(0, 0, cw, ch);
  ctx.fillStyle = '#0a0a1a';
  ctx.fillRect(0, 0, cw, ch);

  for (const s of stars) {
    ctx.fillStyle = `rgba(255,255,255,${0.2 + 0.6 * s.s / 2})`;
    ctx.fillRect(s.x, s.y, s.s, s.s);
  }

  drawGround(scrollY);

  for (const p of pickups) drawPickup(p);
  for (const p of paras) drawPara(p);
  for (const b of enemyBullets) {
    ctx.fillStyle = '#ff6644';
    ctx.fillRect(b.x - 1.5, b.y - 2.5, 3, 5);
  }
  for (const e of enemies) {
    if (e.type === 'tank' || e.type === 'turret') {
      e.y = groundTop() + 5;
      if (e.type === 'tank') drawTank(e); else drawTurret(e);
    } else {
      drawFighter(e);
    }
  }
  for (const b of bullets) {
    ctx.fillStyle = b.dmg > 1 ? '#ffaa00' : '#4eff4e';
    ctx.fillRect(b.x - 1.5, b.y - 4, 3, 8);
  }
  for (const p of particles) {
    ctx.globalAlpha = p.life / p.max;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  if (!gameOver) drawShip(player.x, player.y);
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + h - r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function initStars() {
  stars = [];
  for (let i = 0; i < 30; i++) stars.push({ x: Math.random() * cw, y: Math.random() * ch, s: 0.5 + Math.random() * 1.5, sp: 0.3 + Math.random() * 0.6 });
}

function updateHUD() {
  scoreEl.textContent = Math.round(score);
  let h = '';
  for (let i = 0; i < lives; i++) h += '❤️';
  livesEl.textContent = h || '💀';
  wlevelEl.textContent = wlevel;
}

function showGameOver() {
  draw();
  overlayTitle.textContent = '💥 Game Over';
  overlaySub.textContent = 'Счёт: ' + Math.round(score) + ' | Уровень оружия: ' + wlevel;
  btnNext.textContent = 'Заново';
  btnNext.onclick = resetGame;
  overlay.classList.remove('hidden');
}

// ─── Touch / Mouse ─────────────────────────────────────

function onPointer(cx, cy) {
  const rect = canvas.getBoundingClientRect();
  touchX = cx - rect.left;
  touchY = cy - rect.top;
}

canvas.addEventListener('touchstart', (e) => { e.preventDefault(); const t = e.touches[0]; onPointer(t.clientX, t.clientY); });
canvas.addEventListener('touchmove', (e) => { e.preventDefault(); const t = e.touches[0]; onPointer(t.clientX, t.clientY); });
canvas.addEventListener('touchend', () => { touchX = null; touchY = null; });
canvas.addEventListener('touchcancel', () => { touchX = null; touchY = null; });
canvas.addEventListener('mousedown', (e) => onPointer(e.clientX, e.clientY));
canvas.addEventListener('mousemove', (e) => { if (e.buttons & 1) onPointer(e.clientX, e.clientY); });
canvas.addEventListener('mouseup', () => { touchX = null; touchY = null; });
canvas.addEventListener('mouseleave', () => { touchX = null; touchY = null; });

// ─── Resize ─────────────────────────────────────────────
function resize() {
  if (gameOver) return;
  const vh = window.visualViewport ? window.visualViewport.height : window.innerHeight;
  cw = Math.min(window.innerWidth, 420);
  ch = vh - HUD.offsetHeight;
  if (ch < 100) return;
  canvas.width = cw * dpr;
  canvas.height = ch * dpr;
  canvas.style.width = cw + 'px';
  canvas.style.height = ch + 'px';
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  calcSizes();
  initGround();
  initStars();
}
window.addEventListener('resize', resize);
if (window.visualViewport) window.visualViewport.addEventListener('resize', resize);

// ─── Start ──────────────────────────────────────────────
initStars();
resetGame();
