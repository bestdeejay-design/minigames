import { BUILDING_TYPES, FIXED_STEP, MAP_SIZE, RULES, TILE_SIZE, UNIT_TYPES, WORLD_SIZE } from './config.js';
import { createMap, tileCenter, tileIndex, worldToTile } from './map.js';
import { createPathfinder } from './pathfinding.js';
import { createUnit, updateUnits, moveOrder, harvestOrder, buildOrder, attackOrder, attackMoveOrder, stopUnit } from './units.js';
import { createBuilding, removeBuilding, canPlaceBuilding, beginBuilding, queueUnit, updateBuildings } from './buildings.js';
import { Fog } from './fog.js';
import { EnemyAI } from './ai.js';

const START_UNITS = {
  player: { workers: [[7, 13], [8, 14], [10, 15], [12, 15]], marines: [[14, 12], [15, 13]] },
  enemy: { workers: [[56, 53], [55, 55], [54, 56], [52, 56]], marines: [[49, 50]] },
};
const BEST_KEY = 'rubezh64-best-win';

export class Game {
  constructor() {
    this.audio = null;
    this.reset();
  }

  reset() {
    this.map = createMap();
    this.entities = new Map();
    this.nextId = 1;
    this.occupied = new Uint32Array(MAP_SIZE * MAP_SIZE);
    this.mineralTiles = new Uint8Array(MAP_SIZE * MAP_SIZE);
    this.minerals = this.map.mineralSpots.map(spot => {
      const mineral = {
        id: this.nextId++, kind: 'mineral', tx: spot.tx, ty: spot.ty,
        x: tileCenter(spot.tx), y: tileCenter(spot.ty), amount: RULES.mineralAmount,
      };
      this.entities.set(mineral.id, mineral);
      this.mineralTiles[tileIndex(spot.tx, spot.ty)] = 1;
      return mineral;
    });
    this.units = [];
    this.buildings = [];
    this.projectiles = [];
    this.effects = [];
    this.player = { minerals: RULES.playerMinerals };
    this.enemy = { minerals: RULES.enemyMinerals };
    this.camera = { x: 0, y: 60 };
    this.selection = [];
    this.groups = Array.from({ length: 10 }, () => []);
    this.mode = 'ready';
    this.time = 0;
    this.losses = 0;
    this.notice = '';
    this.noticeTone = 'normal';
    this.noticeTime = 0;
    this.pathBudget = RULES.maxPathsPerTick;
    this.fog = null;
    this.ai = null;
    this.pathfinder = createPathfinder((tx, ty) => this.isTileOpen(tx, ty));

    createBuilding(this, 'command', 'player', 9, 10);
    createBuilding(this, 'command', 'enemy', 51, 50);
    for (const team of ['player', 'enemy']) {
      for (const [tx, ty] of START_UNITS[team].workers) this.spawnUnit('worker', team, tileCenter(tx), tileCenter(ty));
      for (const [tx, ty] of START_UNITS[team].marines) this.spawnUnit('marine', team, tileCenter(tx), tileCenter(ty));
    }
    this.fog = new Fog(this);
    this.ai = new EnemyAI();
  }

  start() {
    if (this.mode !== 'ready') return;
    this.mode = 'running';
    for (const unit of this.units) if (unit.type === 'worker' && unit.order.kind === 'idle') this.assignNearestMineral(unit);
  }
  pause() { if (this.mode === 'running') this.mode = 'paused'; }
  resume() { if (this.mode === 'paused') this.mode = 'running'; }

  tick(dt = FIXED_STEP) {
    if (this.mode !== 'running') return;
    this.time += dt;
    this.noticeTime = Math.max(0, this.noticeTime - dt);
    this.pathBudget = RULES.maxPathsPerTick;
    updateBuildings(this, dt);
    updateUnits(this, dt);
    this.ai.update(this, dt);
    this.updateProjectiles(dt);
    this.updateEffects(dt);
    this.cleanupDead();
    this.fog.update(this, dt);
    this.checkOutcome();
  }

  isTileOpen(tx, ty) {
    return this.map.isTerrainWalkable(tx, ty) && !this.occupied[tileIndex(tx, ty)] && !this.mineralTiles[tileIndex(tx, ty)];
  }
  getSupply(team) {
    const units = this.units.reduce((sum, u) => sum + (u.team === team && u.hp > 0 ? UNIT_TYPES[u.type].supply : 0), 0);
    const queued = this.buildings.reduce((sum, b) => sum + (b.team === team && b.hp > 0 ? b.queue.reduce((n, type) => n + UNIT_TYPES[type].supply, 0) : 0), 0);
    const cap = this.buildings.reduce((sum, b) => sum + (b.team === team && b.hp > 0 && b.progress >= 1 ? BUILDING_TYPES[b.type].supply : 0), 0);
    return [units + queued, Math.min(RULES.maxSupply, cap)];
  }
  spawnUnit(type, team, x, y) {
    if (!this.isTileOpen(worldToTile(x), worldToTile(y))) return null;
    return createUnit(this, type, team, x, y);
  }
  findSpawnPoint(building) {
    const centerX = building.tx + (building.size - 1) / 2;
    const centerY = building.ty + (building.size - 1) / 2;
    for (let radius = Math.ceil(building.size / 2); radius <= 7; radius++) {
      for (let y = Math.floor(centerY - radius); y <= Math.ceil(centerY + radius); y++) {
        for (let x = Math.floor(centerX - radius); x <= Math.ceil(centerX + radius); x++) {
          if (!this.isTileOpen(x, y)) continue;
          const px = tileCenter(x), py = tileCenter(y);
          if (this.units.some(u => u.hp > 0 && Math.hypot(u.x - px, u.y - py) < 25)) continue;
          return { x: px, y: py };
        }
      }
    }
    return null;
  }
  findNearestMineral(unit) {
    let closest = null, best = Infinity;
    for (const mineral of this.minerals) {
      if (mineral.amount <= 0) continue;
      const assigned = this.units.reduce((count, other) => count + (other !== unit && other.team === unit.team && other.order.kind === 'harvest' && other.order.mineralId === mineral.id ? 1 : 0), 0);
      const cost = Math.hypot(unit.x - mineral.x, unit.y - mineral.y) + assigned * RULES.mineralCrowdPenalty;
      if (cost < best) { closest = mineral; best = cost; }
    }
    return closest;
  }
  findNearestBase(team, x, y) {
    let closest = null, best = Infinity;
    for (const building of this.buildings) {
      if (building.team !== team || building.type !== 'command' || building.hp <= 0 || building.progress < 1) continue;
      const distance = Math.hypot(x - building.x, y - building.y);
      if (distance < best) { best = distance; closest = building; }
    }
    return closest;
  }
  assignNearestMineral(unit) {
    const mineral = this.findNearestMineral(unit);
    if (mineral) harvestOrder(unit, mineral.id);
  }

  orderMove(unit, x, y) { if (unit?.kind === 'unit' && unit.hp > 0) moveOrder(unit, x, y); }
  orderHarvest(unit, mineralId) { if (unit?.kind === 'unit' && unit.hp > 0) harvestOrder(unit, mineralId); }
  orderBuild(unit, building) { if (unit?.kind === 'unit' && unit.hp > 0) buildOrder(unit, building.id); }
  orderAttack(unit, targetId) { if (unit?.kind === 'unit' && unit.hp > 0) attackOrder(unit, targetId); }
  orderAttackMove(unit, x, y) { if (unit?.kind === 'unit' && unit.hp > 0) attackMoveOrder(unit, x, y); }
  orderStop(unit) { if (unit?.kind === 'unit') stopUnit(unit); }
  orderGroupMove(units, x, y, attack = false) {
    const side = Math.ceil(Math.sqrt(units.length));
    units.forEach((unit, index) => {
      const px = x + ((index % side) - (side - 1) / 2) * TILE_SIZE;
      const py = y + (Math.floor(index / side) - (side - 1) / 2) * TILE_SIZE;
      if (attack) this.orderAttackMove(unit, px, py);
      else this.orderMove(unit, px, py);
    });
  }
  canPlace(type, tx, ty, team = 'player') { return canPlaceBuilding(this, type, tx, ty, team); }
  place(type, tx, ty, worker, team = 'player', requireVision = true) {
    return beginBuilding(this, type, team, tx, ty, worker, requireVision);
  }
  train(building, type) { return queueUnit(this, building, type); }
  selected() { return this.selection.map(id => this.entities.get(id)).filter(entity => entity && (entity.hp === undefined || entity.hp > 0)); }
  select(ids, additive = false) {
    this.selection = additive ? [...new Set([...this.selection, ...ids])] : [...new Set(ids)];
    this.audio?.play('select');
  }
  entityAt(x, y) {
    // Units take priority when they overlap a building footprint.
    for (let i = this.units.length - 1; i >= 0; i--) {
      const unit = this.units[i];
      if (unit.hp <= 0 || (unit.team === 'enemy' && this.fog && !this.fog.isWorldVisible(unit.x, unit.y))) continue;
      if (Math.hypot(x - unit.x, y - unit.y) <= unit.radius + 7) return unit;
    }
    for (let i = this.buildings.length - 1; i >= 0; i--) {
      const building = this.buildings[i];
      if (building.hp <= 0 || (building.team === 'enemy' && this.fog && !this.fog.isWorldVisible(building.x, building.y))) continue;
      if (x >= building.tx * TILE_SIZE && x < (building.tx + building.size) * TILE_SIZE &&
          y >= building.ty * TILE_SIZE && y < (building.ty + building.size) * TILE_SIZE) return building;
    }
    return this.minerals.find(m => m.amount > 0 && Math.hypot(x - m.x, y - m.y) < 18 && (!this.fog || this.fog.isExplored(m.tx, m.ty))) || null;
  }

  fireProjectile(unit, target) {
    this.projectiles.push({ x: unit.x, y: unit.y, fromTeam: unit.team, fromType: unit.type,
      targetId: target.id, damage: UNIT_TYPES[unit.type].damage, life: RULES.projectileLifeSeconds });
    if (unit.team === 'player' && unit.type === 'marine' && Math.random() < .12) this.audio?.play('shot');
  }
  updateProjectiles(dt) {
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const shot = this.projectiles[i];
      const target = this.entities.get(shot.targetId);
      shot.life -= dt;
      if (!target || target.hp <= 0 || shot.life <= 0) { this.projectiles.splice(i, 1); continue; }
      const dx = target.x - shot.x, dy = target.y - shot.y;
      const distance = Math.hypot(dx, dy);
      const step = RULES.projectileSpeed * dt;
      if (distance <= step + (target.kind === 'unit' ? target.radius : TILE_SIZE / 2)) {
        target.hp = Math.max(0, target.hp - shot.damage);
        target.hitFlash = .15;
        this.effects.push({ kind: 'spark', x: target.x, y: target.y, life: .25, maxLife: .25, team: shot.fromTeam });
        if (target.hp <= 0) this.effects.push({ kind: 'explosion', x: target.x, y: target.y, life: .65, maxLife: .65, team: target.team });
        this.projectiles.splice(i, 1);
      } else {
        shot.x += dx / distance * step;
        shot.y += dy / distance * step;
      }
    }
  }
  addFloatingText(x, y, text, color) { this.effects.push({ kind: 'text', x, y, text, color, life: .9, maxLife: .9 }); }
  updateEffects(dt) {
    for (const effect of this.effects) { effect.life -= dt; if (effect.kind === 'text') effect.y -= dt * 22; }
    this.effects = this.effects.filter(effect => effect.life > 0);
  }
  cleanupDead() {
    const deadUnits = this.units.filter(unit => unit.hp <= 0);
    for (const unit of deadUnits) {
      this.entities.delete(unit.id);
      if (unit.team === 'player') this.losses++;
    }
    this.units = this.units.filter(unit => unit.hp > 0);
    const deadBuildings = this.buildings.filter(building => building.hp <= 0);
    for (const building of deadBuildings) removeBuilding(this, building);
    this.buildings = this.buildings.filter(building => building.hp > 0);
    if (deadUnits.length || deadBuildings.length) {
      this.selection = this.selection.filter(id => this.entities.has(id));
      for (const group of this.groups) {
        for (let i = group.length - 1; i >= 0; i--) if (!this.entities.has(group[i])) group.splice(i, 1);
      }
    }
  }
  checkOutcome() {
    if (this.mode !== 'running') return;
    const playerAlive = this.buildings.some(b => b.team === 'player' && b.hp > 0);
    const enemyAlive = this.buildings.some(b => b.team === 'enemy' && b.hp > 0);
    if (!enemyAlive || !playerAlive) {
      this.mode = enemyAlive ? 'defeat' : 'victory';
      if (this.mode === 'victory') this.saveBest();
      this.audio?.play(this.mode);
    }
  }
  readBest() {
    try {
      const stored = localStorage.getItem(BEST_KEY);
      if (stored === null) return null;
      const value = Number(stored);
      return value >= 0 && Number.isFinite(value) ? value : null;
    } catch (_) { return null; }
  }
  saveBest() {
    const old = this.readBest();
    if (old !== null && old <= this.time) return;
    try { localStorage.setItem(BEST_KEY, String(Math.floor(this.time))); } catch (_) {}
  }
  clampCamera(viewWidth, viewHeight) {
    this.camera.x = Math.max(0, Math.min(Math.max(0, WORLD_SIZE - viewWidth), this.camera.x));
    this.camera.y = Math.max(0, Math.min(Math.max(0, WORLD_SIZE - viewHeight), this.camera.y));
  }
  centerCamera(x, y, viewWidth, viewHeight) {
    this.camera.x = x - viewWidth / 2;
    this.camera.y = y - viewHeight / 2;
    this.clampCamera(viewWidth, viewHeight);
  }
  announce(text, tone = 'normal') {
    this.notice = text;
    this.noticeTone = tone;
    this.noticeTime = 2.5;
  }
}
