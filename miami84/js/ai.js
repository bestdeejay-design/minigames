import { CONFIG } from './config.js';

export class AIController {
  constructor(world, coverPoints = []) {
    this.world = world;
    this.coverPoints = coverPoints;
  }

  // Выбор направления обхода препятствий и воды (лучевые «усики» навигации)
  chooseSteerDirection(x, z, targetX, targetZ, stepDist = 2.6) {
    const baseAngle = Math.atan2(targetX - x, targetZ - z);
    const offsets = [0, 0.45, -0.45, 0.95, -0.95, 1.5, -1.5, Math.PI];

    for (const off of offsets) {
      const ang = baseAngle + off;
      const nx = x + Math.sin(ang) * stepDist;
      const nz = z + Math.cos(ang) * stepDist;
      if (this.world.isWater(nx, nz)) continue;
      const col = this.world.resolveCircleCollision(nx, nz, 0.55, 0);
      if (!col.hitWall) {
        return { vx: Math.sin(ang), vz: Math.cos(ang), angle: ang };
      }
    }
    return { vx: -Math.sin(baseAngle), vz: -Math.cos(baseAngle), angle: baseAngle + Math.PI };
  }

  findBestCover(enemyX, enemyZ, playerX, playerZ) {
    let best = null;
    let bestScore = Infinity;
    for (let i = 0; i < this.coverPoints.length; i++) {
      const cp = this.coverPoints[i];
      const dEnemy = Math.hypot(cp.x - enemyX, cp.z - enemyZ);
      if (dEnemy > CONFIG.ENEMIES.coverSearchRadius) continue;
      const dPlayer = Math.hypot(cp.x - playerX, cp.z - playerZ);
      if (dPlayer < 7 || dPlayer > 36) continue;
      const score = dEnemy + Math.abs(dPlayer - 16) * 0.6;
      if (score < bestScore) {
        bestScore = score;
        best = cp;
      }
    }
    return best;
  }

  updateEnemyAI(enemy, dt, player, particles, audio) {
    if (enemy.dead || !player || player.dead) return;

    const cfg = enemy.config;
    const dx = player.x - enemy.x;
    const dz = player.z - enemy.z;
    const dist = Math.hypot(dx, dz);
    const hasLOS = dist <= CONFIG.ENEMIES.loseSightRange &&
      this.world.hasLineOfSight(enemy.x, enemy.z, player.x, player.z);

    // 1. Обнаружение по дальности или если враг уже потревожен / это полиция
    if (enemy.state === 'patrol') {
      if (enemy.alerted || cfg.isPolice || cfg.isBoss || (dist <= CONFIG.ENEMIES.detectionRange && hasLOS)) {
        enemy.state = cfg.melee ? 'chase' : 'attack';
        enemy.alerted = true;
      }
    }

    // 2. Поведение по состояниям
    let moveX = 0;
    let moveZ = 0;

    if (enemy.state === 'patrol') {
      const wp = enemy.patrolOrigin;
      const tx = wp.x + Math.sin(enemy.patrolAngle) * 7;
      const tz = wp.z + Math.cos(enemy.patrolAngle) * 7;
      if (Math.hypot(tx - enemy.x, tz - enemy.z) < 1.5) {
        enemy.patrolAngle += Math.PI * 0.65;
      }
      const steer = this.chooseSteerDirection(enemy.x, enemy.z, tx, tz, 2.0);
      moveX = steer.vx * cfg.speed * 0.55;
      moveZ = steer.vz * cfg.speed * 0.55;
      enemy.yaw = steer.angle;
    } else {
      // Враг в бою
      enemy.yaw = Math.atan2(dx, dz);

      if (cfg.melee) {
        // Бегущий с битой стремительно сближается
        if (dist > cfg.attackRange * 0.8) {
          const steer = this.chooseSteerDirection(enemy.x, enemy.z, player.x, player.z, 2.4);
          moveX = steer.vx * cfg.speed;
          moveZ = steer.vz * cfg.speed;
          enemy.yaw = steer.angle;
        }
      } else {
        // Стрелок: использует укрытие или держит дистанцию
        if (!enemy.coverTarget && enemy.hp < enemy.maxHp * 0.7 && Math.random() < 0.04) {
          enemy.coverTarget = this.findBestCover(enemy.x, enemy.z, player.x, player.z);
        }

        if (enemy.coverTarget) {
          const cd = Math.hypot(enemy.coverTarget.x - enemy.x, enemy.coverTarget.z - enemy.z);
          if (cd > 1.2) {
            const steer = this.chooseSteerDirection(enemy.x, enemy.z, enemy.coverTarget.x, enemy.coverTarget.z, 2.4);
            moveX = steer.vx * cfg.speed;
            moveZ = steer.vz * cfg.speed;
          } else {
            enemy.coverTarget = null;
          }
        } else if (!hasLOS || dist > cfg.attackRange * 0.88) {
          const steer = this.chooseSteerDirection(enemy.x, enemy.z, player.x, player.z, 2.6);
          moveX = steer.vx * cfg.speed;
          moveZ = steer.vz * cfg.speed;
        } else if (dist < cfg.preferredDist * 0.65) {
          // Отход назад, если игрок слишком близко
          const steer = this.chooseSteerDirection(enemy.x, enemy.z, enemy.x - dx, enemy.z - dz, 2.0);
          moveX = steer.vx * cfg.speed * 0.75;
          moveZ = steer.vz * cfg.speed * 0.75;
        } else {
          // Стрейф в сторону
          enemy.strafeTimer -= dt;
          if (enemy.strafeTimer <= 0) {
            enemy.strafeDir = -enemy.strafeDir;
            enemy.strafeTimer = 1.4 + Math.random() * 1.2;
          }
          const perpX = Math.cos(enemy.yaw) * enemy.strafeDir;
          const perpZ = -Math.sin(enemy.yaw) * enemy.strafeDir;
          moveX = perpX * cfg.speed * 0.55;
          moveZ = perpZ * cfg.speed * 0.55;
        }
      }

      // Стрельба / удар битой
      enemy.fireTimer -= dt;
      if (enemy.fireTimer <= 0 && dist <= cfg.attackRange && (hasLOS || cfg.melee)) {
        enemy.fireTimer = cfg.fireInterval * (0.85 + Math.random() * 0.3);
        this._performAttack(enemy, player, dist, particles, audio);
      }
    }

    // Применение движения с проверкой коллизий и запретом входа в воду
    const nextX = enemy.x + moveX * dt;
    const nextZ = enemy.z + moveZ * dt;
    const col = this.world.resolveCircleCollision(nextX, nextZ, 0.52, enemy.y);
    if (!this.world.isWater(col.x, col.z)) {
      enemy.x = col.x;
      enemy.z = col.z;
    }
    enemy.y = this.world.getGroundHeight(enemy.x, enemy.z);
    enemy.vx = moveX;
    enemy.vz = moveZ;
  }

  _performAttack(enemy, player, dist, particles, audio) {
    const cfg = enemy.config;
    if (cfg.melee) {
      if (dist <= cfg.attackRange + 0.5) {
        if (player.inVehicle) {
          player.inVehicle.hp = Math.max(0, player.inVehicle.hp - cfg.damage);
        } else {
          player.takeDamage(cfg.damage, audio);
        }
      }
      return;
    }

    // Выстрел с неточностью
    audio?.playEnemyShot();
    particles?.spawnSparks(
      enemy.x + Math.sin(enemy.yaw) * 0.5,
      enemy.y + 1.25,
      enemy.z + Math.cos(enemy.yaw) * 0.5,
      0xffbe0b,
      2
    );

    const pellets = cfg.pellets || 1;
    for (let i = 0; i < pellets; i++) {
      const err = (Math.random() - 0.5) * 2 * cfg.inaccuracy;
      const hitChance = Math.max(0.18, 1 - (dist / (cfg.attackRange * 1.25)) - Math.abs(err) * 2.5);
      if (Math.random() < hitChance) {
        if (player.inVehicle) {
          player.inVehicle.hp = Math.max(0, player.inVehicle.hp - cfg.damage);
        } else {
          player.takeDamage(cfg.damage, audio);
        }
      }
    }
  }
}
