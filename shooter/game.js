// ─── Canvas ─────────────────────────────────────────────
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const HUD = document.getElementById('hud');
const scoreEl = document.getElementById('score');
const livesEl = document.getElementById('lives');
const waveLabel = document.getElementById('wave-label');
const overlay = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlay-title');
const overlaySub = document.getElementById('overlay-sub');
const btnNext = document.getElementById('btn-next');

let cw, ch, dpr = window.devicePixelRatio || 1;

// ─── Sizing ─────────────────────────────────────────────
let PW, PH, EW, EH, BW, BH;

function calcSizes() {
  PW = cw * 0.07; PH = PW * 1.3;
  EW = cw * 0.065; EH = EW * 1.1;
  BW = 3; BH = cw * 0.025;
}

// ─── State ──────────────────────────────────────────────
let wave = 0;
let score = 0;
let lives = 3;
let player = { x: 0, y: 0 };
let bullets = [];
let enemyBullets = [];
let enemies = [];
let powerups = [];
let particles = [];
let stars = [];
let gameOver = false;
let gameState = 'playing';
let frameId = 0;
let fireTimer = 0;
let waveIntroTimer = 0;
let invulnTimer = 0;
let spreadShot = false;
let spreadTimer = 0;
let touchX = null;
let animId = null;

// ─── Stars background ──────────────────────────────────
function initStars() {
  stars = [];
  for (let i = 0; i < 40; i++) {
    stars.push({ x: Math.random() * cw, y: Math.random() * ch, s: 0.5 + Math.random() * 1.5, sp: 0.3 + Math.random() * 0.8 });
  }
}

// ─── Player ─────────────────────────────────────────────
function drawShip(x, y) {
  ctx.save();
  if (invulnTimer > 0 && Math.floor(invulnTimer / 80) % 2 === 0) ctx.globalAlpha = 0.3;
  // Body
  ctx.fillStyle = '#4af';
  ctx.beginPath();
  ctx.moveTo(x, y - PH / 2);
  ctx.lineTo(x - PW / 2, y + PH / 2);
  ctx.lineTo(x + PW / 2, y + PH / 2);
  ctx.closePath();
  ctx.fill();
  // Cockpit
  ctx.fillStyle = 'rgba(150,220,255,0.4)';
  ctx.beginPath();
  ctx.moveTo(x, y - PH / 3);
  ctx.lineTo(x - PW / 4, y + PH / 6);
  ctx.lineTo(x + PW / 4, y + PH / 6);
  ctx.closePath();
  ctx.fill();
  // Wing tips
  ctx.fillStyle = '#38d';
  ctx.fillRect(x - PW / 2 - 3, y + PH / 6, 3, PH / 5);
  ctx.fillRect(x + PW / 2, y + PH / 6, 3, PH / 5);
  // Engine glow
  if (frameId % 6 < 3) {
    ctx.fillStyle = 'rgba(255,200,50,0.5)';
    ctx.beginPath();
    ctx.moveTo(x - PW / 4, y + PH / 2);
    ctx.lineTo(x, y + PH / 2 + 6);
    ctx.lineTo(x + PW / 4, y + PH / 2);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

// ─── Enemies ────────────────────────────────────────────
const ENEMY_COLORS = ['#e74c3c','#f39c12','#9b59b6','#2ecc71'];

function drawEnemy(e) {
  const x = e.x, y = e.y, w = e.w, h = e.h;
  ctx.fillStyle = e.hp > 1 ? '#e67e22' : ENEMY_COLORS[e.colorIdx];
  ctx.beginPath();
  ctx.moveTo(x, y - h / 2);
  ctx.lineTo(x - w / 2, y);
  ctx.lineTo(x - w / 3, y + h / 2);
  ctx.lineTo(x + w / 3, y + h / 2);
  ctx.lineTo(x + w / 2, y);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.3)';
  ctx.lineWidth = 1;
  ctx.stroke();
  // Eye
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(x, y - h * 0.1, w * 0.15, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#111';
  ctx.beginPath();
  ctx.arc(x, y - h * 0.1, w * 0.07, 0, Math.PI * 2);
  ctx.fill();
  if (e.hp > 1) {
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.fillRect(x - w * 0.3, y + h * 0.1, w * 0.6, 3);
  }
}

// ─── Bullets ────────────────────────────────────────────
function drawBullet(b) {
  ctx.fillStyle = b.enemy ? '#ff6644' : '#4eff4e';
  ctx.fillRect(b.x - b.w / 2, b.y - b.h / 2, b.w, b.h);
  if (!b.enemy) {
    ctx.fillStyle = 'rgba(255,255,200,0.3)';
    ctx.fillRect(b.x - b.w, b.y + b.h / 2 - 2, b.w * 2, 3);
  }
}

// ─── Powerups ───────────────────────────────────────────
function drawPowerup(p) {
  const pulse = 1 + 0.15 * Math.sin(frameId * 0.1);
  ctx.fillStyle = p.type === 'spread' ? '#ffd700' : '#4af';
  ctx.beginPath();
  ctx.arc(p.x, p.y, 8 * pulse, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.font = '10px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(p.type === 'spread' ? 'S' : '▲', p.x, p.y + 1);
}

// ─── Particles ──────────────────────────────────────────
function spawnParticles(x, y, color, count) {
  for (let i = 0; i < count; i++) {
    particles.push({
      x, y, vx: (Math.random() - 0.5) * 4, vy: (Math.random() - 0.5) * 4,
      life: 30 + Math.random() * 20, maxLife: 50,
      color, r: 2 + Math.random() * 3,
    });
  }
}

// ─── Waves ──────────────────────────────────────────────
function spawnWave() {
  wave++;
  waveLabel.textContent = 'WAVE ' + wave;
  const cols = Math.min(7, 2 + wave);
  const rows = Math.min(3, 1 + Math.floor(wave / 2));
  const gapX = EW * 1.8, gapY = EH * 1.6;
  const totalW = cols * gapX;
  const startX = (cw - totalW) / 2 + gapX / 2;
  enemies = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const bx = startX + c * gapX, by = 15 + r * gapY;
      enemies.push({
        x: bx, y: by, w: EW, h: EH,
        baseX: bx, baseY: by,
        hp: wave > 3 && r === 0 ? 2 : 1,
        colorIdx: Math.floor(Math.random() * ENEMY_COLORS.length),
        diving: false, diveX: 0,
      });
    }
  }
  waveIntroTimer = 60;
  gameState = 'wave_intro';
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

  player.x = cw / 2;
  player.y = ch - PH;
  bullets = [];
  enemyBullets = [];
  enemies = [];
  powerups = [];
  particles = [];
  gameOver = false;
  lives = 3;
  score = 0;
  wave = 0;
  frameId = 0;
  fireTimer = 0;
  invulnTimer = 0;
  spreadShot = false;
  spreadTimer = 0;
  touchX = null;
  initStars();
  overlay.classList.add('hidden');
  if (animId) { cancelAnimationFrame(animId); animId = null; }
  spawnWave();
  loop();
}

function loop() {
  if (gameOver) return;
  frameId++;

  const dt = 1;

  // Invulnerability
  if (invulnTimer > 0) invulnTimer -= dt;
  if (spreadTimer > 0 && --spreadTimer <= 0) spreadShot = false;

  // Wave intro
  if (gameState === 'wave_intro') {
    if (--waveIntroTimer <= 0) gameState = 'playing';
    updateHUD();
    draw();
    animId = requestAnimationFrame(loop);
    return;
  }

  // Stars
  for (const s of stars) {
    s.y += s.sp;
    if (s.y > ch) { s.y = -2; s.x = Math.random() * cw; }
  }

  // Player follow touch
  if (touchX !== null) {
    const target = Math.max(PW / 2, Math.min(cw - PW / 2, touchX));
    player.x += (target - player.x) * 0.15;
  }

  // Auto-fire
  if (++fireTimer >= (spreadShot ? 10 : 8)) {
    fireTimer = 0;
    bullets.push({ x: player.x, y: player.y - PH / 2, w: BW, h: BH, enemy: false });
    if (spreadShot) {
      bullets.push({ x: player.x - PW / 3, y: player.y - PH / 3, w: BW, h: BH, enemy: false });
      bullets.push({ x: player.x + PW / 3, y: player.y - PH / 3, w: BW, h: BH, enemy: false });
    }
  }

  // Move bullets
  for (let i = bullets.length - 1; i >= 0; i--) {
    bullets[i].y -= 6;
    if (bullets[i].y + BH / 2 < 0) bullets.splice(i, 1);
  }
  for (let i = enemyBullets.length - 1; i >= 0; i--) {
    enemyBullets[i].y += 3 + wave * 0.1;
    if (enemyBullets[i].y - enemyBullets[i].h / 2 > ch) enemyBullets.splice(i, 1);
  }

  // Enemy formation movement
  const phase = frameId * 0.025;
  for (const e of enemies) {
    if (e.diving) {
      e.x += (e.diveX - e.x) * 0.04;
      e.y += 2 + wave * 0.05;
      if (e.y > ch + 50) { e.diving = false; e.x = e.baseX; e.y = e.baseY + 50; e.baseY += 50; }
    } else {
      e.x = e.baseX + Math.sin(phase) * 25;
      e.y = e.baseY + Math.sin(phase * 0.6 + e.baseX * 0.05) * 8;
    }
  }

  // Enemy shoot
  if (enemies.length > 0 && frameId % Math.max(30, 60 - wave * 3) === 0) {
    const shooters = enemies.filter(e => !e.diving);
    if (shooters.length > 0) {
      const s = shooters[Math.floor(Math.random() * shooters.length)];
      enemyBullets.push({ x: s.x, y: s.y + EH / 2, w: 3, h: 8, enemy: true });
    }
  }

  // Dive-bomb
  if (enemies.length > 0 && frameId % Math.max(80, 150 - wave * 10) === 0) {
    const candidates = enemies.filter(e => !e.diving);
    if (candidates.length > 0) {
      const diver = candidates[Math.floor(Math.random() * candidates.length)];
      diver.diving = true;
      diver.diveX = player.x + (Math.random() - 0.5) * 60;
    }
  }

  // Bullet-enemy collision
  for (let i = bullets.length - 1; i >= 0; i--) {
    const b = bullets[i];
    for (let j = enemies.length - 1; j >= 0; j--) {
      const e = enemies[j];
      if (Math.abs(b.x - e.x) < e.w / 2 + b.w / 2 && Math.abs(b.y - e.y) < e.h / 2 + b.h / 2) {
        bullets.splice(i, 1);
        e.hp--;
        spawnParticles(e.x, e.y, '#ff0', 5);
        if (e.hp <= 0) {
          score += 10 + wave * 2;
          spawnParticles(e.x, e.y, '#f44', 15);
          if (Math.random() < 0.12) powerups.push({ x: e.x, y: e.y, type: 'spread' });
          if (Math.random() < 0.08) powerups.push({ x: e.x, y: e.y, type: 'shield' });
          enemies.splice(j, 1);
        }
        break;
      }
    }
  }

  // Enemy-player collision + enemy bullet-player collision
  if (invulnTimer <= 0) {
    for (let i = enemyBullets.length - 1; i >= 0; i--) {
      const b = enemyBullets[i];
      if (Math.abs(b.x - player.x) < PW / 2 + b.w / 2 && Math.abs(b.y - player.y) < PH / 2 + b.h / 2) {
        enemyBullets.splice(i, 1);
        hitPlayer();
        if (gameOver) { draw(); showGameOver(); return; }
        break;
      }
    }
    if (invulnTimer <= 0) {
      for (const e of enemies) {
        if (e.diving && Math.abs(e.x - player.x) < PW / 2 + e.w / 2 && Math.abs(e.y - player.y) < PH / 2 + e.h / 2) {
          hitPlayer();
          e.diving = false; e.x = e.baseX; e.y = e.baseY;
          if (gameOver) { draw(); showGameOver(); return; }
          break;
        }
      }
    }
  }

  // Powerup collection
  for (let i = powerups.length - 1; i >= 0; i--) {
    const p = powerups[i];
    p.y += 1.5;
    if (p.y > ch + 20) { powerups.splice(i, 1); continue; }
    if (Math.abs(p.x - player.x) < PW / 2 + 10 && Math.abs(p.y - player.y) < PH / 2 + 10) {
      if (p.type === 'spread') { spreadShot = true; spreadTimer = 600; }
      if (p.type === 'shield') { invulnTimer = 300; }
      powerups.splice(i, 1);
    }
  }

  // Particles
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x += p.vx; p.y += p.vy;
    p.life--;
    if (p.life <= 0) particles.splice(i, 1);
  }

  // Wave complete?
  if (enemies.length === 0) {
    spawnWave();
  }

  updateHUD();
  draw();
  animId = requestAnimationFrame(loop);
}

function hitPlayer() {
  lives--;
  invulnTimer = 90;
  spawnParticles(player.x, player.y, '#4af', 10);
  if (lives <= 0) {
    gameOver = true;
    spawnParticles(player.x, player.y, '#f44', 30);
  }
}

// ─── Drawing ────────────────────────────────────────────

function draw() {
  ctx.clearRect(0, 0, cw, ch);
  ctx.fillStyle = '#0a0a1a';
  ctx.fillRect(0, 0, cw, ch);

  // Stars
  for (const s of stars) {
    ctx.fillStyle = `rgba(255,255,255,${0.3 + 0.7 * (s.s / 2)})`;
    ctx.fillRect(s.x, s.y, s.s, s.s);
  }

  // Powerups
  for (const p of powerups) drawPowerup(p);

  // Enemy bullets
  for (const b of enemyBullets) drawBullet(b);

  // Enemies
  for (const e of enemies) drawEnemy(e);

  // Player bullets
  for (const b of bullets) drawBullet(b);

  // Particles
  for (const p of particles) {
    ctx.fillStyle = p.color;
    ctx.globalAlpha = p.life / p.maxLife;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // Player
  if (!gameOver) drawShip(player.x, player.y);

  // Wave intro text
  if (gameState === 'wave_intro' && waveIntroTimer > 30) {
    ctx.fillStyle = `rgba(233,69,96,${(waveIntroTimer - 30) / 30})`;
    ctx.font = `bold ${cw * 0.07}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('WAVE ' + wave, cw / 2, ch / 2);
  }
}

function updateHUD() {
  scoreEl.textContent = score;
  let h = '';
  for (let i = 0; i < lives; i++) h += '❤️';
  livesEl.textContent = h || '💀';
}

function showGameOver() {
  draw();
  overlayTitle.textContent = '💥 Game Over';
  overlaySub.textContent = 'Счёт: ' + score + ' | Волна: ' + wave;
  btnNext.textContent = 'Заново';
  btnNext.onclick = resetGame;
  overlay.classList.remove('hidden');
}

// ─── Touch / Mouse ─────────────────────────────────────

function onPointer(clientX) {
  const rect = canvas.getBoundingClientRect();
  touchX = clientX - rect.left;
}

canvas.addEventListener('touchstart', (e) => { e.preventDefault(); onPointer(e.touches[0].clientX); });
canvas.addEventListener('touchmove', (e) => { e.preventDefault(); onPointer(e.touches[0].clientX); });
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
  ch = vh - HUD.offsetHeight;
  if (ch < 100) return;
  canvas.width = cw * dpr;
  canvas.height = ch * dpr;
  canvas.style.width = cw + 'px';
  canvas.style.height = ch + 'px';
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  calcSizes();
  initStars();
  player.y = ch - PH;
}

window.addEventListener('resize', resize);
if (window.visualViewport) window.visualViewport.addEventListener('resize', resize);

// ─── Start ──────────────────────────────────────────────
resetGame();
