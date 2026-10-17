// ============================================================
// ai.js — ИИ противника. Раз в полсекунды принимает решения:
// экономика (рабочие) → дома (supply) → казармы → морпехи →
// атакующие волны (каждая следующая больше предыдущей).
// ИИ не симулирует туман войны — видит всю карту (классическое
// «читерство» простых RTS-ИИ, допустимо для MVP).
// ============================================================
import { AI, BUILDINGS, SUPPLY_MAX, TILE } from './config.js';
import { orderGather, orderBuild, orderAttack } from './units.js';
import { canPlace, placeBuildingCmd, enqueueUnit } from './buildings.js';
import { pathToRect } from './pathfinding.js';

export class AIController {
  constructor() {
    this.accT = 0;
    this.nextWave = AI.firstWave;
    this.lastWave = -999;
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
    const mine = (e) => e.side === 'enemy' && !e.dead;
    const workers = st.units.filter((u) => mine(u) && u.type === 'worker');
    const marines = st.units.filter((u) => mine(u) && u.type === 'marine');
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
    if (workers.length < AI.workerTarget) {
      for (const cc of ccs) {
        if (cc.done && cc.queue.length < 2 && money >= 50 && cap - used >= 1) {
          enqueueUnit(st, cc, 'worker');
        }
      }
    }

    // 5) Казармы: первая сразу, вторая по времени.
    if (barracks.length < 1 && money >= BUILDINGS.barracks.cost) {
      this.tryPlace(st, 'barracks');
    } else if (st.time > AI.secondBarracksAt && barracks.length < 2 &&
               money >= BUILDINGS.barracks.cost + 100) {
      this.tryPlace(st, 'barracks');
    }

    // 6) Поток морпехов.
    if (marines.length < AI.maxMarines) {
      for (const b of barracks) {
        if (b.done && b.queue.length < 2 && money >= 50 && cap - used >= 1) {
          enqueueUnit(st, b, 'marine');
        }
      }
    }

    // 7) Волны атаки: копим армию до размера волны и отправляем.
    const idle = marines.filter((u) => u.order.kind !== 'attack');
    if (idle.length >= this.nextWave && st.time - this.lastWave >= AI.minWaveInterval) {
      for (const m of idle) {
        const target = nearestPlayerBuilding(st, m);
        if (target) orderAttack(st, m, target);
      }
      this.lastWave = st.time;
      this.nextWave = Math.min(this.nextWave + AI.waveGrowth, AI.waveMax);
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
