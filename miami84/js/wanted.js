import { CONFIG } from './config.js';

export class WantedSystem {
  constructor(world, enemyManager, vehicleManager, hud) {
    this.world = world;
    this.enemyManager = enemyManager;
    this.vehicleManager = vehicleManager;
    this.hud = hud;
    this.reset();
  }

  reset() {
    this.heat = 0;
    this.stars = 0;
    this.minStarsLock = 0;
    this.timeSinceCrime = 0;
    this.spawnTimer = 2.0;
  }

  reportCrime(amount) {
    if (amount <= 0) return;
    const prevStars = this.stars;
    this.heat = Math.min(1150, this.heat + amount);
    this.timeSinceCrime = 0;
    this._recalcStars();
    if (this.stars > prevStars) {
      this.hud?.addPopup(`РОЗЫСК ★${this.stars}`, '#00bbf9');
    }
  }

  setMinStars(minStars) {
    this.minStarsLock = Math.max(0, Math.min(CONFIG.WANTED.maxStars, minStars));
    if (this.minStarsLock > 0) {
      const targetHeat = CONFIG.WANTED.thresholds[this.minStarsLock];
      if (this.heat < targetHeat) {
        this.heat = targetHeat + 15;
      }
    }
    this._recalcStars();
  }

  clearWanted() {
    this.minStarsLock = 0;
    this.heat = 0;
    this.stars = 0;
    this.timeSinceCrime = 0;
    this.enemyManager?.clearByTag('police');
  }

  _recalcStars() {
    const t = CONFIG.WANTED.thresholds;
    let s = 0;
    for (let i = 1; i < t.length; i++) {
      if (this.heat >= t[i]) s = i;
    }
    this.stars = Math.max(this.minStarsLock, s);
  }

  update(dt, player, audio) {
    if (!player || player.dead) {
      audio?.setSirenActive(false);
      return;
    }

    this.timeSinceCrime += dt;
    if (this.timeSinceCrime >= CONFIG.WANTED.decayDelay && this.heat > 0) {
      const minHeat = this.minStarsLock > 0 ? CONFIG.WANTED.thresholds[this.minStarsLock] + 5 : 0;
      this.heat = Math.max(minHeat, this.heat - CONFIG.WANTED.decayRate * dt);
      this._recalcStars();
    }

    audio?.setSirenActive(this.stars >= 3);

    if (this.stars === 0) return;

    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      this.spawnTimer = Math.max(2.2, CONFIG.WANTED.spawnIntervalBase - this.stars * 0.6);
      this._spawnPoliceWave(player);
    }
  }

  _spawnPoliceWave(player) {
    if (!this.enemyManager) return;

    const activePolice = this.enemyManager.enemies.filter(
      (e) => !e.dead && e.config.isPolice
    ).length;
    const maxFoot = CONFIG.WANTED.maxPoliceFoot[this.stars] || 0;

    if (activePolice < maxFoot) {
      const angle = Math.random() * Math.PI * 2;
      const dist = 28 + Math.random() * 14;
      const sx = Math.min(CONFIG.SHORE_X - 8, player.x + Math.cos(angle) * dist);
      const sz = player.z + Math.sin(angle) * dist;
      const unitType = this.stars >= 3 && Math.random() > 0.4 ? 'swat' : 'police';
      this.enemyManager.spawnEnemy(unitType, sx, sz, 'police', true);
    }

    // На 3+ звёздах вызываются патрульные машины с мигалками
    if (this.stars >= 3 && this.vehicleManager) {
      const activeCruisers = this.vehicleManager.vehicles.filter(
        (c) => !c.exploded && c.isPolice && !c.driver
      ).length;
      const maxCars = CONFIG.WANTED.maxPoliceCars[this.stars] || 0;
      if (activeCruisers < maxCars) {
        const angle = Math.random() * Math.PI * 2;
        const cx = Math.min(CONFIG.SHORE_X - 12, player.x + Math.cos(angle) * 44);
        const cz = player.z + Math.sin(angle) * 44;
        const col = this.world.resolveCircleCollision(cx, cz, 1.8, 0);
        if (!this.world.isWater(col.x, col.z)) {
          this.vehicleManager.spawnVehicle({
            x: col.x,
            z: col.z,
            yaw: Math.atan2(player.x - col.x, player.z - col.z),
            isPolice: true,
            isTraffic: false,
            tag: 'police_car',
          });
        }
      }
    }
  }
}
