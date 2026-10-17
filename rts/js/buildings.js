// ============================================================
// buildings.js — здания: размещение, строительство рабочими,
// очереди производства, население (supply), оборона (турели),
// гарнизоны (бункеры), отрисовка.
// ============================================================
import { TILE, BUILDINGS, UNITS, SUPPLY_MAX, BULLET_SPEED, COLORS } from './config.js';
import { nearestFreeTileAround } from './pathfinding.js';
import { orderBuild, orderMove, spawnUnit, addEffect, shoot, acquireTarget, releaseGarrison } from './units.js';
import { distToRectPx } from './pathfinding.js';

let nextBId = 1;

export class Building {
  constructor(st, side, type, tx, ty, done = false) {
    this.id = nextBId++;
    this.kind = 'building';
    this.side = side;
    this.type = type;
    this.cfg = BUILDINGS[type];
    this.tx = tx; this.ty = ty;
    this.w = this.cfg.w; this.h = this.cfg.h;
    this.x = (tx + this.w / 2) * TILE;   // центр — для прицеливания и камеры
    this.y = (ty + this.h / 2) * TILE;
    this.done = done;
    this.faction = (st.factions && st.factions[side]) || 'human'; // облик и подписи
    this.progress = done ? 1 : 0;
    this.hp = done ? this.cfg.hp : Math.max(1, this.cfg.hp * 0.15);
    this.maxHp = this.cfg.hp;
    this.queue = [];                     // [{type, t, total, hold}]
    this.rally = null;                   // точка сбора (ПКМ по земле)
    this.garrison = [];                  // пехота внутри (бункер)
    this.cd = 0;                         // перезарядка (турель)
    this.scanT = 0;                      // таймер автопоиска цели
    this.target = null;                  // текущая цель турели
    this.angle = side === 'player' ? -Math.PI / 4 : (Math.PI * 3) / 4;
    this.spotted = side === 'player';    // видел ли игрок это вражеское здание
    this.flashT = 0;
    this.selected = false;
    this.dead = false;
    st.buildings.push(this);
  }
}

// Свободно ли место под здание: границы, рельеф, кристаллы, другие здания.
export function canPlace(map, tx, ty, w, h) {
  for (let y = ty; y < ty + h; y++)
    for (let x = tx; x < tx + w; x++) {
      if (!map.inBounds(x, y)) return false;
      const i = map.idx(x, y);
      if (map.terrain[i] !== 0 || map.mineralGrid[i] || map.buildingGrid[i]) return false;
    }
  return true;
}

// Общая команда постройки (для игрока и ИИ): списывает минералы,
// создаёт недострой, выселяет юнитов с площадки, раздаёт приказ рабочим.
export function placeBuildingCmd(st, side, type, tx, ty, builders) {
  const cfg = BUILDINGS[type];
  if (!canPlace(st.map, tx, ty, cfg.w, cfg.h)) return null;
  if (st.minerals[side] < cfg.cost) return null;
  st.minerals[side] -= cfg.cost;
  const b = new Building(st, side, type, tx, ty, false);
  st.map.markBuilding(b);
  st.bcount[side]++;

  // Выселение юнитов, оказавшихся на площадке.
  const spot = nearestFreeTileAround(st.map, tx, ty, cfg.w, cfg.h);
  if (spot) {
    for (const u of st.units) {
      if (u.dead || u.garrison) continue;
      if (u.x > tx * TILE - u.r && u.x < (tx + cfg.w) * TILE + u.r &&
          u.y > ty * TILE - u.r && u.y < (ty + cfg.h) * TILE + u.r) {
        orderMove(st, u, (spot.x + 0.5) * TILE, (spot.y + 0.5) * TILE);
      }
    }
  }
  // Рабочие получают приказ строить.
  if (builders) for (const w of builders) if (!w.dead && !w.garrison) orderBuild(st, w, b);
  return b;
}

// Поставить юнит в очередь производства. Коды: ok | money | queue | wrong.
export function enqueueUnit(st, b, type) {
  if (!b || b.dead || !b.done) return 'wrong';
  const list = Array.isArray(b.cfg.produces) ? b.cfg.produces : [b.cfg.produces];
  if (!list.includes(type)) return 'wrong';
  if (b.queue.length >= 5) return 'queue';
  const cost = UNITS[type].cost;
  if (st.minerals[b.side] < cost) return 'money';
  st.minerals[b.side] -= cost;
  b.queue.push({ type, t: UNITS[type].trainTime, total: UNITS[type].trainTime });
  return 'ok';
}

export function cancelQueueItem(st, b, i) {
  const item = b.queue[i];
  if (!item) return;
  st.minerals[b.side] += UNITS[item.type].cost;
  b.queue.splice(i, 1);
}

// Тик зданий: производство, автострельба турелей, огонь гарнизона
// бункера. Прогресс стройки ведут рабочие (updateBuild в units.js).
export function updateBuildings(st, dt, grid) {
  for (const b of st.buildings) {
    if (b.dead) continue;
    b.flashT = Math.max(0, b.flashT - dt);
    if (!b.done) continue;

    // --- Производство ---
    if (b.queue.length) {
      const q = b.queue[0];
      // Юнит «готов», но ждёт свободного населения.
      if (q.hold) {
        if (st.supply[b.side].used + UNITS[q.type].supply > st.supply[b.side].cap) {
          if (b.side === 'player' && st.time - st.lastSupplyToast > 6) {
            st.lastSupplyToast = st.time;
            st.game.ui.toast('Нужен дом — постройте ещё Дом', 'error');
          }
          continue;
        }
        q.hold = false;
      }
      q.t -= dt;
      if (q.t <= 0) {
        b.queue.shift();
        spawnTrainedUnit(st, b, q.type);
      }
    }

    // --- Турель: сама ищет и обстреливает врагов ---
    if (b.cfg.attack) {
      b.cd = Math.max(0, b.cd - dt);
      b.scanT -= dt;
      // Проверяем актуальность цели: жива и в радиусе.
      if (b.target && (b.target.dead ||
          distToRectPx(b.target.x, b.target.y, b.tx * TILE, b.ty * TILE, b.w * TILE, b.h * TILE) > b.cfg.range + TILE)) {
        b.target = null;
      }
      if (!b.target && b.scanT <= 0) {
        b.scanT = 0.3;
        b.target = acquireTarget(st, b, grid);
      }
      if (b.target) {
        b.angle = Math.atan2(b.target.y - b.y, b.target.x - b.x);
        if (b.cd <= 0) {
          b.cd = b.cfg.cooldown;
          shoot(st, b, b.target);
        }
      }
    }

    // --- Бункер: пехота внутри стреляет сама ---
    if (b.type === 'bunker' && b.garrison.length) {
      const t = acquireTarget(st, b, grid);
      if (t) {
        b.angle = Math.atan2(t.y - b.y, t.x - b.x);
        for (const m of b.garrison) {
          m.cd = Math.max(0, m.cd - dt);
          if (m.cd <= 0) {
            m.cd = m.cfg.cooldown;
            st.projectiles.push({
              x: b.x, y: b.y, tx: t.x, ty: t.y,
              target: t, speed: BULLET_SPEED, dmg: m.cfg.dmg, src: b, dead: false,
            });
            addEffect(st, { kind: 'muzzle', x: b.x + Math.cos(b.angle) * 16, y: b.y + Math.sin(b.angle) * 16, ang: b.angle, t: 0, life: 0.06 });
            st.game.sound.shot();
          }
        }
      }
    }
  }
}

function spawnTrainedUnit(st, b, type) {
  const spot = nearestFreeTileAround(st.map, b.tx, b.ty, b.w, b.h);
  const x = spot ? (spot.x + 0.5) * TILE : b.x;
  const y = spot ? (spot.y + 0.5) * TILE : b.y;
  const u = spawnUnit(st, b.side, type, x, y, true);
  if (b.rally) orderMove(st, u, b.rally.x, b.rally.y);
  addEffect(st, { kind: 'spark', x, y, ang: -Math.PI / 2, t: 0, life: 0.25 });
  if (b.side === 'player') st.game.sound.ready();
}

// Здание под точкой мира (для кликов).
export function buildingAt(st, wx, wy) {
  for (let i = st.buildings.length - 1; i >= 0; i--) {
    const b = st.buildings[i];
    if (b.dead) continue;
    if (wx >= b.tx * TILE && wx < (b.tx + b.w) * TILE &&
        wy >= b.ty * TILE && wy < (b.ty + b.h) * TILE) return b;
  }
  return null;
}

// ------------------------------------------------------------
// Отрисовка здания. camX/camY — смещение камеры (мир → экран).
// ghost=true — «запомненное» вражеское здание вне зоны видимости.
// ------------------------------------------------------------
export function drawBuilding(ctx, b, ghost = false, camX = 0, camY = 0) {
  const px = b.tx * TILE - camX, py = b.ty * TILE - camY;
  const w = b.w * TILE, h = b.h * TILE;
  const isP = b.side === 'player';
  const col = isP ? COLORS.player : COLORS.enemy;
  const dark = isP ? COLORS.playerDark : COLORS.enemyDark;

  ctx.save();
  if (ghost) ctx.globalAlpha = 0.4;
  else if (!b.done) ctx.globalAlpha = 0.45 + 0.3 * b.progress;

  // Тень и корпус.
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.fillRect(px + 4, py + 6, w, h);
  ctx.fillStyle = '#787e87';
  ctx.fillRect(px, py, w, h);
  ctx.fillStyle = dark;
  ctx.fillRect(px, py, w, 6);

  if (b.faction === 'alien') {
    // ===== Постройки кхарид: органика улья =====
    if (b.type === 'cc') {
      // Гнездо-улей: курган с жерлами и светящимся кольцом.
      ctx.fillStyle = '#4c3f60';
      ctx.beginPath(); ctx.ellipse(px + w / 2, py + h / 2 + 4, w * 0.42, h * 0.38, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = dark;
      ctx.beginPath(); ctx.ellipse(px + w / 2, py + h / 2, w * 0.34, h * 0.3, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = col;
      ctx.beginPath(); ctx.ellipse(px + w / 2, py + h / 2 + 2, w * 0.22, h * 0.18, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#b7f0c8';
      for (let i = 0; i < 4; i++) {
        const a = i * Math.PI / 2 + 0.4;
        ctx.beginPath();
        ctx.arc(px + w / 2 + Math.cos(a) * w * 0.28, py + h / 2 + Math.sin(a) * h * 0.24, 4, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.strokeStyle = '#9ff5b8'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(px + w / 2, py + h / 2 + 2, w * 0.15, h * 0.11, 0, 0, Math.PI * 2); ctx.stroke();
    } else if (b.type === 'barracks') {
      // Инкубатор: бугор с выводковой камерой и икрой.
      ctx.fillStyle = '#4c3f60';
      ctx.beginPath(); ctx.ellipse(px + w / 2, py + h / 2 + 3, w * 0.44, h * 0.36, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = dark;
      ctx.beginPath(); ctx.ellipse(px + w / 2 - 4, py + h / 2, w * 0.3, h * 0.28, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = col;
      ctx.beginPath(); ctx.ellipse(px + w / 2 + 8, py + h / 2, 8, 6, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#b7f0c8';
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.arc(px + w / 2 - 12 + i * 9, py + h / 2 + 4, 3.2, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (b.type === 'turret') {
      // Жвала: органическая башня со раскрывшимися клешнями.
      ctx.fillStyle = '#4c3f60';
      ctx.beginPath(); ctx.arc(px + w / 2, py + h / 2 + 2, 11, 0, Math.PI * 2); ctx.fill();
      ctx.save();
      ctx.translate(px + w / 2, py + h / 2);
      ctx.rotate(b.angle != null ? b.angle : -Math.PI / 4);
      ctx.strokeStyle = '#3a4a40'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(2, -3); ctx.lineTo(18, -7); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(2, 3); ctx.lineTo(18, 7); ctx.stroke();
      ctx.fillStyle = col;
      ctx.beginPath(); ctx.arc(0, 0, 8, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#b7f0c8';
      ctx.beginPath(); ctx.arc(3, 0, 3, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    } else if (b.type === 'wall') {
      // Хитиновая стена: пластинчатый нарост.
      ctx.fillStyle = '#4c3f60';
      ctx.fillRect(px + 1, py + 1, w - 2, h - 2);
      ctx.fillStyle = dark;
      ctx.beginPath(); ctx.ellipse(px + w / 2, py + h / 2, w * 0.42, h * 0.34, 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#9ff5b8'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(px + 6, py + h - 6); ctx.lineTo(px + w / 2, py + 6); ctx.lineTo(px + w - 6, py + h - 6); ctx.stroke();
    } else if (b.type === 'bunker') {
      // Кокон: пульсирующий мешок с зелёным просветом.
      ctx.fillStyle = '#4c3f60';
      ctx.beginPath(); ctx.ellipse(px + w / 2, py + h / 2 + 2, w * 0.44, h * 0.38, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = dark;
      ctx.beginPath(); ctx.ellipse(px + w / 2, py + h / 2, w * 0.34, h * 0.28, 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#9ff5b8'; ctx.lineWidth = 2;
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.ellipse(px + w / 2, py + h / 2, w * (0.1 + i * 0.09), h * (0.07 + i * 0.08), 0.5, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.fillStyle = '#b7f0c8';
      ctx.fillRect(px + w / 2 - 1, py + 4, 2, h - 8);
    } else if (b.type === 'factory') {
      // Яма выводка: кратер с икрой и щупальцами по краю.
      ctx.fillStyle = '#3a2f4c';
      ctx.beginPath(); ctx.ellipse(px + w / 2, py + h / 2 + 4, w * 0.44, h * 0.38, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#241c34';
      ctx.beginPath(); ctx.ellipse(px + w / 2, py + h / 2, w * 0.3, h * 0.24, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = col;
      for (let i = 0; i < 5; i++) {
        const a = i * Math.PI * 2 / 5 + 0.5;
        ctx.beginPath();
        ctx.arc(px + w / 2 + Math.cos(a) * w * 0.3, py + h / 2 + Math.sin(a) * h * 0.26, 3.4, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.strokeStyle = '#9ff5b8'; ctx.lineWidth = 2;
      for (let i = 0; i < 4; i++) {
        const a = i * Math.PI / 2 + 0.8;
        ctx.beginPath();
        ctx.moveTo(px + w / 2 + Math.cos(a) * w * 0.44, py + h / 2 + Math.sin(a) * h * 0.38);
        ctx.quadraticCurveTo(
          px + w / 2 + Math.cos(a) * w * 0.56, py + h / 2 + Math.sin(a) * h * 0.5,
          px + w / 2 + Math.cos(a) * w * 0.5, py + h / 2 + Math.sin(a) * h * 0.62);
        ctx.stroke();
      }
    } else {
      // Нарост-кладовая: пузатый мешок-хранилище.
      ctx.fillStyle = '#4c3f60';
      ctx.beginPath(); ctx.ellipse(px + w / 2, py + h / 2 + 3, w * 0.42, h * 0.36, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = dark;
      ctx.beginPath(); ctx.ellipse(px + w / 2, py + h / 2, w * 0.32, h * 0.27, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = col;
      ctx.beginPath(); ctx.ellipse(px + w / 2 - 3, py + h / 2 + 1, 5, 4, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#b7f0c8';
      ctx.beginPath(); ctx.arc(px + w / 2 + 6, py + h / 2 - 2, 3, 0, Math.PI * 2); ctx.fill();
    }
  } else if (b.type === 'cc') {
    // Командный центр: посадочная площадка + антенна.
    ctx.fillStyle = '#5a6069';
    ctx.fillRect(px + 8, py + 10, w - 16, h - 18);
    ctx.strokeStyle = col; ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.ellipse(px + w / 2, py + h / 2 + 2, Math.min(w, h) * 0.28, Math.min(w, h) * 0.22, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#454b54';
    ctx.beginPath();
    ctx.ellipse(px + w / 2, py + h / 2 + 2, Math.min(w, h) * 0.2, Math.min(w, h) * 0.15, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = col;
    ctx.fillRect(px + w - 12, py + 2, 3, 12); // антенна
    ctx.beginPath(); ctx.arc(px + w - 10.5, py + 2, 3, 0, Math.PI * 2); ctx.fill();
  } else if (b.type === 'barracks') {
    // Казарма: ворота, полосы крыши, флаг.
    ctx.fillStyle = '#6b727a';
    ctx.fillRect(px + 6, py + 10, w - 12, h - 16);
    ctx.fillStyle = '#3a3f45';
    ctx.fillRect(px + w / 2 - 10, py + h - 22, 20, 16);
    ctx.fillStyle = col;
    ctx.globalAlpha *= 0.55;
    ctx.fillRect(px + 6, py + 12, w - 12, 4);
    ctx.fillRect(px + 6, py + 20, w - 12, 4);
    ctx.globalAlpha = ghost ? 0.4 : (b.done ? 1 : 0.45 + 0.3 * b.progress);
    ctx.fillStyle = '#c8cdd4';
    ctx.fillRect(px + w - 8, py - 10, 2, 14);          // флагшток
    ctx.beginPath();
    ctx.moveTo(px + w - 6, py - 10);
    ctx.lineTo(px + w - 6 + 14, py - 6);
    ctx.lineTo(px + w - 6, py - 2);
    ctx.closePath();
    ctx.fillStyle = col;
    ctx.fill();
  } else if (b.type === 'turret') {
    // Турель: бетонное основание + вращающаяся спарка.
    ctx.fillStyle = '#5a6069';
    ctx.fillRect(px + 3, py + 3, w - 6, h - 6);
    ctx.fillStyle = '#454b54';
    ctx.beginPath(); ctx.arc(px + w / 2, py + h / 2 + 2, 10, 0, Math.PI * 2); ctx.fill();
    ctx.save();
    ctx.translate(px + w / 2, py + h / 2);
    ctx.rotate(b.angle != null ? b.angle : -Math.PI / 4);
    ctx.fillStyle = '#2c3138';
    ctx.fillRect(4, -4, 16, 3);
    ctx.fillRect(4, 1, 16, 3);
    ctx.fillStyle = col;
    ctx.beginPath(); ctx.arc(0, 0, 8, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#d7e3f5';
    ctx.beginPath(); ctx.arc(0, 0, 3, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  } else if (b.type === 'wall') {
    // Секция стены: кладка.
    ctx.fillStyle = '#6d737b';
    ctx.fillRect(px + 1, py + 1, w - 2, h - 2);
    ctx.fillStyle = '#565c64';
    ctx.fillRect(px + 1, py + h / 2 - 1, w - 2, 2);
    ctx.fillStyle = '#82898f';
    for (let i = 0; i < 3; i++) ctx.fillRect(px + 3 + i * 10, py + 4, 6, 3);
  } else if (b.type === 'bunker') {
    // Бункер: толстые стены, бойница, мешки с песком.
    ctx.fillStyle = '#5f656d';
    ctx.fillRect(px + 2, py + 2, w - 4, h - 4);
    ctx.fillStyle = '#3a3f45';
    ctx.fillRect(px + 6, py + h / 2 - 3, w - 12, 6);
    ctx.fillStyle = col;
    ctx.fillRect(px + 2, py + 2, w - 4, 4);
    ctx.fillStyle = '#8a8f75';
    for (let i = 0; i < 4; i++) {
      ctx.beginPath();
      ctx.ellipse(px + 8 + i * 11, py + h - 4, 5.5, 3.4, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (b.type === 'factory') {
    // Завод техники: цех с воротами, труба с дымом, шестерня.
    ctx.fillStyle = '#6b727a';
    ctx.fillRect(px + 4, py + 8, w - 8, h - 12);
    ctx.fillStyle = '#3a3f45';
    ctx.fillRect(px + w / 2 - 16, py + h - 26, 32, 22); // ворота
    ctx.fillStyle = col;
    ctx.fillRect(px + w / 2 - 16, py + h - 26, 32, 5);
    ctx.fillStyle = '#565c64';
    ctx.fillRect(px + 6, py - 6, 9, 14);               // труба
    ctx.fillStyle = 'rgba(200,200,200,0.25)';
    ctx.beginPath(); ctx.arc(px + 10, py - 12, 5, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = col; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(px + w - 14, py + 10, 6, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = col;
    ctx.beginPath(); ctx.arc(px + w - 14, py + 10, 2.4, 0, Math.PI * 2); ctx.fill();
  } else {
    // Дом (депо): низкий блок с шевронами.
    ctx.fillStyle = '#6a7078';
    ctx.fillRect(px + 3, py + 8, w - 6, h - 12);
    ctx.fillStyle = col;
    ctx.fillRect(px + 3, py + 8, w - 6, 5);
    ctx.fillStyle = '#3a3f45';
    for (let i = 0; i < 2; i++) {
      const bx = px + 8 + i * 16;
      ctx.beginPath();
      ctx.moveTo(bx, py + h / 2 - 4);
      ctx.lineTo(bx + 8, py + h / 2 + 2);
      ctx.lineTo(bx, py + h / 2 + 8);
      ctx.lineTo(bx + 4, py + h / 2 + 2);
      ctx.closePath();
      ctx.fill();
    }
  }

  // Лесах стройки: жёлтые подкосы + полоса прогресса.
  if (!b.done) {
    ctx.strokeStyle = '#d8b13a';
    ctx.lineWidth = 2;
    ctx.strokeRect(px + 2, py + 2, w - 4, h - 4);
    ctx.beginPath();
    ctx.moveTo(px + 2, py + 2); ctx.lineTo(px + w - 2, py + h - 2);
    ctx.moveTo(px + w - 2, py + 2); ctx.lineTo(px + 2, py + h - 2);
    ctx.stroke();
    ctx.fillStyle = '#1a1012';
    ctx.fillRect(px, py - 8, w, 6);
    ctx.fillStyle = '#e8c04a';
    ctx.fillRect(px, py - 8, w * Math.min(1, b.progress), 6);
  } else {
    // Контур выделения и полоска здоровья.
    if (b.selected) {
      ctx.strokeStyle = '#4dff7a';
      ctx.lineWidth = 2;
      ctx.strokeRect(px - 2, py - 2, w + 4, h + 4);
    }
    if (b.hp < b.maxHp || b.selected) {
      const frac = Math.max(0, b.hp / b.maxHp);
      ctx.fillStyle = '#1a1012';
      ctx.fillRect(px, py - 8, w, 6);
      ctx.fillStyle = frac > 0.5 ? '#4be36a' : frac > 0.25 ? '#e8c04a' : '#e04b3f';
      ctx.fillRect(px + 1, py - 7, (w - 2) * frac, 4);
    }
  }

  // Вспышка от полученного урона.
  if (b.flashT > 0) {
    ctx.fillStyle = `rgba(255,255,255,${b.flashT * 2.5})`;
    ctx.fillRect(px, py, w, h);
  }
  ctx.restore();
}
