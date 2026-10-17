import { BUILDING_TYPES, RULES, TILE_SIZE, UNIT_TYPES } from './config.js';
import { canPlaceBuilding } from './buildings.js';

const PREFERRED_SITES = {
  barracks: [[46,48],[45,50],[47,45],[55,44],[45,44]],
  house: [[54,45],[46,54],[58,46],[45,57],[55,58],[48,44]],
};

export class EnemyAI {
  constructor() {
    this.thinkTimer = .6;
    this.waveTimer = RULES.firstWaveSeconds;
    this.waveNumber = 0;
    this.lastWaveSize = 0;
  }
  update(game, dt) {
    this.thinkTimer -= dt;
    this.waveTimer -= dt;
    if (this.thinkTimer <= 0) {
      this.thinkTimer = RULES.aiThinkSeconds;
      this.decide(game);
    }
    if (this.waveTimer <= 0) this.launchWave(game);
  }
  decide(game) {
    const base = game.buildings.find(b => b.team === 'enemy' && b.type === 'command' && b.hp > 0);
    if (!base) return;
    const workers = game.units.filter(u => u.team === 'enemy' && u.type === 'worker' && u.hp > 0);
    const barracks = game.buildings.filter(b => b.team === 'enemy' && b.type === 'barracks' && b.hp > 0);
    const houses = game.buildings.filter(b => b.team === 'enemy' && b.type === 'house' && b.hp > 0);
    for (const worker of workers) if (worker.order.kind === 'idle') game.assignNearestMineral(worker);

    // Every purchase uses the same mineral and supply rules as the player.
    if (!barracks.length && game.enemy.minerals >= BUILDING_TYPES.barracks.cost) this.place(game, 'barracks', base, workers);
    const [used, cap] = game.getSupply('enemy');
    if (!houses.some(b => b.progress < 1) && (!houses.length || cap - used <= RULES.aiSupplyMargin) && houses.length < RULES.aiHouseLimit && game.enemy.minerals >= BUILDING_TYPES.house.cost) this.place(game, 'house', base, workers);
    if (this.waveNumber >= RULES.aiBarracksAfterWave && barracks.length < RULES.aiBarracksTarget && game.enemy.minerals >= BUILDING_TYPES.barracks.cost + RULES.aiBarracksReserve) this.place(game, 'barracks', base, workers);

    if (workers.length < RULES.aiWorkerTarget && base.queue.length < 1 && game.enemy.minerals >= UNIT_TYPES.worker.cost && cap - used >= 2) game.train(base, 'worker');
    for (const building of barracks) {
      if (building.progress < 1 || building.queue.length >= RULES.aiQueueTarget) continue;
      if (game.enemy.minerals >= UNIT_TYPES.marine.cost) game.train(building, 'marine');
    }
  }
  place(game, type, base, workers) {
    const candidates = [...PREFERRED_SITES[type]];
    for (let radius = 4; radius <= 11; radius++) {
      for (let dy = -radius; dy <= radius; dy += 2) {
        for (let dx = -radius; dx <= radius; dx += 2) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) === radius) candidates.push([Math.floor(base.x / TILE_SIZE) + dx, Math.floor(base.y / TILE_SIZE) + dy]);
        }
      }
    }
    for (const [tx, ty] of candidates) {
      if (!canPlaceBuilding(game, type, tx, ty, 'enemy', false)) continue;
      const available = workers.filter(w => w.hp > 0 && w.order.kind !== 'build');
      if (!available.length) return false;
      available.sort((a,b)=>Math.hypot(a.x-tx*TILE_SIZE,a.y-ty*TILE_SIZE)-Math.hypot(b.x-tx*TILE_SIZE,b.y-ty*TILE_SIZE));
      return Boolean(game.place(type, tx, ty, available[0], 'enemy', false));
    }
    return false;
  }
  launchWave(game) {
    const ready = game.units.filter(u => u.team === 'enemy' && u.type === 'marine' && u.hp > 0 && !u.waveAssigned);
    const required = Math.max(2, this.lastWaveSize + 1);
    if (ready.length < required) { this.waveTimer = RULES.waveRetrySeconds; return; }
    const target = game.buildings.find(b => b.team === 'player' && b.type === 'command' && b.hp > 0)
      || game.buildings.find(b => b.team === 'player' && b.hp > 0);
    if (!target) { this.waveTimer = RULES.waveIntervalSeconds; return; }
    const count = Math.min(ready.length, RULES.firstWaveSize + this.waveNumber * RULES.waveGrowth);
    const wave = ready.slice(0, count);
    wave.forEach((unit, index) => {
      unit.waveAssigned = true;
      const offset = (index - (wave.length - 1) / 2) * TILE_SIZE * .6;
      game.orderAttackMove(unit, target.x + offset, target.y + offset * .3);
    });
    this.waveNumber++;
    this.lastWaveSize = wave.length;
    this.waveTimer = RULES.waveIntervalSeconds;
    game.announce(`Волна ${this.waveNumber}: ${wave.length} вражеских штурмовиков!`, 'danger');
    game.audio?.play('error');
  }
}
