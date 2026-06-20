// ─── Setup ───────────────────────────────────────────────
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const scoreEl = document.getElementById('score');
const shotsEl = document.getElementById('shots');
const levelEl = document.getElementById('level');
const overlay = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlay-title');
const overlaySub = document.getElementById('overlay-sub');
const btnNext = document.getElementById('btn-next');

let W, H;

function resize() {
  const rect = canvas.getBoundingClientRect();
  W = canvas.width = rect.width * (window.devicePixelRatio || 1);
  H = canvas.height = rect.height * (window.devicePixelRatio || 1);
  ctx.setTransform(W / rect.width, 0, 0, H / rect.height, 0, 0);
  cw = rect.width;
  ch = rect.height;
}
let cw, ch;
resize();
window.addEventListener('resize', resize);

// ─── Constants ──────────────────────────────────────────
const GRAVITY = 0.28;
const MAX_PULL = 150;
const SLING_X = () => cw / 2;
const SLING_Y = () => ch - 80;
const FORK_SPREAD = 20;

// ─── Levels ──────────────────────────────────────────────
const LEVELS = [
  {
    targets: [
      { x: 70, y: 220, w: 40, h: 40, points: 10 },
    ],
    obstacles: [],
    shots: 5,
  },
  {
    targets: [
      { x: 50, y: 180, w: 35, h: 50, points: 10 },
      { x: cw - 90, y: 200, w: 35, h: 50, points: 15 },
    ],
    obstacles: [
      { x: cw / 2 - 20, y: 230, w: 40, h: 30 },
    ],
    shots: 5,
  },
  {
    targets: [
      { x: 40, y: 160, w: 30, h: 30, points: 10 },
      { x: 180, y: 180, w: 30, h: 30, points: 10 },
      { x: cw / 2 - 15, y: 120, w: 30, h: 30, points: 20 },
    ],
    obstacles: [
      { x: 30, y: 260, w: 90, h: 8 },
      { x: 200, y: 220, w: 80, h: 8 },
    ],
    shots: 5,
  },
  {
    targets: [
      { x: 60, y: 150, w: 30, h: 30, points: 10 },
      { x: cw / 2 - 15, y: 180, w: 30, h: 30, points: 15, moving: true, moveRange: 60, moveSpeed: 0.02 },
      { x: cw - 90, y: 120, w: 30, h: 30, points: 20 },
    ],
    obstacles: [
      { x: cw / 2 - 50, y: 220, w: 100, h: 12 },
    ],
    shots: 5,
  },
  {
    targets: [
      { x: cw / 2 - 15, y: 280, w: 30, h: 30, points: 10 },
      { x: 50, y: 100, w: 25, h: 25, points: 20 },
      { x: cw - 80, y: 80, w: 25, h: 25, points: 20 },
      { x: cw / 2 - 10, y: 40, w: 20, h: 20, points: 30 },
    ],
    obstacles: [
      { x: 0, y: 250, w: cw, h: 8 },
      { x: cw / 2 - 15, y: 200, w: 30, h: 60 },
    ],
    shots: 6,
  },
  {
    targets: [
      { x: 30, y: 80, w: 25, h: 25, points: 15, moving: true, moveRange: 40, moveSpeed: 0.03 },
      { x: cw - 60, y: 100, w: 25, h: 25, points: 15, moving: true, moveRange: 50, moveSpeed: 0.025 },
      { x: cw / 2 - 12, y: 50, w: 24, h: 24, points: 25, moving: true, moveRange: 30, moveSpeed: 0.04 },
    ],
    obstacles: [
      { x: 0, y: 200, w: cw, h: 8 },
      { x: cw / 2 - 40, y: 120, w: 80, h: 15 },
    ],
    shots: 6,
  },
  {
    targets: [
      { x: 40, y: 140, w: 20, h: 20, points: 10 },
      { x: 90, y: 140, w: 20, h: 20, points: 10 },
      { x: 140, y: 140, w: 20, h: 20, points: 10 },
      { x: cw - 60, y: 140, w: 20, h: 20, points: 10 },
      { x: cw - 110, y: 140, w: 20, h: 20, points: 10 },
    ],
    obstacles: [
      { x: 0, y: 200, w: cw, h: 8 },
    ],
    shots: 5,
  },
  {
    targets: [
      { x: 30, y: 120, w: 20, h: 20, points: 10 },
      { x: cw - 50, y: 120, w: 20, h: 20, points: 10 },
      { x: cw / 2 - 10, y: 160, w: 20, h: 20, points: 15, moving: true, moveRange: 80, moveSpeed: 0.03 },
      { x: 60, y: 60, w: 18, h: 18, points: 25 },
      { x: cw - 80, y: 50, w: 18, h: 18, points: 25 },
    ],
    obstacles: [
      { x: 0, y: 220, w: cw, h: 8 },
      { x: cw / 2 - 20, y: 100, w: 40, h: 50 },
    ],
    shots: 6,
  },
  {
    targets: [
      { x: 100, y: 100, w: 22, h: 22, points: 15, moving: true, moveRange: 50, moveSpeed: 0.025 },
      { x: cw - 120, y: 100, w: 22, h: 22, points: 15, moving: true, moveRange: 50, moveSpeed: 0.025 },
      { x: cw / 2 - 11, y: 60, w: 22, h: 22, points: 20, moving: true, moveRange: 40, moveSpeed: 0.03 },
      { x: 40, y: 160, w: 22, h: 22, points: 10 },
      { x: cw - 60, y: 160, w: 22, h: 22, points: 10 },
    ],
    obstacles: [
      { x: 0, y: 220, w: cw, h: 8 },
      { x: 0, y: 130, w: 25, h: 90 },
      { x: cw - 25, y: 130, w: 25, h: 90 },
    ],
    shots: 6,
  },
  {
    targets: [
      { x: 40, y: 100, w: 18, h: 18, points: 10 },
      { x: 80, y: 100, w: 18, h: 18, points: 10 },
      { x: 120, y: 100, w: 18, h: 18, points: 10 },
      { x: 160, y: 100, w: 18, h: 18, points: 10 },
      { x: cw - 170, y: 100, w: 18, h: 18, points: 10 },
      { x: cw - 130, y: 100, w: 18, h: 18, points: 10 },
      { x: cw - 90, y: 100, w: 18, h: 18, points: 10 },
      { x: cw - 50, y: 100, w: 18, h: 18, points: 10 },
    ],
    obstacles: [
      { x: 0, y: 200, w: cw, h: 8 },
      { x: cw / 2 - 60, y: 60, w: 120, h: 12 },
    ],
    shots: 8,
  },
];

// ─── Game State ──────────────────────────────────────────
let level = 0;
let score = 0;
let shotsLeft = 5;
let targets = [];
let obstacles = [];
let proj = null;
let gameState = 'menu'; // menu | aiming | flying | done
let dragX = 0, dragY = 0;
let touchActive = false;

// ─── Load Level ─────────────────────────────────────────
function loadLevel(idx) {
  const lv = LEVELS[idx];
  targets = lv.targets.map(t => ({ ...t, baseX: t.x, hit: false }));
  obstacles = lv.obstacles.map(o => ({ ...o }));
  shotsLeft = lv.shots;
  proj = null;
  gameState = 'menu';
  updateHUD();

  overlay.classList.remove('hidden');
  overlayTitle.textContent = 'Уровень ' + (idx + 1);
  const totalPoints = lv.targets.reduce((s, t) => s + t.points, 0);
  overlaySub.textContent = 'Целей: ' + lv.targets.length + ' | Очков: ' + totalPoints;
  btnNext.textContent = 'Старт!';
  btnNext.onclick = () => {
    overlay.classList.add('hidden');
    gameState = 'aiming';
    touchActive = false;
  };
}

// ─── Shooter ─────────────────────────────────────────────
function getSlingPos() {
  return { x: SLING_X(), y: SLING_Y() };
}

function fireProjectile(vx, vy) {
  const s = getSlingPos();
  proj = {
    x: s.x,
    y: s.y - 10,
    vx: vx,
    vy: vy,
    r: 7,
    trail: [],
  };
  gameState = 'flying';
  shotsLeft--;
  updateHUD();
}

// ─── Update ──────────────────────────────────────────────
function update() {
  if (gameState !== 'flying' || !proj) return;

  // Move targets
  for (const t of targets) {
    if (t.moving && !t.hit) {
      t.x = t.baseX + Math.sin(Date.now() * t.moveSpeed) * t.moveRange;
    }
  }

  // Physics
  proj.vy += GRAVITY;
  proj.x += proj.vx;
  proj.y += proj.vy;

  proj.trail.push({ x: proj.x, y: proj.y });
  if (proj.trail.length > 15) proj.trail.shift();

  // Bounce off walls
  if (proj.x < proj.r) { proj.x = proj.r; proj.vx *= -0.5; }
  if (proj.x > cw - proj.r) { proj.x = cw - proj.r; proj.vx *= -0.5; }

  // Hit obstacles (simple AABB)
  for (const o of obstacles) {
    if (proj.x + proj.r > o.x && proj.x - proj.r < o.x + o.w &&
        proj.y + proj.r > o.y && proj.y - proj.r < o.y + o.h) {
      // Determine bounce direction
      const cx = o.x + o.w / 2;
      const cy = o.y + o.h / 2;
      const dx = proj.x - cx;
      const dy = proj.y - cy;
      if (Math.abs(dx / o.w) > Math.abs(dy / o.h)) {
        proj.vx *= -0.6;
        proj.x += proj.vx > 0 ? 3 : -3;
      } else {
        proj.vy *= -0.6;
        proj.y += proj.vy < 0 ? -3 : 3;
      }
    }
  }

  // Hit targets
  for (const t of targets) {
    if (t.hit) continue;
    if (proj.x + proj.r > t.x && proj.x - proj.r < t.x + t.w &&
        proj.y + proj.r > t.y && proj.y - proj.r < t.y + t.h) {
      t.hit = true;
      score += t.points;
      updateHUD();
    }
  }

  // Check if out of bounds or done
  if (proj.y > ch + 50 || proj.x < -50 || proj.x > cw + 50) {
    endShot();
  }
}

function endShot() {
  proj = null;
  gameState = 'aiming';
  touchActive = false;

  // Check level complete
  if (targets.every(t => t.hit)) {
    gameState = 'done';
    overlay.classList.remove('hidden');
    overlayTitle.textContent = '🎉 Уровень пройден!';
    const nextIdx = level + 1;
    if (nextIdx < LEVELS.length) {
      overlaySub.textContent = 'Счёт: ' + score;
      btnNext.textContent = 'Дальше →';
      btnNext.onclick = () => { level = nextIdx; loadLevel(level); };
    } else {
      overlaySub.textContent = '🎊 Ты прошёл ВСЕ уровни! Счёт: ' + score;
      btnNext.textContent = 'Заново';
      btnNext.onclick = () => { level = 0; score = 0; loadLevel(level); };
    }
  } else if (shotsLeft <= 0) {
    gameState = 'done';
    overlay.classList.remove('hidden');
    overlayTitle.textContent = '💥 Нет выстрелов';
    overlaySub.textContent = 'Счёт: ' + score;
    btnNext.textContent = 'Повторить';
    btnNext.onclick = () => { loadLevel(level); };
  }
}

// ─── Draw ────────────────────────────────────────────────
function draw() {
  ctx.clearRect(0, 0, cw, ch);

  // Sky gradient
  const grad = ctx.createLinearGradient(0, 0, 0, ch);
  grad.addColorStop(0, '#4dc9f6');
  grad.addColorStop(0.6, '#87CEEB');
  grad.addColorStop(1, '#a8d8ea');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, cw, ch);

  // Clouds
  ctx.fillStyle = 'rgba(255,255,255,0.4)';
  drawCloud(60, 40, 30);
  drawCloud(cw - 90, 60, 25);
  drawCloud(cw / 2 + 20, 25, 20);

  // Ground
  ctx.fillStyle = '#4a7c3f';
  ctx.fillRect(0, ch - 30, cw, 30);
  ctx.fillStyle = '#3d6b34';
  ctx.fillRect(0, ch - 30, cw, 4);

  // Obstacles
  ctx.fillStyle = '#8B4513';
  for (const o of obstacles) {
    ctx.fillRect(o.x, o.y, o.w, o.h);
    ctx.strokeStyle = '#6B3410';
    ctx.lineWidth = 2;
    ctx.strokeRect(o.x, o.y, o.w, o.h);
  }

  // Targets
  for (const t of targets) {
    if (t.hit) {
      ctx.fillStyle = 'rgba(100,100,100,0.3)';
      ctx.fillRect(t.x, t.y, t.w, t.h);
      continue;
    }
    const gradT = ctx.createRadialGradient(t.x + t.w / 2, t.y + t.h / 2, 0, t.x + t.w / 2, t.y + t.h / 2, t.w);
    gradT.addColorStop(0, '#ff6b6b');
    gradT.addColorStop(0.6, '#e74c3c');
    gradT.addColorStop(1, '#c0392b');
    ctx.fillStyle = gradT;
    ctx.beginPath();
    ctx.roundRect(t.x, t.y, t.w, t.h, 4);
    ctx.fill();

    // Points label
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(t.points, t.x + t.w / 2, t.y + t.h / 2);
  }

  // Slingshot base
  const s = getSlingPos();
  ctx.strokeStyle = '#5a3a1a';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(s.x - FORK_SPREAD, s.y - 30);
  ctx.lineTo(s.x - FORK_SPREAD, s.y + 10);
  ctx.moveTo(s.x + FORK_SPREAD, s.y - 30);
  ctx.lineTo(s.x + FORK_SPREAD, s.y + 10);
  ctx.stroke();

  // Aiming
  if (gameState === 'aiming' && touchActive) {
    const dx = s.x - dragX;
    const dy = s.y - dragY;
    const pull = Math.min(Math.sqrt(dx * dx + dy * dy), MAX_PULL);
    if (pull > 15) {
      const angle = Math.atan2(dy, dx);
      const power = pull / MAX_PULL;

      // Elastic band
      ctx.strokeStyle = '#8B4513';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(s.x - FORK_SPREAD, s.y - 30);
      ctx.lineTo(dragX, dragY);
      ctx.lineTo(s.x + FORK_SPREAD, s.y - 30);
      ctx.stroke();

      // Projectile on band
      ctx.fillStyle = '#2c2c2c';
      ctx.beginPath();
      ctx.arc(dragX, dragY, 10, 0, Math.PI * 2);
      ctx.fill();

      // Trajectory preview
      const launchVx = Math.cos(angle) * power * 26;
      const launchVy = Math.sin(angle) * power * 26;
      ctx.fillStyle = 'rgba(255,255,255,0.4)';
      let px = s.x, py = s.y - 10;
      let pvx = launchVx, pvy = launchVy;
      for (let i = 0; i < 30; i++) {
        pvx *= 0.99;
        pvy += GRAVITY;
        px += pvx;
        py += pvy;
        if (py > ch) break;
        ctx.beginPath();
        ctx.arc(px, py, 2, 0, Math.PI * 2);
        ctx.fill();
      }
    } else {
      // Resting projectile on sling
      ctx.fillStyle = '#2c2c2c';
      ctx.beginPath();
      ctx.arc(s.x, s.y - 10, 10, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (gameState !== 'flying') {
    // Resting projectile
    ctx.fillStyle = '#2c2c2c';
    ctx.beginPath();
    ctx.arc(s.x, s.y - 10, 10, 0, Math.PI * 2);
    ctx.fill();
  }

  // Flying projectile
  if (proj) {
    // Trail
    for (let i = 0; i < proj.trail.length; i++) {
      const a = i / proj.trail.length * 0.5;
      ctx.fillStyle = `rgba(44,44,44,${a})`;
      ctx.beginPath();
      ctx.arc(proj.trail[i].x, proj.trail[i].y, 3, 0, Math.PI * 2);
      ctx.fill();
    }
    // Projectile
    ctx.fillStyle = '#2c2c2c';
    ctx.beginPath();
    ctx.arc(proj.x, proj.y, proj.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#444';
    ctx.beginPath();
    ctx.arc(proj.x - 2, proj.y - 3, 3, 0, Math.PI * 2);
    ctx.fill();
  }

  // Touch hint if no activity
  if (gameState === 'aiming' && !touchActive && shotsLeft > 0) {
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.font = '14px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('👇 Оттяни и отпусти', cw / 2, ch - 60);
  }
}

function drawCloud(x, y, size) {
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    ctx.arc(x + i * size * 0.8, y + (i % 2) * size * 0.3, size * (0.6 + i * 0.15), 0, Math.PI * 2);
    ctx.fill();
  }
}

// ─── Loop ────────────────────────────────────────────────
function loop() {
  update();
  draw();
  requestAnimationFrame(loop);
}

// ─── HUD ─────────────────────────────────────────────────
function updateHUD() {
  scoreEl.textContent = '🎯 ' + score;
  shotsEl.textContent = '🔫 ' + shotsLeft;
  levelEl.textContent = '🏁 ' + (level + 1);
}

// ─── Input ───────────────────────────────────────────────
canvas.addEventListener('touchstart', (e) => {
  e.preventDefault();
  if (gameState !== 'aiming') return;
  const t = e.touches[0];
  const r = canvas.getBoundingClientRect();
  dragX = t.clientX - r.left;
  dragY = t.clientY - r.top;
  touchActive = true;
});

canvas.addEventListener('touchmove', (e) => {
  e.preventDefault();
  if (gameState !== 'aiming' || !touchActive) return;
  const t = e.touches[0];
  const r = canvas.getBoundingClientRect();
  dragX = t.clientX - r.left;
  dragY = t.clientY - r.top;
});

canvas.addEventListener('touchend', (e) => {
  e.preventDefault();
  if (gameState !== 'aiming' || !touchActive) return;

  const s = getSlingPos();
  const dx = s.x - dragX;
  const dy = s.y - dragY;
  const pull = Math.sqrt(dx * dx + dy * dy);

  if (pull > 20) {
    const limited = Math.min(pull, MAX_PULL);
    const angle = Math.atan2(dy, dx);
    const power = limited / MAX_PULL;
    const vx = Math.cos(angle) * power * 26;
    const vy = Math.sin(angle) * power * 26;
    fireProjectile(vx, vy);
  }
  touchActive = false;
});

// Mouse support
canvas.addEventListener('mousedown', (e) => {
  if (gameState !== 'aiming') return;
  const r = canvas.getBoundingClientRect();
  dragX = e.clientX - r.left;
  dragY = e.clientY - r.top;
  touchActive = true;
});

canvas.addEventListener('mousemove', (e) => {
  if (gameState !== 'aiming' || !touchActive) return;
  const r = canvas.getBoundingClientRect();
  dragX = e.clientX - r.left;
  dragY = e.clientY - r.top;
});

canvas.addEventListener('mouseup', () => {
  if (gameState !== 'aiming' || !touchActive) return;
  const s = getSlingPos();
  const dx = s.x - dragX;
  const dy = s.y - dragY;
  const pull = Math.sqrt(dx * dx + dy * dy);

  if (pull > 20) {
    const limited = Math.min(pull, MAX_PULL);
    const angle = Math.atan2(dy, dx);
    const power = limited / MAX_PULL;
    const vx = Math.cos(angle) * power * 26;
    const vy = Math.sin(angle) * power * 26;
    fireProjectile(vx, vy);
  }
  touchActive = false;
});

// ─── Start ───────────────────────────────────────────────
loadLevel(0);
loop();
