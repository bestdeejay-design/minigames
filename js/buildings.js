import { BUILDING_TYPES, MAP_SIZE, RULES, TILE_SIZE, UNIT_TYPES } from './config.js';
import { tileIndex } from './map.js';

export function createBuilding(game, type, team, tx, ty, complete = true) {
  const stats = BUILDING_TYPES[type];
  const building = {
    id: game.nextId++, kind: 'building', type, team, tx, ty, size: stats.size,
    x: (tx + stats.size / 2) * TILE_SIZE, y: (ty + stats.size / 2) * TILE_SIZE,
    hp: complete ? stats.hp : Math.round(stats.hp * .3), maxHp: stats.hp,
    progress: complete ? 1 : 0, queue: [], training: 0,
    rally: null,
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
  // Require an open tile immediately outside the footprint for the builder.
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
  if (!worker || worker.type !== 'worker' || worker.team !== team || !canPlaceBuilding(game, type, tx, ty, team, requireVision)) return null;
  if (game[team].minerals < stats.cost) return null;
  game[team].minerals -= stats.cost;
  const building = createBuilding(game, type, team, tx, ty, false);
  game.orderBuild(worker, building);
  return building;
}

export function queueUnit(game, building, type) {
  const stats = UNIT_TYPES[type];
  if (!stats || building.progress < 1 || building.team !== 'player' && building.team !== 'enemy') return false;
  if (BUILDING_TYPES[building.type].trains !== type || building.queue.length >= 5) return false;
  if (game[building.team].minerals < stats.cost) return false;
  const [used, cap] = game.getSupply(building.team);
  if (used + stats.supply > cap) return false;
  game[building.team].minerals -= stats.cost;
  building.queue.push(type);
  return true;
}

export function updateBuildings(game, dt) {
  for (const building of game.buildings) {
    if (building.hp <= 0 || building.progress < 1 || !building.queue.length) continue;
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
    if (building.team === 'player') {
      game.announce(`${UNIT_TYPES[type].name} готов`, 'normal');
      game.audio?.play('train');
    }
  }
}
