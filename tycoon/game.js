// ─── Setup ───────────────────────────────────────────────
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const moneyEl = document.getElementById('money');
const infoEl = document.getElementById('info');
const popEl = document.getElementById('pop');
const btnBuild = document.getElementById('btn-build');
const shopEl = document.getElementById('shop');

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

// ─── Business Data ───────────────────────────────────────
const BUSINESSES = [
  { id: 'pizza',    name: 'Пиццерия',    emoji: '🍕', cost: 0,   income: 4,  color: '#e74c3c', dur: 3000, pop: 30 },
  { id: 'cafe',     name: 'Кафе',        emoji: '☕', cost: 60,  income: 6,  color: '#d4a574', dur: 3500, pop: 25 },
  { id: 'burger',   name: 'Бургер',      emoji: '🍔', cost: 120, income: 8,  color: '#f39c12', dur: 2500, pop: 20 },
  { id: 'library',  name: 'Библиотека',  emoji: '📚', cost: 80,  income: 5,  color: '#3498db', dur: 5000, pop: 15 },
  { id: 'arcade',   name: 'Аркада',      emoji: '🎮', cost: 200, income: 12, color: '#9b59b6', dur: 4000, pop: 20 },
  { id: 'sushi',    name: 'Суши',        emoji: '🍣', cost: 350, income: 18, color: '#1abc9c', dur: 3000, pop: 15 },
  { id: 'fashion',  name: 'Мода',        emoji: '👗', cost: 500, income: 25, color: '#e84393', dur: 4500, pop: 10 },
  { id: 'jewelry',  name: 'Ювелирка',    emoji: '💎', cost: 800, income: 35, color: '#00cec9', dur: 4000, pop: 5  },
];

const CHAR_TYPES = [
  { id: 'student',     emoji: '🧑‍🎓', wants: ['pizza','cafe','library'],      patience: 15000, tip: 2 },
  { id: 'worker',      emoji: '👨‍💼', wants: ['cafe','burger'],                patience: 10000, tip: 3 },
  { id: 'hipster',     emoji: '🧑‍🎤', wants: ['sushi','arcade','cafe'],       patience: 12000, tip: 4 },
  { id: 'elder',       emoji: '👴',   wants: ['library','cafe','pizza'],      patience: 20000, tip: 1 },
  { id: 'fashionista', emoji: '👱‍♀️', wants: ['fashion','jewelry','cafe'],    patience: 15000, tip: 5 },
  { id: 'kid',         emoji: '🧒',   wants: ['arcade','pizza','burger'],     patience: 8000,  tip: 1 },
];

// ─── Game State ──────────────────────────────────────────
let money = 50;
let floors = [];
let chars = [];
let elevatorY = 0;
let elevatorTarget = 0;
let elevatorOccupants = [];
let elevatorState = 'idle';
let elevatorTimer = 0;
let spawnTimer = 0;
let charId = 0;
let selectedFloor = null;
let totalPop = 0;
let floorH = 55;
const SHAFT = 30;
const FLOOR_MIN = 38;

// ─── Init ────────────────────────────────────────────────
function initFloors() {
  floors = [
    { id: 0, business: null, label: 'Вход' },
    { id: 1, business: 'pizza', label: '2' },
  ];
}
initFloors();

function getFloorY(floorId) {
  return ch - (floorId + 1) * floorH;
}

function getFloorAt(y) {
  for (let i = floors.length - 1; i >= 0; i--) {
    const fy = getFloorY(floors[i].id);
    if (y >= fy && y <= fy + floorH) return floors[i];
  }
  return null;
}

function getBuildCost() {
  return Math.floor(80 + (floors.length - 1) * 60);
}

function recalcFloorH() {
  floorH = Math.min(55, Math.max(FLOOR_MIN, (ch - 20) / (floors.length + 0.5)));
}

// ─── Character Spawn ─────────────────────────────────────
function spawnChar() {
  const activeBiz = floors.filter(f => f.business).map(f => f.business);
  if (activeBiz.length === 0) return;

  const ct = CHAR_TYPES[Math.floor(Math.random() * CHAR_TYPES.length)];
  const wants = ct.wants.filter(w => activeBiz.includes(w));
  if (wants.length === 0) return;

  const wantBiz = wants[Math.floor(Math.random() * wants.length)];
  const targetFloor = floors.find(f => f.business === wantBiz);
  if (!targetFloor) return;

  chars.push({
    id: charId++,
    type: ct,
    biz: wantBiz,
    targetFloor: targetFloor.id,
    state: 'waiting',
    timer: 0,
    patience: ct.patience,
    gaveTip: false,
  });
}

// ─── Elevator ────────────────────────────────────────────
function updateElevator() {
  const waiting = chars.filter(c => c.state === 'waiting');

  if (elevatorState === 'idle') {
    // Rest at ground floor
    const gy = getFloorY(0) + floorH / 2 - 10;
    elevatorY += (gy - elevatorY) * 0.1;

    if (waiting.length > 0) {
      const ch = waiting[0];
      ch.state = 'elevator';
      elevatorOccupants.push(ch);
      elevatorState = 'going';
      elevatorTarget = ch.targetFloor;
      elevatorTimer = Math.abs(ch.targetFloor - 0) * 15 + 30;
    }
  }

  else if (elevatorState === 'going') {
    const ty = getFloorY(elevatorTarget) + floorH / 2 - 10;
    elevatorY += (ty - elevatorY) * 0.08;
    elevatorTimer--;

    if (elevatorTimer <= 0 || Math.abs(elevatorY - ty) < 2) {
      elevatorY = ty;
      // Drop off
      const atFloor = elevatorOccupants.filter(o => o.targetFloor === elevatorTarget);
      for (const occ of atFloor) {
        occ.state = 'visiting';
        occ.timer = BUSINESSES.find(b => b.id === occ.biz).dur;
      }
      elevatorOccupants = elevatorOccupants.filter(o => o.targetFloor !== elevatorTarget);

      if (elevatorOccupants.length > 0) {
        // Go to next occupant's floor
        elevatorTarget = elevatorOccupants[0].targetFloor;
        elevatorTimer = Math.abs(elevatorTarget - floors.find(f => f.id === elevatorTarget).id) * 15 + 30;
      } else {
        elevatorState = 'returning';
        elevatorTimer = 30;
      }
    }
  }

  else if (elevatorState === 'returning') {
    const gy = getFloorY(0) + floorH / 2 - 10;
    elevatorY += (gy - elevatorY) * 0.05;
    elevatorTimer--;
    if (elevatorTimer <= 0 || Math.abs(elevatorY - gy) < 2) {
      elevatorState = 'idle';
    }
  }
}

// ─── Update ──────────────────────────────────────────────
function update() {
  if (floors.length === 0) return;

  recalcFloorH();

  // Passive income
  const bizFloors = floors.filter(f => f.business && f.id > 0);
  for (const f of bizFloors) {
    const biz = BUSINESSES.find(b => b.id === f.business);
    if (biz && Math.random() < 0.005) money += biz.income * 0.1;
  }

  // Spawn
  spawnTimer += 16;
  const spawnRate = Math.max(600, 2000 - bizFloors.length * 60);
  if (spawnTimer > spawnRate && chars.filter(c => c.state === 'waiting' || c.state === 'elevator').length < 6) {
    spawnTimer = 0;
    spawnChar();
  }

  updateElevator();

  // Visiting chars
  for (const ch of chars) {
    if (ch.state === 'visiting') {
      ch.timer -= 16;
      if (ch.timer <= 0) {
        const biz = BUSINESSES.find(b => b.id === ch.biz);
        const earn = (biz ? biz.income : 0) + ch.type.tip;
        money += Math.round(earn);
        ch.state = 'leaving';
        ch.timer = 1500;
      }
    }
    if (ch.state === 'leaving') {
      ch.timer -= 16;
      if (ch.timer <= 0) {
        ch.state = 'gone';
      }
    }
  }

  chars = chars.filter(c => c.state !== 'gone');
  totalPop = chars.length;
}

// ─── Draw ────────────────────────────────────────────────
function draw() {
  ctx.clearRect(0, 0, cw, ch);

  // Background
  ctx.fillStyle = '#0a1628';
  ctx.fillRect(0, 0, cw, ch);

  const shaftX = cw - SHAFT;

  // Floors
  for (let i = 0; i < floors.length; i++) {
    const f = floors[i];
    const y = getFloorY(f.id);
    const isGround = f.id === 0;
    const isSel = selectedFloor && selectedFloor.id === f.id;

    // Floor bg
    ctx.fillStyle = isSel ? '#1a2a4e' : (isGround ? '#151525' : '#16213e');
    ctx.fillRect(0, y, cw, floorH);

    // Divider
    ctx.strokeStyle = '#2a3a5e';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(cw, y);
    ctx.stroke();

    // Label
    ctx.fillStyle = '#667';
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(isGround ? 'Вход' : f.label + 'F', 5, y + floorH / 2);

    // Business
    if (f.business) {
      const biz = BUSINESSES.find(b => b.id === f.business);
      ctx.font = '16px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(biz.emoji, 34, y + floorH / 2);
      ctx.fillStyle = '#bbb';
      ctx.font = '10px sans-serif';
      ctx.fillText(biz.name, 54, y + floorH / 2);

      // Visitor dots on floor
      const visitors = chars.filter(c => c.state === 'visiting' && c.targetFloor === f.id);
      let vx = cw - SHAFT - 20 - visitors.length * 16;
      for (const v of visitors) {
        ctx.font = '12px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(v.type.emoji, vx, y + floorH / 2);
        vx += 16;
      }

      // Income pulse
      if (visitors.length > 0) {
        ctx.fillStyle = '#ffd700';
        ctx.font = '8px sans-serif';
        ctx.fillText('+$' + biz.income, 54, y + floorH / 2 - 8);
      }
    } else if (!isGround) {
      // Empty floor - "+" indicator
      ctx.fillStyle = 'rgba(255,255,255,0.12)';
      ctx.font = '18px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('+', cw / 2 - SHAFT / 2, y + floorH / 2);
      ctx.fillStyle = 'rgba(255,255,255,0.2)';
      ctx.font = '8px sans-serif';
      ctx.fillText('тапни →', cw / 2 - SHAFT / 2, y + floorH / 2 + 12);
    }

    // Elevator shaft area on this floor
    ctx.fillStyle = '#0a0a1a';
    ctx.fillRect(shaftX, y, SHAFT, floorH);
    ctx.strokeStyle = '#1a2a4e';
    ctx.lineWidth = 1;
    ctx.strokeRect(shaftX, y, SHAFT, floorH);
  }

  // Elevator car
  const carY = elevatorY;
  ctx.shadowColor = '#e94560';
  ctx.shadowBlur = 6;
  ctx.fillStyle = '#e94560';
  ctx.fillRect(cw - SHAFT + 3, carY, SHAFT - 6, 18);
  ctx.shadowBlur = 0;

  // Elevator label
  if (elevatorOccupants.length > 0) {
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#fff';
    ctx.fillText(elevatorOccupants.map(o => o.type.emoji).join(''), cw - SHAFT / 2, carY + 9);
  }

  // Waiting chars at ground
  const waiting = chars.filter(c => c.state === 'waiting');
  let wx = 40;
  for (const w of waiting) {
    ctx.font = '14px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(w.type.emoji, wx, getFloorY(0) + floorH / 2);
    wx += 20;
    if (wx > cw - SHAFT - 10) break;
  }
}

// ─── Loop ────────────────────────────────────────────────
function loop() {
  update();
  draw();
  moneyEl.textContent = '💰 ' + Math.floor(money);
  infoEl.textContent = '🏢 ' + (floors.length - 1) + ' эт.';
  popEl.textContent = '👥 ' + totalPop;
  const cost = getBuildCost();
  btnBuild.textContent = '🏗️ Построить $' + cost;
  btnBuild.disabled = money < cost;
  requestAnimationFrame(loop);
}

// ─── Build Floor ─────────────────────────────────────────
btnBuild.addEventListener('click', () => {
  const cost = getBuildCost();
  if (money < cost) return;
  money -= cost;
  const newId = floors.length;
  floors.push({ id: newId, business: null, label: String(newId + 1) });
  recalcFloorH();
  selectedFloor = floors[floors.length - 1];
  updateShop();
});

// ─── Canvas Tap ──────────────────────────────────────────
function onCanvasTap(x, y) {
  const f = getFloorAt(y);
  if (!f) { selectedFloor = null; updateShop(); return; }
  if (f.id > 0 && !f.business) {
    selectedFloor = f;
    updateShop();
  } else {
    selectedFloor = null;
    updateShop();
  }
}

canvas.addEventListener('touchstart', (e) => {
  e.preventDefault();
  const t = e.touches[0];
  const r = canvas.getBoundingClientRect();
  onCanvasTap(t.clientX - r.left, t.clientY - r.top);
});

canvas.addEventListener('mousedown', (e) => {
  const r = canvas.getBoundingClientRect();
  onCanvasTap(e.clientX - r.left, e.clientY - r.top);
});

// ─── Shop ────────────────────────────────────────────────
function updateShop() {
  shopEl.innerHTML = '';
  const target = selectedFloor;

  if (!target || target.business || target.id === 0) {
    for (const biz of BUSINESSES) {
      const btn = document.createElement('button');
      btn.className = 'shop-btn';
      btn.textContent = biz.emoji + ' ' + biz.name;
      btn.title = '$' + biz.cost + ' | +$' + biz.income + '/посещ';
      shopEl.appendChild(btn);
    }
    return;
  }

  // Show only affordable + newer businesses
  const maxCost = Math.min(800, money + 50);
  for (const biz of BUSINESSES) {
    if (biz.cost > maxCost) continue;
    const btn = document.createElement('button');
    btn.className = 'shop-btn';
    btn.textContent = biz.emoji + ' $' + biz.cost;
    btn.disabled = biz.cost > money;
    btn.addEventListener('click', () => {
      if (money < biz.cost || target.business) return;
      money -= biz.cost;
      target.business = biz.id;
      selectedFloor = null;
      updateShop();
    });
    shopEl.appendChild(btn);
  }
}
updateShop();

loop();
