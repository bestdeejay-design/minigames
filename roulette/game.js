// ─── Constants ──────────────────────────────────────────
const REDS = new Set([1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36]);
const WHEEL_ORDER = [0,32,15,19,4,21,2,25,17,34,6,27,13,36,11,30,8,23,10,5,24,16,33,1,20,14,31,9,22,18,29,7,28,12,35,3,26];
const SECTOR_COUNT = 37;
const SECTOR_ANGLE = Math.PI * 2 / SECTOR_COUNT;

const PAYOUTS = {
  straight: 35, red: 1, black: 1, odd: 1, even: 1,
  '1-18': 1, '19-36': 1,
};

// ─── DOM ─────────────────────────────────────────────────
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const balanceEl = document.getElementById('balance');
const betTotalEl = document.getElementById('bet-total');
const resultLabel = document.getElementById('result-label');
const overlay = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlay-title');
const overlaySub = document.getElementById('overlay-sub');
const btnNext = document.getElementById('btn-next');
const btnSpin = document.getElementById('btn-spin');
const chipBtns = document.querySelectorAll('.chip-btn');
const outsideBtns = document.querySelectorAll('#outside-bets button');

let cw, ch;
let dpr = window.devicePixelRatio || 1;

// ─── State ───────────────────────────────────────────────
let balance = 1000;
let chipValue = 10;
let bets = {};      // { "n7": amount, "red": amount, ... }
let totalBet = 0;
let wheelAngle = 0;
let spinning = false;
let spinProgress = 0;
let spinDuration = 3500;
let spinStartAngle = 0;
let spinTargetAngle = 0;
let spinStartTime = 0;
let result = null;
let animId = null;

function numColor(n) {
  if (n === 0) return '#27ae60';
  return REDS.has(n) ? '#c0392b' : '#1e1e3a';
}

function numBetKey(n) { return 'n' + n; }

function buildBetGrid() {
  const grid = document.getElementById('num-grid');
  for (let row = 0; row < 6; row++) {
    for (let col = 0; col < 6; col++) {
      const n = row * 6 + col + 1;
      const btn = document.createElement('button');
      btn.dataset.bet = numBetKey(n);
      btn.dataset.num = n;
      btn.className = REDS.has(n) ? 'b-red' : 'b-black';
      const span = document.createElement('span');
      span.textContent = n;
      btn.appendChild(span);
      btn.addEventListener('click', () => placeBet(numBetKey(n)));
      grid.appendChild(btn);
    }
  }
  const zb = document.createElement('button');
  zb.dataset.bet = 'n0';
  zb.dataset.num = 0;
  zb.className = 'b-green';
  const zs = document.createElement('span');
  zs.textContent = '0';
  zb.appendChild(zs);
  zb.addEventListener('click', () => placeBet('n0'));
  grid.appendChild(zb);
}

function placeBet(key) {
  if (spinning) return;
  if (balance < chipValue) return;
  balance -= chipValue;
  bets[key] = (bets[key] || 0) + chipValue;
  totalBet += chipValue;
  updateHUD();
  updateGrid();
}

function clearBets() {
  for (const key in bets) {
    balance += bets[key];
  }
  bets = {};
  totalBet = 0;
  updateHUD();
  updateGrid();
}

function updateHUD() {
  balanceEl.textContent = Math.round(balance);
  betTotalEl.textContent = Math.round(totalBet);
  btnSpin.disabled = totalBet === 0 || spinning;
}

function updateGrid() {
  document.querySelectorAll('#num-grid button').forEach(btn => {
    const key = btn.dataset.bet;
    const amt = bets[key];
    let chipEl = btn.querySelector('.chip-count');
    if (amt > 0) {
      if (!chipEl) { chipEl = document.createElement('span'); chipEl.className = 'chip-count'; btn.appendChild(chipEl); }
      chipEl.textContent = amt;
    } else if (chipEl) {
      chipEl.remove();
    }
  });
  outsideBtns.forEach(btn => {
    const key = btn.dataset.bet;
    const amt = bets[key];
    let chipEl = btn.querySelector('.chip-count');
    if (amt > 0) {
      if (!chipEl) { chipEl = document.createElement('span'); chipEl.className = 'chip-count'; btn.appendChild(chipEl); }
      chipEl.textContent = amt;
    } else if (chipEl) {
      chipEl.remove();
    }
  });
}

// ─── Wheel Drawing ──────────────────────────────────────

function drawWheel() {
  const cx = cw / 2, cy = ch / 2;
  const outerR = Math.min(cw, ch) * 0.46;

    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.beginPath();
    ctx.arc(cx + 2, cy + 2, outerR + 6, 0, Math.PI * 2);
    ctx.fill();

    // Outer ring (white diamonds on real wheel)
    ctx.beginPath();
    ctx.arc(cx, cy, outerR + 4, 0, Math.PI * 2);
    ctx.fillStyle = '#333';
    ctx.fill();
    // Diamonds (8 шт) — вращаются вместе с колесом
    const diamondR = outerR + 2;
    for (let i = 0; i < 8; i++) {
      const da = i * Math.PI / 4 + wheelAngle;
      const dx = cx + Math.cos(da) * diamondR;
      const dy = cy + Math.sin(da) * diamondR;
      ctx.fillStyle = '#ffd700';
      ctx.beginPath();
      ctx.moveTo(dx, dy - 3);
      ctx.lineTo(dx + 2, dy);
      ctx.lineTo(dx, dy + 3);
      ctx.lineTo(dx - 2, dy);
      ctx.closePath();
      ctx.fill();
    }
    // Outer track rim
    ctx.beginPath();
    ctx.arc(cx, cy, outerR + 1, 0, Math.PI * 2);
    ctx.strokeStyle = '#666';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Sectors
  for (let i = 0; i < SECTOR_COUNT; i++) {
    const a0 = i * SECTOR_ANGLE + wheelAngle;
    const a1 = a0 + SECTOR_ANGLE;
    const n = WHEEL_ORDER[i];
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, outerR, a0, a1);
    ctx.closePath();
    ctx.fillStyle = numColor(n);
    ctx.fill();
    ctx.strokeStyle = '#222';
    ctx.lineWidth = 0.5;
    ctx.stroke();
  }

  // Inner rim
  const innerR = outerR * 0.64;
  ctx.beginPath();
  ctx.arc(cx, cy, innerR, 0, Math.PI * 2);
  ctx.fillStyle = '#1a1a2e';
  ctx.fill();
  ctx.strokeStyle = '#444';
  ctx.lineWidth = 2;
  ctx.stroke();
  // Rotating accent dots on inner rim
  for (let i = 0; i < 12; i++) {
    const da = i * Math.PI / 6 + wheelAngle;
    const dx = cx + Math.cos(da) * (innerR - 2);
    const dy = cy + Math.sin(da) * (innerR - 2);
    ctx.fillStyle = i % 2 === 0 ? 'rgba(255,255,255,0.2)' : 'rgba(255,215,0,0.15)';
    ctx.beginPath();
    ctx.arc(dx, dy, 2, 0, Math.PI * 2);
    ctx.fill();
  }

  // Center hub
  const hubR = innerR * 0.55;
  ctx.beginPath();
  ctx.arc(cx, cy, hubR, 0, Math.PI * 2);
  ctx.fillStyle = '#222';
  ctx.fill();
  ctx.strokeStyle = '#555';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  const grad = ctx.createRadialGradient(cx - hubR * 0.2, cy - hubR * 0.2, 0, cx, cy, hubR);
  grad.addColorStop(0, '#3a3a5a');
  grad.addColorStop(1, '#1a1a2e');
  ctx.beginPath();
  ctx.arc(cx, cy, hubR * 0.7, 0, Math.PI * 2);
  ctx.fillStyle = grad;
  ctx.fill();

  // Numbers
  ctx.save();
  for (let i = 0; i < SECTOR_COUNT; i++) {
    const mid = (i + 0.5) * SECTOR_ANGLE + wheelAngle;
    const n = WHEEL_ORDER[i];
    const r = (outerR + innerR) / 2;
    const x = cx + Math.cos(mid) * r;
    const y = cy + Math.sin(mid) * r;
    ctx.translate(x, y);
    ctx.rotate(mid + Math.PI / 2);
    ctx.fillStyle = '#fff';
    ctx.font = `bold ${Math.max(7, Math.round(outerR * 0.09))}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(n, 0, 0);
    ctx.rotate(-mid - Math.PI / 2);
    ctx.translate(-x, -y);
  }
  ctx.restore();

  // Top marker (pointer)
  ctx.fillStyle = '#e94560';
  ctx.beginPath();
  ctx.moveTo(cx - 7, ch * 0.04);
  ctx.lineTo(cx + 7, ch * 0.04);
  ctx.lineTo(cx, ch * 0.04 + 14);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#ff6b81';
  ctx.lineWidth = 1;
  ctx.stroke();
}

function drawBall(progress) {
  const cx = cw / 2, cy = ch / 2;
  const outerR = Math.min(cw, ch) * 0.46;

  if (spinning && progress < 1) {
    // Ball orbits at outer track, gradually moves inward
    const ballAngle = wheelAngle + Math.sin(progress * 12) * (1 - progress) * 4 + progress * 6;
    const br = outerR * (0.88 - progress * 0.22);
    const bx = cx + Math.cos(ballAngle) * br;
    const by = cy + Math.sin(ballAngle) * br;
    const size = outerR * 0.055;
    // Trail
    for (let t = 1; t <= 3; t++) {
      const ta = ballAngle - t * 0.15;
      const tx = cx + Math.cos(ta) * br;
      const ty = cy + Math.sin(ta) * br;
      ctx.beginPath();
      ctx.arc(tx, ty, size * (1 - t * 0.2), 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255,255,255,${0.2 - t * 0.05})`;
      ctx.fill();
    }
    ctx.beginPath();
    ctx.arc(bx, by, size, 0, Math.PI * 2);
    ctx.fillStyle = '#fff';
    ctx.fill();
    ctx.strokeStyle = '#ffd700';
    ctx.lineWidth = 1;
    ctx.stroke();
  } else if (result !== null) {
    // Ball on result sector
    const idx = WHEEL_ORDER.indexOf(result);
    const mid = (idx + 0.5) * SECTOR_ANGLE + wheelAngle;
    const br = outerR * 0.57;
    const bx = cx + Math.cos(mid) * br;
    const by = cy + Math.sin(mid) * br;
    const size = outerR * 0.05;
    ctx.beginPath();
    ctx.arc(bx, by, size, 0, Math.PI * 2);
    ctx.fillStyle = '#fff';
    ctx.fill();
    ctx.strokeStyle = '#ffd700';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    // Glow
    ctx.beginPath();
    ctx.arc(bx, by, size + 3, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255,215,0,0.3)';
    ctx.lineWidth = 2;
    ctx.stroke();
  }
}

function draw() {
  ctx.clearRect(0, 0, cw, ch);
  ctx.fillStyle = '#0a0a1a';
  ctx.fillRect(0, 0, cw, ch);

  drawWheel();
  drawBall(spinProgress);
}

// ─── Spin Animation ─────────────────────────────────────

function startSpin() {
  if (totalBet === 0) return;

  const resultNum = Math.floor(Math.random() * 37);
  result = resultNum;

  const idx = WHEEL_ORDER.indexOf(resultNum);
  const sectorMid = (idx + 0.5) * SECTOR_ANGLE;
  const finalAngle = -Math.PI / 2 - sectorMid;

  const fullTurns = 5 + Math.floor(Math.random() * 4);
  spinStartAngle = wheelAngle;
  spinTargetAngle = finalAngle + fullTurns * Math.PI * 2;
  while (spinTargetAngle <= spinStartAngle) spinTargetAngle += Math.PI * 2;

  spinStartTime = performance.now();
  spinProgress = 0;
  spinning = true;
  btnSpin.disabled = true;
  resultLabel.textContent = '';
  updateHUD();
  animateSpin();
}

function animateSpin() {
  const elapsed = performance.now() - spinStartTime;
  const raw = elapsed / spinDuration;
  spinProgress = Math.min(raw, 1);
  const eased = 1 - Math.pow(1 - spinProgress, 3);

  wheelAngle = spinStartAngle + (spinTargetAngle - spinStartAngle) * eased;
  draw();

  if (spinProgress < 1) {
    animId = requestAnimationFrame(animateSpin);
  } else {
    wheelAngle = spinTargetAngle;
    spinning = false;
    draw();
    payOut();
  }
}

// ─── Payout ──────────────────────────────────────────────

function payOut() {
  let win = 0;
  const n = result;
  const isRed = REDS.has(n);
  const isEven = n !== 0 && n % 2 === 0;
  const isOdd = n !== 0 && n % 2 === 1;

  for (const key in bets) {
    const amt = bets[key];
    if (key === 'n' + n) win += amt + amt * PAYOUTS.straight;
    else if (key === 'red' && isRed) win += amt + amt * PAYOUTS.red;
    else if (key === 'black' && !isRed && n !== 0) win += amt + amt * PAYOUTS.black;
    else if (key === 'odd' && isOdd) win += amt + amt * PAYOUTS.odd;
    else if (key === 'even' && isEven) win += amt + amt * PAYOUTS.even;
    else if (key === '1-18' && n >= 1 && n <= 18) win += amt + amt * PAYOUTS['1-18'];
    else if (key === '19-36' && n >= 19 && n <= 36) win += amt + amt * PAYOUTS['19-36'];
  }

  bets = {};
  totalBet = 0;
  balance += win;
  updateHUD();
  updateGrid();

  const color = n === 0 ? 'зелёное' : isRed ? 'красное' : 'чёрное';
  resultLabel.textContent = `${n} (${color})`;

  if (win > 0) {
    overlayTitle.textContent = `🎉 Выигрыш: +${Math.round(win)}`;
    overlaySub.textContent = `Число ${n} (${color})`;
  } else {
    overlayTitle.textContent = '😔 Проигрыш';
    overlaySub.textContent = `Выпало ${n} (${color})`;
  }
  overlay.classList.remove('hidden');
  btnNext.textContent = 'Ещё!';
  btnNext.onclick = () => {
    overlay.classList.add('hidden');
    resultLabel.textContent = '';
    result = null;
    draw();
    if (balance < 10) {
      balance = 1000;
      updateHUD();
    }
  };
}

// ─── Resize ──────────────────────────────────────────────

function resize() {
  cw = window.innerWidth;
  ch = Math.min(cw, window.innerHeight * 0.46);
  canvas.width = cw * dpr;
  canvas.height = ch * dpr;
  canvas.style.width = cw + 'px';
  canvas.style.height = ch + 'px';
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  draw();
}

window.addEventListener('resize', resize);

// ─── Init ────────────────────────────────────────────────

buildBetGrid();

chipBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    chipBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    chipValue = parseInt(btn.dataset.val);
  });
});

outsideBtns.forEach(btn => {
  btn.addEventListener('click', () => placeBet(btn.dataset.bet));
});

btnSpin.addEventListener('click', startSpin);

// Long-press on canvas to clear
let clearTimer = null;
document.addEventListener('touchstart', (e) => {
  if (e.target.closest('button') || e.target.closest('#chip-row')) return;
  clearTimer = setTimeout(clearBets, 800);
});
document.addEventListener('touchend', () => {
  if (clearTimer) { clearTimeout(clearTimer); clearTimer = null; }
});
document.addEventListener('touchmove', () => {
  if (clearTimer) { clearTimeout(clearTimer); clearTimer = null; }
});

resize();
updateHUD();
