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
let money = 150;
let floors = [];
let chars = [];
let elevators = [];
let spawnTimer = 0;
let charId = 0;
let selectedFloor = null;
let totalPop = 0;
let floorH = 55;
const FLOOR_MIN = 34;

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
  return Math.floor(80 + (floors.length - 2) * 50);
}

function recalcFloorH() {
  floorH = Math.min(55, Math.max(FLOOR_MIN, (ch - 20) / (floors.length + 0.5)));
}

function getElevatorCount() {
  const n = floors.length - 1;
  if (n <= 4) return 1;
  if (n <= 8) return 2;
  return 3;
}

// ─── Elevator System ─────────────────────────────────────
function rebuildElevators() {
  const target = getElevatorCount();
  while (elevators.length < target) {
    const idx = elevators.length;
    elevators.push({
      id: idx,
      y: getFloorY(0) + floorH / 2 - 9,
      targetFloor: 0,
      occupants: [],
      state: 'idle',
      timer: 30 + idx * 10,
      capacity: 4,
    });
  }
  while (elevators.length > target) {
    const e = elevators.pop();
    // Release any occupants back to waiting
    for (const occ of e.occupants) {
      occ.state = 'waiting';
    }
  }
}

function updateElevators() {
  rebuildElevators();

  for (const ev of elevators) {
    if (ev.state === 'idle') {
      // Rest at ground
      const gy = getFloorY(0) + floorH / 2 - 9;
      ev.y += (gy - ev.y) * 0.1;

      // Look for waiting people
      const waiting = chars.filter(c => c.state === 'waiting');
      if (waiting.length > 0) {
        const take = Math.min(ev.capacity, waiting.length);
        for (let i = 0; i < take; i++) {
          const ch = waiting[i];
          ch.state = 'elevator';
          ev.occupants.push(ch);
        }
        ev.state = 'going';
        ev.targetFloor = ev.occupants[0].targetFloor;
        ev.timer = Math.abs(ev.targetFloor - 0) * 12 + 20;
      }
    }

    else if (ev.state === 'going') {
      const ty = getFloorY(ev.targetFloor) + floorH / 2 - 9;
      ev.y += (ty - ev.y) * 0.08;
      ev.timer--;

      const dist = Math.abs(ev.y - ty);
      if (ev.timer <= 0 || dist < 2) {
        ev.y = ty;
        // Drop off those whose floor is here
        const arriving = ev.occupants.filter(o => o.targetFloor === ev.targetFloor);
        for (const occ of arriving) {
          occ.state = 'visiting';
          occ.timer = BUSINESSES.find(b => b.id === occ.biz).dur;
        }
        ev.occupants = ev.occupants.filter(o => o.targetFloor !== ev.targetFloor);

        if (ev.occupants.length > 0) {
          // Next floor
          ev.targetFloor = ev.occupants[0].targetFloor;
          ev.timer = Math.abs(ev.targetFloor - floors.find(f => f.id === ev.targetFloor).id) * 12 + 20;
        } else {
          ev.state = 'returning';
          ev.timer = 30;
        }
      }
    }

    else if (ev.state === 'returning') {
      const gy = getFloorY(0) + floorH / 2 - 9;
      ev.y += (gy - ev.y) * 0.05;
      ev.timer--;
      if (ev.timer <= 0 || Math.abs(ev.y - gy) < 2) {
        ev.y = gy;
        ev.state = 'idle';
        ev.timer = 20;
      }
    }
  }
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
    gaveTip: false,
  });
}

// ─── Update ──────────────────────────────────────────────
function update() {
  if (floors.length === 0) return;
  recalcFloorH();

  // Passive income
  const bizFloors = floors.filter(f => f.business && f.id > 0);
  for (const f of bizFloors) {
    const biz = BUSINESSES.find(b => b.id === f.business);
    if (biz && Math.random() < 0.008) money += biz.income * 0.1;
  }

  // Spawn
  spawnTimer += 16;
  const spawnRate = Math.max(400, 1200 - bizFloors.length * 40);
  if (spawnTimer > spawnRate && chars.filter(c => c.state === 'waiting' || c.state === 'elevator').length < 8) {
    spawnTimer = 0;
    spawnChar();
  }

  updateElevators();

  // Visiting chars
  for (const ch of chars) {
    if (ch.state === 'visiting') {
      ch.timer -= 16;
      if (ch.timer <= 0) {
        const biz = BUSINESSES.find(b => b.id === ch.biz);
        const earn = (biz ? biz.income : 0) + (ch.gaveTip ? 0 : ch.type.tip);
        money += Math.round(earn);
        ch.gaveTip = true;
        ch.state = 'leaving';
        ch.timer = 1200;
      }
    }
    if (ch.state === 'leaving') {
      ch.timer -= 16;
      if (ch.timer <= 0) ch.state = 'gone';
    }
  }

  chars = chars.filter(c => c.state !== 'gone');
  totalPop = chars.length;
}

// ─── Draw ────────────────────────────────────────────────
function draw() {
  ctx.clearRect(0, 0, cw, ch);
  ctx.fillStyle = '#0a1628';
  ctx.fillRect(0, 0, cw, ch);

  const numElev = getElevatorCount();
  const SHAFT = 24 * numElev + 6;
  const shaftX = cw - SHAFT;

  // Floors
  for (let i = 0; i < floors.length; i++) {
    const f = floors[i];
    const y = getFloorY(f.id);
    const isGround = f.id === 0;
    const isSel = selectedFloor && selectedFloor.id === f.id;

    ctx.fillStyle = isSel ? '#1a2a4e' : (isGround ? '#151525' : '#16213e');
    ctx.fillRect(0, y, cw, floorH);

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

      const visitors = chars.filter(c => c.state === 'visiting' && c.targetFloor === f.id);
      let vx = shaftX - 20 - visitors.length * 16;
      for (const v of visitors) {
        ctx.font = '12px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(v.type.emoji, vx, y + floorH / 2);
        vx += 16;
      }
      if (visitors.length > 0) {
        ctx.fillStyle = '#ffd700';
        ctx.font = '8px sans-serif';
        ctx.fillText('+$' + biz.income, 54, y + floorH / 2 - 8);
      }
    } else if (!isGround) {
      ctx.fillStyle = 'rgba(255,255,255,0.12)';
      ctx.font = '18px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('+', cw / 2 - SHAFT / 2, y + floorH / 2);
      ctx.fillStyle = 'rgba(255,255,255,0.2)';
      ctx.font = '8px sans-serif';
      ctx.fillText('тапни →', cw / 2 - SHAFT / 2, y + floorH / 2 + 12);
    }

    // Elevator shaft bg
    ctx.fillStyle = '#0a0a1a';
    ctx.fillRect(shaftX, y, SHAFT, floorH);
    ctx.strokeStyle = '#1a2a4e';
    ctx.lineWidth = 1;
    ctx.strokeRect(shaftX, y, SHAFT, floorH);
  }

  // Elevator cars
  for (const ev of elevators) {
    const carX = shaftX + 3 + ev.id * 24;
    const carY = ev.y;
    ctx.shadowColor = '#e94560';
    ctx.shadowBlur = 5;
    ctx.fillStyle = ev.occupants.length > 0 ? '#e94560' : '#c0392b';
    ctx.fillRect(carX, carY, 20, 16);
    ctx.shadowBlur = 0;

    if (ev.occupants.length > 0) {
      ctx.font = '8px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#fff';
      ctx.fillText(ev.occupants.map(o => o.type.emoji).join(''), carX + 10, carY + 8);
    }
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
    if (wx > shaftX - 10) break;
  }
}

// ─── Loop ────────────────────────────────────────────────
function loop() {
  update();
  draw();
  moneyEl.textContent = '💰 ' + Math.floor(money);
  infoEl.textContent = '🏢 ' + (floors.length - 1) + ' эт. 🛗' + getElevatorCount();
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
    if (!target) {
      const p = document.createElement('span');
      p.style.cssText = 'color:#667;font-size:0.85rem;padding:8px;';
      p.textContent = '👆 Тапни на пустой этаж, чтобы открыть бизнес';
      shopEl.appendChild(p);
    }
    return;
  }

  const maxCost = Math.min(800, money + 100);
  for (const biz of BUSINESSES) {
    if (biz.cost > maxCost) continue;
    if (biz.cost === 0 && target.id > 1) continue;
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
