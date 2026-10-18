import * as THREE from '../libs/three.module.min.js';
import { CONFIG } from './config.js';
import { createHumanoidMesh } from './entities.js';

export class Player {
  constructor(world, camera) {
    this.world = world;
    this.camera = camera;
    this.cash = CONFIG.PLAYER.startCash;
    this.totalEarned = CONFIG.PLAYER.startCash;
    this.kills = 0;

    // Режим камеры: 'fp' (от 1-го лица), 'tp' (от 3-го лица), 'top' (вид сверху в стиле GTA)
    this.cameraModeIndex = 0;
    this.cameraMode = CONFIG.CAMERA_MODES[0].id;
    this.animPhase = 0;

    this._buildPlayerAvatar();
    this.reset(true);
  }

  _buildPlayerAvatar() {
    // 3D-модель главного героя Коди Веги (белый пиджак 80-х поверх бирюзовой футболки)
    this.mesh = createHumanoidMesh({
      shirtColor: 0xf8f9fa,
      innerShirtColor: 0x00f5d4,
      pantsColor: 0xe9ecef,
      hairColor: 0x2b1d14,
      hasGun: true,
    });

    // Неоновое кольцо и луч прицеливания под ногами (для удобства стрельбы от 3-го лица и сверху)
    const ringGeo = new THREE.RingGeometry(0.48, 0.62, 20);
    ringGeo.rotateX(-Math.PI / 2);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x00f5d4,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.75,
    });
    this.footRing = new THREE.Mesh(ringGeo, ringMat);
    this.footRing.position.y = 0.04;
    this.mesh.add(this.footRing);

    const aimGeo = new THREE.PlaneGeometry(0.12, 9.5);
    aimGeo.rotateX(-Math.PI / 2);
    aimGeo.translate(0, 0.06, 5.2);
    this.aimLineMesh = new THREE.Mesh(
      aimGeo,
      new THREE.MeshBasicMaterial({
        color: 0xff2a85,
        transparent: true,
        opacity: 0.55,
        side: THREE.DoubleSide,
      })
    );
    this.mesh.add(this.aimLineMesh);

    this.mesh.visible = false;
    if (this.world && this.world.scene) {
      this.world.scene.add(this.mesh);
    }
  }

  setCameraMode(modeId) {
    const idx = CONFIG.CAMERA_MODES.findIndex((m) => m.id === modeId);
    if (idx === -1) return this.getCameraModeLabel();
    this.cameraModeIndex = idx;
    this.cameraMode = CONFIG.CAMERA_MODES[idx].id;
    if (this.cameraMode === 'top') {
      this.pitch = 0;
    }
    this._updateAvatarVisibility();
    if (this.inVehicle) {
      this._syncCameraInCar(this.inVehicle);
    } else {
      this._syncCamera();
    }
    return this.getCameraModeLabel();
  }

  cycleCameraMode() {
    const nextIdx = (this.cameraModeIndex + 1) % CONFIG.CAMERA_MODES.length;
    return this.setCameraMode(CONFIG.CAMERA_MODES[nextIdx].id);
  }

  getCameraModeLabel() {
    return CONFIG.CAMERA_MODES[this.cameraModeIndex].label;
  }

  _updateAvatarVisibility() {
    if (!this.mesh) return;
    this.mesh.visible = !this.dead && !this.inVehicle && this.cameraMode !== 'fp';
    if (this.aimLineMesh) {
      this.aimLineMesh.visible = this.cameraMode === 'top' || this.cameraMode === 'tp';
    }
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
    this._updateAvatarVisibility();
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
    this._updateAvatarVisibility();
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
      this._updateAvatarVisibility();
    }
  }

  rotateLook(deltaX, deltaY) {
    if (this.dead) return;
    this.yaw -= deltaX * CONFIG.PLAYER.mouseSensitivity;
    if (this.cameraMode === 'top') {
      this.pitch = 0;
    } else {
      this.pitch = Math.max(
        -1.38,
        Math.min(1.38, this.pitch - deltaY * CONFIG.PLAYER.mouseSensitivity)
      );
    }
  }

  update(dt, input, audio) {
    if (this.damageFlash > 0) {
      this.damageFlash = Math.max(0, this.damageFlash - dt * 1.8);
    }
    if (this.dead) return;

    this._updateAvatarVisibility();

    if (this.inVehicle) {
      const car = this.inVehicle;
      this.x = car.x;
      this.z = car.z;
      this.y = car.y;
      this._syncCameraInCar(car);
      return;
    }

    // Движение пешком
    const moveForward =
      (input.keys.KeyW || input.keys.ArrowUp ? 1 : 0) -
      (input.keys.KeyS || input.keys.ArrowDown ? 1 : 0) -
      input.joyY;
    const moveRight =
      (input.keys.KeyD || input.keys.ArrowRight ? 1 : 0) -
      (input.keys.KeyA || input.keys.ArrowLeft ? 1 : 0) +
      input.joyX;

    const isSprinting = Boolean(input.keys.ShiftLeft || input.keys.ShiftRight);
    const topSpeed = isSprinting ? CONFIG.PLAYER.runSpeed : CONFIG.PLAYER.walkSpeed;

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

    // Обновление позиции и анимации 3D-модели игрока (для вида от 3-го лица и сверху)
    if (this.mesh) {
      this.mesh.position.set(this.x, this.y, this.z);
      // Модель смотрит вдоль направления взгляда (-sin(yaw), -cos(yaw))
      this.mesh.rotation.y = Math.PI + this.yaw;

      this.animPhase += dt * (horizSpeed > 0.4 ? horizSpeed * 2.4 : 0);
      const swing = horizSpeed > 0.4 ? Math.sin(this.animPhase) * 0.6 : 0;
      const limbs = this.mesh.userData.limbs;
      if (limbs) {
        limbs.leftLeg.rotation.x = swing;
        limbs.rightLeg.rotation.x = -swing;
        limbs.leftArm.rotation.x = -swing * 0.65;
        limbs.rightArm.rotation.x = -1.35 + this.pitch * 0.6;
      }
    }

    this._syncCamera();
  }

  // Защита камеры от проваливания внутрь зданий в режиме от 3-го лица
  _resolveCameraObstruction(pivotX, pivotY, pivotZ, desiredX, desiredY, desiredZ) {
    const dx = desiredX - pivotX;
    const dy = desiredY - pivotY;
    const dz = desiredZ - pivotZ;
    const dist = Math.hypot(dx, dz);
    if (dist < 0.2) return { x: desiredX, y: desiredY, z: desiredZ };

    const steps = 10;
    for (let s = 1; s <= steps; s++) {
      const t = s / steps;
      const px = pivotX + dx * t;
      const py = pivotY + dy * t;
      const pz = pivotZ + dz * t;
      const list = this.world.spatialGrid.queryRadius(px, pz, 1.2);
      for (let i = 0; i < list.length; i++) {
        const b = list[i];
        if (py < b.maxY && px >= b.minX - 0.35 && px <= b.maxX + 0.35 && pz >= b.minZ - 0.35 && pz <= b.maxZ + 0.35) {
          const safeT = Math.max(0.18, (s - 1) / steps);
          return {
            x: pivotX + dx * safeT,
            y: pivotY + dy * safeT,
            z: pivotZ + dz * safeT,
          };
        }
      }
    }
    return { x: desiredX, y: desiredY, z: desiredZ };
  }

  _syncCamera() {
    if (!this.camera) return;

    if (this.cameraMode === 'fp') {
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
      return;
    }

    if (this.cameraMode === 'tp') {
      // Камера от 3-го лица из-за правого плеча с проверкой стен
      const forwardX = -Math.sin(this.yaw);
      const forwardZ = -Math.cos(this.yaw);
      const rightX = Math.cos(this.yaw);
      const rightZ = -Math.sin(this.yaw);

      const pivotX = this.x + rightX * CONFIG.CAMERA.tpFootShoulder;
      const pivotY = this.y + CONFIG.CAMERA.tpFootHeight;
      const pivotZ = this.z + rightZ * CONFIG.CAMERA.tpFootShoulder;

      const dist = CONFIG.CAMERA.tpFootDist;
      const desiredX = pivotX - forwardX * dist * Math.cos(this.pitch * 0.5);
      const desiredY = Math.max(this.y + 0.65, pivotY - Math.sin(this.pitch * 0.65) * dist * 0.7);
      const desiredZ = pivotZ - forwardZ * dist * Math.cos(this.pitch * 0.5);

      const safe = this._resolveCameraObstruction(this.x, pivotY, this.z, desiredX, desiredY, desiredZ);
      this.camera.position.set(safe.x, safe.y, safe.z);
      this.camera.rotation.order = 'YXZ';
      this.camera.rotation.y = this.yaw;
      this.camera.rotation.x = this.pitch * 0.65 - 0.08;
      this.camera.rotation.z = 0;
      return;
    }

    // Режим 'top' — классический вид сверху как в GTA (камера чуть позади, чтобы игрок был в центре прицела, а впереди открывался обзор улицы)
    const forwardX = -Math.sin(this.yaw);
    const forwardZ = -Math.cos(this.yaw);
    const topH = CONFIG.CAMERA.topFootHeight;
    this.camera.position.set(
      this.x - forwardX * 4.5,
      this.y + topH,
      this.z - forwardZ * 4.5
    );
    this.camera.rotation.order = 'YXZ';
    this.camera.rotation.y = this.yaw;
    this.camera.rotation.x = -Math.PI * 0.46;
    this.camera.rotation.z = 0;
  }

  _syncCameraInCar(car) {
    if (!this.camera) return;
    const forwardX = Math.sin(car.yaw);
    const forwardZ = Math.cos(car.yaw);

    if (this.cameraMode === 'fp') {
      // Вид от первого лица из салона машины
      this.camera.position.set(
        car.x - forwardX * 0.15,
        car.y + 1.32,
        car.z - forwardZ * 0.15
      );
      this.camera.rotation.order = 'YXZ';
      this.camera.rotation.y = Math.PI + car.yaw + this.yaw * 0.35;
      this.camera.rotation.x = this.pitch * 0.5;
      this.camera.rotation.z = -car.steerAngle * 0.04;
      return;
    }

    if (this.cameraMode === 'tp') {
      // Вид от третьего лица позади автомобиля (Chase Cam)
      const viewYaw = Math.PI + car.yaw + this.yaw * 0.45;
      const camFwdX = -Math.sin(viewYaw);
      const camFwdZ = -Math.cos(viewYaw);
      const dist = CONFIG.CAMERA.tpCarDist + Math.min(2.2, car.speed * 0.06);
      const pivotY = car.y + CONFIG.CAMERA.tpCarHeight;

      const desiredX = car.x - camFwdX * dist;
      const desiredY = pivotY;
      const desiredZ = car.z - camFwdZ * dist;
      const safe = this._resolveCameraObstruction(car.x, car.y + 1.5, car.z, desiredX, desiredY, desiredZ);

      this.camera.position.set(safe.x, safe.y, safe.z);
      this.camera.rotation.order = 'YXZ';
      this.camera.rotation.y = viewYaw;
      this.camera.rotation.x = -0.18;
      this.camera.rotation.z = -car.steerAngle * 0.025;
      return;
    }

    // Режим 'top' в машине — классическая камера сверху GTA с отдалением от скорости
    const dynamicH = CONFIG.CAMERA.topCarBaseHeight + Math.abs(car.speed) * CONFIG.CAMERA.topCarSpeedZoom;
    this.camera.position.set(
      car.x - forwardX * 2.5,
      car.y + dynamicH,
      car.z - forwardZ * 2.5
    );
    this.camera.rotation.order = 'YXZ';
    this.camera.rotation.y = Math.PI + car.yaw;
    this.camera.rotation.x = -Math.PI * 0.47;
    this.camera.rotation.z = 0;
  }
}
