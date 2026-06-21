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

let W, H, cw, ch;

function resize() {
  const rect = canvas.getBoundingClientRect();
  W = canvas.width = rect.width * (window.devicePixelRatio || 1);
  H = canvas.height = rect.height * (window.devicePixelRatio || 1);
  ctx.setTransform(W / rect.width, 0, 0, H / rect.height, 0, 0);
  cw = rect.width;
  ch = rect.height;
}
resize();
window.addEventListener('resize', resize);

// ─── Constants ──────────────────────────────────────────
const BALL_R = 11;
const POCKET_R = 18;
const FRICTION = 0.988;
const WALL_BOUNCE = 0.75;
const MAX_POWER = 16;

const TABLE = {
  left: () => cw * 0.10,
  right: () => cw * 0.90,
  top: () => ch * 0.10,
  bottom: () => ch * 0.90,
};

// Портрет: центральные лузы по бокам (длинные борта)
// Лузы на границе стола — открытый край, куда шар может закатиться
const POCKETS = [
  { x: () => cw * 0.10, y: () => ch * 0.10, pts: 3 },
  { x: () => cw * 0.90, y: () => ch * 0.10, pts: 3 },
  { x: () => cw * 0.10, y: () => ch * 0.50, pts: 7 },
  { x: () => cw * 0.90, y: () => ch * 0.50, pts: 7 },
  { x: () => cw * 0.10, y: () => ch * 0.90, pts: 3 },
  { x: () => cw * 0.90, y: () => ch * 0.90, pts: 3 },
];

const BALL_COLORS = [
  '#FFD700','#1E90FF','#FF4500','#9932CC','#FF8C00','#228B22','#8B0000','#2F4F4F',
  '#FF69B4','#00CED1','#FFD700','#FF6347','#7B68EE','#32CD32','#DC143C','#FFD700',
];

// ─── State ──────────────────────────────────────────────
let level = 1;
let score = 0;
let shotsLeft = 0;
let balls = [];
let cueBall = null;
let gameState = 'menu';
let dragX = 0, dragY = 0;
let touchActive = false;
let powerRatio = 0;
let settling = false;

// ─── Auto-generate Level ────────────────────────────────
function genLevel(lv) {
  const numTargets = Math.min(1 + lv, 11);
  const totalBalls = numTargets + 1;
  const ballsOut = [];
  const tl = TABLE.left(), tr = TABLE.right();
  const tt = TABLE.top(), tb = TABLE.bottom();
  const ctrX = (tl + tr) * 0.5;

  // Кий — за головной линией ("kitchen"), 18% от нижнего борта
  const cueX = ctrX;
  const cueY = tb - (tb - tt) * 0.18;
  ballsOut.push({ x: cueX, y: cueY, r: BALL_R, vx: 0, vy: 0, cue: true, color: '#fff', label: '', active: true });

  // Пирамида шаров в верхней части стола
  const apexX = ctrX;
  const apexY = tt + BALL_R + 20 + (tb - tt) * 0.08;
  const spacing = BALL_R * 2 + 1;
  const rowSpacing = BALL_R * Math.sqrt(3);
  let placed = 0, row = 0;

  while (placed < numTargets) {
    for (let col = 0; col <= row && placed < numTargets; col++) {
      const x = apexX + (col - row / 2) * spacing;
      const y = apexY + row * rowSpacing;
      ballsOut.push({ x, y, r: BALL_R, vx: 0, vy: 0, cue: false, color: BALL_COLORS[placed % BALL_COLORS.length], label: String(placed + 1), active: true });
      placed++;
    }
    row++;
  }

  return { balls: ballsOut, shots: totalBalls };
}

// ─── Load Level ─────────────────────────────────────────
function loadLevel(lv) {
  const data = genLevel(lv);
  balls = data.balls;
  cueBall = balls[0];
  shotsLeft = data.shots;
  gameState = 'menu';
  powerRatio = 0;
  touchActive = false;
  settling = false;
  updateHUD();
  overlay.classList.remove('hidden');
  overlayTitle.textContent = 'Уровень ' + lv;
  overlaySub.textContent = 'Шаров: ' + balls.length + ' | Ходов: ' + shotsLeft;
  btnNext.textContent = 'Старт!';
  btnNext.onclick = () => {
    overlay.classList.add('hidden');
    gameState = 'aiming';
  };
}

// ─── Shoot ──────────────────────────────────────────────
function shoot(vx, vy) {
  cueBall.vx = vx;
  cueBall.vy = vy;
  gameState = 'flying';
  shotsLeft--;
  powerRatio = 0;
  settling = true;
  updateHUD();
}

// ─── Update ──────────────────────────────────────────────
function update() {
  if (gameState !== 'flying') return;

  let allStill = true;

  for (const b of balls) {
    if (!b.active) continue;

    b.vx *= FRICTION;
    b.vy *= FRICTION;
    if (Math.abs(b.vx) < 0.05) b.vx = 0;
    if (Math.abs(b.vy) < 0.05) b.vy = 0;

    b.x += b.vx;
    b.y += b.vy;

    if (Math.abs(b.vx) > 0.05 || Math.abs(b.vy) > 0.05) allStill = false;

    // walls (пропускаем отскок если шар у лузы)
    const atPocket = nearPocket(b);
    if (!atPocket) {
      if (b.x - b.r < TABLE.left()) { b.x = TABLE.left() + b.r; b.vx = Math.abs(b.vx) * WALL_BOUNCE; }
      if (b.x + b.r > TABLE.right()) { b.x = TABLE.right() - b.r; b.vx = -Math.abs(b.vx) * WALL_BOUNCE; }
      if (b.y - b.r < TABLE.top()) { b.y = TABLE.top() + b.r; b.vy = Math.abs(b.vy) * WALL_BOUNCE; }
      if (b.y + b.r > TABLE.bottom()) { b.y = TABLE.bottom() - b.r; b.vy = -Math.abs(b.vy) * WALL_BOUNCE; }
    }
  }

  // Ball-ball collisions
  for (let i = 0; i < balls.length; i++) {
    for (let j = i + 1; j < balls.length; j++) {
      const a = balls[i], b = balls[j];
      if (!a.active || !b.active) continue;
      collide(a, b);
    }
  }

  // Pockets
  for (const b of balls) {
    if (!b.active) continue;
    for (const p of POCKETS) {
      const dx = b.x - p.x(), dy = b.y - p.y();
      if (dx * dx + dy * dy < POCKET_R * POCKET_R) {
        b.active = false;
        score += b.cue ? 5 : 10;
        score += p.pts;
        updateHUD();
        break;
      }
    }
  }

  if (settling && allStill) {
    settling = false;
    endTurn();
  }
}

function nearPocket(ball) {
  for (const p of POCKETS) {
    const dx = ball.x - p.x(), dy = ball.y - p.y();
    if (dx * dx + dy * dy < (POCKET_R + ball.r + 2) * (POCKET_R + ball.r + 2)) return true;
  }
  return false;
}

function simulateTrajectory(sx, sy, svx, svy) {
  const tl = TABLE.left() + BALL_R, tr = TABLE.right() - BALL_R;
  const tt = TABLE.top() + BALL_R, tb = TABLE.bottom() - BALL_R;
  const results = [];
  const hitBalls = new Set();

  const sims = [{ x: sx, y: sy, vx: svx, vy: svy, dotR: 2.5, color: 'rgba(255,255,200,1)', dots: [], idx: -1 }];
  results.push(sims[0]);

  for (let iter = 0; iter < 800; iter++) {
    let anyMoving = false;
    for (const sim of sims) {
      if (sim.stopped) continue;
      sim.vx *= FRICTION; sim.vy *= FRICTION;
      sim.x += sim.vx; sim.y += sim.vy;
      if (Math.abs(sim.vx) < 0.15 && Math.abs(sim.vy) < 0.15) { sim.stopped = true; continue; }
      anyMoving = true;
      const nearP = nearPocket({ x: sim.x, y: sim.y, r: BALL_R });
      if (!nearP) {
        if (sim.x < tl) { sim.x = tl; sim.vx = Math.abs(sim.vx) * WALL_BOUNCE; }
        if (sim.x > tr) { sim.x = tr; sim.vx = -Math.abs(sim.vx) * WALL_BOUNCE; }
        if (sim.y < tt) { sim.y = tt; sim.vy = Math.abs(sim.vy) * WALL_BOUNCE; }
        if (sim.y > tb) { sim.y = tb; sim.vy = -Math.abs(sim.vy) * WALL_BOUNCE; }
      }
      if (iter % 2 === 0) sim.dots.push({ x: sim.x, y: sim.y });
    }

    // Соударения между симулированными шарами и реальными
    for (const sim of sims) {
      if (sim.stopped || sim.collided) continue;
      for (const ball of balls) {
        if (!ball.active || ball.cue || hitBalls.has(ball)) continue;
        const dx = ball.x - sim.x, dy = ball.y - sim.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < BALL_R * 2 && dist > 0.01) {
          // nx,ny от кия к цели — направление удара
          const nx = dx / dist, ny = dy / dist;
          const relV = sim.vx * nx + sim.vy * ny;
          if (relV <= 0) continue; // кий движется не в сторону шара
          // Передаём импульс цели
          const transfer = relV * 0.85;
          const tcolor = ball.color;
          const previewColor = `rgba(${parseInt(tcolor.slice(1,3),16)},${parseInt(tcolor.slice(3,5),16)},${parseInt(tcolor.slice(5,7),16)},1)`;
          const tsim = { x: ball.x + nx * BALL_R, y: ball.y + ny * BALL_R, vx: nx * transfer, vy: ny * transfer, dotR: 2, color: previewColor, dots: [], idx: sims.length, stopped: false, collided: false };
          sims.push(tsim);
          results.push(tsim);
          sim.collided = sim.idx > 0; // кий (idx=-1) может бить дальше
          // Кий теряет составляющую вдоль линии удара
          sim.vx -= nx * transfer;
          sim.vy -= ny * transfer;
          hitBalls.add(ball);
          break;
        }
      }
    }

    if (!anyMoving) break;
  }
  return results;
}

function collide(a, b) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  const minDist = a.r + b.r;
  if (dist >= minDist || dist < 0.001) return;

  const nx = dx / dist;
  const ny = dy / dist;
  const overlap = minDist - dist;

  a.x -= nx * overlap * 0.5;
  a.y -= ny * overlap * 0.5;
  b.x += nx * overlap * 0.5;
  b.y += ny * overlap * 0.5;

  const dvx = b.vx - a.vx;
  const dvy = b.vy - a.vy;
  const relV = dvx * nx + dvy * ny;
  if (relV > 0) return;

  const impulse = relV * 0.95;
  a.vx += impulse * nx;
  a.vy += impulse * ny;
  b.vx -= impulse * nx;
  b.vy -= impulse * ny;
}

function endTurn() {
  const remaining = balls.filter(b => b.active);
  if (remaining.length === 0 || shotsLeft <= 0) {
    gameState = 'done';
    overlay.classList.remove('hidden');
    overlayTitle.textContent = '🎉 Уровень пройден!';
    const nextLv = level + 1;
    let sub = 'Счёт: ' + score;
    if (remaining.length === 0) sub += ' | Все шары забиты!';
    if (nextLv <= 20) {
      overlaySub.textContent = sub;
      btnNext.textContent = 'Дальше →';
      btnNext.onclick = () => { level = nextLv; loadLevel(level); };
    } else {
      overlaySub.textContent = '🎊 Все уровни пройдены! ' + sub;
      btnNext.textContent = 'Заново';
      btnNext.onclick = () => { level = 1; score = 0; loadLevel(level); };
    }
    return;
  }

  // If cue ball is gone, reassign
  if (!cueBall.active) {
    const activeBalls = balls.filter(b => b.active);
    if (activeBalls.length > 0) {
      cueBall = activeBalls[0];
      cueBall.cue = true;
      cueBall.color = '#fff';
    }
  }

  gameState = 'aiming';
}

// ─── Draw ────────────────────────────────────────────────
function draw() {
  ctx.clearRect(0, 0, cw, ch);

  // Background
  ctx.fillStyle = '#1a1a2e';
  ctx.fillRect(0, 0, cw, ch);

  // Table shadow
  ctx.fillStyle = 'rgba(0,0,0,0.4)';
  roundRect(ctx, TABLE.left() + 3, TABLE.top() + 3, TABLE.right() - TABLE.left(), TABLE.bottom() - TABLE.top(), 6);
  ctx.fill();

  // Outer rail (wood)
  ctx.fillStyle = '#5C3A1E';
  roundRect(ctx, TABLE.left(), TABLE.top(), TABLE.right() - TABLE.left(), TABLE.bottom() - TABLE.top(), 5);
  ctx.fill();

  // Inner rail (dark green)
  const railW = 8;
  ctx.fillStyle = '#2E7D4E';
  roundRect(ctx, TABLE.left() + railW, TABLE.top() + railW, TABLE.right() - TABLE.left() - railW * 2, TABLE.bottom() - TABLE.top() - railW * 2, 3);
  ctx.fill();

  // Felt (bright green)
  ctx.fillStyle = '#3BA85E';
  roundRect(ctx, TABLE.left() + railW + 4, TABLE.top() + railW + 4, TABLE.right() - TABLE.left() - railW * 2 - 8, TABLE.bottom() - TABLE.top() - railW * 2 - 8, 2);
  ctx.fill();

  // Head string (головная линия)
  const hsY = TABLE.bottom() - (TABLE.bottom() - TABLE.top()) * 0.25;
  ctx.strokeStyle = 'rgba(255,255,255,0.12)';
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.moveTo(TABLE.left() + railW + 4, hsY);
  ctx.lineTo(TABLE.right() - railW - 4, hsY);
  ctx.stroke();
  ctx.setLineDash([]);

  // Foot spot (место пирамиды)
  const fsX = TABLE.left() + (TABLE.right() - TABLE.left()) * 0.5;
  const fsY = TABLE.top() + BALL_R + 20 + (TABLE.bottom() - TABLE.top()) * 0.08;
  ctx.fillStyle = 'rgba(255,255,255,0.25)';
  const ds = 4;
  ctx.beginPath();
  ctx.moveTo(fsX, fsY - ds);
  ctx.lineTo(fsX + ds, fsY);
  ctx.lineTo(fsX, fsY + ds);
  ctx.lineTo(fsX - ds, fsY);
  ctx.closePath();
  ctx.fill();

  // Pocket cutouts on rails
  for (const p of POCKETS) {
    const px = p.x(), py = p.y();
    const r = POCKET_R + 2;
    // Dark hole
    ctx.fillStyle = '#111';
    ctx.beginPath();
    ctx.arc(px, py, r, 0, Math.PI * 2);
    ctx.fill();
    // Inner shadow
    ctx.fillStyle = '#222';
    ctx.beginPath();
    ctx.arc(px, py, r - 3, 0, Math.PI * 2);
    ctx.fill();
    // Point label
    ctx.fillStyle = '#ffd700';
    ctx.font = 'bold 9px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('+' + p.pts, px, py + 1);
  }

  // Balls
  for (const b of balls) {
    if (!b.active) continue;
    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.arc(b.x + 2, b.y + 2, b.r, 0, Math.PI * 2);
    ctx.fill();
    // Ball
    const grad = ctx.createRadialGradient(b.x - 3, b.y - 4, 1, b.x, b.y, b.r);
    grad.addColorStop(0, lightenColor(b.color, 50));
    grad.addColorStop(0.7, b.color);
    grad.addColorStop(1, darkenColor(b.color, 40));
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
    ctx.fill();
    if (b.cue) {
      ctx.strokeStyle = 'rgba(200,200,200,0.5)';
      ctx.lineWidth = 1;
      ctx.stroke();
    }
    // Number
    if (b.label) {
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 8px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(b.label, b.x, b.y + 0.5);
    }
  }

  // Aiming
  if (gameState === 'aiming' && touchActive) {
    const dx = cueBall.x - dragX;
    const dy = cueBall.y - dragY;
    const pull = Math.min(Math.sqrt(dx * dx + dy * dy), 120);

    if (pull > 5) {
      powerRatio = pull / 120;
      // Power bar
      drawPowerBar(powerRatio);

      const angle = Math.atan2(dy, dx);
      const power = (pull / 120) * MAX_POWER;

      // Cue stick (короче для портрета)
      const stickLen = 40 + pull * 0.35;
      ctx.strokeStyle = '#8B4513';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(cueBall.x + Math.cos(angle) * (BALL_R + 4), cueBall.y + Math.sin(angle) * (BALL_R + 4));
      ctx.lineTo(cueBall.x + Math.cos(angle) * stickLen, cueBall.y + Math.sin(angle) * stickLen);
      ctx.stroke();

      // Траектории: кий + соударения с шарами
      const trajectories = simulateTrajectory(cueBall.x, cueBall.y, Math.cos(angle) * power, Math.sin(angle) * power);
      for (const traj of trajectories) {
        const dots = traj.dots;
        // Пунктирная линия для траектории кия
        if (traj.idx === -1 && dots.length > 1) {
          ctx.strokeStyle = 'rgba(255,255,200,0.25)';
          ctx.lineWidth = 1.5;
          ctx.setLineDash([4, 5]);
          ctx.beginPath();
          ctx.moveTo(dots[0].x, dots[0].y);
          for (let i = 1; i < dots.length; i++) ctx.lineTo(dots[i].x, dots[i].y);
          ctx.stroke();
          ctx.setLineDash([]);
        }
        // Точки с белой подложкой для контраста на сукне
        for (let i = 0; i < dots.length; i++) {
          const r = traj.dotR;
          const p = dots[i];
          const alpha = 0.5 + 0.45 * (1 - i / dots.length);
          // Белая подложка
          ctx.fillStyle = 'rgba(255,255,255,0.7)';
          ctx.beginPath();
          ctx.arc(p.x, p.y, r + 1, 0, Math.PI * 2);
          ctx.fill();
          // Цветной центр
          ctx.fillStyle = traj.color.replace('1)', alpha + ')');
          ctx.beginPath();
          ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    // Drag indicator
    ctx.strokeStyle = 'rgba(255,255,255,0.3)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(dragX, dragY, 10, 0, Math.PI * 2);
    ctx.stroke();
  } else if (gameState === 'aiming' && !touchActive && shotsLeft > 0) {
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.font = '14px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('👆 Оттяни от шара и отпусти', cw / 2, ch * 0.97);
  }
}

function drawPowerBar(ratio) {
  const barW = 100, barH = 8;
  const bx = cw * 0.5 - barW / 2, by = ch * 0.06;
  ctx.fillStyle = 'rgba(0,0,0,0.4)';
  roundRect(ctx, bx - 2, by - 2, barW + 4, barH + 4, 4);
  ctx.fill();
  const fillW = barW * ratio;
  if (fillW > 0) {
    const grad = ctx.createLinearGradient(bx, by, bx + barW, by);
    grad.addColorStop(0, '#2ecc71');
    grad.addColorStop(0.5, '#f39c12');
    grad.addColorStop(1, '#e74c3c');
    ctx.fillStyle = grad;
    roundRect(ctx, bx, by, fillW, barH, 3);
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
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function lightenColor(color, amt) {
  const hex = color.replace('#','');
  if (hex.length < 6) return color;
  const r = Math.min(255, parseInt(hex.substr(0,2),16) + amt);
  const g = Math.min(255, parseInt(hex.substr(2,2),16) + amt);
  const b = Math.min(255, parseInt(hex.substr(4,2),16) + amt);
  return `rgb(${r},${g},${b})`;
}

function darkenColor(color, amt) {
  const hex = color.replace('#','');
  if (hex.length < 6) return color;
  const r = Math.max(0, parseInt(hex.substr(0,2),16) - amt);
  const g = Math.max(0, parseInt(hex.substr(2,2),16) - amt);
  const b = Math.max(0, parseInt(hex.substr(4,2),16) - amt);
  return `rgb(${r},${g},${b})`;
}

// ─── Loop ────────────────────────────────────────────────
function loop() {
  update();
  draw();
  requestAnimationFrame(loop);
}

// ─── HUD ─────────────────────────────────────────────────
function updateHUD() {
  scoreEl.textContent = score;
  shotsEl.textContent = shotsLeft;
  levelEl.textContent = level;
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
  const dx = cueBall.x - dragX;
  const dy = cueBall.y - dragY;
  const pull = Math.sqrt(dx * dx + dy * dy);

  if (pull > 10) {
    const angle = Math.atan2(dy, dx);
    const power = Math.min(pull / 120, 1) * MAX_POWER;
    const vx = Math.cos(angle) * power;
    const vy = Math.sin(angle) * power;
    shoot(vx, vy);
  }
  touchActive = false;
  powerRatio = 0;
}

// ─── Start ───────────────────────────────────────────────
loadLevel(1);
loop();
