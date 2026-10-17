// ============================================================
// ai.js — ИИ противника. Работает по профилю миссии:
//   обычный бой — экономика (рабочие → дома → казармы → пехота →
//   техника) и нарастающие волны атак;
//   миссия-оборона — волны спавнятся из гнёзд противника с
//   нарастающим размером, без собственной экономики.
// ИИ не симулирует туман войны — видит всю карту (классическое
// «читерство» простых RTS-ИИ, допустимо для аркады).
// ============================================================
import { AI, BUILDINGS, UNITS, SUPPLY_MAX, TILE } from './config.js';
import { orderGather, orderBuild, orderAttack, orderRepair, spawnUnit } from './units.js';
import { canPlace, placeBuildingCmd, enqueueUnit } from './buildings.js';
import { pathToRect } from './pathfinding.js';

export class AIController {
  constructor(profile = {}) {
    this.p = { ...AI, ...profile };       // профиль миссии поверх базовых чисел
    this.def = this.p.defense || null;    // режим обороны (миссия защиты)
    this.accT = 0;
    this.nextWave = this.p.firstWave;
    this.lastWave = -999;
    this.defWaveNum = 0;
    this.defNextWaveAt = this.def ? this.def.prep : 0;
    // Спираль офсетов вокруг базы для поиска места под здание.
    this.spotOffsets = [];
    const R = 11;
    for (let dy = -R; dy <= R; dy++)
      for (let dx = -R; dx <= R; dx++)
        this.spotOffsets.push([dx, dy, dx * dx + dy * dy]);
    this.spotOffsets.sort((a, b) => a[2] - b[2]);
  }

  update(dt, st) {
    this.accT += dt;
    if (this.accT < 0.5) return; // решения принимаем 2 раза в секунду
    this.accT = 0;
    this.step(st);
  }

  step(st) {
    if (!st || st.gameOver) return;
    if (this.def) { this.defenseStep(st); return; }
    this.survivalStep(st);
  }

  // ----------------------------------------------------------
  // Миссия-оборона: подготовка → волны из гнёзд, растущие со временем.
  // ----------------------------------------------------------
  defenseStep(st) {
    const D = this.def;
    if (st.time < D.prep) return; // игрок готовится — противник ждёт
    if (st.time < this.defNextWaveAt) return;

    // Отправляем волну: размер растёт с номером волны.
    const n = Math.min(D.max, D.start + D.grow * this.defWaveNum);
    const cc = st.buildings.find((b) => b.side === 'enemy' && !b.dead && b.type === 'cc');
    if (!cc) return;
    const wave = [];
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = TILE * (2.5 + Math.random() * 2);
      const u = spawnUnit(st, 'enemy', 'marine', cc.x + Math.cos(a) * r, cc.y + Math.sin(a) * r);
      wave.push(u);
    }
    // Каждая третья волна усиливается быстрыми единицами.
    if (this.defWaveNum % 3 === 2) {
      for (let i = 0; i < 2; i++) {
        const u = spawnUnit(st, 'enemy', 'buggy', cc.x + (Math.random() - 0.5) * TILE * 4, cc.y + TILE * 3);
        wave.push(u);
      }
    }
    const target = nearestPlayerBuilding(st, cc);
    for (const u of wave) if (target) orderAttack(st, u, target);

    this.defWaveNum++;
    this.defNextWaveAt = st.time + D.every;
    st.defenseWave = this.defWaveNum;
    st.pings.push({ x: cc.x, y: cc.y, t: 0 });
    st.game.ui.toast('Волна ' + this.defWaveNum + ' из улья идёт к базе!', 'error');
    st.game.sound.ping();
  }

  // ----------------------------------------------------------
  // Обычный бой: экономика → техника → волны.
  // ----------------------------------------------------------
  survivalStep(st) {
    const P = this.p;
    const mine = (e) => e.side === 'enemy' && !e.dead;
    const workers = st.units.filter((u) => mine(u) && u.type === 'worker');
    const combat = st.units.filter((u) => mine(u) && !u.cfg.canMine);
    const ccs = st.buildings.filter((b) => mine(b) && b.type === 'cc');
    const barracks = st.buildings.filter((b) => mine(b) && b.type === 'barracks');
    const money = st.minerals.enemy;
    const { used, cap } = st.supply.enemy;

    // 1) Бездельники-рабочие — за кристаллы.
    for (const w of workers) {
      if (w.order.kind === 'idle') {
        const c = st.map.crystals.find((c) => !c.dead && c.amount > 0);
        if (c) orderGather(st, w, c);
      }
    }

    // 2) Недостроенные здания без строителя — назначить рабочего.
    for (const b of st.buildings) {
      if (!mine(b) || b.done) continue;
      const hasBuilder = st.units.some((u) => mine(u) && u.order.kind === 'build' && u.order.target === b);
      if (!hasBuilder && workers.length) {
        const w = nearestTo(workers, b.x, b.y);
        if (w) orderBuild(st, w, b);
      }
    }

    // 3) Дом — если население на пределе (приоритет №1, иначе deadlock).
    const depotPending = st.buildings.some((b) => mine(b) && !b.done && b.type === 'depot');
    if (cap < SUPPLY_MAX && cap - used <= 2 && !depotPending && money >= BUILDINGS.depot.cost) {
      this.tryPlace(st, 'depot');
    }

    // 4) Рабочие до целевого количества.
    if (workers.length < P.workerTarget) {
      for (const cc of ccs) {
        if (cc.done && cc.queue.length < 2 && money >= 50 && cap - used >= 1) {
          enqueueUnit(st, cc, 'worker');
        }
      }
    }

    // 5) Казармы: первая сразу, вторая по времени.
    if (barracks.length < 1 && money >= BUILDINGS.barracks.cost) {
      this.tryPlace(st, 'barracks');
    } else if (st.time > P.secondBarracksAt && barracks.length < 2 &&
               money >= BUILDINGS.barracks.cost + 100) {
      this.tryPlace(st, 'barracks');
    }

    // 6) Турели у базы — по профилю миссии.
    if (P.maxTurrets > 0) {
      const turrets = st.buildings.filter((b) => mine(b) && b.type === 'turret');
      if (turrets.length < P.maxTurrets && money >= BUILDINGS.turret.cost + 60) {
        this.tryPlace(st, 'turret');
      }
    }

    // 7) Завод техники и техника — по профилю миссии.
    if (P.factory && barracks.some((b) => b.done)) {
      const factories = st.buildings.filter((b) => mine(b) && b.type === 'factory');
      if (!factories.length && money >= BUILDINGS.factory.cost + 50) {
        this.tryPlace(st, 'factory');
      }
      const buggies = st.units.filter((u) => mine(u) && u.type === 'buggy');
      const tanks = st.units.filter((u) => mine(u) && u.type === 'tank');
      for (const f of factories) {
        if (!f.done || f.queue.length >= 2) continue;
        const queued = f.queue.reduce((s, q) => s + (q.type === 'buggy' ? 1 : 2), 0);
        if (money >= UNITS.tank.cost && tanks.length + queued < P.maxTanks && cap - used >= 3) {
          enqueueUnit(st, f, 'tank');
        } else if (money >= UNITS.buggy.cost && buggies.length + queued < P.maxBuggies && cap - used >= 2) {
          enqueueUnit(st, f, 'buggy');
        }
      }
    }

    // 8) Ремонт: рабочий латает повреждённую технику/здания.
    if (P.repair) {
      const busy = workers.filter((w) => w.order.kind === 'repair');
      if (!busy.length) {
        const hurtV = st.units.find((u) => mine(u) && u.cfg.vehicle && u.hp < u.maxHp * 0.6);
        const hurtB = st.buildings.find((b) => mine(b) && b.done && b.hp < b.maxHp * 0.55);
        const target = hurtV || hurtB;
        if (target) {
          const w = nearestTo(workers, target.x, target.y);
          if (w && w.order.kind !== 'build') orderRepair(st, w, target);
        }
      }
    }

    // 9) Волны атаки: копим армию до размера волны и отправляем.
    const idle = combat.filter((u) => u.order.kind !== 'attack');
    if (idle.length >= this.nextWave && st.time - this.lastWave >= P.minWaveInterval) {
      for (const m of idle) {
        const target = nearestPlayerBuilding(st, m);
        if (target) orderAttack(st, m, target);
      }
      this.lastWave = st.time;
      this.nextWave = Math.min(this.nextWave + P.waveGrowth, P.waveMax);
    }
  }

  // Ищем свободное место у своей базы и ставим здание силами рабочего.
  tryPlace(st, type) {
    const cfg = BUILDINGS[type];
    const cc = st.buildings.find((b) => b.side === 'enemy' && !b.dead && b.type === 'cc');
    if (!cc) return;
    const workers = st.units.filter((u) => u.side === 'enemy' && !u.dead && u.type === 'worker');
    if (!workers.length) return;

    for (const [dx, dy] of this.spotOffsets) {
      const tx = cc.tx + dx, ty = cc.ty + dy;
      if (!canPlace(st.map, tx, ty, cfg.w, cfg.h)) continue;
      // Место должно быть достижимо из базы — иначе рабочий застрянет.
      if (!pathToRect(st.map, cc.tx + 2, cc.ty + 1, { x: tx, y: ty, w: cfg.w, h: cfg.h })) continue;
      const w = nearestTo(workers, (tx + cfg.w / 2) * TILE, (ty + cfg.h / 2) * TILE);
      placeBuildingCmd(st, 'enemy', type, tx, ty, [w]);
      return;
    }
  }
}

function nearestTo(list, x, y) {
  let best = null, bd = Infinity;
  for (const e of list) {
    const d = Math.hypot(e.x - x, e.y - y);
    if (d < bd) { bd = d; best = e; }
  }
  return best;
}

function nearestPlayerBuilding(st, unit) {
  let best = null, bd = Infinity;
  for (const b of st.buildings) {
    if (b.dead || b.side !== 'player') continue;
    const d = Math.hypot(b.x - unit.x, b.y - unit.y);
    if (d < bd) { bd = d; best = b; }
  }
  return best;
}
