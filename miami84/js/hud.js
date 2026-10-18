import { CONFIG } from './config.js';

export class HUD {
  constructor() {
    this.popups = [];
    this.radarCanvas = typeof document !== 'undefined' ? document.getElementById('radar-canvas') : null;
    this.radarCtx = this.radarCanvas ? this.radarCanvas.getContext('2d') : null;
    this.weaponCanvas = typeof document !== 'undefined' ? document.getElementById('weapon-icon-canvas') : null;
    this.weaponCtx = this.weaponCanvas ? this.weaponCanvas.getContext('2d') : null;
    this._lastWeaponId = null;

    this.els = typeof document !== 'undefined'
      ? {
          cash: document.getElementById('hud-cash'),
          healthBar: document.getElementById('hud-health-bar'),
          healthVal: document.getElementById('hud-health-val'),
          armorBar: document.getElementById('hud-armor-bar'),
          armorVal: document.getElementById('hud-armor-val'),
          stars: document.getElementById('hud-stars'),
          weaponName: document.getElementById('hud-weapon-name'),
          weaponAmmo: document.getElementById('hud-weapon-ammo'),
          missionTitle: document.getElementById('hud-mission-title'),
          missionHint: document.getElementById('hud-mission-hint'),
          missionStatus: document.getElementById('hud-mission-status'),
          interactPrompt: document.getElementById('hud-interact'),
          cameraLabel: document.getElementById('hud-camera-mode'),
          radioLabel: document.getElementById('hud-radio'),
          timeLabel: document.getElementById('hud-time-mode'),
          fpsLabel: document.getElementById('hud-fps'),
          carPanel: document.getElementById('hud-car-panel'),
          carHpBar: document.getElementById('hud-car-hp'),
          carSpeed: document.getElementById('hud-car-speed'),
          damageOverlay: document.getElementById('damage-overlay'),
          popupsContainer: document.getElementById('hud-popups'),
        }
      : {};
  }

  addPopup(text, color = '#00f5d4') {
    this.popups.push({ text, color, life: 2.2 });
    if (this.popups.length > 5) {
      this.popups.shift();
    }
    this._renderPopupsDOM();
  }

  _renderPopupsDOM() {
    if (!this.els.popupsContainer) return;
    this.els.popupsContainer.innerHTML = this.popups
      .map(
        (p) =>
          `<div class="hud-popup-item" style="color:${p.color};text-shadow:0 0 10px ${p.color}">${p.text}</div>`
      )
      .join('');
  }

  update(dt, { player, weapons, enemies, vehicles, wanted, missions, world, audio, engine }) {
    // 1. Всплывающие награды
    let changed = false;
    for (let i = this.popups.length - 1; i >= 0; i--) {
      this.popups[i].life -= dt;
      if (this.popups[i].life <= 0) {
        this.popups.splice(i, 1);
        changed = true;
      }
    }
    if (changed) this._renderPopupsDOM();

    if (!player) return;

    // 2. Деньги, здоровье, броня, звёзды розыска
    if (this.els.cash) {
      this.els.cash.textContent = `$${String(player.cash).padStart(6, '0')}`;
    }
    if (this.els.healthBar) {
      this.els.healthBar.style.width = `${Math.max(0, player.health)}%`;
    }
    if (this.els.healthVal) {
      this.els.healthVal.textContent = `${Math.max(0, player.health)}`;
    }
    if (this.els.armorBar) {
      this.els.armorBar.style.width = `${Math.max(0, player.armor)}%`;
    }
    if (this.els.armorVal) {
      this.els.armorVal.textContent = `${Math.max(0, player.armor)}`;
    }

    if (this.els.stars && wanted) {
      let starsHtml = '';
      for (let i = 1; i <= CONFIG.WANTED.maxStars; i++) {
        const active = i <= wanted.stars;
        starsHtml += `<span class="star ${active ? 'is-active' : ''}">★</span>`;
      }
      this.els.stars.innerHTML = starsHtml;
    }

    // 3. Оружие и патроны
    if (weapons) {
      const w = weapons.current;
      if (this.els.weaponName) {
        this.els.weaponName.textContent = w.name;
      }
      if (this.els.weaponAmmo) {
        const reserveStr = w.infiniteAmmo ? '∞' : String(w.reserve);
        this.els.weaponAmmo.textContent = weapons.reloading
          ? 'ПЕРЕЗАРЯДКА...'
          : `${w.clip} / ${reserveStr}`;
      }
      if (this._lastWeaponId !== w.id) {
        this._lastWeaponId = w.id;
        this._drawWeaponIcon(w.id);
      }
    }

    // 4. Панель машины
    if (this.els.carPanel) {
      if (player.inVehicle) {
        this.els.carPanel.hidden = false;
        const car = player.inVehicle;
        const hpPct = Math.max(0, Math.round((car.hp / car.maxHp) * 100));
        if (this.els.carHpBar) this.els.carHpBar.style.width = `${hpPct}%`;
        if (this.els.carSpeed) {
          this.els.carSpeed.textContent = `${Math.round(car.speed * 3.6)} КМ/Ч`;
        }
      } else {
        this.els.carPanel.hidden = true;
      }
    }

    // 5. Подсказка взаимодействия [E]
    if (this.els.interactPrompt && vehicles) {
      if (player.inVehicle) {
        this.els.interactPrompt.textContent = '[E] ВЫЙТИ ИЗ МАШИНЫ · [ПРОБЕЛ] ДРИФТ';
        this.els.interactPrompt.hidden = false;
      } else {
        const nearCar = vehicles.findNearestInteractableVehicle(player);
        if (nearCar) {
          this.els.interactPrompt.textContent = '[E] СЕСТЬ За РУЛЬ';
          this.els.interactPrompt.hidden = false;
        } else {
          this.els.interactPrompt.hidden = true;
        }
      }
    }

    // 6. Миссия сверху
    if (missions) {
      const info = missions.getCurrentMissionInfo();
      if (this.els.missionTitle) this.els.missionTitle.textContent = info.title;
      if (this.els.missionHint) this.els.missionHint.textContent = info.hint;
      if (this.els.missionStatus) this.els.missionStatus.textContent = info.status || '';
    }

    // 7. Камера, Радио, Закат/Ночь и FPS
    if (this.els.cameraLabel && player) {
      this.els.cameraLabel.textContent = `🎥 ${player.getCameraModeLabel()} [V]`;
    }
    if (this.els.radioLabel && audio) {
      this.els.radioLabel.textContent = `📻 ${audio.getCurrentStationName()} [Q]`;
    }
    if (this.els.timeLabel && world) {
      this.els.timeLabel.textContent = world.isNight ? '🌙 НОЧЬ [N]' : '🌅 ЗАКАТ [N]';
    }
    if (this.els.fpsLabel && engine) {
      this.els.fpsLabel.textContent = `${engine.fps} FPS`;
    }

    if (this.els.damageOverlay) {
      this.els.damageOverlay.style.opacity = String(player.damageFlash.toFixed(2));
    }

    // 8. Вращающийся радар-миникарта
    this._drawRadar(player, enemies, vehicles, missions);
  }

  _drawWeaponIcon(weaponId) {
    const ctx = this.weaponCtx;
    if (!ctx) return;
    ctx.clearRect(0, 0, 120, 48);
    ctx.fillStyle = '#00f5d4';
    ctx.strokeStyle = '#ff2a85';
    ctx.lineWidth = 2;

    if (weaponId === 'pistol') {
      ctx.fillRect(34, 12, 46, 12);
      ctx.fillRect(34, 22, 14, 18);
      ctx.strokeRect(34, 12, 46, 12);
    } else if (weaponId === 'smg') {
      ctx.fillRect(20, 12, 68, 13);
      ctx.fillRect(48, 25, 10, 18);
      ctx.fillRect(24, 25, 12, 14);
      ctx.strokeRect(20, 12, 68, 13);
    } else {
      ctx.fillRect(10, 14, 96, 10);
      ctx.fillRect(42, 24, 28, 7);
      ctx.fillRect(10, 22, 18, 14);
      ctx.strokeRect(10, 14, 96, 10);
    }
  }

  _drawRadar(player, enemies, vehicles, missions) {
    const ctx = this.radarCtx;
    if (!ctx || !this.radarCanvas) return;

    const w = this.radarCanvas.width;
    const h = this.radarCanvas.height;
    const cx = w * 0.5;
    const cy = h * 0.5;
    const radius = cx - 6;
    const scale = 0.55; // пикселей на метр

    ctx.clearRect(0, 0, w, h);

    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.clip();

    // Фон радара — океан вокруг острова
    ctx.fillStyle = 'rgba(3, 52, 92, 0.92)';
    ctx.fillRect(0, 0, w, h);

    // Вращение радара по направлению взгляда игрока (вверх = направление взгляда)
    const viewYaw = player.inVehicle ? Math.PI + player.inVehicle.yaw : player.yaw;
    ctx.translate(cx, cy);
    ctx.rotate(viewYaw);

    // Отрисовка острова и его песчаного берега со всех 4 сторон
    const isl = CONFIG.ISLAND;
    const islX = (isl.minX - player.x) * scale;
    const islZ = (isl.minZ - player.z) * scale;
    const islW = (isl.maxX - isl.minX) * scale;
    const islD = (isl.maxZ - isl.minZ) * scale;

    ctx.fillStyle = 'rgba(238, 210, 148, 0.42)';
    ctx.fillRect(islX, islZ, islW, islD);

    ctx.fillStyle = 'rgba(18, 12, 38, 0.92)';
    ctx.fillRect(
      islX + 8,
      islZ + 8,
      Math.max(10, islW - 24),
      Math.max(10, islD - 16)
    );

    // Отрисовка сетки дорог
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.18)';
    ctx.lineWidth = 6;
    for (const ax of CONFIG.AVENUES_X) {
      const rx = (ax - player.x) * scale;
      ctx.beginPath();
      ctx.moveTo(rx, (-260 - player.z) * scale);
      ctx.lineTo(rx, (260 - player.z) * scale);
      ctx.stroke();
    }
    for (const sz of CONFIG.STREETS_Z) {
      const rz = (sz - player.z) * scale;
      ctx.beginPath();
      ctx.moveTo((-260 - player.x) * scale, rz);
      ctx.lineTo((160 - player.x) * scale, rz);
      ctx.stroke();
    }

    // Метки машин
    if (vehicles) {
      for (const car of vehicles.vehicles) {
        if (car.exploded || car === player.inVehicle) continue;
        const dx = (car.x - player.x) * scale;
        const dz = (car.z - player.z) * scale;
        if (dx * dx + dz * dz > radius * radius) continue;
        ctx.fillStyle = car.isPolice ? '#00bbf9' : car.tag === 'mission3_car' ? '#ffbe0b' : '#72efdd';
        ctx.fillRect(dx - 2.5, dz - 2.5, 5, 5);
      }
    }

    // Метки врагов и полиции
    if (enemies) {
      for (const e of enemies.enemies) {
        if (e.dead) continue;
        const dx = (e.x - player.x) * scale;
        const dz = (e.z - player.z) * scale;
        if (dx * dx + dz * dz > radius * radius) continue;
        ctx.fillStyle = e.config.isPolice ? '#3a86ff' : e.config.isBoss ? '#ffbe0b' : '#ff2a85';
        ctx.beginPath();
        ctx.arc(dx, dz, e.config.isBoss ? 5 : 3.2, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Маркер текущей миссии (прижимается к краю радара, если цель далеко)
    if (missions && !missions.allCompleted && missions.markerPos) {
      let mx = (missions.markerPos.x - player.x) * scale;
      let mz = (missions.markerPos.z - player.z) * scale;
      const d = Math.hypot(mx, mz);
      if (d > radius - 8) {
        mx = (mx / d) * (radius - 8);
        mz = (mz / d) * (radius - 8);
      }
      ctx.fillStyle = '#ffbe0b';
      ctx.strokeStyle = '#ff2a85';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(mx, mz, 5.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }

    ctx.restore();

    // Центральная стрелка игрока (всегда смотрит вверх)
    ctx.fillStyle = '#00f5d4';
    ctx.beginPath();
    ctx.moveTo(cx, cy - 6);
    ctx.lineTo(cx - 5, cy + 5);
    ctx.lineTo(cx + 5, cy + 5);
    ctx.closePath();
    ctx.fill();

    // Неоновый ободок радара
    ctx.strokeStyle = '#ff2a85';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.stroke();
  }
}
