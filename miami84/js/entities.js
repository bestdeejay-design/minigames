import * as THREE from '../libs/three.module.min.js';
import { CONFIG } from './config.js';
import { createGlowTexture } from './world.js';

// Фабрика проработанного персонажа (для игрока в виде от 3-го лица / сверху, NPC, бандитов, полиции и босса)
export function createHumanoidMesh({
  shirtColor = 0xff2a85,
  innerShirtColor = 0x00f5d4,
  pantsColor = 0xf8f9fa,
  skinColor = 0xe0ac69,
  hairColor = 0x22181c,
  scale = 1.0,
  hasHat = false,
  hatColor = 0x0d1b2a,
  hasBat = false,
  hasGun = false,
  isBoss = false,
} = {}) {
  const group = new THREE.Group();
  group.scale.setScalar(scale);

  const skinMat = new THREE.MeshLambertMaterial({ color: skinColor });
  const shirtMat = new THREE.MeshLambertMaterial({ color: shirtColor });
  const innerMat = new THREE.MeshLambertMaterial({ color: innerShirtColor });
  const pantsMat = new THREE.MeshLambertMaterial({ color: pantsColor });
  const darkMat = new THREE.MeshBasicMaterial({ color: 0x111118 });
  const shoeMat = new THREE.MeshLambertMaterial({ color: 0xf8f9fa });
  const hairMat = new THREE.MeshLambertMaterial({ color: hairColor });

  // Тень под ногами для реалистичной привязки к земле (особенно в виде от 3-го лица и сверху)
  const shadowGeo = new THREE.CircleGeometry(0.46, 12);
  shadowGeo.rotateX(-Math.PI / 2);
  const shadow = new THREE.Mesh(
    shadowGeo,
    new THREE.MeshBasicMaterial({
      color: 0x06030d,
      transparent: true,
      opacity: 0.42,
      depthWrite: false,
    })
  );
  shadow.position.y = 0.02;
  group.add(shadow);

  // Торс (пиджак 80-х + яркая футболка под ним + ремень)
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.68, 0.32), shirtMat);
  torso.position.y = 1.06;
  group.add(torso);

  const innerTee = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.56, 0.34), innerMat);
  innerTee.position.set(0, 1.08, 0);
  group.add(innerTee);

  const belt = new THREE.Mesh(new THREE.BoxGeometry(0.57, 0.08, 0.33), darkMat);
  belt.position.y = 0.74;
  group.add(belt);

  // Шея и голова + причёска + солнечные очки 80-х
  const neck = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.12, 0.18), skinMat);
  neck.position.y = 1.43;
  group.add(neck);

  const head = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.38, 0.38), skinMat);
  head.position.y = 1.64;
  group.add(head);

  const hair = new THREE.Mesh(new THREE.BoxGeometry(0.41, 0.15, 0.41), hairMat);
  hair.position.set(0, 1.8, -0.01);
  group.add(hair);

  const glasses = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.1, 0.08), darkMat);
  glasses.position.set(0, 1.66, 0.19);
  group.add(glasses);

  if (hasHat || isBoss) {
    const hat = new THREE.Mesh(
      new THREE.BoxGeometry(0.48, 0.14, 0.5),
      new THREE.MeshLambertMaterial({ color: isBoss ? 0xf72585 : hatColor })
    );
    hat.position.set(0, 1.87, 0.02);
    group.add(hat);
  }

  // Ноги с кроссовками
  const legGeo = new THREE.BoxGeometry(0.22, 0.64, 0.24);
  legGeo.translate(0, -0.32, 0);
  const shoeGeo = new THREE.BoxGeometry(0.23, 0.12, 0.32);

  const leftLeg = new THREE.Mesh(legGeo, pantsMat);
  leftLeg.position.set(-0.15, 0.72, 0);
  const leftShoe = new THREE.Mesh(shoeGeo, shoeMat);
  leftShoe.position.set(0, -0.66, 0.04);
  leftLeg.add(leftShoe);

  const rightLeg = new THREE.Mesh(legGeo, pantsMat);
  rightLeg.position.set(0.15, 0.72, 0);
  const rightShoe = new THREE.Mesh(shoeGeo, shoeMat);
  rightShoe.position.set(0, -0.66, 0.04);
  rightLeg.add(rightShoe);
  group.add(leftLeg, rightLeg);

  // Руки с кистями
  const armGeo = new THREE.BoxGeometry(0.18, 0.54, 0.2);
  armGeo.translate(0, -0.25, 0);
  const handGeo = new THREE.BoxGeometry(0.15, 0.14, 0.16);

  const leftArm = new THREE.Mesh(armGeo, shirtMat);
  leftArm.position.set(-0.38, 1.34, 0);
  const leftHand = new THREE.Mesh(handGeo, skinMat);
  leftHand.position.set(0, -0.54, 0);
  leftArm.add(leftHand);

  const rightArm = new THREE.Mesh(armGeo, shirtMat);
  rightArm.position.set(0.38, 1.34, 0);
  const rightHand = new THREE.Mesh(handGeo, skinMat);
  rightHand.position.set(0, -0.54, 0);
  rightArm.add(rightHand);

  group.add(leftArm, rightArm);

  let weaponAttachment = null;
  if (hasBat) {
    const bat = new THREE.Mesh(
      new THREE.CylinderGeometry(0.05, 0.03, 0.85, 6),
      new THREE.MeshBasicMaterial({ color: 0x00f5d4 })
    );
    bat.rotation.x = Math.PI * 0.4;
    bat.position.set(0, -0.55, 0.28);
    rightArm.add(bat);
    weaponAttachment = bat;
  } else if (hasGun) {
    const gun = new THREE.Mesh(
      new THREE.BoxGeometry(0.1, 0.14, 0.45),
      new THREE.MeshLambertMaterial({ color: 0x222634 })
    );
    gun.position.set(0, -0.52, 0.24);
    rightArm.add(gun);
    weaponAttachment = gun;
  }

  group.userData.limbs = { leftLeg, rightLeg, leftArm, rightArm, torso, head, weaponAttachment };
  return group;
}

// Пул частиц: искры попаданий, гильзы, дым и взрывы
export class ParticlePool {
  constructor(scene, maxCount = 120) {
    this.scene = scene;
    this.pool = [];
    const boxGeo = new THREE.BoxGeometry(0.12, 0.12, 0.12);
    for (let i = 0; i < maxCount; i++) {
      const mat = new THREE.MeshBasicMaterial({ color: 0xffbe0b, transparent: true, opacity: 1 });
      const mesh = new THREE.Mesh(boxGeo, mat);
      mesh.visible = false;
      scene.add(mesh);
      this.pool.push({
        mesh,
        active: false,
        vx: 0,
        vy: 0,
        vz: 0,
        life: 0,
        maxLife: 0.5,
        gravity: 12,
        scale: 1,
        isShell: false,
      });
    }
    this._cursor = 0;
  }

  _acquire() {
    for (let i = 0; i < this.pool.length; i++) {
      const idx = (this._cursor + i) % this.pool.length;
      if (!this.pool[idx].active) {
        this._cursor = (idx + 1) % this.pool.length;
        return this.pool[idx];
      }
    }
    const p = this.pool[this._cursor];
    this._cursor = (this._cursor + 1) % this.pool.length;
    return p;
  }

  spawnSparks(x, y, z, color = 0xffbe0b, count = 7) {
    for (let i = 0; i < count; i++) {
      const p = this._acquire();
      p.active = true;
      p.isShell = false;
      p.life = 0;
      p.maxLife = 0.28 + (i % 3) * 0.08;
      p.gravity = 14;
      p.scale = 0.9;
      p.mesh.material.color.setHex(color);
      p.mesh.material.opacity = 1;
      p.mesh.position.set(x, y, z);
      p.mesh.scale.setScalar(0.8);
      p.mesh.visible = true;
      const angle = (i / count) * Math.PI * 2 + Math.random() * 0.5;
      const spd = 2.5 + Math.random() * 4.5;
      p.vx = Math.cos(angle) * spd;
      p.vy = 1.8 + Math.random() * 3.5;
      p.vz = Math.sin(angle) * spd;
    }
  }

  spawnShell(x, y, z, rightX, rightZ) {
    const p = this._acquire();
    p.active = true;
    p.isShell = true;
    p.life = 0;
    p.maxLife = 0.7;
    p.gravity = 18;
    p.mesh.material.color.setHex(0xffd166);
    p.mesh.material.opacity = 1;
    p.mesh.position.set(x, y, z);
    p.mesh.scale.set(0.45, 0.45, 0.9);
    p.mesh.visible = true;
    p.vx = rightX * (2.4 + Math.random() * 1.2);
    p.vy = 2.2 + Math.random() * 1.0;
    p.vz = rightZ * (2.4 + Math.random() * 1.2);
  }

  spawnSmoke(x, y, z, count = 3) {
    for (let i = 0; i < count; i++) {
      const p = this._acquire();
      p.active = true;
      p.isShell = false;
      p.life = 0;
      p.maxLife = 0.45 + Math.random() * 0.25;
      p.gravity = -2.2; // дым поднимается вверх
      p.mesh.material.color.setHex(0xcfd8dc);
      p.mesh.material.opacity = 0.65;
      p.mesh.position.set(x, y, z);
      p.mesh.scale.setScalar(1.3);
      p.mesh.visible = true;
      p.vx = (Math.random() - 0.5) * 1.2;
      p.vy = 0.8 + Math.random() * 1.2;
      p.vz = (Math.random() - 0.5) * 1.2;
    }
  }

  spawnExplosion(x, y, z) {
    this.spawnSparks(x, y + 0.8, z, 0xff2a85, 16);
    this.spawnSparks(x, y + 0.5, z, 0xffbe0b, 16);
    this.spawnSmoke(x, y + 1.0, z, 10);
  }

  // Светящиеся трассеры выстрелов (отлично видны и от 1-го, и от 3-го лица, и сверху)
  spawnTracer(x1, y1, z1, x2, y2, z2, color = 0x00f5d4) {
    const steps = 3;
    for (let i = 1; i <= steps; i++) {
      const t = i / (steps + 1);
      const p = this._acquire();
      p.active = true;
      p.isShell = false;
      p.life = 0;
      p.maxLife = 0.09 + i * 0.02;
      p.gravity = 0;
      p.mesh.material.color.setHex(color);
      p.mesh.material.opacity = 0.9;
      p.mesh.position.set(
        x1 + (x2 - x1) * t,
        y1 + (y2 - y1) * t,
        z1 + (z2 - z1) * t
      );
      p.mesh.scale.setScalar(0.65);
      p.mesh.visible = true;
      p.vx = (x2 - x1) * 2.5;
      p.vy = (y2 - y1) * 2.5;
      p.vz = (z2 - z1) * 2.5;
    }
  }

  update(dt) {
    for (let i = 0; i < this.pool.length; i++) {
      const p = this.pool[i];
      if (!p.active) continue;
      p.life += dt;
      if (p.life >= p.maxLife) {
        p.active = false;
        p.mesh.visible = false;
        continue;
      }
      p.vy -= p.gravity * dt;
      p.mesh.position.x += p.vx * dt;
      p.mesh.position.y += p.vy * dt;
      p.mesh.position.z += p.vz * dt;
      if (p.mesh.position.y < 0.05) {
        p.mesh.position.y = 0.05;
        p.vy = Math.abs(p.vy) * 0.35;
        p.vx *= 0.7;
        p.vz *= 0.7;
      }
      if (p.isShell) {
        p.mesh.rotation.x += dt * 14;
        p.mesh.rotation.z += dt * 11;
      } else {
        p.mesh.material.opacity = Math.max(0, 1 - p.life / p.maxLife);
      }
    }
  }
}

// Подбираемые предметы: аптечки, броня, патроны, наличные (светятся и вращаются)
export class PickupManager {
  constructor(world) {
    this.world = world;
    this.scene = world.scene;
    this.pickups = [];
    this.glowTex = createGlowTexture('#00f5d4');
    this._spawnInitialPickups();
  }

  _spawnInitialPickups() {
    const spots = [
      { x: 102, z: 32, type: 'cash' },
      { x: 140, z: -5, type: 'armor' },
      { x: 95, z: -55, type: 'ammo' },
      { x: 112, z: -85, type: 'health' },
      { x: 50, z: -40, type: 'ammo' },
      { x: -40, z: -25, type: 'health' },
      { x: -40, z: 50, type: 'armor' },
      { x: -130, z: 50, type: 'ammo' },
      { x: -162, z: 175, type: 'health' },
      { x: -150, z: -150, type: 'armor' },
      { x: -155, z: -175, type: 'health' },
      { x: -165, z: -145, type: 'ammo' },
      { x: 140, z: 110, type: 'cash' },
      { x: 50, z: 140, type: 'health' },
    ];
    for (const s of spots) {
      this.spawnPickup(s.type, s.x, s.z, true);
    }
  }

  spawnPickup(type, x, z, permanent = false) {
    const cfg = CONFIG.PICKUPS.types[type] || CONFIG.PICKUPS.types.cash;
    const group = new THREE.Group();
    const y = this.world.getGroundHeight(x, z) + 0.65;
    group.position.set(x, y, z);

    const mat = new THREE.MeshBasicMaterial({ color: cfg.color });
    let mesh;
    if (type === 'health') {
      mesh = new THREE.Group();
      mesh.add(
        new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.2, 0.2), mat),
        new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.65, 0.2), mat)
      );
    } else if (type === 'armor') {
      mesh = new THREE.Mesh(new THREE.OctahedronGeometry(0.42, 0), mat);
    } else if (type === 'ammo') {
      mesh = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.38, 0.42), mat);
    } else {
      mesh = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.18, 0.32), mat);
    }
    group.add(mesh);

    const sprite = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: this.glowTex,
        color: cfg.color,
        transparent: true,
        blending: THREE.AdditiveBlending,
        opacity: 0.7,
        depthWrite: false,
      })
    );
    sprite.scale.set(1.8, 1.8, 1);
    group.add(sprite);

    this.scene.add(group);
    const item = {
      type,
      x,
      z,
      baseY: y,
      group,
      active: true,
      permanent,
      respawnTimer: 0,
    };
    this.pickups.push(item);
    return item;
  }

  update(dt, time, player, weapons, hud, audio) {
    for (let i = this.pickups.length - 1; i >= 0; i--) {
      const p = this.pickups[i];
      if (!p.active) {
        if (p.permanent) {
          p.respawnTimer -= dt;
          if (p.respawnTimer <= 0) {
            p.active = true;
            p.group.visible = true;
          }
        }
        continue;
      }

      p.group.rotation.y += dt * 2.4;
      p.group.position.y = p.baseY + Math.sin(time * 3.5 + i) * 0.14;

      if (!player || player.dead) continue;
      const dist = Math.hypot(player.x - p.x, player.z - p.z);
      if (dist <= CONFIG.PLAYER.pickupDistance) {
        const info = CONFIG.PICKUPS.types[p.type];
        let picked = false;
        if (p.type === 'health' && player.health < CONFIG.PLAYER.maxHealth) {
          player.heal(info.amount);
          hud?.addPopup(`+${info.amount} ЗДОРОВЬЕ`, '#00f5d4');
          picked = true;
        } else if (p.type === 'armor' && player.armor < CONFIG.PLAYER.maxArmor) {
          player.addArmor(info.amount);
          hud?.addPopup(`+${info.amount} БРОНЯ`, '#3a86ff');
          picked = true;
        } else if (p.type === 'ammo' && weapons) {
          weapons.addAmmo('smg', info.smg);
          weapons.addAmmo('shotgun', info.shotgun);
          hud?.addPopup(`+ПАТРОНЫ`, '#ffbe0b');
          picked = true;
        } else if (p.type === 'cash') {
          player.addCash(info.amount);
          hud?.addPopup(`+$${info.amount}`, '#8ac926');
          picked = true;
        }

        if (picked) {
          audio?.playPickup();
          if (p.permanent) {
            p.active = false;
            p.group.visible = false;
            p.respawnTimer = CONFIG.PICKUPS.respawnTime;
          } else {
            this.scene.remove(p.group);
            this.pickups.splice(i, 1);
          }
        }
      }
    }
  }
}

// Гражданские ходячие NPC: гуляют по тротуарам и разбегаются при стрельбе (не более ~30 активных)
export class CivilianManager {
  constructor(world) {
    this.world = world;
    this.scene = world.scene;
    this.npcs = [];
    this._seedCounter = 1;
    this._populateInitial(CONFIG.NPCS.maxActive);
  }

  _nextRand() {
    this._seedCounter = (this._seedCounter * 16807) % 2147483647;
    return (this._seedCounter - 1) / 2147483646;
  }

  _pickSidewalkPos(centerX = 95, centerZ = 0) {
    const avIdx = Math.floor(this._nextRand() * CONFIG.AVENUES_X.length);
    const ax = CONFIG.AVENUES_X[avIdx];
    const side = this._nextRand() > 0.5 ? 1 : -1;
    const x = ax + side * (CONFIG.ROAD_WIDTH * 0.5 + 2.0);
    const z = Math.max(-230, Math.min(230, centerZ + (this._nextRand() - 0.5) * 150));
    return { x, z, dirZ: this._nextRand() > 0.5 ? 1 : -1 };
  }

  _populateInitial(count) {
    const shirts = CONFIG.COLORS.npcShirts;
    const cap = Math.min(count, CONFIG.NPCS.maxActive);
    for (let i = 0; i < cap; i++) {
      const pos = this._pickSidewalkPos(95, 0);
      const shirtColor = shirts[i % shirts.length];
      const mesh = createHumanoidMesh({
        shirtColor,
        pantsColor: i % 2 === 0 ? 0xf8f9fa : 0x2b2d42,
      });
      mesh.position.set(pos.x, 0, pos.z);
      this.scene.add(mesh);
      this.npcs.push({
        x: pos.x,
        y: 0,
        z: pos.z,
        vx: 0,
        vz: pos.dirZ * CONFIG.NPCS.walkSpeed,
        yaw: pos.dirZ > 0 ? 0 : Math.PI,
        panicTimer: 0,
        animPhase: i * 0.9,
        mesh,
        hp: 35,
        dead: false,
        deathTimer: 0,
      });
    }
  }

  notifyGunshot(shotX, shotZ) {
    let panickedCount = 0;
    for (const npc of this.npcs) {
      if (npc.dead) continue;
      const dx = npc.x - shotX;
      const dz = npc.z - shotZ;
      const dist = Math.hypot(dx, dz);
      if (dist <= CONFIG.NPCS.panicRadius) {
        npc.panicTimer = CONFIG.NPCS.panicDuration;
        const len = Math.max(0.1, dist);
        npc.vx = (dx / len) * CONFIG.NPCS.fleeSpeed;
        npc.vz = (dz / len) * CONFIG.NPCS.fleeSpeed;
        npc.yaw = Math.atan2(npc.vx, npc.vz);
        panickedCount++;
      }
    }
    return panickedCount;
  }

  update(dt, player) {
    const px = player ? player.x : 95;
    const pz = player ? player.z : 0;

    for (let i = 0; i < this.npcs.length; i++) {
      const npc = this.npcs[i];
      if (npc.dead) {
        npc.deathTimer += dt;
        npc.mesh.rotation.x = Math.min(Math.PI * 0.5, npc.deathTimer * 4);
        npc.mesh.scale.setScalar(Math.max(0.01, 1 - npc.deathTimer * 0.8));
        if (npc.deathTimer > 1.2) {
          this._respawnNearPlayer(npc, px, pz);
        }
        continue;
      }

      // Перенос далёких NPC поближе к игроку (стриминг по расстоянию)
      const distToPlayer = Math.hypot(npc.x - px, npc.z - pz);
      if (distToPlayer > CONFIG.NPCS.despawnRadius) {
        this._respawnNearPlayer(npc, px, pz);
        continue;
      }

      if (npc.panicTimer > 0) {
        npc.panicTimer -= dt;
        if (npc.panicTimer <= 0) {
          npc.vx = 0;
          npc.vz = (this._nextRand() > 0.5 ? 1 : -1) * CONFIG.NPCS.walkSpeed;
          npc.yaw = npc.vz > 0 ? 0 : Math.PI;
        }
      }

      let nextX = npc.x + npc.vx * dt;
      let nextZ = npc.z + npc.vz * dt;

      // Не заходить в воду и обходить здания
      const col = this.world.resolveCircleCollision(nextX, nextZ, 0.45, 0);
      if (col.hitWall || this.world.isWater(col.x, col.z) || Math.abs(col.z) > 245) {
        npc.vx = -npc.vx;
        npc.vz = -npc.vz;
        if (Math.hypot(npc.vx, npc.vz) < 0.5) {
          npc.vz = CONFIG.NPCS.walkSpeed;
        }
        npc.yaw = Math.atan2(npc.vx, npc.vz);
      } else {
        npc.x = col.x;
        npc.z = col.z;
      }

      npc.y = this.world.getGroundHeight(npc.x, npc.z);
      npc.mesh.position.set(npc.x, npc.y, npc.z);
      npc.mesh.rotation.y = npc.yaw;

      // Анимация рук и ног
      const spd = Math.hypot(npc.vx, npc.vz);
      npc.animPhase += dt * spd * 2.8;
      const swing = Math.sin(npc.animPhase) * 0.55;
      const limbs = npc.mesh.userData.limbs;
      if (limbs) {
        limbs.leftLeg.rotation.x = swing;
        limbs.rightLeg.rotation.x = -swing;
        if (npc.panicTimer > 0) {
          // Поднятые руки при панике
          limbs.leftArm.rotation.x = -2.4 + swing * 0.3;
          limbs.rightArm.rotation.x = -2.4 - swing * 0.3;
        } else {
          limbs.leftArm.rotation.x = -swing * 0.7;
          limbs.rightArm.rotation.x = swing * 0.7;
        }
      }
    }
  }

  _respawnNearPlayer(npc, px, pz) {
    const pos = this._pickSidewalkPos(px, pz);
    npc.x = pos.x;
    npc.z = pos.z;
    npc.y = 0;
    npc.vx = 0;
    npc.vz = pos.dirZ * CONFIG.NPCS.walkSpeed;
    npc.yaw = pos.dirZ > 0 ? 0 : Math.PI;
    npc.panicTimer = 0;
    npc.dead = false;
    npc.deathTimer = 0;
    npc.hp = 35;
    npc.mesh.rotation.set(0, npc.yaw, 0);
    npc.mesh.scale.setScalar(1);
    npc.mesh.position.set(npc.x, 0, npc.z);
  }
}
