import { BUILDING_TYPES, RULES, TILE_SIZE, UNIT_TYPES } from './config.js';
import { tileCenter, tileIndex, worldToTile } from './map.js';

export function createUnit(game, type, team, x, y) {
  const stats = UNIT_TYPES[type];
  const unit = {
    id: game.nextId++, kind: 'unit', type, team, x, y,
    hp: stats.hp, maxHp: stats.hp, radius: stats.radius, facing: team === 'player' ? 0 : Math.PI,
    order: { kind: 'idle' }, path: null, pathIndex: 0, pathKey: '', repath: 0,
    cooldown: 0, autoTimer: 0, healTimer: 0, cargo: 0, harvestTimer: 0,
    hitFlash: 0, waveAssigned: false,
  };
  game.units.push(unit);
  game.entities.set(unit.id, unit);
  return unit;
}

function clearPath(unit) {
  unit.path = null;
  unit.pathIndex = 0;
  unit.pathKey = '';
  unit.repath = 0;
}
export function stopUnit(unit) { unit.order = { kind: 'idle' }; clearPath(unit); }
export function moveOrder(unit, x, y) {
  unit.order = { kind: 'move', x: tileCenter(worldToTile(x)), y: tileCenter(worldToTile(y)) };
  clearPath(unit);
}
export function harvestOrder(unit, mineralId) {
  if (unit.type !== 'worker') return;
  unit.order = { kind: 'harvest', mineralId, phase: unit.cargo ? 'return' : 'toMine' };
  unit.harvestTimer = 0;
  clearPath(unit);
}
export function buildOrder(unit, buildingId) {
  if (unit.type !== 'worker') return;
  const resumeMineralId = unit.order.kind === 'harvest' ? unit.order.mineralId : null;
  unit.order = { kind: 'build', buildingId, resumeMineralId };
  clearPath(unit);
}
export function attackOrder(unit, targetId, automatic = false) {
  unit.order = { kind: 'attack', targetId, automatic, lastX: unit.x, lastY: unit.y, homeX: unit.x, homeY: unit.y };
  clearPath(unit);
}
export function attackMoveOrder(unit, x, y) {
  unit.order = { kind: 'attackMove', x, y, targetId: null };
  clearPath(unit);
}

export function distanceToTarget(unit, target) {
  if (target.kind === 'building') {
    const left = target.tx * TILE_SIZE, top = target.ty * TILE_SIZE;
    const right = left + target.size * TILE_SIZE, bottom = top + target.size * TILE_SIZE;
    const dx = Math.max(left - unit.x, 0, unit.x - right);
    const dy = Math.max(top - unit.y, 0, unit.y - bottom);
    return Math.hypot(dx, dy);
  }
  return Math.max(0, Math.hypot(unit.x - target.x, unit.y - target.y) - (target.radius || 0));
}

function isVisibleTo(game, unit, target) {
  return unit.team === 'enemy' || !game.fog || game.fog.isWorldVisible(target.x, target.y);
}

// Paths are requested only when an order changes or a moving target changes tile.
// A per-tick budget spreads large group orders over several simulation steps.
function advance(game, unit, targetX, targetY, stopRange, dt, minimumGoalRadius = 0) {
  const straightDistance = Math.hypot(unit.x - targetX, unit.y - targetY);
  if (straightDistance <= stopRange) return true;
  const goalX = worldToTile(targetX), goalY = worldToTile(targetY);
  // A target can lie on a tile edge (notably a 2×2 building). Account for
  // that half-tile offset so A* cannot stop outside the actual interaction range.
  const centerOffset = Math.hypot(targetX - tileCenter(goalX), targetY - tileCenter(goalY));
  const rangeTiles = Math.max(minimumGoalRadius, Math.floor((stopRange - centerOffset - 8) / TILE_SIZE));
  const pathKey = `${goalX},${goalY},${rangeTiles}`;
  unit.repath -= dt;
  if ((unit.path === null || unit.pathKey !== pathKey || (unit.pathIndex >= unit.path.length && unit.repath <= 0)) && game.pathBudget > 0) {
    game.pathBudget--;
    unit.path = game.pathfinder.find(worldToTile(unit.x), worldToTile(unit.y), goalX, goalY, rangeTiles);
    unit.pathIndex = 0;
    unit.pathKey = pathKey;
    unit.repath = RULES.pathRetrySeconds;
  }
  if (unit.path === null) return false;
  // Crowd separation may push a unit back a few pixels each tick. A generous
  // waypoint radius prevents two nearby workers from pinning each other forever.
  while (unit.pathIndex < unit.path.length && Math.hypot(unit.x - unit.path[unit.pathIndex].x, unit.y - unit.path[unit.pathIndex].y) < unit.radius + RULES.unitSpacing + 2) unit.pathIndex++;
  const waypoint = unit.path[unit.pathIndex] || { x: targetX, y: targetY };
  const dx = waypoint.x - unit.x, dy = waypoint.y - unit.y;
  const distance = Math.hypot(dx, dy);
  if (distance < 1) return straightDistance <= stopRange + 8;
  const speed = UNIT_TYPES[unit.type].speed;
  const step = Math.min(distance, speed * dt);
  const nx = unit.x + dx / distance * step, ny = unit.y + dy / distance * step;
  const open = (x, y) => game.isTileOpen(worldToTile(x), worldToTile(y));
  if (open(nx, ny)) { unit.x = nx; unit.y = ny; }
  else if (open(nx, unit.y)) unit.x = nx;
  else if (open(unit.x, ny)) unit.y = ny;
  else unit.repath = 0;
  unit.facing = Math.atan2(dy, dx);
  return Math.hypot(unit.x - targetX, unit.y - targetY) <= stopRange;
}

function closestEnemy(game, unit, maxDistance) {
  let closest = null, best = maxDistance;
  for (const enemy of [...game.units, ...game.buildings]) {
    if (enemy.team === unit.team || enemy.hp <= 0 || !isVisibleTo(game, unit, enemy)) continue;
    const distance = distanceToTarget(unit, enemy);
    if (distance < best) { best = distance; closest = enemy; }
  }
  return closest;
}

function fireAt(game, unit, target) {
  if (unit.cooldown > 0 || !isVisibleTo(game, unit, target)) return;
  if (distanceToTarget(unit, target) > UNIT_TYPES[unit.type].range) return;
  unit.cooldown = UNIT_TYPES[unit.type].cooldown;
  unit.facing = Math.atan2(target.y - unit.y, target.x - unit.x);
  game.fireProjectile(unit, target);
}

function updateHarvest(game, unit, dt) {
  const order = unit.order;
  let mineral = game.entities.get(order.mineralId);
  if ((!mineral || mineral.amount <= 0) && unit.cargo === 0) {
    mineral = game.findNearestMineral(unit);
    if (!mineral) { stopUnit(unit); return; }
    order.mineralId = mineral.id;
    clearPath(unit);
  }
  if (order.phase === 'return' || unit.cargo > 0) {
    const base = game.findNearestBase(unit.team, unit.x, unit.y);
    if (!base) { stopUnit(unit); return; }
    const reach = base.size * TILE_SIZE / 2 + RULES.depositReach;
    if (advance(game, unit, base.x, base.y, reach, dt)) {
      game[unit.team].minerals += unit.cargo;
      if (unit.team === 'player' && unit.cargo) game.addFloatingText(unit.x, unit.y - 16, `+${unit.cargo}`, '#9ddff0');
      unit.cargo = 0;
      order.phase = 'toMine';
      clearPath(unit);
    }
    return;
  }
  if (!mineral || mineral.amount <= 0) return;
  if (advance(game, unit, mineral.x, mineral.y, RULES.mineralReach, dt)) {
    unit.harvestTimer += dt;
    if (unit.harvestTimer >= RULES.harvestSeconds) {
      const amount = Math.min(RULES.harvestAmount + game[unit.team].upgrades.drills * 5, mineral.amount);
      mineral.amount -= amount;
      unit.cargo = amount;
      unit.harvestTimer = 0;
      order.phase = 'return';
      clearPath(unit);
      if (mineral.amount <= 0) game.mineralTiles[tileIndex(mineral.tx, mineral.ty)] = 0;
    }
  } else unit.harvestTimer = 0;
}

function updateBuild(game, unit, dt) {
  const building = game.entities.get(unit.order.buildingId);
  const resumeMining = () => {
    const previous = game.entities.get(unit.order.resumeMineralId);
    stopUnit(unit);
    if (previous?.amount > 0) harvestOrder(unit, previous.id);
    else game.assignNearestMineral(unit);
  };
  if (!building || building.kind !== 'building' || building.team !== unit.team || building.hp <= 0 || building.progress >= 1) {
    resumeMining(); return;
  }
  const reach = building.size * TILE_SIZE / 2 + RULES.workerBuildReach;
  if (!advance(game, unit, building.x, building.y, reach, dt)) return;
  building.progress = Math.min(1, building.progress + dt / BUILDING_TYPES[building.type].buildSeconds);
  building.hp = Math.min(building.maxHp, building.hp + building.maxHp * .7 * dt / BUILDING_TYPES[building.type].buildSeconds);
  if (building.progress >= 1) {
    building.hp = building.maxHp;
    resumeMining();
    if (building.team === 'player') {
      game.announce(`${BUILDING_TYPES[building.type].name} построен`, 'normal');
      game.audio?.play('build');
    }
  }
}

function updateAttack(game, unit, dt) {
  const order = unit.order;
  // Automatic defence is leashed; one scout must not draw the entire garrison
  // across the map. Explicit player orders and AI waves have no such limit.
  if (order.automatic && Math.hypot(unit.x - order.homeX, unit.y - order.homeY) > UNIT_TYPES[unit.type].vision * TILE_SIZE * .85) {
    moveOrder(unit, order.homeX, order.homeY);
    return;
  }
  const target = game.entities.get(order.targetId);
  if (!target || target.hp <= 0 || target.team === unit.team) { stopUnit(unit); return; }
  if (isVisibleTo(game, unit, target)) {
    order.lastX = target.x; order.lastY = target.y;
    if (distanceToTarget(unit, target) <= UNIT_TYPES[unit.type].range) {
      unit.path = null;
      fireAt(game, unit, target);
    } else advance(game, unit, target.x, target.y,
      UNIT_TYPES[unit.type].range + (target.kind === 'building' ? target.size * TILE_SIZE / 2 : target.radius || 0) - 8,
      dt, target.kind === 'building' ? Math.ceil(target.size / 2) : 0);
  } else if (advance(game, unit, order.lastX, order.lastY, 8, dt)) stopUnit(unit);
}

function updateAttackMove(game, unit, dt) {
  const order = unit.order;
  let target = game.entities.get(order.targetId);
  if (!target || target.hp <= 0 || !isVisibleTo(game, unit, target)) {
    const previousId = order.targetId;
    target = closestEnemy(game, unit, UNIT_TYPES[unit.type].vision * TILE_SIZE);
    order.targetId = target?.id || null;
    if (order.targetId !== previousId) clearPath(unit);
  }
  if (target) {
    if (distanceToTarget(unit, target) <= UNIT_TYPES[unit.type].range) fireAt(game, unit, target);
    else advance(game, unit, target.x, target.y,
      UNIT_TYPES[unit.type].range + (target.kind === 'building' ? target.size * TILE_SIZE / 2 : target.radius || 0) - 8,
      dt, target.kind === 'building' ? Math.ceil(target.size / 2) : 0);
  } else if (advance(game, unit, order.x, order.y, 8, dt)) stopUnit(unit);
}

function repairAllies(game, unit, dt) {
  const stats = UNIT_TYPES.support;
  unit.healTimer -= dt;
  if (unit.healTimer > 0) return;
  unit.healTimer = stats.healInterval;
  let target = null, priority = 0;
  for (const ally of [...game.units, ...game.buildings]) {
    if (ally === unit || ally.team !== unit.team || ally.hp <= 0 || ally.hp >= ally.maxHp || ally.kind === 'building' && ally.progress < 1) continue;
    if (Math.hypot(unit.x - ally.x, unit.y - ally.y) > stats.healRange + (ally.kind === 'building' ? ally.size * TILE_SIZE / 2 : 0)) continue;
    const urgency = (ally.maxHp - ally.hp) / ally.maxHp + (ally.kind === 'unit' ? .3 : 0);
    if (urgency > priority) { target = ally; priority = urgency; }
  }
  if (!target) return;
  target.hp = Math.min(target.maxHp, target.hp + stats.healAmount);
  game.effects.push({ kind: 'repair', x: target.x, y: target.y, life: .45, maxLife: .45, team: unit.team });
}

export function updateUnits(game, dt) {
  for (const unit of game.units) {
    if (unit.hp <= 0) continue;
    unit.cooldown = Math.max(0, unit.cooldown - dt);
    unit.hitFlash = Math.max(0, unit.hitFlash - dt);
    unit.autoTimer -= dt;
    if (unit.order.kind === 'move') {
      if (advance(game, unit, unit.order.x, unit.order.y, 8, dt)) stopUnit(unit);
    } else if (unit.order.kind === 'harvest') updateHarvest(game, unit, dt);
    else if (unit.order.kind === 'build') updateBuild(game, unit, dt);
    else if (unit.order.kind === 'attack') updateAttack(game, unit, dt);
    else if (unit.order.kind === 'attackMove') updateAttackMove(game, unit, dt);
    if (unit.type === 'support') repairAllies(game, unit, dt);

    // Idle troops pursue a nearby threat; busy units still shoot in self-defence.
    if (unit.autoTimer <= 0) {
      unit.autoTimer = .28 + (unit.id % 5) * .035;
      if (unit.order.kind !== 'attack' && unit.order.kind !== 'attackMove') {
        const sight = unit.order.kind === 'idle'
          ? ['worker','support'].includes(unit.type) ? UNIT_TYPES[unit.type].range + 60 : UNIT_TYPES[unit.type].vision * TILE_SIZE
          : UNIT_TYPES[unit.type].range;
        const target = closestEnemy(game, unit, sight);
        if (target) {
          if (unit.order.kind === 'idle') attackOrder(unit, target.id, true);
          else fireAt(game, unit, target);
        }
      }
    }
  }
  separateUnits(game);
}

// Units do not block A*: this local separation avoids clumping without causing
// hundreds of expensive re-paths when a formation squeezes through a corridor.
function separateUnits(game) {
  const units = game.units;
  for (let i = 0; i < units.length; i++) {
    const a = units[i];
    if (a.hp <= 0) continue;
    for (let j = i + 1; j < units.length; j++) {
      const b = units[j];
      if (b.hp <= 0) continue;
      const dx = b.x - a.x, dy = b.y - a.y;
      const minimum = a.radius + b.radius + RULES.unitSpacing;
      if (Math.abs(dx) > minimum || Math.abs(dy) > minimum) continue;
      const d2 = dx * dx + dy * dy;
      if (d2 >= minimum * minimum) continue;
      const distance = Math.sqrt(d2) || .001;
      const angle = d2 ? Math.atan2(dy, dx) : (a.id + b.id) * 1.618;
      const shift = Math.min(3.5, (minimum - distance) * .5);
      const sx = Math.cos(angle) * shift, sy = Math.sin(angle) * shift;
      const ax = a.x - sx, ay = a.y - sy, bx = b.x + sx, by = b.y + sy;
      if (game.isTileOpen(worldToTile(ax), worldToTile(ay))) { a.x = ax; a.y = ay; }
      if (game.isTileOpen(worldToTile(bx), worldToTile(by))) { b.x = bx; b.y = by; }
    }
  }
}
