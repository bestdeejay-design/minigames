import * as THREE from '../libs/three.module.min.js';
import { CONFIG } from './config.js';
import { loadStorage, saveStorage } from './engine.js';

export class MissionManager {
  constructor(world, enemyManager, vehicleManager, wantedSystem, hud, onCampaignComplete) {
    this.world = world;
    this.scene = world.scene;
    this.enemyManager = enemyManager;
    this.vehicleManager = vehicleManager;
    this.wantedSystem = wantedSystem;
    this.hud = hud;
    this.onCampaignComplete = onCampaignComplete;

    this.currentIndex = 0;
    this.allCompleted = false;
    this.timer = 0;
    this.targetCar = null;
    this.bossEntity = null;
    this.markerPos = { x: 148, z: -20 };
    this.statusText = '';

    this._buildBeaconMesh();
  }

  _buildBeaconMesh() {
    this.beaconGroup = new THREE.Group();
    const beamMat = new THREE.MeshBasicMaterial({
      color: 0xff2a85,
      transparent: true,
      opacity: 0.36,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 2.6, 26, 16, 1, true), beamMat);
    beam.position.y = 13;

    const ringMat = new THREE.MeshBasicMaterial({ color: 0x00f5d4 });
    const ring = new THREE.Mesh(new THREE.CylinderGeometry(3.0, 3.0, 0.28, 20), ringMat);
    ring.position.y = 0.16;

    this.beaconGroup.add(beam, ring);
    this.scene.add(this.beaconGroup);
  }

  startCampaign() {
    this.allCompleted = false;
    this.startMission(0);
  }

  startMission(index) {
    this.currentIndex = index;
    if (index >= CONFIG.MISSIONS.length) {
      this.allCompleted = true;
      this.beaconGroup.visible = false;
      this.wantedSystem?.clearWanted();
      if (this.onCampaignComplete) {
        this.onCampaignComplete();
      }
      return;
    }

    const m = CONFIG.MISSIONS[index];
    this.beaconGroup.visible = true;
    this.targetCar = null;
    this.bossEntity = null;
    this.statusText = '';

    if (m.type === 'reach') {
      this.markerPos = { x: m.target.x, z: m.target.z };
    } else if (m.type === 'clear') {
      this.markerPos = { x: m.target.x, z: m.target.z };
      this.enemyManager.clearByTag('mission2');
      const offsets = [
        { dx: -6, dz: -6, type: 'pistol' },
        { dx: 6, dz: -6, type: 'bat' },
        { dx: -6, dz: 6, type: 'pistol' },
        { dx: 6, dz: 6, type: 'heavy' },
        { dx: 0, dz: -9, type: 'bat' },
        { dx: 2, dz: 9, type: 'pistol' },
      ];
      for (const off of offsets) {
        this.enemyManager.spawnEnemy(off.type, m.target.x + off.dx, m.target.z + off.dz, 'mission2', false);
      }
    } else if (m.type === 'steal_car') {
      this.timer = m.timeLimit;
      this.targetCar = this.vehicleManager.spawnVehicle({
        x: m.carSpawn.x,
        z: m.carSpawn.z,
        yaw: 0,
        color: 0xffbe0b,
        isTraffic: false,
        isSports: true,
        tag: 'mission3_car',
      });
      this.markerPos = { x: this.targetCar.x, z: this.targetCar.z };
    } else if (m.type === 'survive_wanted') {
      this.timer = m.duration;
      this.wantedSystem.setMinStars(m.minStars);
      this.markerPos = { x: m.target.x, z: m.target.z };
    } else if (m.type === 'boss') {
      this.markerPos = { x: m.target.x, z: m.target.z };
      this.enemyManager.clearByTag('mission5');
      this.bossEntity = this.enemyManager.spawnEnemy('boss', m.target.x, m.target.z, 'mission5', false);
      const guardSpots = [
        { dx: -8, dz: -6, type: 'heavy' },
        { dx: 8, dz: -6, type: 'pistol' },
        { dx: -7, dz: 7, type: 'bat' },
        { dx: 7, dz: 7, type: 'heavy' },
      ];
      for (const g of guardSpots) {
        this.enemyManager.spawnEnemy(g.type, m.target.x + g.dx, m.target.z + g.dz, 'mission5', false);
      }
    }

    this._syncBeacon(0);
    this.hud?.addPopup(m.title, '#00f5d4');
  }

  _syncBeacon(time) {
    const by = this.world.getGroundHeight(this.markerPos.x, this.markerPos.z);
    this.beaconGroup.position.set(this.markerPos.x, by, this.markerPos.z);
    this.beaconGroup.rotation.y = time * 1.5;
  }

  update(dt, time, player, audio) {
    if (this.allCompleted || !player || player.dead) return;

    const m = CONFIG.MISSIONS[this.currentIndex];
    if (!m) return;

    if (m.type === 'reach') {
      const d = Math.hypot(player.x - m.target.x, player.z - m.target.z);
      this.statusText = `Дистанция: ${Math.round(d)} м`;
      if (d <= m.radius) {
        this._completeCurrentMission(player, audio);
        return;
      }
    } else if (m.type === 'clear') {
      const alive = this.enemyManager.enemies.filter((e) => !e.dead && e.tag === 'mission2');
      this.statusText = `Осталось бандитов: ${alive.length} / ${m.enemyCount}`;
      if (alive.length > 0) {
        this.markerPos = { x: alive[0].x, z: alive[0].z };
      }
      if (alive.length === 0) {
        this._completeCurrentMission(player, audio);
        return;
      }
    } else if (m.type === 'steal_car') {
      this.timer -= dt;
      if (!this.targetCar || this.targetCar.exploded || this.timer <= 0) {
        this.hud?.addPopup('ВРЕМЯ ВЫШЛО / МАШИНА РАЗБИТА — ПОВТОР', '#ff2a55');
        this.startMission(this.currentIndex);
        return;
      }

      if (player.inVehicle === this.targetCar) {
        this.markerPos = { x: m.garageTarget.x, z: m.garageTarget.z };
        const d = Math.hypot(this.targetCar.x - m.garageTarget.x, this.targetCar.z - m.garageTarget.z);
        this.statusText = `В гараж порта: ${Math.round(d)} м · Таймер: ${Math.ceil(this.timer)} с`;
        if (d <= m.garageRadius) {
          this._completeCurrentMission(player, audio);
          return;
        }
      } else {
        this.markerPos = { x: this.targetCar.x, z: this.targetCar.z };
        const d = Math.hypot(player.x - this.targetCar.x, player.z - this.targetCar.z);
        this.statusText = `Сядьте в спорткар (E): ${Math.round(d)} м · Таймер: ${Math.ceil(this.timer)} с`;
      }
    } else if (m.type === 'survive_wanted') {
      if (this.wantedSystem.stars < m.minStars) {
        this.wantedSystem.setMinStars(m.minStars);
      }
      this.timer = Math.max(0, this.timer - dt);
      this.markerPos = { x: player.x, z: player.z };
      this.beaconGroup.visible = false;
      this.statusText = `Выживание ★${this.wantedSystem.stars}: осталось ${Math.ceil(this.timer)} с`;
      if (this.timer <= 0) {
        this.wantedSystem.clearWanted();
        this._completeCurrentMission(player, audio);
        return;
      }
    } else if (m.type === 'boss') {
      this.beaconGroup.visible = true;
      const bossAlive = this.bossEntity && !this.bossEntity.dead;
      const guardsAlive = this.enemyManager.enemies.filter((e) => !e.dead && e.tag === 'mission5');
      if (bossAlive) {
        this.markerPos = { x: this.bossEntity.x, z: this.bossEntity.z };
        const pct = Math.max(0, Math.round((this.bossEntity.hp / this.bossEntity.maxHp) * 100));
        this.statusText = `Босс Виктор «Кобра» Кортес: ${pct}% HP`;
      } else if (guardsAlive.length > 0) {
        this.markerPos = { x: guardsAlive[0].x, z: guardsAlive[0].z };
        this.statusText = `Добить охрану доков: ${guardsAlive.length}`;
      } else {
        this._completeCurrentMission(player, audio);
        return;
      }
    }

    this._syncBeacon(time);
  }

  _completeCurrentMission(player, audio) {
    const m = CONFIG.MISSIONS[this.currentIndex];
    player.addCash(m.reward);
    audio?.playMissionComplete();
    this.hud?.addPopup(`МИССИЯ ВЫПОЛНЕНА! +$${m.reward}`, '#ffbe0b');

    const best = loadStorage(CONFIG.STORAGE_KEYS.HIGH_SCORE, 0);
    if (player.cash > best) {
      saveStorage(CONFIG.STORAGE_KEYS.HIGH_SCORE, player.cash);
    }

    this.startMission(this.currentIndex + 1);
  }

  getCurrentMissionInfo() {
    if (this.allCompleted) {
      return {
        title: 'ВСЕ 5 МИССИЙ ВЫПОЛНЕНЫ · СВОБОДНЫЙ РЕЖИМ',
        hint: 'Неон-Бэй под вашим контролем! Исследуйте город или начните новую игру.',
        status: '',
      };
    }
    const m = CONFIG.MISSIONS[this.currentIndex];
    return {
      title: m.title,
      hint: m.hint,
      status: this.statusText,
    };
  }
}
