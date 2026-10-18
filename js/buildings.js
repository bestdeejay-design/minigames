import { BUILDING_TYPES, MAP_SIZE, RULES, TILE_SIZE, UNIT_TYPES, UPGRADES } from './config.js';
import { tileIndex } from './map.js';

export function createBuilding(game, type, team, tx, ty, complete = true) {
  const stats = BUILDING_TYPES[type];
  const building = {
    id: game.nextId++, kind: 'building', type, team, tx, ty, size: stats.size,
    x: (tx + stats.size / 2) * TILE_SIZE, y: (ty + stats.size / 2) * TILE_SIZE,
    hp: complete ? stats.hp : Math.round(stats.hp * .3), maxHp: stats.hp,
    progress: complete ? 1 : 0, queue: [], training: 0, research: null,
    cooldown: 0, hitFlash: 0, rally: null,
  };
  game.buildings.push(building);
  game.entities.set(building.id, building);
  for (let y = ty; y < ty + stats.size; y++) {
    for (let x = tx; x < tx + stats.size; x++) game.occupied[tileIndex(x, y)] = building.id;
  }
  return building;
}

export function removeBuilding(game, building) {
  for (let y = building.ty; y < building.ty + building.size; y++) {
    for (let x = building.tx; x < building.tx + building.size; x++) {
      const index = tileIndex(x, y);
      if (game.occupied[index] === building.id) game.occupied[index] = 0;
    }
  }
  game.entities.delete(building.id);
}

export function canPlaceBuilding(game, type, tx, ty, team, requireVision = true) {
  const stats = BUILDING_TYPES[type];
  if (!stats || type === 'command' || tx < 1 || ty < 1 || tx + stats.size >= MAP_SIZE - 1 || ty + stats.size >= MAP_SIZE - 1) return false;
  for (let y = ty; y < ty + stats.size; y++) {
    for (let x = tx; x < tx + stats.size; x++) {
      if (!game.isTileOpen(x, y)) return false;
      if (game.units.some(unit => unit.hp > 0 && Math.floor(unit.x / TILE_SIZE) === x && Math.floor(unit.y / TILE_SIZE) === y)) return false;
      if (team === 'player' && requireVision && game.fog && !game.fog.isVisible(x, y)) return false;
    }
  }
  for (let y = ty - 1; y <= ty + stats.size; y++) {
    for (let x = tx - 1; x <= tx + stats.size; x++) {
      if (x >= tx && x < tx + stats.size && y >= ty && y < ty + stats.size) continue;
      if (game.isTileOpen(x, y)) return true;
    }
  }
  return false;
}

export function beginBuilding(game, type, team, tx, ty, worker = null, requireVision = true) {
  const stats = BUILDING_TYPES[type];
  if (!stats || !worker || worker.hp <= 0 || worker.type !== 'worker' || worker.team !== team || !game.canBuild(type, team)) return null;
  if (!canPlaceBuilding(game, type, tx, ty, team, requireVision) || game[team].minerals < stats.cost) return null;
  game[team].minerals -= stats.cost;
  const building = createBuilding(game, type, team, tx, ty, false);
  game.orderBuild(worker, building);
  return building;
}

export function queueUnit(game, building, type) {
  const stats = UNIT_TYPES[type];
  if (!stats || !building || building.hp <= 0 || building.progress < 1 || !game[building.team]) return false;
  if (!BUILDING_TYPES[building.type].trains.includes(type) || building.queue.length >= 5) return false;
  if (game[building.team].minerals < stats.cost) return false;
  const [used, cap] = game.getSupply(building.team);
  if (used + stats.supply > cap) return false;
  game[building.team].minerals -= stats.cost;
  building.queue.push(type);
  return true;
}

export function queueResearch(game, building, key) {
  const stats = UPGRADES[key];
  if (!stats || !building || building.hp <= 0 || building.progress < 1 || building.research || stats.building !== building.type) return false;
  const team = game[building.team];
  if (!team || team.upgrades[key] >= stats.max) return false;
  // Only one building may research a particular upgrade at once.
  if (game.buildings.some(other => other.team === building.team && other.research?.key === key)) return false;
  const level = team.upgrades[key];
  const cost = stats.cost + stats.costStep * level;
  if (team.minerals < cost) return false;
  team.minerals -= cost;
  const total = stats.seconds + stats.secondsStep * level;
  building.research = { key, total, remaining: total };
  return true;
}

function fireDefence(game, building, dt) {
  const stats = BUILDING_TYPES[building.type];
  building.cooldown = Math.max(0, building.cooldown - dt);
  if (building.cooldown > 0) return;
  let target = null, best = stats.range;
  for (const enemy of game.units) {
    if (enemy.team === building.team || enemy.hp <= 0) continue;
    if (building.team === 'player' && game.fog && !game.fog.isWorldVisible(enemy.x, enemy.y)) continue;
    const distance = Math.hypot(building.x - enemy.x, building.y - enemy.y);
    if (distance < best) { best = distance; target = enemy; }
  }
  if (!target) return;
  building.cooldown = stats.cooldown;
  game.fireProjectile(building, target);
}

export function updateBuildings(game, dt) {
  for (const building of game.buildings) {
    building.hitFlash = Math.max(0, building.hitFlash - dt);
    if (building.hp <= 0 || building.progress < 1) continue;
    if (BUILDING_TYPES[building.type].range) fireDefence(game, building, dt);
    if (building.research) {
      building.research.remaining -= dt;
      if (building.research.remaining <= 0) {
        const key = building.research.key;
        game[building.team].upgrades[key]++;
        building.research = null;
        if (building.team === 'player') {
          game.announce(`${UPGRADES[key].name}: уровень ${game.player.upgrades[key]}`, 'normal');
          game.audio?.play('research');
        }
      }
    }
    if (!building.queue.length) continue;
    const type = building.queue[0];
    building.training += dt;
    if (building.training < UNIT_TYPES[type].trainSeconds) continue;
    const point = game.findSpawnPoint(building);
    if (!point) { building.training = UNIT_TYPES[type].trainSeconds; continue; }
    building.queue.shift();
    building.training = 0;
    const unit = game.spawnUnit(type, building.team, point.x, point.y);
    if (unit && building.rally) {
      if (building.rally.mineralId && type === 'worker') game.orderHarvest(unit, building.rally.mineralId);
      else game.orderMove(unit, building.rally.x, building.rally.y);
    } else if (unit && type === 'worker') game.assignNearestMineral(unit);
    if (building.team === 'player' && unit) {
      game.announce(`${UNIT_TYPES[type].name} готов`, 'normal');
      game.audio?.play('train');
    }
  }
}
