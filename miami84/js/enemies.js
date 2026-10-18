import { CONFIG } from './config.js';
import { createHumanoidMesh } from './entities.js';

export class EnemyManager {
  constructor(world, aiController, pickupManager, particles, hud) {
    this.world = world;
    this.scene = world.scene;
    this.ai = aiController;
    this.pickups = pickupManager;
    this.particles = particles;
    this.hud = hud;
    this.enemies = [];
    this._idCounter = 1;
    this._spawnAmbientGangs();
  }

  _spawnAmbientGangs() {
    const spots = [
      { type: 'pistol', x: -20, z: -120 },
      { type: 'bat', x: -26, z: -115 },
      { type: 'heavy', x: -125, z: -60 },
      { type: 'pistol', x: -135, z: 30 },
      { type: 'bat', x: 55, z: 135 },
      { type: 'pistol', x: 45, z: -135 },
    ];
    for (const s of spots) {
      this.spawnEnemy(s.type, s.x, s.z, 'ambient', false);
    }
  }

  spawnEnemy(type = 'pistol', x = 0, z = 0, tag = 'ambient', alerted = false) {
    const cfg = CONFIG.ENEMIES.types[type] || CONFIG.ENEMIES.types.pistol;
    const safePos = this.world.resolveCircleCollision(x, z, 0.65, 0);
    const ex = this.world.isWater(safePos.x, safePos.z) ? CONFIG.SHORE_X - 6 : safePos.x;
    const ez = safePos.z;
    const ey = this.world.getGroundHeight(ex, ez);

    const mesh = createHumanoidMesh({
      shirtColor: cfg.shirtColor,
      pantsColor: cfg.pantsColor,
      scale: cfg.isBoss ? 1.32 : type === 'heavy' ? 1.12 : 1.0,
      hasHat: Boolean(cfg.isPolice || cfg.isBoss),
      hatColor: cfg.isPolice ? 0x1d3557 : 0xf72585,
      hasBat: Boolean(cfg.melee),
      hasGun: !cfg.melee,
      isBoss: Boolean(cfg.isBoss),
    });
    mesh.position.set(ex, ey, ez);
    this.scene.add(mesh);

    const enemy = {
      id: this._idCounter++,
      type,
      tag,
      config: cfg,
      x: ex,
      y: ey,
      z: ez,
      vx: 0,
      vz: 0,
      yaw: 0,
      hp: cfg.hp,
      maxHp: cfg.hp,
      state: alerted ? (cfg.melee ? 'chase' : 'attack') : 'patrol',
      alerted: Boolean(alerted),
      patrolOrigin: { x: ex, z: ez },
      patrolAngle: (this._idCounter * 1.3) % (Math.PI * 2),
      fireTimer: 0.4 + Math.random() * 0.6,
      strafeDir: this._idCounter % 2 === 0 ? 1 : -1,
      strafeTimer: 1.5,
      coverTarget: null,
      animPhase: Math.random() * 6,
      dead: false,
      deathTimer: 0,
      mesh,
    };

    this.enemies.push(enemy);
    return enemy;
  }

  damageEnemy(enemy, amount, player, wantedSystem, audio) {
    if (!enemy || enemy.dead) return;
    enemy.hp -= amount;
    enemy.alerted = true;
    if (enemy.state === 'patrol') {
      enemy.state = enemy.config.melee ? 'chase' : 'attack';
    }

    // Тревога соседним бандитам
    for (const other of this.enemies) {
      if (other.dead || other.alerted) continue;
      if (Math.hypot(other.x - enemy.x, other.z - enemy.z) < 28) {
        other.alerted = true;
        other.state = other.config.melee ? 'chase' : 'attack';
      }
    }

    if (enemy.hp <= 0) {
      enemy.hp = 0;
      enemy.dead = true;
      enemy.deathTimer = 0;
      audio?.playEnemyDown();

      if (player) {
        player.kills++;
        player.addCash(enemy.config.cashReward);
        this.hud?.addPopup(`+$${enemy.config.cashReward}`, '#ffbe0b');
      }

      if (wantedSystem) {
        const heat = enemy.config.isPolice
          ? CONFIG.WANTED.heatPerPoliceKill
          : CONFIG.WANTED.heatPerBanditKill;
        wantedSystem.reportCrime(heat);
      }

      // Выпадение предмета (наличные, патроны или аптечка)
      if (this.pickups) {
        const dropRoll = enemy.id % 3;
        const dropType = dropRoll === 0 ? 'cash' : dropRoll === 1 ? 'ammo' : 'health';
        this.pickups.spawnPickup(dropType, enemy.x, enemy.z, false);
      }
    }
  }

  clearByTag(tag) {
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      if (this.enemies[i].tag === tag) {
        this.scene.remove(this.enemies[i].mesh);
        this.enemies.splice(i, 1);
      }
    }
  }

  reset() {
    for (const e of this.enemies) {
      this.scene.remove(e.mesh);
    }
    this.enemies.length = 0;
    this._spawnAmbientGangs();
  }

  update(dt, player, audio) {
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      if (e.dead) {
        // Анимация падения и исчезновения без крови
        e.deathTimer += dt;
        e.mesh.rotation.x = -Math.min(Math.PI * 0.5, e.deathTimer * 4.5);
        const s = Math.max(0.01, (1 - e.deathTimer * 1.1) * (e.config.isBoss ? 1.32 : 1));
        e.mesh.scale.setScalar(s);
        if (e.deathTimer >= 0.85) {
          this.scene.remove(e.mesh);
          this.enemies.splice(i, 1);
        }
        continue;
      }

      this.ai.updateEnemyAI(e, dt, player, this.particles, audio);

      // Синхронизация меша и анимация конечностей
      e.mesh.position.set(e.x, e.y, e.z);
      e.mesh.rotation.y = e.yaw;

      const spd = Math.hypot(e.vx, e.vz);
      e.animPhase += dt * Math.max(1.5, spd * 2.5);
      const swing = spd > 0.3 ? Math.sin(e.animPhase) * 0.55 : 0;
      const limbs = e.mesh.userData.limbs;
      if (limbs) {
        limbs.leftLeg.rotation.x = swing;
        limbs.rightLeg.rotation.x = -swing;
        limbs.leftArm.rotation.x = -swing * 0.6;
        limbs.rightArm.rotation.x = e.config.melee ? -0.9 + swing * 0.8 : -1.25;
      }
    }

    // Поддержание уличных банд на карте в свободном режиме
    const ambientCount = this.enemies.filter((e) => !e.dead && e.tag === 'ambient').length;
    if (ambientCount < 4 && this.enemies.length < CONFIG.ENEMIES.maxActiveEnemies) {
      const types = ['pistol', 'bat', 'heavy'];
      const t = types[this._idCounter % types.length];
      const angle = (this._idCounter * 2.1) % (Math.PI * 2);
      const px = player ? player.x : 0;
      const pz = player ? player.z : 0;
      const sx = Math.max(-220, Math.min(130, px + Math.cos(angle) * 65));
      const sz = Math.max(-220, Math.min(220, pz + Math.sin(angle) * 65));
      this.spawnEnemy(t, sx, sz, 'ambient', false);
    }
  }
}
