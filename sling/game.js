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
const MAX_PULL = 100;
const SLING_X = () => cw / 2;
const SLING_Y = () => ch * 0.72;
const POWER_MULT = 0.22;

// Препятствия всегда ниже рогатки (y=0.78 > sling_y=0.72).
// Снаряд летит вверх свободно, препятствия ловят только
// неудачные выстрелы на излёте. Центр свободен.
const LEVELS = [
  // 1
  { targets: [{ x: 0.72, y: 0.20, w: 55, h: 55, points: 10 }], obstacles: [], shots: 3 },
  // 2
  { targets: [
    { x: 0.18, y: 0.22, w: 46, h: 46, points: 10 },
    { x: 0.76, y: 0.18, w: 46, h: 46, points: 15 },
  ], obstacles: [], shots: 4 },
  // 3
  { targets: [
    { x: 0.15, y: 0.16, w: 40, h: 40, points: 10 },
    { x: 0.50, y: 0.09, w: 40, h: 40, points: 15 },
    { x: 0.82, y: 0.14, w: 40, h: 40, points: 20 },
  ], obstacles: [
    { x: 0, y: 0.78, w: 0.10, h: 6 },
    { x: 0.90, y: 0.78, w: 0.10, h: 6 },
  ], shots: 5 },
  // 4 — движущаяся
  { targets: [
    { x: 0.18, y: 0.16, w: 36, h: 36, points: 10 },
    { x: 0.74, y: 0.12, w: 36, h: 36, points: 15, moving: true, moveRange: 28, moveSpeed: 0.02 },
    { x: 0.48, y: 0.28, w: 36, h: 36, points: 20 },
  ], obstacles: [], shots: 5 },
  // 5
  { targets: [
    { x: 0.20, y: 0.10, w: 34, h: 34, points: 20 },
    { x: 0.78, y: 0.10, w: 34, h: 34, points: 20 },
  ], obstacles: [
    { x: 0.04, y: 0.78, w: 0.10, h: 6 },
    { x: 0.86, y: 0.78, w: 0.10, h: 6 },
  ], shots: 5 },
  // 6 — движущиеся
  { targets: [
    { x: 0.18, y: 0.12, w: 32, h: 32, points: 15, moving: true, moveRange: 22, moveSpeed: 0.025 },
    { x: 0.80, y: 0.13, w: 32, h: 32, points: 15, moving: true, moveRange: 22, moveSpeed: 0.025 },
    { x: 0.48, y: 0.09, w: 32, h: 32, points: 25, moving: true, moveRange: 12, moveSpeed: 0.03 },
  ], obstacles: [
    { x: 0, y: 0.78, w: 0.12, h: 6 },
    { x: 0.88, y: 0.78, w: 0.12, h: 6 },
  ], shots: 6 },
  // 7 — ряд
  { targets: [
    { x: 0.04, y: 0.14, w: 24, h: 24, points: 8 },
    { x: 0.20, y: 0.14, w: 24, h: 24, points: 8 },
    { x: 0.36, y: 0.14, w: 24, h: 24, points: 8 },
    { x: 0.52, y: 0.14, w: 24, h: 24, points: 8 },
    { x: 0.68, y: 0.14, w: 24, h: 24, points: 8 },
    { x: 0.84, y: 0.14, w: 24, h: 24, points: 8 },
  ], obstacles: [
    { x: 0.15, y: 0.78, w: 0.25, h: 6 },
    { x: 0.55, y: 0.78, w: 0.30, h: 6 },
  ], shots: 6 },
  // 8
  { targets: [
    { x: 0.15, y: 0.10, w: 28, h: 28, points: 15 },
    { x: 0.83, y: 0.10, w: 28, h: 28, points: 15 },
    { x: 0.48, y: 0.28, w: 28, h: 28, points: 20, moving: true, moveRange: 16, moveSpeed: 0.02 },
  ], obstacles: [
    { x: 0, y: 0.78, w: 0.15, h: 6 },
    { x: 0.85, y: 0.78, w: 0.15, h: 6 },
  ], shots: 6 },
  // 9 — движущиеся + нижние
  { targets: [
    { x: 0.18, y: 0.20, w: 20, h: 20, points: 12, moving: true, moveRange: 35, moveSpeed: 0.03 },
    { x: 0.50, y: 0.10, w: 22, h: 22, points: 18, moving: true, moveRange: 20, moveSpeed: 0.035 },
    { x: 0.80, y: 0.20, w: 20, h: 20, points: 12, moving: true, moveRange: 35, moveSpeed: 0.03 },
    { x: 0.35, y: 0.34, w: 22, h: 22, points: 10 },
    { x: 0.65, y: 0.34, w: 22, h: 22, points: 10 },
  ], obstacles: [
    { x: 0, y: 0.78, w: 0.12, h: 6 },
    { x: 0.40, y: 0.78, w: 0.20, h: 6 },
    { x: 0.76, y: 0.78, w: 0.12, h: 6 },
  ], shots: 6 },
  // 10 — финал старых
  { targets: [
    { x: 0.10, y: 0.10, w: 22, h: 22, points: 10 },
    { x: 0.28, y: 0.30, w: 22, h: 22, points: 10, moving: true, moveRange: 20, moveSpeed: 0.025 },
    { x: 0.45, y: 0.09, w: 24, h: 24, points: 20 },
    { x: 0.60, y: 0.28, w: 22, h: 22, points: 15, moving: true, moveRange: 22, moveSpeed: 0.03 },
    { x: 0.78, y: 0.10, w: 22, h: 22, points: 10 },
    { x: 0.90, y: 0.24, w: 22, h: 22, points: 10, moving: true, moveRange: 14, moveSpeed: 0.02 },
  ], obstacles: [
    { x: 0.05, y: 0.78, w: 0.10, h: 6 },
    { x: 0.42, y: 0.78, w: 0.16, h: 6 },
    { x: 0.78, y: 0.78, w: 0.17, h: 6 },
  ], shots: 7 },
  // ─── 11 — три больших на разной высоте ───
  { targets: [
    { x: 0.12, y: 0.10, w: 36, h: 36, points: 15 },
    { x: 0.50, y: 0.22, w: 36, h: 36, points: 15 },
    { x: 0.85, y: 0.10, w: 36, h: 36, points: 15 },
  ], obstacles: [
    { x: 0, y: 0.78, w: 0.08, h: 6 },
    { x: 0.92, y: 0.78, w: 0.08, h: 6 },
  ], shots: 5 },
  // ─── 12 — движущаяся в центре + боковые ───
  { targets: [
    { x: 0.10, y: 0.12, w: 28, h: 28, points: 12 },
    { x: 0.50, y: 0.18, w: 28, h: 28, points: 20, moving: true, moveRange: 35, moveSpeed: 0.025 },
    { x: 0.88, y: 0.12, w: 28, h: 28, points: 12 },
  ], obstacles: [
    { x: 0, y: 0.78, w: 0.10, h: 6 },
    { x: 0.35, y: 0.78, w: 0.30, h: 6 },
    { x: 0.90, y: 0.78, w: 0.10, h: 6 },
  ], shots: 5 },
  // ─── 13 — карусель из 4 движущихся ───
  { targets: [
    { x: 0.15, y: 0.10, w: 24, h: 24, points: 12, moving: true, moveRange: 20, moveSpeed: 0.025 },
    { x: 0.38, y: 0.10, w: 24, h: 24, points: 12, moving: true, moveRange: 20, moveSpeed: 0.025 },
    { x: 0.62, y: 0.10, w: 24, h: 24, points: 12, moving: true, moveRange: 20, moveSpeed: 0.025 },
    { x: 0.85, y: 0.10, w: 24, h: 24, points: 12, moving: true, moveRange: 20, moveSpeed: 0.025 },
  ], obstacles: [
    { x: 0, y: 0.78, w: 0.06, h: 6 },
    { x: 0.47, y: 0.78, w: 0.06, h: 6 },
    { x: 0.94, y: 0.78, w: 0.06, h: 6 },
  ], shots: 6 },
  // ─── 14 — лесенка ───
  { targets: [
    { x: 0.08, y: 0.26, w: 26, h: 26, points: 10 },
    { x: 0.25, y: 0.20, w: 26, h: 26, points: 10 },
    { x: 0.42, y: 0.14, w: 26, h: 26, points: 10 },
    { x: 0.58, y: 0.20, w: 26, h: 26, points: 10 },
    { x: 0.75, y: 0.26, w: 26, h: 26, points: 10 },
  ], obstacles: [
    { x: 0.04, y: 0.78, w: 0.20, h: 6 },
    { x: 0.76, y: 0.78, w: 0.20, h: 6 },
  ], shots: 5 },
  // ─── 15 — финал: всё сразу ───
  { targets: [
    { x: 0.08, y: 0.09, w: 20, h: 20, points: 10 },
    { x: 0.22, y: 0.30, w: 20, h: 20, points: 15, moving: true, moveRange: 18, moveSpeed: 0.03 },
    { x: 0.40, y: 0.10, w: 22, h: 22, points: 20 },
    { x: 0.55, y: 0.28, w: 20, h: 20, points: 15, moving: true, moveRange: 20, moveSpeed: 0.03 },
    { x: 0.72, y: 0.09, w: 20, h: 20, points: 10 },
    { x: 0.88, y: 0.24, w: 20, h: 20, points: 10, moving: true, moveRange: 14, moveSpeed: 0.025 },
  ], obstacles: [
    { x: 0, y: 0.78, w: 0.08, h: 6 },
    { x: 0.30, y: 0.78, w: 0.08, h: 6 },
    { x: 0.62, y: 0.78, w: 0.08, h: 6 },
    { x: 0.92, y: 0.78, w: 0.08, h: 6 },
  ], shots: 7 },
];

let level = 0;
let score = 0;
let shotsLeft = 5;
let targets = [];
let obstacles = [];
let proj = null;
let gameState = 'menu';
let dragX = 0, dragY = 0;
let touchActive = false;
let powerRatio = 0;

// ─── Load Level ─────────────────────────────────────────
function loadLevel(idx) {
  const lv = LEVELS[idx];
  targets = lv.targets.map(t => ({
    x: t.x * cw,
    y: t.y * ch,
    w: t.w,
    h: t.h,
    baseX: t.x * cw,
    points: t.points,
    hit: false,
    moving: t.moving || false,
    moveRange: t.moveRange || 0,
    moveSpeed: t.moveSpeed || 0,
  }));
  obstacles = lv.obstacles.map(o => ({
    x: typeof o.x === 'number' && o.x < 1 ? o.x * cw : o.x,
    y: typeof o.y === 'number' && o.y < 1 ? o.y * ch : o.y,
    w: typeof o.w === 'number' && o.w < 1 ? o.w * cw : o.w,
    h: typeof o.h === 'number' && o.h < 1 ? o.h * ch : o.h,
  }));
  shotsLeft = lv.shots;
  proj = null;
  gameState = 'menu';
  powerRatio = 0;
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
    y: s.y - 7,
    vx: vx,
    vy: vy,
    r: 7,
    trail: [],
    lifetime: 0,
  };
  gameState = 'flying';
  shotsLeft--;
  powerRatio = 0;
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

  // Lifetime
  proj.lifetime++;
  if (proj.lifetime > 300) { endShot(); return; }

  // Physics
  proj.vy += GRAVITY;
  proj.x += proj.vx;
  proj.y += proj.vy;

  proj.trail.push({ x: proj.x, y: proj.y });
  if (proj.trail.length > 18) proj.trail.shift();

  // Walls bounce
  if (proj.x < proj.r) { proj.x = proj.r; proj.vx = Math.abs(proj.vx) * 0.6; }
  if (proj.x > cw - proj.r) { proj.x = cw - proj.r; proj.vx = -Math.abs(proj.vx) * 0.6; }

  // Obstacles
  for (const o of obstacles) {
    if (proj.x + proj.r > o.x && proj.x - proj.r < o.x + o.w &&
        proj.y + proj.r > o.y && proj.y - proj.r < o.y + o.h) {
      const cx = o.x + o.w / 2;
      const cy = o.y + o.h / 2;
      const dx = proj.x - cx;
      const dy = proj.y - cy;
      if (Math.abs(dx / Math.max(o.w, 1)) > Math.abs(dy / Math.max(o.h, 1))) {
        proj.vx = -Math.sign(proj.vx) * Math.abs(proj.vx) * 0.65;
        proj.x += Math.sign(proj.vx) * 3;
      } else {
        proj.vy = -Math.sign(proj.vy) * Math.abs(proj.vy) * 0.65;
        proj.y += Math.sign(proj.vy) * 3;
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

  // Out of bounds
  if (proj.y > ch + 20 || proj.x < -100 || proj.x > cw + 100) {
    endShot(); return;
  }
  // Hit ground
  if (proj.y > ch - 25 && Math.abs(proj.vy) < 2) {
    endShot(); return;
  }
  // Very slow anywhere
  if (Math.abs(proj.vx) < 0.2 && Math.abs(proj.vy) < 0.2 && proj.y > ch - 60) {
    endShot(); return;
  }
}

function endShot() {
  proj = null;
  gameState = 'aiming';
  touchActive = false;

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
      overlaySub.textContent = '🎊 Все уровни пройдены! Счёт: ' + score;
      btnNext.textContent = 'Заново';
      btnNext.onclick = () => { level = 0; score = 0; loadLevel(level); };
    }
  } else if (shotsLeft <= 0) {
    gameState = 'done';
    overlay.classList.remove('hidden');
    overlayTitle.textContent = '💥 Нет выстрелов';
    overlaySub.textContent = 'Счёт: ' + score + ' | Осталось целей: ' + targets.filter(t => !t.hit).length;
    btnNext.textContent = 'Повторить';
    btnNext.onclick = () => { loadLevel(level); };
  }
}

// ─── Draw ────────────────────────────────────────────────
function draw() {
  ctx.clearRect(0, 0, cw, ch);

  // Sky
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
  ctx.fillRect(0, ch - 25, cw, 25);
  ctx.fillStyle = '#3d6b34';
  ctx.fillRect(0, ch - 25, cw, 4);

  // Obstacles
  for (const o of obstacles) {
    ctx.fillStyle = '#8B4513';
    ctx.fillRect(o.x, o.y, o.w, o.h);
    ctx.strokeStyle = '#6B3410';
    ctx.lineWidth = 2;
    ctx.strokeRect(o.x, o.y, o.w, o.h);
  }

  // Targets
  for (const t of targets) {
    if (t.hit) {
      ctx.fillStyle = 'rgba(80,80,80,0.3)';
      ctx.fillRect(t.x, t.y, t.w, t.h);
      continue;
    }
    const gradT = ctx.createRadialGradient(t.x + t.w / 2, t.y + t.h / 2, 0, t.x + t.w / 2, t.y + t.h / 2, t.w);
    gradT.addColorStop(0, '#ff6b6b');
    gradT.addColorStop(0.6, '#e74c3c');
    gradT.addColorStop(1, '#c0392b');
    ctx.fillStyle = gradT;
    ctx.fillRect(t.x, t.y, t.w, t.h);

    ctx.fillStyle = '#fff';
    ctx.font = 'bold 10px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(t.points, t.x + t.w / 2, t.y + t.h / 2);
  }

  // Slingshot frame
  const s = getSlingPos();
  ctx.strokeStyle = '#5a3a1a';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(s.x - 18, s.y - 28);
  ctx.lineTo(s.x - 18, s.y + 10);
  ctx.moveTo(s.x + 18, s.y - 28);
  ctx.lineTo(s.x + 18, s.y + 10);
  ctx.stroke();

  // Aiming
  if (gameState === 'aiming') {
    if (touchActive) {
      const dx = s.x - dragX;
      const dy = s.y - dragY;
      const pull = Math.min(Math.sqrt(dx * dx + dy * dy), MAX_PULL);

      // Power bar
      powerRatio = pull / MAX_PULL;
      drawPowerBar(powerRatio);

      if (pull > 10) {
        const angle = Math.atan2(dy, dx);
        const velocity = pull * POWER_MULT;

        // Elastic band
        ctx.strokeStyle = '#8B4513';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(s.x - 18, s.y - 28);
        ctx.lineTo(dragX, dragY);
        ctx.lineTo(s.x + 18, s.y - 28);
        ctx.stroke();

        // Drag cursor with ring
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(dragX, dragY, 12, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(dragX, dragY, 4, 0, Math.PI * 2);
        ctx.fill();

        // Trajectory dots
        const launchVx = Math.cos(angle) * velocity;
        const launchVy = Math.sin(angle) * velocity;
        let px = s.x, py = s.y - 7;
        let pvx = launchVx, pvy = launchVy;
        let prevX = s.x, prevY = s.y - 7;
        // рисуем линию
        ctx.strokeStyle = 'rgba(255,255,100,0.35)';
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 6]);
        ctx.beginPath();
        ctx.moveTo(prevX, prevY);
        for (let i = 0; i < 40; i++) {
          pvy += GRAVITY;
          px += pvx;
          py += pvy;
          if (py > ch || px < -20 || px > cw + 20) break;
          ctx.lineTo(px, py);
        }
        ctx.stroke();
        ctx.setLineDash([]);

        // точки поверх линии
        pvy = launchVy; px = s.x; py = s.y - 7;
        for (let i = 0; i < 40; i++) {
          pvy += GRAVITY;
          px += pvx;
          py += pvy;
          if (py > ch || px < -20 || px > cw + 20) break;
          const bright = 0.7 + 0.3 * (1 - i / 40);
          ctx.fillStyle = `rgba(255,255,100,${bright})`;
          ctx.beginPath();
          ctx.arc(px, py, 2.5, 0, Math.PI * 2);
          ctx.fill();
        }
      } else {
        // Resting projectile
        ctx.fillStyle = '#2c2c2c';
        ctx.beginPath();
        ctx.arc(s.x, s.y - 7, 7, 0, Math.PI * 2);
        ctx.fill();
      }
    } else {
      // Resting projectile
      ctx.fillStyle = '#2c2c2c';
      ctx.beginPath();
      ctx.arc(s.x, s.y - 7, 7, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Flying projectile
  if (proj) {
    for (let i = 0; i < proj.trail.length; i++) {
      const a = (i / proj.trail.length) * 0.5;
      ctx.fillStyle = `rgba(44,44,44,${a})`;
      ctx.beginPath();
      ctx.arc(proj.trail[i].x, proj.trail[i].y, 3, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = '#2c2c2c';
    ctx.beginPath();
    ctx.arc(proj.x, proj.y, proj.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#555';
    ctx.beginPath();
    ctx.arc(proj.x - 2, proj.y - 3, 2.5, 0, Math.PI * 2);
    ctx.fill();
  }

  // Hint
  if (gameState === 'aiming' && !touchActive && shotsLeft > 0) {
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.font = '14px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('👇 Оттяни и отпусти', cw / 2, ch - 55);
  }
}

function drawPowerBar(ratio) {
  const barW = 8;
  const barH = 80;
  const bx = 14;
  const by = ch - 30 - barH;

  ctx.fillStyle = 'rgba(0,0,0,0.4)';
  ctx.fillRect(bx - 1, by - 1, barW + 2, barH + 2);

  const fillH = barH * ratio;
  const grad = ctx.createLinearGradient(bx, by + barH, bx, by);
  grad.addColorStop(0, '#2ecc71');
  grad.addColorStop(0.5, '#f39c12');
  grad.addColorStop(1, '#e74c3c');
  ctx.fillStyle = grad;
  ctx.fillRect(bx, by + barH - fillH, barW, fillH);
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
  releaseShot();
});

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
  releaseShot();
});

function releaseShot() {
  const s = getSlingPos();
  const dx = s.x - dragX;
  const dy = s.y - dragY;
  const pull = Math.sqrt(dx * dx + dy * dy);

  if (pull > 15) {
    const limited = Math.min(pull, MAX_PULL);
    const angle = Math.atan2(dy, dx);
    const velocity = limited * POWER_MULT;
    const vx = Math.cos(angle) * velocity;
    const vy = Math.sin(angle) * velocity;
    fireProjectile(vx, vy);
  }
  touchActive = false;
  powerRatio = 0;
}

// ─── Start ───────────────────────────────────────────────
loadLevel(0);
loop();
