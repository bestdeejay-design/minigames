import * as THREE from '../libs/three.module.min.js';
import { CONFIG } from './config.js';

export function createVintageCarMesh(colorHex = 0xff2a85, isPolice = false, isSports = false) {
  const group = new THREE.Group();

  const bodyColor = isPolice ? 0x1d3557 : colorHex;
  const bodyMat = new THREE.MeshPhongMaterial({
    color: bodyColor,
    specular: 0xffffff,
    shininess: 85,
  });
  const roofMat = new THREE.MeshPhongMaterial({
    color: isPolice ? 0xf8f9fa : isSports ? 0x181824 : colorHex,
    specular: 0xdddddd,
    shininess: 65,
  });
  const glassMat = new THREE.MeshPhongMaterial({
    color: 0x72efdd,
    specular: 0xffffff,
    shininess: 110,
    transparent: true,
    opacity: 0.44,
  });
  const darkMat = new THREE.MeshLambertMaterial({ color: 0x151520 });
  const chromeMat = new THREE.MeshPhongMaterial({
    color: 0xd8e2dc,
    specular: 0xffffff,
    shininess: 100,
  });
  const headlightMat = new THREE.MeshBasicMaterial({ color: 0xfff3b0 });
  const taillightMat = new THREE.MeshBasicMaterial({ color: 0xff2a55 });

  // Мягкая тень под кузовом автомобиля
  const shadowGeo = new THREE.PlaneGeometry(2.35, 4.75);
  shadowGeo.rotateX(-Math.PI / 2);
  const shadow = new THREE.Mesh(
    shadowGeo,
    new THREE.MeshBasicMaterial({
      color: 0x05020a,
      transparent: true,
      opacity: 0.48,
      depthWrite: false,
    })
  );
  shadow.position.y = 0.03;
  group.add(shadow);

  // Нижний клиновидный кузов в стиле 80-х
  const chassis = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.64, 4.5), bodyMat);
  chassis.position.y = 0.56;
  group.add(chassis);

  // Передний скошенный капот и бамперы
  const hoodSlope = new THREE.Mesh(new THREE.BoxGeometry(2.02, 0.16, 1.35), bodyMat);
  hoodSlope.position.set(0, 0.88, 1.42);
  hoodSlope.rotation.x = 0.08;
  group.add(hoodSlope);

  const frontBumper = new THREE.Mesh(new THREE.BoxGeometry(2.16, 0.22, 0.22), chromeMat);
  frontBumper.position.set(0, 0.38, 2.28);
  const rearBumper = new THREE.Mesh(new THREE.BoxGeometry(2.16, 0.22, 0.22), chromeMat);
  rearBumper.position.set(0, 0.38, -2.28);
  group.add(frontBumper, rearBumper);

  // Боковые зеркала
  const mirrorL = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.12, 0.14), bodyMat);
  mirrorL.position.set(-1.12, 0.96, 0.62);
  const mirrorR = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.12, 0.14), bodyMat);
  mirrorR.position.set(1.12, 0.96, 0.62);
  group.add(mirrorL, mirrorR);

  // Неоновая боковая полоса
  const stripe = new THREE.Mesh(
    new THREE.BoxGeometry(2.14, 0.1, 4.42),
    new THREE.MeshBasicMaterial({ color: isPolice ? 0x00bbf9 : 0x00f5d4 })
  );
  stripe.position.y = 0.58;
  group.add(stripe);

  // Крыша и стойки (полая кабина, чтобы при виде от 1-го лица из салона был виден руль и капот)
  const roofTop = new THREE.Mesh(new THREE.BoxGeometry(1.78, 0.12, 1.95), roofMat);
  roofTop.position.set(0, 1.56, -0.2);
  group.add(roofTop);

  // Стойки крыши
  const pillarGeo = new THREE.BoxGeometry(0.1, 0.68, 0.1);
  const pillars = [
    [-0.84, 1.22, 0.72],
    [0.84, 1.22, 0.72],
    [-0.84, 1.22, -1.1],
    [0.84, 1.22, -1.1],
  ];
  for (const [px, py, pz] of pillars) {
    const p = new THREE.Mesh(pillarGeo, roofMat);
    p.position.set(px, py, pz);
    group.add(p);
  }

  // Полупрозрачное лобовое стекло
  const windshield = new THREE.Mesh(new THREE.BoxGeometry(1.66, 0.58, 0.06), glassMat);
  windshield.position.set(0, 1.22, 0.75);
  windshield.rotation.x = -0.22;
  group.add(windshield);

  // Салон: приборная панель и руль для камеры от первого лица
  const dash = new THREE.Mesh(new THREE.BoxGeometry(1.72, 0.32, 0.45), darkMat);
  dash.position.set(0, 0.98, 0.55);
  group.add(dash);

  const dashNeon = new THREE.Mesh(
    new THREE.BoxGeometry(1.4, 0.08, 0.05),
    new THREE.MeshBasicMaterial({ color: 0xff2a85 })
  );
  dashNeon.position.set(0, 1.08, 0.32);
  group.add(dashNeon);

  const steeringWheel = new THREE.Mesh(
    new THREE.CylinderGeometry(0.22, 0.22, 0.05, 8),
    new THREE.MeshBasicMaterial({ color: 0x00f5d4 })
  );
  steeringWheel.rotation.x = Math.PI * 0.38;
  steeringWheel.position.set(0.38, 1.12, 0.28);
  group.add(steeringWheel);

  // Спойлер для спорткаров
  if (isSports) {
    const spoiler = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.1, 0.38), bodyMat);
    spoiler.position.set(0, 1.12, -2.05);
    group.add(spoiler);
  }

  // Мигалка для полицейской машины
  let sirenRed = null;
  let sirenBlue = null;
  if (isPolice) {
    sirenRed = new THREE.Mesh(
      new THREE.BoxGeometry(0.45, 0.18, 0.28),
      new THREE.MeshBasicMaterial({ color: 0xff2a55 })
    );
    sirenRed.position.set(-0.28, 1.7, -0.15);
    sirenBlue = new THREE.Mesh(
      new THREE.BoxGeometry(0.45, 0.18, 0.28),
      new THREE.MeshBasicMaterial({ color: 0x00bbf9 })
    );
    sirenBlue.position.set(0.28, 1.7, -0.15);
    group.add(sirenRed, sirenBlue);
  }

  // Фары и задние фонари (машина смотрит вдоль +Z при yaw=0)
  const fL = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.18, 0.1), headlightMat);
  fL.position.set(-0.68, 0.62, 2.26);
  const fR = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.18, 0.1), headlightMat);
  fR.position.set(0.68, 0.62, 2.26);
  const rL = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.18, 0.1), taillightMat);
  rL.position.set(-0.68, 0.62, -2.26);
  const rR = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.18, 0.1), taillightMat);
  rR.position.set(0.68, 0.62, -2.26);
  group.add(fL, fR, rL, rR);

  // 4 колеса
  const wheelGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.26, 8);
  wheelGeo.rotateZ(Math.PI * 0.5);
  const wheelPositions = [
    [-1.02, 0.38, 1.4],
    [1.02, 0.38, 1.4],
    [-1.02, 0.38, -1.4],
    [1.02, 0.38, -1.4],
  ];
  for (const [wx, wy, wz] of wheelPositions) {
    const w = new THREE.Mesh(wheelGeo, darkMat);
    w.position.set(wx, wy, wz);
    group.add(w);
  }

  group.userData = { steeringWheel, sirenRed, sirenBlue, bodyMat };
  return group;
}

export class VehicleManager {
  constructor(world, particles, hud) {
    this.world = world;
    this.scene = world.scene;
    this.particles = particles;
    this.hud = hud;
    this.vehicles = [];
    this._idCounter = 1;
    this._routes = this._buildTrafficRoutes();
    this._spawnInitialVehicles();
  }

  _buildTrafficRoutes() {
    // Замкнутые маршруты по сетке проспектов и улиц (машины едут по кругу)
    return [
      [
        { x: 140, z: -220 },
        { x: 140, z: 230 },
        { x: 50, z: 230 },
        { x: 50, z: -220 },
      ],
      [
        { x: 50, z: -130 },
        { x: -40, z: -130 },
        { x: -40, z: 140 },
        { x: 50, z: 140 },
      ],
      [
        { x: -40, z: -220 },
        { x: -130, z: -220 },
        { x: -130, z: 140 },
        { x: -40, z: 140 },
      ],
      [
        { x: -130, z: -40 },
        { x: -220, z: -40 },
        { x: -220, z: 230 },
        { x: -130, z: 230 },
      ],
    ];
  }

  _spawnInitialVehicles() {
    const colors = CONFIG.COLORS.carColors;

    // 1. Припаркованные винтажные машины вдоль бульвара и кварталов
    const parkedSpots = [
      { x: 131, z: 38, yaw: 0, sports: true },
      { x: 131, z: -12, yaw: 0, sports: false },
      { x: 131, z: -65, yaw: 0, sports: true },
      { x: 131, z: 95, yaw: 0, sports: false },
      { x: 58, z: 25, yaw: Math.PI, sports: false },
      { x: 58, z: -48, yaw: Math.PI, sports: true },
      { x: -32, z: 18, yaw: 0, sports: false },
      { x: -32, z: -95, yaw: 0, sports: true },
      { x: -122, z: 15, yaw: 0, sports: false },
      { x: -122, z: 120, yaw: 0, sports: false },
      { x: -155, z: 165, yaw: Math.PI * 0.5, sports: false },
      { x: -155, z: -135, yaw: Math.PI * 0.5, sports: true },
    ];
    parkedSpots.forEach((p, idx) => {
      this.spawnVehicle({
        x: p.x,
        z: p.z,
        yaw: p.yaw,
        color: colors[idx % colors.length],
        isTraffic: false,
        isSports: p.sports,
      });
    });

    // 2. Ездящий трафик по маршрутам
    for (let i = 0; i < CONFIG.VEHICLES.trafficCount; i++) {
      const routeIdx = i % this._routes.length;
      const route = this._routes[routeIdx];
      const wpIdx = i % route.length;
      const nextWp = route[(wpIdx + 1) % route.length];
      const curWp = route[wpIdx];
      const t = ((i * 0.27) % 0.7) + 0.15;
      const x = curWp.x + (nextWp.x - curWp.x) * t;
      const z = curWp.z + (nextWp.z - curWp.z) * t;
      const yaw = Math.atan2(nextWp.x - curWp.x, nextWp.z - curWp.z);

      this.spawnVehicle({
        x,
        z,
        yaw,
        color: colors[(i + 3) % colors.length],
        isTraffic: true,
        routeIndex: routeIdx,
        waypointIndex: (wpIdx + 1) % route.length,
        isSports: i % 3 === 0,
      });
    }
  }

  spawnVehicle({
    x = 95,
    z = 40,
    yaw = 0,
    color = 0xff2a85,
    isTraffic = false,
    isPolice = false,
    isSports = false,
    routeIndex = 0,
    waypointIndex = 0,
    tag = 'car',
  } = {}) {
    const mesh = createVintageCarMesh(color, isPolice, isSports);
    const y = this.world.getGroundHeight(x, z);
    mesh.position.set(x, y, z);
    mesh.rotation.y = yaw;
    this.scene.add(mesh);

    const car = {
      id: this._idCounter++,
      tag,
      x,
      y,
      z,
      vx: 0,
      vz: 0,
      speed: 0,
      yaw,
      steerAngle: 0,
      hp: CONFIG.VEHICLES.maxHp,
      maxHp: CONFIG.VEHICLES.maxHp,
      isTraffic,
      isPolice,
      isSports,
      routeIndex,
      waypointIndex,
      driver: null,
      exploded: false,
      sirenPhase: 0,
      smokeTimer: 0,
      mesh,
    };
    this.vehicles.push(car);
    return car;
  }

  findNearestInteractableVehicle(player) {
    let best = null;
    let bestDist = CONFIG.PLAYER.interactDistance;
    for (const car of this.vehicles) {
      if (car.exploded) continue;
      const d = Math.hypot(car.x - player.x, car.z - player.z);
      if (d <= bestDist) {
        bestDist = d;
        best = car;
      }
    }
    return best;
  }

  tryToggleVehicle(player, wantedSystem, audio) {
    if (!player || player.dead) return false;

    // Выход из машины
    if (player.inVehicle) {
      const car = player.inVehicle;
      car.driver = null;
      player.inVehicle = null;
      // Ставим игрока сбоку от водительской двери в безопасной точке
      const sideX = car.x - Math.cos(car.yaw) * 2.2;
      const sideZ = car.z + Math.sin(car.yaw) * 2.2;
      const col = this.world.resolveCircleCollision(sideX, sideZ, CONFIG.PLAYER.radius, car.y);
      player.x = col.x;
      player.z = col.z;
      player.y = this.world.getGroundHeight(player.x, player.z);
      player.yaw = Math.PI + car.yaw;
      player.pitch = 0;
      audio?.setEngineSpeed(0, false);
      return true;
    }

    // Посадка в ближайшую машину
    const nearest = this.findNearestInteractableVehicle(player);
    if (!nearest) return false;

    if (nearest.isTraffic || nearest.isPolice) {
      wantedSystem?.reportCrime(CONFIG.WANTED.heatPerCarTheft);
    }
    nearest.isTraffic = false;
    nearest.driver = player;
    player.inVehicle = nearest;
    player.yaw = 0;
    player.pitch = 0;
    this.hud?.addPopup(nearest.isSports ? 'СПОРТКАР GT-84' : 'СЕДАН 80-Х', '#00f5d4');
    return true;
  }

  damageVehicle(car, amount, player, enemyManager, audio) {
    if (!car || car.exploded) return;
    car.hp = Math.max(0, car.hp - amount);
    if (car.hp <= 0) {
      this.explodeVehicle(car, player, enemyManager, audio);
    }
  }

  explodeVehicle(car, player, enemyManager, audio) {
    if (!car || car.exploded) return;
    car.exploded = true;
    car.speed = 0;
    car.vx = 0;
    car.vz = 0;
    if (car.mesh.userData.bodyMat) {
      car.mesh.userData.bodyMat.color.setHex(0x1f1f24);
    }

    this.particles?.spawnExplosion(car.x, car.y, car.z);
    audio?.playExplosion();
    this.hud?.addPopup('ВЗРЫВ МАШИНЫ!', '#ff2a55');

    // Если игрок внутри в момент взрыва — получает серьёзный урон и выбрасывается
    if (player && player.inVehicle === car) {
      car.driver = null;
      player.inVehicle = null;
      player.x = car.x - Math.cos(car.yaw) * 2.5;
      player.z = car.z + Math.sin(car.yaw) * 2.5;
      player.takeDamage(CONFIG.VEHICLES.explosionDamage, audio);
      audio?.setEngineSpeed(0, false);
    } else if (player && !player.dead) {
      const d = Math.hypot(player.x - car.x, player.z - car.z);
      if (d < CONFIG.VEHICLES.explosionRadius) {
        const dmg = Math.round(CONFIG.VEHICLES.explosionDamage * (1 - d / CONFIG.VEHICLES.explosionRadius));
        player.takeDamage(dmg, audio);
      }
    }

    // Урон врагам в радиусе взрыва
    if (enemyManager) {
      for (const e of enemyManager.enemies) {
        if (e.dead) continue;
        const d = Math.hypot(e.x - car.x, e.z - car.z);
        if (d < CONFIG.VEHICLES.explosionRadius) {
          enemyManager.damageEnemy(e, 180, player, null, audio);
        }
      }
    }
  }

  update(dt, input, player, enemyManager, civilianManager, wantedSystem, audio) {
    for (let i = 0; i < this.vehicles.length; i++) {
      const car = this.vehicles[i];
      if (car.exploded) continue;

      // Анимация полицейской мигалки
      if (car.isPolice && car.mesh.userData.sirenRed) {
        car.sirenPhase += dt * 10;
        const redOn = Math.sin(car.sirenPhase) > 0;
        car.mesh.userData.sirenRed.material.color.setHex(redOn ? 0xff2a55 : 0x330011);
        car.mesh.userData.sirenBlue.material.color.setHex(redOn ? 0x002244 : 0x00bbf9);
      }

      // Дым из-под капота при низком HP
      if (car.hp < car.maxHp * 0.4) {
        car.smokeTimer -= dt;
        if (car.smokeTimer <= 0) {
          car.smokeTimer = 0.18;
          this.particles?.spawnSmoke(
            car.x + Math.sin(car.yaw) * 1.6,
            car.y + 0.9,
            car.z + Math.cos(car.yaw) * 1.6,
            1
          );
        }
      }

      if (car.driver === player) {
        this._updatePlayerDriving(car, dt, input, player, enemyManager, audio);
      } else if (car.isPolice) {
        this._updatePoliceCarAI(car, dt, player, enemyManager, audio);
      } else if (car.isTraffic) {
        this._updateTrafficCar(car, dt);
      } else {
        // Припаркованная машина плавно тормозит
        car.vx *= Math.max(0, 1 - dt * 6);
        car.vz *= Math.max(0, 1 - dt * 6);
        car.speed = Math.hypot(car.vx, car.vz);
        car.x += car.vx * dt;
        car.z += car.vz * dt;
      }

      car.y = this.world.getGroundHeight(car.x, car.z);
      car.mesh.position.set(car.x, car.y, car.z);
      car.mesh.rotation.y = car.yaw;
    }

    // Проверка столкновений машин друг с другом и с NPC/врагами
    this._resolveVehicleInteractions(player, enemyManager, civilianManager, wantedSystem, audio);
  }

  _updatePlayerDriving(car, dt, input, player, enemyManager, audio) {
    const throttle = (input.keys.KeyW || input.keys.ArrowUp ? 1 : 0) - Math.min(0, input.joyY);
    const brake = (input.keys.KeyS || input.keys.ArrowDown ? 1 : 0) + Math.max(0, input.joyY);
    const steerInput =
      (input.keys.KeyA || input.keys.ArrowLeft ? 1 : 0) -
      (input.keys.KeyD || input.keys.ArrowRight ? 1 : 0) -
      input.joyX;
    const drifting = Boolean(input.keys.Space || input.jumpPressed);

    const forwardX = Math.sin(car.yaw);
    const forwardZ = Math.cos(car.yaw);
    const rightX = Math.cos(car.yaw);
    const rightZ = -Math.sin(car.yaw);

    let forwardSpeed = car.vx * forwardX + car.vz * forwardZ;
    let lateralSpeed = car.vx * rightX + car.vz * rightZ;

    if (throttle > 0) {
      forwardSpeed += CONFIG.VEHICLES.acceleration * throttle * dt;
    } else if (brake > 0) {
      if (forwardSpeed > 0.5) {
        forwardSpeed -= CONFIG.VEHICLES.brakeDecel * brake * dt;
      } else {
        forwardSpeed -= CONFIG.VEHICLES.acceleration * 0.65 * brake * dt;
      }
    } else {
      const sign = Math.sign(forwardSpeed);
      forwardSpeed = sign * Math.max(0, Math.abs(forwardSpeed) - CONFIG.VEHICLES.friction * dt);
    }

    const topSpd = car.isSports ? CONFIG.VEHICLES.maxSpeed * 1.15 : CONFIG.VEHICLES.maxSpeed;
    forwardSpeed = Math.max(-CONFIG.VEHICLES.reverseMaxSpeed, Math.min(topSpd, forwardSpeed));

    // Руление и дрифт
    car.steerAngle = steerInput * 0.65;
    if (car.mesh.userData.steeringWheel) {
      car.mesh.userData.steeringWheel.rotation.z = car.steerAngle * 1.4;
    }
    if (Math.abs(forwardSpeed) > 0.4) {
      const dirSign = forwardSpeed >= 0 ? 1 : -1;
      const driftBoost = drifting ? 1.32 : 1.0;
      car.yaw += steerInput * CONFIG.VEHICLES.turnRate * driftBoost * dirSign * dt;
    }

    const grip = drifting ? CONFIG.VEHICLES.driftGrip : CONFIG.VEHICLES.normalGrip;
    lateralSpeed *= Math.pow(1 - grip, dt * 10);

    if (drifting && Math.abs(forwardSpeed) > 9 && Math.abs(steerInput) > 0.1) {
      this.particles?.spawnSmoke(car.x - forwardX * 1.8, car.y + 0.2, car.z - forwardZ * 1.8, 1);
    }

    const newFwdX = Math.sin(car.yaw);
    const newFwdZ = Math.cos(car.yaw);
    const newRightX = Math.cos(car.yaw);
    const newRightZ = -Math.sin(car.yaw);

    car.vx = newFwdX * forwardSpeed + newRightX * lateralSpeed;
    car.vz = newFwdZ * forwardSpeed + newRightZ * lateralSpeed;
    car.speed = Math.hypot(car.vx, car.vz);

    const nextX = car.x + car.vx * dt;
    const nextZ = car.z + car.vz * dt;
    const col = this.world.resolveCircleCollision(nextX, nextZ, 1.45, car.y);
    if (col.hitWall) {
      if (car.speed > 10) {
        const crashDmg = (car.speed - 8) * CONFIG.VEHICLES.collisionDamageScale;
        this.damageVehicle(car, crashDmg, player, enemyManager, audio);
        this.particles?.spawnSparks(col.x, car.y + 0.6, col.z, 0xffbe0b, 5);
      }
      car.vx *= 0.35;
      car.vz *= 0.35;
      car.speed = Math.hypot(car.vx, car.vz);
    }
    car.x = col.x;
    car.z = col.z;

    audio?.setEngineSpeed(car.speed, true);
  }

  _updateTrafficCar(car, dt) {
    const route = this._routes[car.routeIndex % this._routes.length];
    const target = route[car.waypointIndex % route.length];
    const dx = target.x - car.x;
    const dz = target.z - car.z;
    const dist = Math.hypot(dx, dz);

    if (dist < 4.5) {
      car.waypointIndex = (car.waypointIndex + 1) % route.length;
    }

    const desiredYaw = Math.atan2(dx, dz);
    car.yaw = desiredYaw;
    const fwdX = Math.sin(car.yaw);
    const fwdZ = Math.cos(car.yaw);

    // Проверка дистанции до впереди идущей машины, чтобы трафик не проходил сквозь друг друга
    let blocked = false;
    for (const other of this.vehicles) {
      if (other === car || other.exploded) continue;
      const ox = other.x - car.x;
      const oz = other.z - car.z;
      const d = Math.hypot(ox, oz);
      if (d < CONFIG.VEHICLES.safeFollowingDistance) {
        const dot = (ox * fwdX + oz * fwdZ) / Math.max(0.01, d);
        if (dot > 0.65) {
          blocked = true;
          break;
        }
      }
    }

    const targetSpd = blocked ? 0 : CONFIG.VEHICLES.trafficSpeed;
    car.speed += (targetSpd - car.speed) * Math.min(1, dt * 6);
    car.vx = fwdX * car.speed;
    car.vz = fwdZ * car.speed;
    car.x += car.vx * dt;
    car.z += car.vz * dt;
  }

  _updatePoliceCarAI(car, dt, player, enemyManager, audio) {
    if (!player || player.dead) return;
    const dx = player.x - car.x;
    const dz = player.z - car.z;
    const dist = Math.hypot(dx, dz);

    if (dist <= 13) {
      // Полицейская машина останавливается рядом и высаживает наряд
      car.speed = 0;
      car.vx = 0;
      car.vz = 0;
      if (!car.deployedOfficers && enemyManager) {
        car.deployedOfficers = true;
        enemyManager.spawnEnemy('swat', car.x + 2.2, car.z, 'police', true);
      }
      return;
    }

    car.yaw = Math.atan2(dx, dz);
    const spd = CONFIG.VEHICLES.trafficSpeed * 1.45;
    const nextX = car.x + Math.sin(car.yaw) * spd * dt;
    const nextZ = car.z + Math.cos(car.yaw) * spd * dt;
    const col = this.world.resolveCircleCollision(nextX, nextZ, 1.45, car.y);
    if (!this.world.isWater(col.x, col.z)) {
      car.x = col.x;
      car.z = col.z;
    }
    car.speed = spd;
  }

  _resolveVehicleInteractions(player, enemyManager, civilianManager, wantedSystem, audio) {
    // 1. Машина против машины (не проходят сквозь друг друга)
    const minSep = 3.1;
    for (let i = 0; i < this.vehicles.length; i++) {
      const a = this.vehicles[i];
      if (a.exploded) continue;
      for (let j = i + 1; j < this.vehicles.length; j++) {
        const b = this.vehicles[j];
        if (b.exploded) continue;
        const dx = b.x - a.x;
        const dz = b.z - a.z;
        const dist = Math.hypot(dx, dz);
        if (dist < minSep && dist > 1e-4) {
          const overlap = (minSep - dist) * 0.5;
          const nx = dx / dist;
          const nz = dz / dist;
          a.x -= nx * overlap;
          a.z -= nz * overlap;
          b.x += nx * overlap;
          b.z += nz * overlap;
          if (a.driver === player && a.speed > 9) {
            this.damageVehicle(b, a.speed * 1.2, player, enemyManager, audio);
            this.particles?.spawnSparks((a.x + b.x) * 0.5, a.y + 0.6, (a.z + b.z) * 0.5, 0xffbe0b, 4);
          }
        }
      }
    }

    // 2. Столкновение машины игрока с бандитами и NPC
    const activeCar = player?.inVehicle;
    if (!activeCar || activeCar.exploded || activeCar.speed < 4.5) return;

    if (enemyManager) {
      for (const e of enemyManager.enemies) {
        if (e.dead) continue;
        if (Math.hypot(e.x - activeCar.x, e.z - activeCar.z) < 2.1) {
          enemyManager.damageEnemy(e, activeCar.speed * 5.5, player, wantedSystem, audio);
          this.particles?.spawnSparks(e.x, e.y + 0.8, e.z, 0xff2a85, 5);
        }
      }
    }

    if (civilianManager) {
      for (const npc of civilianManager.npcs) {
        if (npc.dead) continue;
        if (Math.hypot(npc.x - activeCar.x, npc.z - activeCar.z) < 2.0) {
          npc.dead = true;
          npc.deathTimer = 0;
          wantedSystem?.reportCrime(CONFIG.WANTED.heatPerNpcHit);
          civilianManager.notifyGunshot(activeCar.x, activeCar.z);
        }
      }
    }
  }
}
