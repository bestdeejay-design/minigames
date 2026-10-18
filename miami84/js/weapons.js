import * as THREE from '../libs/three.module.min.js';
import { CONFIG } from './config.js';
import { createGlowTexture } from './world.js';

export class WeaponSystem {
  constructor(camera, scene, world, particles) {
    this.camera = camera;
    this.scene = scene;
    this.world = world;
    this.particles = particles;
    this.raycaster = new THREE.Raycaster();

    this.weapons = CONFIG.WEAPONS.map((cfg) => ({
      ...cfg,
      clip: cfg.magSize,
      reserve: cfg.startReserve,
    }));
    this.currentIndex = 0;
    this.cooldown = 0;
    this.reloading = false;
    this.reloadTimer = 0;
    this.recoilOffset = 0;
    this.muzzleTimer = 0;
    this.swayTime = 0;
    this._triggerHeldLastFrame = false;

    this._buildViewModel();
  }

  reset() {
    for (let i = 0; i < this.weapons.length; i++) {
      this.weapons[i].clip = CONFIG.WEAPONS[i].magSize;
      this.weapons[i].reserve = CONFIG.WEAPONS[i].startReserve;
    }
    this.currentIndex = 0;
    this.cooldown = 0;
    this.reloading = false;
    this.reloadTimer = 0;
    this.recoilOffset = 0;
    this._updateViewModelMesh();
  }

  get current() {
    return this.weapons[this.currentIndex];
  }

  _buildViewModel() {
    this.holder = new THREE.Group();
    this.holder.position.set(0.28, -0.25, -0.48);
    if (this.camera) {
      this.camera.add(this.holder);
    }

    this.gunModels = [];
    const darkMetal = new THREE.MeshLambertMaterial({ color: 0x1c1e2a });
    const chromeMat = new THREE.MeshLambertMaterial({ color: 0xb8c0ff });
    const handMat = new THREE.MeshLambertMaterial({ color: 0xe0ac69 });

    // 1. Пистолет
    const pistolGroup = new THREE.Group();
    const pBarrel = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.08, 0.34), chromeMat);
    pBarrel.position.set(0, 0.04, -0.08);
    const pGrip = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.16, 0.08), darkMetal);
    pGrip.position.set(0, -0.05, 0.05);
    pGrip.rotation.x = 0.25;
    const pStripe = new THREE.Mesh(
      new THREE.BoxGeometry(0.065, 0.02, 0.3),
      new THREE.MeshBasicMaterial({ color: 0x00f5d4 })
    );
    pStripe.position.set(0, 0.06, -0.08);
    const pHand = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.09, 0.14), handMat);
    pHand.position.set(0, -0.06, 0.08);
    pistolGroup.add(pBarrel, pGrip, pStripe, pHand);
    this.holder.add(pistolGroup);
    this.gunModels.push(pistolGroup);

    // 2. Пистолет-пулемёт (SMG)
    const smgGroup = new THREE.Group();
    const sBody = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.1, 0.44), darkMetal);
    sBody.position.set(0, 0.04, -0.1);
    const sMag = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.22, 0.06), chromeMat);
    sMag.position.set(0, -0.1, -0.12);
    const sNeon = new THREE.Mesh(
      new THREE.BoxGeometry(0.08, 0.022, 0.38),
      new THREE.MeshBasicMaterial({ color: 0xff2a85 })
    );
    sNeon.position.set(0, 0.07, -0.1);
    const sHand = new THREE.Mesh(new THREE.BoxGeometry(0.085, 0.09, 0.15), handMat);
    sHand.position.set(0, -0.06, 0.07);
    smgGroup.add(sBody, sMag, sNeon, sHand);
    this.holder.add(smgGroup);
    this.gunModels.push(smgGroup);

    // 3. Дробовик
    const sgGroup = new THREE.Group();
    const sgBarrel = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.07, 0.62), chromeMat);
    sgBarrel.position.set(0, 0.05, -0.18);
    const sgPump = new THREE.Mesh(
      new THREE.BoxGeometry(0.085, 0.065, 0.24),
      new THREE.MeshLambertMaterial({ color: 0x8d5b4c })
    );
    sgPump.position.set(0, 0.01, -0.22);
    const sgNeon = new THREE.Mesh(
      new THREE.BoxGeometry(0.076, 0.02, 0.5),
      new THREE.MeshBasicMaterial({ color: 0xffbe0b })
    );
    sgNeon.position.set(0, 0.075, -0.16);
    const sgHand = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.09, 0.18), handMat);
    sgHand.position.set(0, -0.04, 0.08);
    sgGroup.add(sgBarrel, sgPump, sgNeon, sgHand);
    this.holder.add(sgGroup);
    this.gunModels.push(sgGroup);

    // Вспышка выстрела (muzzle flash)
    this.muzzleFlash = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: createGlowTexture('#ffbe0b'),
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    this.muzzleFlash.position.set(0, 0.05, -0.45);
    this.muzzleFlash.scale.set(0.38, 0.38, 1);
    this.muzzleFlash.visible = false;
    this.holder.add(this.muzzleFlash);

    this._updateViewModelMesh();
  }

  _updateViewModelMesh() {
    for (let i = 0; i < this.gunModels.length; i++) {
      this.gunModels[i].visible = i === this.currentIndex;
    }
  }

  selectWeapon(index) {
    if (index < 0 || index >= this.weapons.length || index === this.currentIndex) return;
    this.currentIndex = index;
    this.reloading = false;
    this.reloadTimer = 0;
    this.cooldown = 0.15;
    this._updateViewModelMesh();
  }

  cycleWeapon(dir = 1) {
    const next = (this.currentIndex + dir + this.weapons.length) % this.weapons.length;
    this.selectWeapon(next);
  }

  addAmmo(weaponId, amount) {
    const w = this.weapons.find((item) => item.id === weaponId);
    if (!w || w.infiniteAmmo) return;
    w.reserve = Math.min(w.maxReserve, w.reserve + amount);
  }

  startReload(audio) {
    const w = this.current;
    if (this.reloading) return false;
    if (w.clip >= w.magSize) return false;
    if (!w.infiniteAmmo && w.reserve <= 0) return false;

    this.reloading = true;
    this.reloadTimer = w.reloadTime;
    audio?.playReload();
    return true;
  }

  _finishReload() {
    const w = this.current;
    const needed = w.magSize - w.clip;
    if (w.infiniteAmmo) {
      w.clip = w.magSize;
    } else {
      const take = Math.min(needed, w.reserve);
      w.clip += take;
      w.reserve -= take;
    }
    this.reloading = false;
    this.reloadTimer = 0;
  }

  update(dt, input, player, enemyManager, civilianManager, vehicleManager, wantedSystem, audio) {
    if (!player || player.dead) return;

    // Скрываем оружие в руках, когда игрок сидит в машине
    this.holder.visible = !player.inVehicle;
    if (player.inVehicle) return;

    // Переключение оружия клавишами 1-3 и колёсиком
    if (input.weaponSlotRequested) {
      this.selectWeapon(input.weaponSlotRequested - 1);
      input.weaponSlotRequested = 0;
    }
    if (input.wheelDelta !== 0) {
      this.cycleWeapon(input.wheelDelta > 0 ? 1 : -1);
      input.wheelDelta = 0;
    }

    if (input.reloadPressed) {
      input.reloadPressed = false;
      this.startReload(audio);
    }

    if (this.cooldown > 0) {
      this.cooldown = Math.max(0, this.cooldown - dt);
    }

    if (this.reloading) {
      this.reloadTimer -= dt;
      if (this.reloadTimer <= 0) {
        this._finishReload();
      }
    }

    if (this.muzzleTimer > 0) {
      this.muzzleTimer -= dt;
      if (this.muzzleTimer <= 0) {
        this.muzzleFlash.visible = false;
      }
    }

    // Стрельба
    const w = this.current;
    const wantFire = input.fireDown && (w.automatic || !this._triggerHeldLastFrame || input.fireJustPressed);
    this._triggerHeldLastFrame = input.fireDown;
    input.fireJustPressed = false;

    if (wantFire && !this.reloading && this.cooldown <= 0) {
      if (w.clip > 0) {
        this.fireShot(player, enemyManager, civilianManager, vehicleManager, wantedSystem, audio);
      } else {
        this.startReload(audio);
      }
    }

    // Анимация отдачи, перезарядки и покачивания оружия в руках
    const moveSpeed = Math.hypot(player.vx, player.vz);
    this.swayTime += dt * (moveSpeed > 0.5 ? 8.5 : 1.8);
    this.recoilOffset = Math.max(0, this.recoilOffset - dt * 1.4);

    const swayX = Math.cos(this.swayTime * 0.5) * (moveSpeed > 0.5 ? 0.018 : 0.004);
    const swayY = Math.sin(this.swayTime) * (moveSpeed > 0.5 ? 0.016 : 0.004);
    const reloadDip = this.reloading ? Math.sin((this.reloadTimer / w.reloadTime) * Math.PI) * 0.18 : 0;

    this.holder.position.set(
      0.28 + swayX,
      -0.25 + swayY - reloadDip,
      -0.48 + this.recoilOffset
    );
    this.holder.rotation.x = this.recoilOffset * 1.6 - reloadDip * 2.2;
  }

  fireShot(player, enemyManager, civilianManager, vehicleManager, wantedSystem, audio) {
    const w = this.current;
    w.clip = Math.max(0, w.clip - 1);
    this.cooldown = 1 / w.fireRate;
    this.recoilOffset = Math.min(0.18, this.recoilOffset + w.recoilKick);
    this.muzzleFlash.visible = true;
    this.muzzleTimer = 0.055;

    audio?.playShot(w.id);
    wantedSystem?.reportCrime(CONFIG.WANTED.heatPerShot);
    civilianManager?.notifyGunshot(player.x, player.z);

    // Выброс гильзы и дыма
    const eyeY = player.y + CONFIG.PLAYER.eyeHeight;
    const forwardX = -Math.sin(player.yaw) * Math.cos(player.pitch);
    const forwardY = Math.sin(player.pitch);
    const forwardZ = -Math.cos(player.yaw) * Math.cos(player.pitch);
    const rightX = Math.cos(player.yaw);
    const rightZ = -Math.sin(player.yaw);

    this.particles?.spawnShell(
      player.x + forwardX * 0.5 + rightX * 0.25,
      eyeY - 0.15,
      player.z + forwardZ * 0.5 + rightZ * 0.25,
      rightX,
      rightZ
    );
    this.particles?.spawnSmoke(
      player.x + forwardX * 0.8,
      eyeY - 0.08,
      player.z + forwardZ * 0.8,
      1
    );

    const origin = new THREE.Vector3(player.x, eyeY, player.z);
    let hitsCount = 0;

    for (let p = 0; p < w.pellets; p++) {
      const spreadYaw = player.yaw + (Math.random() - 0.5) * w.spread * 2;
      const spreadPitch = player.pitch + (Math.random() - 0.5) * w.spread * 2;

      const dir = new THREE.Vector3(
        -Math.sin(spreadYaw) * Math.cos(spreadPitch),
        Math.sin(spreadPitch),
        -Math.cos(spreadYaw) * Math.cos(spreadPitch)
      ).normalize();

      this.raycaster.set(origin, dir);
      this.raycaster.far = w.range;

      // 1. Расстояние до ближайшего препятствия/здания
      let wallDist = w.range;
      let wallPoint = null;
      const worldHits = this.raycaster.intersectObjects(this.world.raycastMeshes, false);
      if (worldHits.length > 0 && worldHits[0].distance < wallDist) {
        wallDist = worldHits[0].distance;
        wallPoint = worldHits[0].point;
      }

      // 2. Попадание по врагам (бандиты, полиция, босс) через Raycaster и цилиндрический хитбокс
      let bestTarget = null;
      let bestDist = wallDist;

      if (enemyManager) {
        for (const enemy of enemyManager.enemies) {
          if (enemy.dead) continue;
          let hitDist = this._rayCylinderHit(origin, dir, enemy.x, enemy.y, enemy.z, 0.65, 1.9);
          if (hitDist === null && enemy.mesh) {
            const meshHits = this.raycaster.intersectObject(enemy.mesh, true);
            if (meshHits.length > 0) hitDist = meshHits[0].distance;
          }
          if (hitDist !== null && hitDist < bestDist) {
            bestDist = hitDist;
            bestTarget = { kind: 'enemy', ref: enemy };
          }
        }
      }

      // 3. Попадание по машинам
      if (vehicleManager) {
        for (const car of vehicleManager.vehicles) {
          if (car.exploded || car === player.inVehicle) continue;
          const hitDist = this._rayCylinderHit(origin, dir, car.x, car.y, car.z, 1.85, 1.6);
          if (hitDist !== null && hitDist < bestDist) {
            bestDist = hitDist;
            bestTarget = { kind: 'vehicle', ref: car };
          }
        }
      }

      // 4. Попадание по гражданским NPC (поднимает уровень розыска)
      if (civilianManager) {
        for (const npc of civilianManager.npcs) {
          if (npc.dead) continue;
          const hitDist = this._rayCylinderHit(origin, dir, npc.x, npc.y, npc.z, 0.55, 1.85);
          if (hitDist !== null && hitDist < bestDist) {
            bestDist = hitDist;
            bestTarget = { kind: 'npc', ref: npc };
          }
        }
      }

      const hitX = origin.x + dir.x * bestDist;
      const hitY = origin.y + dir.y * bestDist;
      const hitZ = origin.z + dir.z * bestDist;

      if (bestTarget) {
        hitsCount++;
        if (bestTarget.kind === 'enemy') {
          enemyManager.damageEnemy(bestTarget.ref, w.damage, player, wantedSystem, audio);
          this.particles?.spawnSparks(hitX, hitY, hitZ, 0xff2a85, 5);
        } else if (bestTarget.kind === 'vehicle') {
          vehicleManager.damageVehicle(bestTarget.ref, w.damage, player, enemyManager, audio);
          this.particles?.spawnSparks(hitX, hitY, hitZ, 0xffbe0b, 6);
        } else if (bestTarget.kind === 'npc') {
          bestTarget.ref.dead = true;
          bestTarget.ref.deathTimer = 0;
          wantedSystem?.reportCrime(CONFIG.WANTED.heatPerNpcHit);
          this.particles?.spawnSparks(hitX, hitY, hitZ, 0x00f5d4, 4);
        }
      } else if (wallPoint) {
        this.particles?.spawnSparks(wallPoint.x, wallPoint.y, wallPoint.z, 0x00f5d4, 4);
      }
    }

    if (w.clip === 0) {
      this.startReload(audio);
    }
    return hitsCount;
  }

  _rayCylinderHit(origin, dir, cx, cy, cz, radius, height) {
    const dx = cx - origin.x;
    const dz = cz - origin.z;
    const horizLenSq = dir.x * dir.x + dir.z * dir.z;
    if (horizLenSq < 1e-6) return null;

    const t = (dx * dir.x + dz * dir.z) / horizLenSq;
    if (t < 0.2) return null;

    const px = origin.x + dir.x * t;
    const py = origin.y + dir.y * t;
    const pz = origin.z + dir.z * t;

    const distSq = (px - cx) * (px - cx) + (pz - cz) * (pz - cz);
    if (distSq > radius * radius) return null;
    if (py < cy - 0.2 || py > cy + height + 0.2) return null;

    return t;
  }
}
