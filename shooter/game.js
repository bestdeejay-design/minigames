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
let stars = [];
let gameOver = false, gameState = 'playing';
let frameId = 0, fireTimer = 0, invulnTimer = 0;
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

// ─── Player — X-wing ────────────────────────────────────
function drawShip(x, y) {
  ctx.save();
  if (invulnTimer > 0 && Math.floor(invulnTimer / 80) % 2 === 0) ctx.globalAlpha = 0.3;
  const hw = PW / 2, hh = PH / 2;

  // Engine glow
  ctx.fillStyle = `rgba(255,160,50,${0.15 + 0.12 * Math.sin(frameId * 0.2)})`;
  ctx.beginPath();
  ctx.ellipse(x, y + hh * 0.6, PW * 0.35, PH * 0.12, 0, 0, Math.PI * 2);
  ctx.fill();

  // S-foils in attack position
  ctx.fillStyle = '#b0b8c0';
  ctx.strokeStyle = '#889098';
  ctx.lineWidth = 0.5;
  // Top-left wing
  ctx.beginPath();
  ctx.moveTo(x - hw * 0.15, y - hh * 0.05);
  ctx.lineTo(x - hw * 0.85, y - hh * 0.25);
  ctx.lineTo(x - hw * 0.8, y + hh * 0.15);
  ctx.lineTo(x - hw * 0.15, y + hh * 0.1);
  ctx.closePath(); ctx.fill(); ctx.stroke();
  // Top-right wing
  ctx.beginPath();
  ctx.moveTo(x + hw * 0.15, y - hh * 0.05);
  ctx.lineTo(x + hw * 0.85, y - hh * 0.25);
  ctx.lineTo(x + hw * 0.8, y + hh * 0.15);
  ctx.lineTo(x + hw * 0.15, y + hh * 0.1);
  ctx.closePath(); ctx.fill(); ctx.stroke();
  // Bottom-left wing
  ctx.beginPath();
  ctx.moveTo(x - hw * 0.15, y + hh * 0.2);
  ctx.lineTo(x - hw * 0.78, y + hh * 0.05);
  ctx.lineTo(x - hw * 0.72, y + hh * 0.5);
  ctx.lineTo(x - hw * 0.15, y + hh * 0.35);
  ctx.closePath(); ctx.fill(); ctx.stroke();
  // Bottom-right wing
  ctx.beginPath();
  ctx.moveTo(x + hw * 0.15, y + hh * 0.2);
  ctx.lineTo(x + hw * 0.78, y + hh * 0.05);
  ctx.lineTo(x + hw * 0.72, y + hh * 0.5);
  ctx.lineTo(x + hw * 0.15, y + hh * 0.35);
  ctx.closePath(); ctx.fill(); ctx.stroke();

  // Wingtip exhausts
  ctx.fillStyle = `rgba(255,180,60,${0.25 + 0.15 * Math.sin(frameId * 0.12)})`;
  for (const [ex, ey] of [[x - hw * 0.78, y + hh * 0.08], [x + hw * 0.78, y + hh * 0.08],
                           [x - hw * 0.71, y + hh * 0.48], [x + hw * 0.71, y + hh * 0.48]]) {
    ctx.fillRect(ex - 2, ey, 4, 5);
  }

  // Fuselage
  ctx.fillStyle = '#c8d0d8';
  roundRect(ctx, x - hw * 0.18, y - hh * 0.25, PW * 0.36, PH * 0.65, 3);
  ctx.fill();
  ctx.strokeStyle = '#889098';
  ctx.lineWidth = 0.5;
  ctx.stroke();

  // Nose cone
  ctx.fillStyle = '#a0a8b0';
  ctx.beginPath();
  ctx.moveTo(x - hw * 0.14, y - hh * 0.25);
  ctx.lineTo(x, y - hh * 0.55);
  ctx.lineTo(x + hw * 0.14, y - hh * 0.25);
  ctx.closePath(); ctx.fill(); ctx.stroke();

  // Cockpit
  ctx.fillStyle = '#3a9fd4';
  ctx.beginPath();
  ctx.ellipse(x, y - hh * 0.05, hw * 0.08, hh * 0.12, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(150,220,255,0.3)';
  ctx.beginPath();
  ctx.ellipse(x - hw * 0.02, y - hh * 0.07, hw * 0.04, hh * 0.06, 0, 0, Math.PI * 2);
  ctx.fill();

  // R2
  ctx.fillStyle = '#eee';
  ctx.beginPath();
  ctx.arc(x + hw * 0.14, y + hh * 0.05, hw * 0.06, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#3a9fd4';
  ctx.beginPath();
  ctx.arc(x + hw * 0.14, y + hh * 0.05, hw * 0.03, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

// ─── Enemies ────────────────────────────────────────────

function hexPath(cx, cy, rx, ry) {
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = Math.PI / 3 * i - Math.PI / 6;
    const px = cx + Math.cos(a) * rx;
    const py = cy + Math.sin(a) * ry;
    i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
  }
  ctx.closePath();
}

function drawTank(e) {
  const x = e.x, y = e.y, hw = e.w / 2, hh = e.h / 2;
  // Lambda-class shuttle — delta shape from top
  ctx.fillStyle = '#667';
  ctx.beginPath();
  ctx.moveTo(x, y - hh);           // nose
  ctx.lineTo(x - hw * 1.2, y + hh); // left wingtip
  ctx.lineTo(x + hw * 1.2, y + hh); // right wingtip
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle = '#445';
  ctx.lineWidth = 0.5;
  ctx.stroke();
  // Center body
  ctx.fillStyle = '#778';
  ctx.fillRect(x - hw * 0.3, y - hh * 0.5, hw * 0.6, hh * 1.2);
  // Cockpit
  ctx.fillStyle = '#4af';
  ctx.beginPath();
  ctx.arc(x, y - hh * 0.3, hw * 0.15, 0, Math.PI * 2);
  ctx.fill();
  // Engine glow
  ctx.fillStyle = `rgba(255,100,50,${0.2 + 0.1 * Math.sin(frameId * 0.15)})`;
  ctx.fillRect(x - hw * 0.9, y + hh - 4, hw * 0.5, 4);
  ctx.fillRect(x + hw * 0.4, y + hh - 4, hw * 0.5, 4);
  if (e.hp > 1) {
    ctx.fillStyle = '#f44';
    ctx.fillRect(x - hw * 0.25, y + hh - 3, hw * 0.5, 3);
  }
}

function drawTurret(e) {
  const x = e.x, y = e.y, hw = e.w / 2, hh = e.h / 2;
  // Turbolaser tower
  ctx.fillStyle = '#555';
  ctx.fillRect(x - hw * 0.4, y - hh * 0.6, hw * 0.8, hh * 1.2);
  // Dish
  ctx.fillStyle = '#666';
  ctx.beginPath();
  ctx.arc(x, y - hh * 0.6, hw * 0.5, Math.PI, 0);
  ctx.fill();
  ctx.fillStyle = '#888';
  ctx.beginPath();
  ctx.arc(x, y - hh * 0.6, hw * 0.25, Math.PI, 0);
  ctx.fill();
  // Barrel
  ctx.fillStyle = '#777';
  ctx.fillRect(x - 2, y - hh * 0.6 - 6, 4, 8);
  // Base
  ctx.fillStyle = '#444';
  ctx.fillRect(x - hw * 0.5, y + hh * 0.5, hw, 5);
  // Glow
  ctx.fillStyle = `rgba(255,50,50,${0.15 + 0.1 * Math.sin(frameId * 0.1)})`;
  ctx.beginPath();
  ctx.arc(x, y - hh * 0.6 - 6, 4, 0, Math.PI * 2);
  ctx.fill();
}

function drawFighter(e) {
  const x = e.x, y = e.y, hw = e.w / 2, hh = e.h / 2;
  ctx.strokeStyle = '#1a1a1e';
  ctx.lineWidth = 0.5;
  // TIE Fighter
  // Left wing panels
  ctx.fillStyle = '#2a2a2e';
  hexPath(x - hw * 0.75, y, hw * 0.65, hh * 0.75);
  ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#1a1a1e';
  hexPath(x - hw * 0.75, y, hw * 0.45, hh * 0.55);
  ctx.fill();
  // Right wing panels
  ctx.fillStyle = '#2a2a2e';
  hexPath(x + hw * 0.75, y, hw * 0.65, hh * 0.75);
  ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#1a1a1e';
  hexPath(x + hw * 0.75, y, hw * 0.45, hh * 0.55);
  ctx.fill();
  // Struts connecting wings
  ctx.fillStyle = '#333';
  ctx.fillRect(x - hw * 0.4, y - 1, hw * 0.8, 2);
  // Ball cockpit
  ctx.fillStyle = '#222';
  ctx.beginPath();
  ctx.arc(x, y, hw * 0.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#444';
  ctx.beginPath();
  ctx.arc(x, y, hw * 0.15, 0, Math.PI * 2);
  ctx.fill();
  // Window
  ctx.fillStyle = '#4af';
  ctx.beginPath();
  ctx.arc(x, y, hw * 0.08, 0, Math.PI * 2);
  ctx.fill();
}

function drawBomber(e) {
  const x = e.x, y = e.y, hw = e.w / 2, hh = e.h / 2;
  // TIE Bomber — bulkier, longer wings
  ctx.fillStyle = '#2d2d30';
  // Left wing
  ctx.beginPath();
  ctx.moveTo(x - hw * 0.1, y - hh);
  ctx.lineTo(x - hw * 1.0, y - hh * 0.6);
  ctx.lineTo(x - hw * 1.0, y + hh * 0.6);
  ctx.lineTo(x - hw * 0.1, y + hh);
  ctx.closePath(); ctx.fill();
  // Right wing
  ctx.beginPath();
  ctx.moveTo(x + hw * 0.1, y - hh);
  ctx.lineTo(x + hw * 1.0, y - hh * 0.6);
  ctx.lineTo(x + hw * 1.0, y + hh * 0.6);
  ctx.lineTo(x + hw * 0.1, y + hh);
  ctx.closePath(); ctx.fill();
  // Body
  ctx.fillStyle = '#333';
  ctx.fillRect(x - hw * 0.2, y - hh * 0.5, hw * 0.4, hh);
  // Bomb bay
  ctx.fillStyle = '#1a1a1a';
  ctx.fillRect(x - hw * 0.1, y, hw * 0.2, hh * 0.4);
  // Cockpit
  ctx.fillStyle = '#4af';
  ctx.beginPath();
  ctx.arc(x, y - hh * 0.3, hw * 0.1, 0, Math.PI * 2);
  ctx.fill();
}

function drawPara(p) {
  const x = p.x, y = p.y;
  // Escape pod
  ctx.fillStyle = '#777';
  ctx.beginPath();
  ctx.ellipse(x, y, 4, 6, 0, 0, Math.PI * 2);
  ctx.fill();
  // Heat shield
  ctx.fillStyle = '#555';
  ctx.beginPath();
  ctx.arc(x, y + 4, 4, Math.PI, 0);
  ctx.fill();
  // Window
  ctx.fillStyle = '#4af';
  ctx.beginPath();
  ctx.arc(x, y - 1, 2, 0, Math.PI * 2);
  ctx.fill();
  // Retro thrusters
  ctx.fillStyle = 'rgba(255,150,50,0.4)';
  ctx.fillRect(x - 3, y + 5, 2, 3);
  ctx.fillRect(x + 1, y + 5, 2, 3);
  ctx.fillStyle = '#ffd700';
  ctx.font = '4px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('✦', x, y - 7);
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
    const s = 6 * pulse;
    ctx.fillStyle = 'rgba(255,68,68,0.2)';
    ctx.beginPath();
    ctx.arc(p.x, p.y, s * 1.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#f44';
    ctx.beginPath();
    ctx.moveTo(p.x, p.y + s * 0.3);
    ctx.bezierCurveTo(p.x, p.y + s * 0.8, p.x - s * 0.7, p.y + s * 0.2, p.x, p.y - s * 0.3);
    ctx.bezierCurveTo(p.x + s * 0.7, p.y + s * 0.2, p.x, p.y + s * 0.8, p.x, p.y + s * 0.3);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.beginPath();
    ctx.arc(p.x - s * 0.15, p.y - s * 0.15, s * 0.15, 0, Math.PI * 2);
    ctx.fill();
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

// ─── Background — Space ─────────────────────────────────
function drawBackground() {
  ctx.fillStyle = '#06060e';
  ctx.fillRect(0, 0, cw, ch);
  for (const s of stars) {
    const a = 0.3 + 0.7 * (s.s - 0.3);
    ctx.fillStyle = `rgba(255,255,255,${a})`;
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.s * 0.6, 0, Math.PI * 2);
    ctx.fill();
  }
}

// ─── Spawning ───────────────────────────────────────────
function spawnEnemy() {
  const r = Math.random();
  if (r < 0.25) {
    enemies.push({ type: 'tank', x: 10 + Math.random() * (cw - 20), y: -20, w: 22, h: 14, hp: 2, maxHp: 2, shootTimer: 60 + Math.random() * 80 });
  } else if (r < 0.45) {
    enemies.push({ type: 'turret', x: 10 + Math.random() * (cw - 20), y: -20, w: 16, h: 18, hp: 1, shootTimer: 30 + Math.random() * 40 });
  } else {
    enemies.push({ type: 'fighter', x: Math.random() * cw, y: -20, w: EW, h: EH, hp: 1, vx: (Math.random() - 0.5) * 1.2, vy: 0, shootTimer: 40 + Math.random() * 60 });
  }
}

function tryDropPara() {
  enemies.push({ type: 'bomber', x: Math.random() * cw, y: -20, w: EW * 1.3, h: EH * 0.8, hp: 3, vx: (Math.random() - 0.5) * 1, vy: 0.8, dropTimer: 30 });
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
  spawnTimer = 0; paraDropTimer = 0;
  touchX = null; touchY = null;
  overlay.classList.add('hidden');
  if (animId) { cancelAnimationFrame(animId); animId = null; }
  initStars();
  loop();
}

function loop() {
  if (gameOver) return;
  frameId++;
  const dt = 1;

  if (invulnTimer > 0) invulnTimer -= dt;

  for (const s of stars) { s.y += s.sp; if (s.y > ch) { s.y = -2; s.x = Math.random() * cw; } }

  // Player follow touch
  if (touchX !== null && touchY !== null) {
    const tx = Math.max(PW / 2, Math.min(cw - PW / 2, touchX));
    const ty = Math.max(PH / 2, Math.min(ch - PH / 2, touchY));
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

  // Spawn
  const spawnInterval = Math.max(60, 120 - Math.floor(score / 1000) * 8);
  spawnTimer += dt;
  if (spawnTimer >= spawnInterval) {
    spawnTimer = 0;
    spawnEnemy();
    if (frameId > 300 && Math.random() < 0.08) tryDropPara();
  }

  // Move enemies
  const speedBonus = Math.floor(score / 1000) * 0.1;
  const scrollSpeed = Math.min(0.6 + speedBonus, 1.8);
  for (let i = enemies.length - 1; i >= 0; i--) {
    const e = enemies[i];
    e.y += scrollSpeed;
    if (e.type === 'tank' || e.type === 'turret') {
      e.shootTimer -= dt;
      if (e.shootTimer <= 0) {
        const spd = e.type === 'turret' ? 2.5 : 1.5;
        if (e.type === 'turret') e.shootTimer = 25 + Math.random() * 20;
        else e.shootTimer = 70 + Math.random() * 40;
        const dx = player.x - e.x, dy = player.y - e.y;
        const d = Math.sqrt(dx * dx + dy * dy) || 1;
        enemyBullets.push({ x: e.x, y: e.y + 5, vx: dx / d * spd, vy: dy / d * spd, w: 3, h: 5 });
      }
    } else {
      e.x += e.vx || 0;
      e.shootTimer -= dt;
      if (e.shootTimer <= 0) {
        e.shootTimer = 50 + Math.random() * 40;
        enemyBullets.push({ x: e.x, y: e.y + EH / 2, vx: (Math.random() - 0.5) * 0.3, vy: 2, w: 3, h: 5 });
      }
      if (e.type === 'bomber' && --e.dropTimer <= 0) {
        e.dropTimer = 50;
        paras.push({ x: e.x + (Math.random() - 0.5) * 10, y: e.y + EH / 2, vy: 0.6 });
      }
    }
    if (e.y > ch + 40) { enemies.splice(i, 1); }
  }

  // Paratroopers
  for (let i = paras.length - 1; i >= 0; i--) {
    const p = paras[i];
    p.y += p.vy;
    if (p.y > ch + 10) { paras.splice(i, 1); continue; }
    if (Math.abs(p.x - player.x) < PW / 2 + 6 && Math.abs(p.y - player.y) < PH / 2 + 6) {
      score += 100;
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
        burst(e.x, e.y, '#0f0', 4);
        if (e.hp <= 0) {
          score += 10 + frameId * 0.05;
          burst(e.x, e.y, '#f44', 12);
      const r = Math.random();
      if (r < 0.15) pickups.push({ x: e.x, y: e.y, type: 'coin' });
      else if (r < 0.25) pickups.push({ x: e.x, y: e.y, type: 'life' });
      else if (r < 0.40) pickups.push({ x: e.x, y: e.y, type: 'upgrade' });
          enemies.splice(j, 1);
        }
        break;
      }
    }
  }

  // Enemy bullets → player
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
  drawBackground();

  for (const p of pickups) drawPickup(p);
  for (const p of paras) drawPara(p);
  for (const b of enemyBullets) {
    ctx.fillStyle = '#ff3333';
    ctx.shadowColor = '#ff3333';
    ctx.shadowBlur = 6;
    ctx.fillRect(b.x - 1.5, b.y - 2.5, 3, 5);
    ctx.shadowBlur = 0;
  }
  for (const e of enemies) {
    if (e.type === 'tank') drawTank(e);
    else if (e.type === 'turret') drawTurret(e);
    else if (e.type === 'bomber') drawBomber(e);
    else drawFighter(e);
  }
  for (const b of bullets) {
    ctx.fillStyle = b.dmg > 1 ? '#ffaa00' : '#33ff33';
    ctx.shadowColor = b.dmg > 1 ? '#ffaa00' : '#33ff33';
    ctx.shadowBlur = 6;
    ctx.fillRect(b.x - 1.5, b.y - 4, 3, 8);
    ctx.shadowBlur = 0;
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
  for (let i = 0; i < 40; i++) stars.push({ x: Math.random() * cw, y: Math.random() * ch, s: 0.4 + Math.random() * 1.8, sp: 0.2 + Math.random() * 0.8 });
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
  initStars();
}
window.addEventListener('resize', resize);
if (window.visualViewport) window.visualViewport.addEventListener('resize', resize);

// ─── Start ──────────────────────────────────────────────
resetGame();
