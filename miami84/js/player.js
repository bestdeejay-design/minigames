import { CONFIG } from './config.js';

export class Player {
  constructor(world, camera) {
    this.world = world;
    this.camera = camera;
    this.cash = CONFIG.PLAYER.startCash;
    this.totalEarned = CONFIG.PLAYER.startCash;
    this.kills = 0;
    this.reset(true);
  }

  reset(keepCash = false) {
    this.x = CONFIG.PLAYER.startX;
    this.z = CONFIG.PLAYER.startZ;
    this.y = this.world.getGroundHeight(this.x, this.z);
    this.vx = 0;
    this.vy = 0;
    this.vz = 0;
    this.yaw = CONFIG.PLAYER.startYaw;
    this.pitch = 0;
    this.onGround = true;

    this.health = CONFIG.PLAYER.maxHealth;
    this.armor = CONFIG.PLAYER.startArmor;
    if (!keepCash) {
      this.cash = CONFIG.PLAYER.startCash;
      this.totalEarned = CONFIG.PLAYER.startCash;
      this.kills = 0;
    }

    this.dead = false;
    this.inVehicle = null;
    this.headBobTimer = 0;
    this.stepSoundTimer = 0;
    this.damageFlash = 0;
    this._syncCamera();
  }

  respawn() {
    const penalty = Math.min(
      this.cash,
      Math.max(
        CONFIG.PLAYER.deathCashPenalty,
        Math.round(this.cash * CONFIG.PLAYER.deathPenaltyRatio)
      )
    );
    this.cash = Math.max(0, this.cash - penalty);
    this.inVehicle = null;
    this.x = CONFIG.PLAYER.startX;
    this.z = CONFIG.PLAYER.startZ;
    this.y = this.world.getGroundHeight(this.x, this.z);
    this.vx = 0;
    this.vy = 0;
    this.vz = 0;
    this.health = CONFIG.PLAYER.maxHealth;
    this.armor = CONFIG.PLAYER.startArmor;
    this.dead = false;
    this.damageFlash = 0;
    this._syncCamera();
    return penalty;
  }

  addCash(amount) {
    const val = Math.max(0, Math.round(amount));
    this.cash += val;
    this.totalEarned += val;
  }

  heal(amount) {
    this.health = Math.min(CONFIG.PLAYER.maxHealth, this.health + amount);
  }

  addArmor(amount) {
    this.armor = Math.min(CONFIG.PLAYER.maxArmor, this.armor + amount);
  }

  takeDamage(amount, audio) {
    if (this.dead || amount <= 0) return;
    let remaining = amount;
    if (this.armor > 0) {
      const absorbed = Math.min(this.armor, remaining * 0.65);
      this.armor = Math.max(0, Math.round(this.armor - absorbed));
      remaining -= absorbed;
    }
    this.health = Math.max(0, Math.round(this.health - remaining));
    this.damageFlash = 0.45;
    audio?.playHit();
    if (this.health <= 0) {
      this.health = 0;
      this.dead = true;
      if (this.inVehicle) {
        this.inVehicle.driver = null;
        this.inVehicle = null;
      }
    }
  }

  rotateLook(deltaX, deltaY) {
    if (this.dead) return;
    this.yaw -= deltaX * CONFIG.PLAYER.mouseSensitivity;
    this.pitch = Math.max(
      -1.38,
      Math.min(1.38, this.pitch - deltaY * CONFIG.PLAYER.mouseSensitivity)
    );
  }

  update(dt, input, audio) {
    if (this.damageFlash > 0) {
      this.damageFlash = Math.max(0, this.damageFlash - dt * 1.8);
    }
    if (this.dead) return;

    // Если игрок за рулём машины, позиция синхронизируется с машиной
    if (this.inVehicle) {
      const car = this.inVehicle;
      this.x = car.x;
      this.z = car.z;
      this.y = car.y;
      this._syncCameraInCar(car);
      return;
    }

    // Движение пешком (WASD + виртуальный джойстик)
    const moveForward = (input.keys.KeyW || input.keys.ArrowUp ? 1 : 0) -
      (input.keys.KeyS || input.keys.ArrowDown ? 1 : 0) -
      input.joyY;
    const moveRight = (input.keys.KeyD || input.keys.ArrowRight ? 1 : 0) -
      (input.keys.KeyA || input.keys.ArrowLeft ? 1 : 0) +
      input.joyX;

    const isSprinting = Boolean(input.keys.ShiftLeft || input.keys.ShiftRight);
    const topSpeed = isSprinting ? CONFIG.PLAYER.runSpeed : CONFIG.PLAYER.walkSpeed;

    // Вектор взгляда в горизонтальной плоскости (камера смотрит вдоль -Z при yaw=0)
    const forwardX = -Math.sin(this.yaw);
    const forwardZ = -Math.cos(this.yaw);
    const rightX = Math.cos(this.yaw);
    const rightZ = -Math.sin(this.yaw);

    let wishX = forwardX * moveForward + rightX * moveRight;
    let wishZ = forwardZ * moveForward + rightZ * moveRight;
    const wishLen = Math.hypot(wishX, wishZ);
    if (wishLen > 1) {
      wishX /= wishLen;
      wishZ /= wishLen;
    }

    this.vx = wishX * topSpeed;
    this.vz = wishZ * topSpeed;

    // Прыжок и гравитация
    if ((input.keys.Space || input.jumpPressed) && this.onGround) {
      this.vy = CONFIG.PLAYER.jumpSpeed;
      this.onGround = false;
      input.jumpPressed = false;
    }

    this.vy -= CONFIG.GRAVITY * dt;
    this.y += this.vy * dt;

    const nextX = this.x + this.vx * dt;
    const nextZ = this.z + this.vz * dt;
    const col = this.world.resolveCircleCollision(nextX, nextZ, CONFIG.PLAYER.radius, this.y);
    this.x = col.x;
    this.z = col.z;

    const groundY = this.world.getGroundHeight(this.x, this.z);
    if (this.y <= groundY) {
      this.y = groundY;
      this.vy = 0;
      this.onGround = true;
    }

    // Покачивание камеры (head-bob) и звук шагов
    const horizSpeed = Math.hypot(this.vx, this.vz);
    if (this.onGround && horizSpeed > 0.6) {
      const freq = isSprinting ? CONFIG.PLAYER.headBobFrequency * 1.35 : CONFIG.PLAYER.headBobFrequency;
      this.headBobTimer += dt * freq;
      this.stepSoundTimer += dt * (isSprinting ? 2.7 : 1.9);
      if (this.stepSoundTimer >= 1.0) {
        this.stepSoundTimer = 0;
        audio?.playStep();
      }
    } else {
      this.headBobTimer = 0;
    }

    this._syncCamera();
  }

  _syncCamera() {
    if (!this.camera) return;
    const bobOffsetY = Math.sin(this.headBobTimer) * CONFIG.PLAYER.headBobAmplitude;
    const bobOffsetX = Math.cos(this.headBobTimer * 0.5) * CONFIG.PLAYER.headBobAmplitude * 0.45;

    this.camera.position.set(
      this.x + Math.cos(this.yaw) * bobOffsetX,
      this.y + CONFIG.PLAYER.eyeHeight + bobOffsetY,
      this.z - Math.sin(this.yaw) * bobOffsetX
    );
    this.camera.rotation.order = 'YXZ';
    this.camera.rotation.y = this.yaw;
    this.camera.rotation.x = this.pitch;
    this.camera.rotation.z = 0;
  }

  _syncCameraInCar(car) {
    if (!this.camera) return;
    // Вид от первого лица из салона машины
    const forwardX = Math.sin(car.yaw);
    const forwardZ = Math.cos(car.yaw);
    this.camera.position.set(
      car.x - forwardX * 0.15,
      car.y + 1.32,
      car.z - forwardZ * 0.15
    );
    this.camera.rotation.order = 'YXZ';
    // В машине камера поворачивается вместе с кузовом + свободный доворот мыши
    this.camera.rotation.y = Math.PI + car.yaw + this.yaw * 0.35;
    this.camera.rotation.x = this.pitch * 0.5;
    this.camera.rotation.z = -car.steerAngle * 0.04;
  }
}
