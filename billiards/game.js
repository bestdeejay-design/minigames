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
const BALL_R = 10;
const POCKET_R = 17;
const FRICTION = 0.988;
const WALL_BOUNCE = 0.75;
const MAX_POWER = 18;

const TABLE = {
  left: () => cw * 0.06,
  right: () => cw * 0.94,
  top: () => ch * 0.10,
  bottom: () => ch * 0.90,
};

const POCKETS = [
  { x: () => cw * 0.07, y: () => ch * 0.11, pts: 3 },
  { x: () => cw * 0.50, y: () => ch * 0.09, pts: 7 },
  { x: () => cw * 0.93, y: () => ch * 0.11, pts: 3 },
  { x: () => cw * 0.07, y: () => ch * 0.89, pts: 3 },
  { x: () => cw * 0.50, y: () => ch * 0.91, pts: 7 },
  { x: () => cw * 0.93, y: () => ch * 0.89, pts: 3 },
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
  const numBalls = Math.min(2 + lv, 12);
  const ballsOut = [];
  const placed = [];
  const tl = TABLE.left(), tr = TABLE.right();
  const tt = TABLE.top(), tb = TABLE.bottom();

  function randPos() {
    for (let attempt = 0; attempt < 100; attempt++) {
      const x = tl + BALL_R + Math.random() * (tr - tl - BALL_R * 2);
      const y = tt + BALL_R + Math.random() * (tb - tt - BALL_R * 2);
      let ok = true;
      for (const p of placed) {
        const dx = x - p.x, dy = y - p.y;
        if (dx * dx + dy * dy < (BALL_R * 2 + 6) * (BALL_R * 2 + 6)) { ok = false; break; }
      }
      for (const pk of POCKETS) {
        const px = pk.x(), py = pk.y();
        const dx = x - px, dy = y - py;
        if (dx * dx + dy * dy < (POCKET_R + BALL_R + 4) * (POCKET_R + BALL_R + 4)) { ok = false; break; }
      }
      if (ok) return { x, y };
    }
    return { x: tl + BALL_R + Math.random() * (tr - tl - BALL_R * 2), y: tt + BALL_R + Math.random() * (tb - tt - BALL_R * 2) };
  }

  for (let i = 0; i < numBalls; i++) {
    const pos = randPos();
    const isCue = i === 0;
    placed.push(pos);
    ballsOut.push({
      x: pos.x, y: pos.y, r: BALL_R,
      vx: 0, vy: 0,
      cue: isCue,
      color: isCue ? '#fff' : BALL_COLORS[(i - 1) % BALL_COLORS.length],
      label: isCue ? '' : String(i),
      active: true,
    });
  }
  return { balls: ballsOut, shots: numBalls };
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

    // walls
    if (b.x - b.r < TABLE.left()) { b.x = TABLE.left() + b.r; b.vx = Math.abs(b.vx) * WALL_BOUNCE; }
    if (b.x + b.r > TABLE.right()) { b.x = TABLE.right() - b.r; b.vx = -Math.abs(b.vx) * WALL_BOUNCE; }
    if (b.y - b.r < TABLE.top()) { b.y = TABLE.top() + b.r; b.vy = Math.abs(b.vy) * WALL_BOUNCE; }
    if (b.y + b.r > TABLE.bottom()) { b.y = TABLE.bottom() - b.r; b.vy = -Math.abs(b.vy) * WALL_BOUNCE; }
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

  // Balls still in pocket radius reduction (leave pocket area)
  for (const b of balls) {
    if (!b.active) continue;
    for (const p of POCKETS) {
      const dx = b.x - p.x(), dy = b.y - p.y();
      if (dx * dx + dy * dy < (POCKET_R + b.r) * (POCKET_R + b.r)) {
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < POCKET_R + b.r && dist > 0.01) {
          const push = (POCKET_R + b.r - dist) * 0.3;
          b.x += (dx / dist) * push;
          b.y += (dy / dist) * push;
        }
      }
    }
  }

  if (settling && allStill) {
    settling = false;
    endTurn();
  }
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
  roundRect(ctx, TABLE.left() + 4, TABLE.top() + 4, TABLE.right() - TABLE.left(), TABLE.bottom() - TABLE.top(), 8);
  ctx.fill();

  // Table border (rail)
  ctx.fillStyle = '#5C3A1E';
  roundRect(ctx, TABLE.left(), TABLE.top(), TABLE.right() - TABLE.left(), TABLE.bottom() - TABLE.top(), 6);
  ctx.fill();

  // Inner rail
  const inner = 6;
  ctx.fillStyle = '#3D6B34';
  roundRect(ctx, TABLE.left() + inner, TABLE.top() + inner, TABLE.right() - TABLE.left() - inner * 2, TABLE.bottom() - TABLE.top() - inner * 2, 4);
  ctx.fill();

  // Felt
  ctx.fillStyle = '#2D8A4E';
  roundRect(ctx, TABLE.left() + inner + 4, TABLE.top() + inner + 4, TABLE.right() - TABLE.left() - inner * 2 - 8, TABLE.bottom() - TABLE.top() - inner * 2 - 8, 3);
  ctx.fill();

  // Pockets
  for (const p of POCKETS) {
    const px = p.x(), py = p.y();
    ctx.fillStyle = '#111';
    ctx.beginPath();
    ctx.arc(px, py, POCKET_R, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#333';
    ctx.beginPath();
    ctx.arc(px, py, POCKET_R - 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffd700';
    ctx.font = 'bold 8px sans-serif';
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

      // Cue stick
      const stickLen = 60 + pull * 0.5;
      ctx.strokeStyle = '#8B4513';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(cueBall.x + Math.cos(angle) * (BALL_R + 4), cueBall.y + Math.sin(angle) * (BALL_R + 4));
      ctx.lineTo(cueBall.x + Math.cos(angle) * stickLen, cueBall.y + Math.sin(angle) * stickLen);
      ctx.stroke();

      // Trajectory dots
      let px = cueBall.x, py = cueBall.y;
      let pvx = Math.cos(angle) * power;
      let pvy = Math.sin(angle) * power;
      for (let i = 0; i < 30; i++) {
        px += pvx; py += pvy;
        pvx *= FRICTION; pvy *= FRICTION;
        if (px < TABLE.left() || px > TABLE.right() || py < TABLE.top() || py > TABLE.bottom()) break;
        const alpha = 0.5 + 0.4 * (1 - i / 30);
        ctx.fillStyle = `rgba(255,255,200,${alpha})`;
        ctx.beginPath();
        ctx.arc(px, py, 2, 0, Math.PI * 2);
        ctx.fill();
        // Simple wall bounce for preview
        if (px - BALL_R < TABLE.left()) { pvx = Math.abs(pvx) * WALL_BOUNCE; px = TABLE.left() + BALL_R; }
        if (px + BALL_R > TABLE.right()) { pvx = -Math.abs(pvx) * WALL_BOUNCE; px = TABLE.right() - BALL_R; }
        if (py - BALL_R < TABLE.top()) { pvy = Math.abs(pvy) * WALL_BOUNCE; py = TABLE.top() + BALL_R; }
        if (py + BALL_R > TABLE.bottom()) { pvy = -Math.abs(pvy) * WALL_BOUNCE; py = TABLE.bottom() - BALL_R; }
      }

      // Aim line from cue direction
      ctx.strokeStyle = 'rgba(255,255,255,0.2)';
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 5]);
      ctx.beginPath();
      ctx.moveTo(cueBall.x, cueBall.y);
      ctx.lineTo(cueBall.x + Math.cos(angle) * 200, cueBall.y + Math.sin(angle) * 200);
      ctx.stroke();
      ctx.setLineDash([]);
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
    ctx.fillText('👆 Оттяни от шара и отпусти', cw / 2, ch * 0.96);
  }
}

function drawPowerBar(ratio) {
  const barW = 8, barH = 80;
  const bx = 14, by = ch * 0.5 - barH / 2;
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
