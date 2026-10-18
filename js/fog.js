import { BUILDING_TYPES, MAP_SIZE, RULES, TILE_SIZE, UNIT_TYPES } from './config.js';
import { tileIndex, worldToTile } from './map.js';

export class Fog {
  constructor(game) {
    // 0 = never seen, 1 = explored, 2 = currently visible.
    this.cells = new Uint8Array(MAP_SIZE * MAP_SIZE);
    this.timer = 0;
    this.minimapCanvas = document.createElement('canvas');
    this.minimapCanvas.width = MAP_SIZE;
    this.minimapCanvas.height = MAP_SIZE;
    this.mini = this.minimapCanvas.getContext('2d');
    this.recompute(game);
  }
  get(tx, ty) {
    if (tx < 0 || ty < 0 || tx >= MAP_SIZE || ty >= MAP_SIZE) return 0;
    return this.cells[tileIndex(tx, ty)];
  }
  isVisible(tx, ty) { return this.get(tx, ty) === 2; }
  isExplored(tx, ty) { return this.get(tx, ty) > 0; }
  isWorldVisible(x, y) { return this.isVisible(worldToTile(x), worldToTile(y)); }
  update(game, dt) {
    this.timer -= dt;
    if (this.timer <= 0) {
      this.timer = RULES.fogRefreshSeconds;
      this.recompute(game);
    }
  }
  recompute(game) {
    for (let i = 0; i < this.cells.length; i++) if (this.cells[i] === 2) this.cells[i] = 1;
    const reveal = (x, y, radius) => {
      const cx = worldToTile(x), cy = worldToTile(y);
      const r2 = radius * radius;
      for (let ty = Math.max(0, cy - radius); ty <= Math.min(MAP_SIZE - 1, cy + radius); ty++) {
        for (let tx = Math.max(0, cx - radius); tx <= Math.min(MAP_SIZE - 1, cx + radius); tx++) {
          if ((tx - cx) ** 2 + (ty - cy) ** 2 <= r2) this.cells[tileIndex(tx, ty)] = 2;
        }
      }
    };
    for (const building of game.buildings) {
      if (building.team === 'player' && building.hp > 0) reveal(building.x, building.y,
        building.progress < 1 ? Math.max(3, BUILDING_TYPES[building.type].vision - 2) : BUILDING_TYPES[building.type].vision);
    }
    for (const unit of game.units) {
      if (unit.team === 'player' && unit.hp > 0) reveal(unit.x, unit.y, UNIT_TYPES[unit.type].vision);
    }
    for (const relay of game.relays || []) if (relay.owner === 'player') reveal(relay.x, relay.y, RULES.relayVision);
    this.mini.clearRect(0, 0, MAP_SIZE, MAP_SIZE);
    for (let ty = 0; ty < MAP_SIZE; ty++) {
      for (let tx = 0; tx < MAP_SIZE; tx++) {
        const state = this.cells[tileIndex(tx, ty)];
        if (state === 2) continue;
        this.mini.fillStyle = state === 0 ? '#071218' : 'rgba(5,17,24,.70)';
        this.mini.fillRect(tx, ty, 1, 1);
      }
    }
  }
}
