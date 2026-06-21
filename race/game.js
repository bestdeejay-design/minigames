// ─── Canvas ─────────────────────────────────────────────
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const HUD = document.getElementById('hud');
const scoreEl = document.getElementById('score');
const speedLabel = document.getElementById('speed-label');
const overlay = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlay-title');
const overlaySub = document.getElementById('overlay-sub');
const btnNext = document.getElementById('btn-next');

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
let gameOver = false;
let gameTime = 0;
let score = 0;
let roadOffset = 0;
let touchX = null;
let spawnTimer = 0;
let animId = null;
let frameId = 0;

// ─── Cars ───────────────────────────────────────────────
const COLORS = ['#e74c3c','#f39c12','#9b59b6','#2ecc71','#3498db','#e67e22','#1abc9c'];

function drawCar(x, y, w, h, color, isPlayer) {
  const r = w * 0.15; // corner radius
  // Body
  ctx.fillStyle = color;
  roundRect(ctx, x - w / 2, y - h / 2, w, h, r);
  ctx.fill();
  // Shadow
  ctx.fillStyle = 'rgba(0,0,0,0.2)';
  roundRect(ctx, x - w / 2 + 2, y - h / 2 + 2, w, h, r);
  ctx.fill();
  // Body again on top
  ctx.fillStyle = color;
  roundRect(ctx, x - w / 2, y - h / 2, w, h, r);
  ctx.fill();

  // Windshield
  const ws = w * 0.72, wh = h * 0.22;
  ctx.fillStyle = isPlayer ? 'rgba(150,220,255,0.5)' : 'rgba(200,230,255,0.35)';
  roundRect(ctx, x - ws / 2, y - h / 2 + h * 0.12, ws, wh, 3);
  ctx.fill();

  // Rear window
  ctx.fillStyle = 'rgba(200,230,255,0.2)';
  roundRect(ctx, x - ws * 0.7 / 2, y + h / 2 - h * 0.30, ws * 0.7, wh * 0.7, 2);
  ctx.fill();

  // Wheels
  const whW = w * 0.12, whH = h * 0.18;
  ctx.fillStyle = '#222';
  const wx = w / 2 - 2, wy1 = -h * 0.22, wy2 = h * 0.18;
  for (const side of [-1, 1]) {
    ctx.fillRect(x + side * wx - whW / 2, y + wy1 - whH / 2, whW, whH);
    ctx.fillRect(x + side * wx - whW / 2, y + wy2 - whH / 2, whW, whH);
  }

  // Headlights (player) / taillights (enemy)
  const lr = w * 0.06;
  for (const side of [-1, 1]) {
    ctx.fillStyle = isPlayer ? '#ffd700' : '#ff4444';
    ctx.beginPath();
    ctx.arc(x + side * w * 0.3, y - h / 2 + lr + 2, lr, 0, Math.PI * 2);
    ctx.fill();
  }
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

// ─── Enemies ────────────────────────────────────────────
function spawnEnemy() {
  const w = carW * (0.85 + Math.random() * 0.3);
  const h = w * 1.7;
  enemies.push({
    x: roadL + Math.random() * (roadW - w) + w / 2,
    y: -h,
    w, h,
    speed: 1.5 + Math.random() * 0.8 + (gameTime * 0.0003),
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
  });
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
  calcLayout();

  player.x = cw / 2;
  player.y = ch - carH;
  enemies = [];
  gameOver = false;
  gameTime = 0;
  score = 0;
  roadOffset = 0;
  spawnTimer = 0;
  touchX = null;
  frameId = 0;
  overlay.classList.add('hidden');
  if (animId) { cancelAnimationFrame(animId); animId = null; }
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

  // Player follow touch
  if (touchX !== null) {
    const target = Math.max(roadL + carW / 2, Math.min(roadL + roadW - carW / 2, touchX));
    player.x += (target - player.x) * 0.18;
  }

  // Spawn
  const interval = Math.max(350, 1200 - gameTime * 10);
  spawnTimer += dt;
  if (spawnTimer >= interval) {
    spawnTimer = 0;
    if (Math.random() < 0.65 + gameTime * 0.005) spawnEnemy();
  }

  // Move enemies + collision
  for (let i = enemies.length - 1; i >= 0; i--) {
    const e = enemies[i];
    e.y += e.speed + baseSpeed * 0.3;
    if (e.y - e.h / 2 > ch + 50) { enemies.splice(i, 1); continue; }

    // Collision
    const px = player.x, py = player.y;
    const pw = carW * 0.7, ph = carH * 0.7;
    if (px - pw / 2 < e.x + e.w / 2 && px + pw / 2 > e.x - e.w / 2 &&
        py - ph / 2 < e.y + e.h / 2 && py + ph / 2 > e.y - e.h / 2) {
      gameOver = true;
      showGameOver();
      return;
    }
  }

  updateHUD();
  draw();
  animId = requestAnimationFrame(loop);
}

// ─── Drawing ────────────────────────────────────────────

function draw() {
  ctx.clearRect(0, 0, cw, ch);

  // Grass
  ctx.fillStyle = '#1a3a1a';
  ctx.fillRect(0, 0, cw, ch);

  // Road
  ctx.fillStyle = '#333';
  ctx.fillRect(roadL, 0, roadW, ch);

  // Road edges
  ctx.fillStyle = '#fff';
  ctx.fillRect(roadL - 2, 0, 3, ch);
  ctx.fillRect(roadL + roadW - 1, 0, 3, ch);

  // Lane dashes
  ctx.fillStyle = 'rgba(255,255,255,0.3)';
  const dashH = 30, gapH = 30, totalH = dashH + gapH;
  for (let lane = 1; lane < LANES; lane++) {
    const lx = roadL + lane * laneW - 1;
    for (let y = -gapH + roadOffset % totalH; y < ch + dashH; y += totalH) {
      ctx.fillRect(lx, y, 2, dashH);
    }
  }

  // Enemies
  for (const e of enemies) {
    drawCar(e.x, e.y, e.w, e.h, e.color, false);
  }

  // Player
  drawCar(player.x, player.y, carW, carH, '#4a9eff', true);
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
  overlayTitle.textContent = '💥 Game Over';
  overlaySub.textContent = 'Счёт: ' + score;
  btnNext.textContent = 'Заново';
  btnNext.onclick = resetGame;
  overlay.classList.remove('hidden');
}

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
  ch = vh - HUD.offsetHeight;
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
