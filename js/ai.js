import { BUILDING_TYPES, RULES, TILE_SIZE, UNIT_TYPES, UPGRADES } from './config.js';
import { canPlaceBuilding } from './buildings.js';

const PREFERRED_SITES = {
  barracks: [[46,48],[45,50],[47,45],[55,44],[45,44]],
  house: [[54,45],[46,54],[58,46],[45,57],[55,58],[48,44]],
  turret: [[49,45],[47,52],[55,55],[50,57]],
  workshop: [[57,44],[45,56],[56,57],[44,45]],
};

export class EnemyAI {
  constructor(settings) {
    this.settings = settings;
    this.thinkTimer = .6;
    this.waveTimer = settings.firstWave;
    this.waveNumber = 0;
    this.lastWaveSize = 0;
    this.warned = false;
  }
  update(game, dt) {
    this.thinkTimer -= dt;
    this.waveTimer -= dt;
    if (this.thinkTimer <= 0) {
      this.thinkTimer = RULES.aiThinkSeconds;
      this.decide(game);
    }
    if (!this.warned && this.waveTimer <= RULES.waveWarningSeconds && this.waveTimer > 0) {
      this.warned = true;
      game.announce(`Радар: штурм через ${RULES.waveWarningSeconds} секунд. Подготовьте оборону!`, 'danger');
      game.audio?.play('warning');
    }
    if (this.waveTimer <= 0) this.launchWave(game);
  }
  decide(game) {
    const base = game.buildings.find(b => b.team === 'enemy' && b.type === 'command' && b.hp > 0)
      || game.buildings.find(b => b.team === 'enemy' && b.type === 'outpost' && b.hp > 0);
    if (!base) return;
    const workers = game.units.filter(u => u.team === 'enemy' && u.type === 'worker' && u.hp > 0);
    const barracks = game.buildings.filter(b => b.team === 'enemy' && b.type === 'barracks' && b.hp > 0);
    const houses = game.buildings.filter(b => b.team === 'enemy' && b.type === 'house' && b.hp > 0);
    const workshops = game.buildings.filter(b => b.team === 'enemy' && b.type === 'workshop' && b.hp > 0);
    for (const worker of workers) if (worker.order.kind === 'idle') game.assignNearestMineral(worker);

    // The AI plays the same economy: no free units, buildings or supply.
    if (!barracks.length && game.enemy.minerals >= BUILDING_TYPES.barracks.cost) this.place(game, 'barracks', base, workers);
    const [used, cap] = game.getSupply('enemy');
    if (!houses.some(b => b.progress < 1) && (!houses.length || cap - used <= RULES.aiSupplyMargin)
      && houses.length < RULES.aiHouseLimit && game.enemy.minerals >= BUILDING_TYPES.house.cost) this.place(game, 'house', base, workers);
    if (this.waveNumber >= RULES.aiBarracksAfterWave && barracks.length < RULES.aiBarracksTarget
      && game.enemy.minerals >= BUILDING_TYPES.barracks.cost + RULES.aiBarracksReserve) this.place(game, 'barracks', base, workers);
    if (this.waveNumber >= 1 && !game.buildings.some(b => b.team === 'enemy' && b.type === 'turret' && b.hp > 0)
      && game.enemy.minerals >= BUILDING_TYPES.turret.cost + 120) this.place(game, 'turret', base, workers);
    if (this.waveNumber >= 2 && !workshops.length && game.enemy.minerals >= BUILDING_TYPES.workshop.cost + 200) this.place(game, 'workshop', base, workers);
    if (this.waveNumber >= 3 && workshops.some(b => b.progress >= 1)
      && !game.buildings.some(b => b.team === 'enemy' && b.type === 'outpost' && b.hp > 0)
      && game.enemy.minerals >= BUILDING_TYPES.outpost.cost + 300) this.place(game, 'outpost', base, workers);

    if (workers.length < this.settings.workers && base.queue.length < 1 && game.enemy.minerals >= UNIT_TYPES.worker.cost && cap - used >= 2) game.train(base, 'worker');

    // Late-game technology is bought normally. Raiding the workshop or
    // contesting its mineral income slows both its production and research.
    const lab = workshops.find(b => b.progress >= 1 && !b.research);
    if (lab && this.waveNumber >= 3) {
      const desiredLevel = this.waveNumber >= 5 ? 2 : 1;
      const key = ['weapons','plating'].find(name => game.enemy.upgrades[name] < desiredLevel);
      if (key) {
        const upgrade = UPGRADES[key];
        const cost = upgrade.cost + upgrade.costStep * game.enemy.upgrades[key];
        if (game.enemy.minerals >= cost + 170) game.research(lab, key);
      }
    }

    const combat = game.units.filter(u => u.team === 'enemy' && u.type !== 'worker' && !u.waveAssigned).length;
    const queued = game.buildings.filter(b => b.team === 'enemy').reduce((n,b)=>n+b.queue.filter(type=>type!=='worker').length,0);
    const limit = Math.min(36, this.settings.armyReserve + this.waveNumber * this.settings.armyGrowth);
    if (combat + queued < limit) {
      for (const building of barracks) {
        if (building.progress < 1 || building.queue.length >= RULES.aiQueueTarget) continue;
        const hasScout = game.units.some(u => u.team === 'enemy' && u.type === 'scout' && u.hp > 0)
          || game.buildings.some(b => b.team === 'enemy' && b.queue.includes('scout'));
        const type = !hasScout && game.time > 55 ? 'scout' : 'marine';
        game.train(building, type);
      }
      for (const building of workshops) {
        if (building.progress < 1 || building.queue.length >= 2) continue;
        const hasSupport = game.units.some(u => u.team === 'enemy' && u.type === 'support')
          || game.buildings.some(b => b.team === 'enemy' && b.queue.includes('support'));
        game.train(building, hasSupport ? 'guardian' : 'support');
      }
    }
    this.scoutRelay(game, base);
  }
  scoutRelay(game, base) {
    const scout = game.units.find(u => u.team === 'enemy' && u.type === 'scout' && u.hp > 0 && !u.waveAssigned);
    if (!scout) return;
    const current = game.entities.get(scout.relayMission);
    if (current?.owner === 'enemy') scout.relayMission = null;
    if (scout.relayMission) return;
    const relay = game.relays.filter(r => r.owner !== 'enemy')
      .sort((a,b)=>Math.hypot(a.x-base.x,a.y-base.y)-Math.hypot(b.x-base.x,b.y-base.y))[0];
    if (relay) {
      scout.relayMission = relay.id;
      game.orderMove(scout, relay.x, relay.y);
    }
  }
  place(game, type, base, workers) {
    const candidates = [...(PREFERRED_SITES[type] || [])];
    const cx = type === 'outpost' ? 50 : Math.floor(base.x / TILE_SIZE);
    const cy = type === 'outpost' ? 30 : Math.floor(base.y / TILE_SIZE);
    for (let radius = type === 'outpost' ? 2 : 4; radius <= 11; radius++) {
      for (let dy = -radius; dy <= radius; dy += 2) {
        for (let dx = -radius; dx <= radius; dx += 2) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) === radius) candidates.push([cx + dx, cy + dy]);
        }
      }
    }
    for (const [tx, ty] of candidates) {
      if (!game.canBuild(type, 'enemy') || !canPlaceBuilding(game, type, tx, ty, 'enemy', false)) continue;
      const available = workers.filter(w => w.hp > 0 && w.order.kind !== 'build');
      if (!available.length) return false;
      available.sort((a,b)=>Math.hypot(a.x-tx*TILE_SIZE,a.y-ty*TILE_SIZE)-Math.hypot(b.x-tx*TILE_SIZE,b.y-ty*TILE_SIZE));
      return Boolean(game.place(type, tx, ty, available[0], 'enemy', false));
    }
    return false;
  }
  launchWave(game) {
    const ready = game.units.filter(u => u.team === 'enemy' && ['marine','guardian','support'].includes(u.type) && u.hp > 0 && !u.waveAssigned);
    const desired = Math.min(this.settings.waveCap, this.settings.waveSize + this.waveNumber * this.settings.waveGrowth);
    const required = Math.min(desired, Math.max(2, this.lastWaveSize + 1));
    if (ready.length < required) { this.waveTimer = RULES.waveRetrySeconds; return; }
    const targets = game.buildings.filter(b => b.team === 'player' && b.hp > 0);
    const target = this.waveNumber % 2 ? targets.find(b => b.type === 'outpost') : null;
    const destination = target || targets.find(b => b.type === 'command') || targets[0];
    if (!destination) { this.waveTimer = this.settings.waveInterval; return; }
    const wave = ready.slice(0, Math.min(desired, ready.length));
    wave.forEach((unit, index) => {
      unit.waveAssigned = true;
      const offset = (index - (wave.length - 1) / 2) * TILE_SIZE * .6;
      game.orderAttackMove(unit, destination.x + offset, destination.y + offset * .3);
    });
    this.waveNumber++;
    this.lastWaveSize = wave.length;
    this.waveTimer = this.settings.waveInterval;
    this.warned = false;
    const guards = wave.filter(unit => unit.type === 'guardian').length;
    const mechanics = wave.filter(unit => unit.type === 'support').length;
    const mix = [guards ? `${guards} страж.` : '', mechanics ? `${mechanics} ремонт.` : ''].filter(Boolean).join(' · ');
    game.announce(`Волна ${this.waveNumber}: ${wave.length} роботов${mix ? ` · ${mix}` : ''} идут к базе!`, 'danger');
    game.audio?.play('warning');
  }
}
