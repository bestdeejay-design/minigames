import { CONFIG } from './config.js';
import { Engine, loadStorage, saveStorage } from './engine.js';
import { World } from './world.js';
import { CityGenerator } from './city-gen.js';
import { ParticlePool, PickupManager, CivilianManager } from './entities.js';
import { Player } from './player.js';
import { WeaponSystem } from './weapons.js';
import { AIController } from './ai.js';
import { EnemyManager } from './enemies.js';
import { VehicleManager } from './vehicles.js';
import { WantedSystem } from './wanted.js';
import { MissionManager } from './missions.js';
import { HUD } from './hud.js';
import { AudioSystem } from './audio.js';
import { InputController } from './input.js';

export class NeonMiamiGame {
  constructor(canvas = null) {
    const savedSettings = loadStorage(CONFIG.STORAGE_KEYS.SETTINGS, {
      quality: 'high',
      muted: false,
    });
    this.quality = savedSettings.quality === 'low' ? 'low' : 'high';
    this.canvas =
      canvas || (typeof document !== 'undefined' ? document.getElementById('game-canvas') : null);

    this.engine = new Engine(this.canvas, this.quality);
    this.world = new World(this.engine.scene, this.quality);
    this.cityGen = new CityGenerator(this.world, this.quality);
    this.cityGen.generate();

    this.particles = new ParticlePool(
      this.engine.scene,
      CONFIG.QUALITY[this.quality].maxParticles
    );
    this.hud = new HUD();
    this.audio = new AudioSystem(Boolean(savedSettings.muted));
    this.pickups = new PickupManager(this.world);
    this.civilians = new CivilianManager(this.world);

    this.player = new Player(this.world, this.engine.camera);
    this.weapons = new WeaponSystem(
      this.engine.camera,
      this.engine.scene,
      this.world,
      this.particles
    );

    this.ai = new AIController(this.world, this.cityGen.coverPoints);
    this.enemies = new EnemyManager(
      this.world,
      this.ai,
      this.pickups,
      this.particles,
      this.hud
    );
    this.vehicles = new VehicleManager(this.world, this.particles, this.hud);
    this.wanted = new WantedSystem(this.world, this.enemies, this.vehicles, this.hud);
    this.missions = new MissionManager(
      this.world,
      this.enemies,
      this.vehicles,
      this.wanted,
      this.hud,
      () => this._onCampaignComplete()
    );

    this.state = 'start'; // 'start' | 'playing' | 'paused' | 'wasted' | 'victory'
    this.elapsedTime = 0;
    this._accumulator = 0;
    this._lastFrameTime = 0;

    this.input = new InputController(this.canvas, {
      isPlaying: () => this.state === 'playing',
      onFirstInteraction: () => this.audio.unlock(),
      onLook: (dx, dy) => {
        if (this.state === 'playing') {
          this.player.rotateLook(dx, dy);
        }
      },
      onInteract: () => {
        if (this.state === 'playing') {
          this.vehicles.tryToggleVehicle(this.player, this.wanted, this.audio);
        }
      },
      onCameraCycle: () => {
        const modeLabel = this.player.cycleCameraMode();
        this.hud.addPopup(`КАМЕРА: ${modeLabel}`, '#00f5d4');
      },
      onRadioNext: () => {
        this.audio.unlock();
        const stName = this.audio.nextStation();
        this.hud.addPopup(`РАДИО: ${stName}`, '#ff2a85');
      },
      onToggleNight: () => {
        const isNight = this.world.toggleNightMode();
        this.hud.addPopup(isNight ? 'РЕЖИМ: НОЧЬ НЕОНА' : 'РЕЖИМ: ЗАКАТ 84', '#00f5d4');
      },
      onPauseToggle: () => {
        if (this.state === 'playing') {
          this.pauseGame();
        } else if (this.state === 'paused') {
          this.resumeGame();
        }
      },
    });

    this.missions.startCampaign();
    this._bindUI();
    this._refreshBestScoreUI();
  }

  _saveSettings() {
    saveStorage(CONFIG.STORAGE_KEYS.SETTINGS, {
      quality: this.quality,
      muted: this.audio.muted,
    });
  }

  _refreshBestScoreUI() {
    if (typeof document === 'undefined') return;
    const best = loadStorage(CONFIG.STORAGE_KEYS.HIGH_SCORE, 0);
    const elStart = document.getElementById('best-score-start');
    const elVic = document.getElementById('victory-best');
    if (elStart) elStart.textContent = `$${best}`;
    if (elVic) elVic.textContent = `$${best}`;
  }

  _bindUI() {
    if (typeof document === 'undefined') return;

    const btnStart = document.getElementById('btn-start-game');
    const btnResume = document.getElementById('btn-resume-game');
    const btnRestartPause = document.getElementById('btn-restart-pause');
    const btnRespawn = document.getElementById('btn-respawn');
    const btnFreeRoam = document.getElementById('btn-continue-freeroam');
    const btnNewCampaign = document.getElementById('btn-new-campaign');
    const btnQuality = document.getElementById('btn-quality-toggle');
    const btnSound = document.getElementById('btn-sound-toggle');
    const btnTopPause = document.getElementById('btn-top-pause');
    const btnTopNight = document.getElementById('btn-top-night');
    const btnTopRadio = document.getElementById('btn-top-radio');
    const btnTopCamera = document.getElementById('btn-top-camera');

    btnStart?.addEventListener('click', () => {
      this.audio.unlock();
      this.startGame();
    });
    btnResume?.addEventListener('click', () => {
      this.audio.unlock();
      this.resumeGame();
    });
    btnRestartPause?.addEventListener('click', () => {
      this.audio.unlock();
      this.restartCampaign();
    });
    btnRespawn?.addEventListener('click', () => {
      this.audio.unlock();
      this.respawnPlayer();
    });
    btnFreeRoam?.addEventListener('click', () => {
      this.audio.unlock();
      this.resumeGame();
    });
    btnNewCampaign?.addEventListener('click', () => {
      this.audio.unlock();
      this.restartCampaign();
    });

    const updateQualityLabel = () => {
      if (btnQuality) {
        btnQuality.textContent = `КАЧЕСТВО: ${this.quality === 'high' ? 'ВЫСОКОЕ' : 'НИЗКОЕ'}`;
      }
    };
    updateQualityLabel();

    btnQuality?.addEventListener('click', () => {
      this.quality = this.quality === 'high' ? 'low' : 'high';
      this.engine.setQuality(this.quality);
      const q = CONFIG.QUALITY[this.quality];
      if (this.cityGen.palmInstanced) {
        const pCount = Math.min(this.cityGen.palmPositions.length, q.palmCount);
        this.cityGen.palmInstanced.trunkInst.count = pCount;
        this.cityGen.palmInstanced.crownInst.count = pCount;
      }
      if (this.cityGen.treeInstanced) {
        const tCount = Math.min(this.cityGen.treePositions.length, q.treeCount || 80);
        this.cityGen.treeInstanced.trunkInst.count = tCount;
        this.cityGen.treeInstanced.canopyInst.count = tCount;
      }
      if (this.cityGen.lampInstanced) {
        const lCount = Math.min(this.cityGen.lampPositions.length, q.lampCount);
        this.cityGen.lampInstanced.poleInst.count = lCount;
        this.cityGen.lampInstanced.bulbInst.count = lCount;
      }
      updateQualityLabel();
      this._saveSettings();
    });

    const updateSoundLabel = () => {
      if (btnSound) {
        btnSound.textContent = `ЗВУК: ${this.audio.muted ? 'ВЫКЛ' : 'ВКЛ'}`;
      }
    };
    updateSoundLabel();

    btnSound?.addEventListener('click', () => {
      this.audio.unlock();
      this.audio.toggleMute();
      updateSoundLabel();
      this._saveSettings();
    });

    btnTopPause?.addEventListener('click', () => {
      if (this.state === 'playing') this.pauseGame();
      else if (this.state === 'paused') this.resumeGame();
    });
    btnTopNight?.addEventListener('click', () => {
      const isNight = this.world.toggleNightMode();
      this.hud.addPopup(isNight ? 'РЕЖИМ: НОЧЬ НЕОНА' : 'РЕЖИМ: ЗАКАТ 84', '#00f5d4');
    });
    btnTopRadio?.addEventListener('click', () => {
      this.audio.unlock();
      const stName = this.audio.nextStation();
      this.hud.addPopup(`РАДИО: ${stName}`, '#ff2a85');
    });
    btnTopCamera?.addEventListener('click', () => {
      const modeLabel = this.player.cycleCameraMode();
      this.hud.addPopup(`КАМЕРА: ${modeLabel}`, '#00f5d4');
    });

    // Автоматическая пауза при потере фокуса вкладки
    window.addEventListener('blur', () => {
      if (this.state === 'playing') this.pauseGame();
    });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && this.state === 'playing') {
        this.pauseGame();
      }
    });
  }

  _showOverlayScreen(screenId = null) {
    if (typeof document === 'undefined') return;
    const screens = ['screen-start', 'screen-pause', 'screen-wasted', 'screen-victory'];
    for (const id of screens) {
      const el = document.getElementById(id);
      if (el) {
        el.hidden = id !== screenId;
      }
    }
  }

  startGame() {
    this.state = 'playing';
    this._showOverlayScreen(null);
    this.input.requestPointerLock();
  }

  pauseGame() {
    if (this.state !== 'playing') return;
    this.state = 'paused';
    this.input.resetTransient();
    this.audio.setEngineSpeed(0, false);
    if (typeof document !== 'undefined' && document.exitPointerLock && document.pointerLockElement) {
      try {
        document.exitPointerLock();
      } catch (_e) {}
    }
    this._showOverlayScreen('screen-pause');
  }

  resumeGame() {
    this.state = 'playing';
    this._showOverlayScreen(null);
    this.input.requestPointerLock();
  }

  restartCampaign() {
    this.player.reset(false);
    this.weapons.reset();
    this.wanted.clearWanted();
    this.enemies.reset();
    this.missions.startCampaign();
    this.state = 'playing';
    this._showOverlayScreen(null);
    this.input.requestPointerLock();
  }

  respawnPlayer() {
    const penalty = this.player.respawn();
    this.wanted.clearWanted();
    this.hud.addPopup(`ГОСПИТАЛЬ: -$${penalty}`, '#ff2a85');
    this.state = 'playing';
    this._showOverlayScreen(null);
    this.input.requestPointerLock();
  }

  _onPlayerDied() {
    this.state = 'wasted';
    this.input.resetTransient();
    this.audio.setEngineSpeed(0, false);
    if (typeof document !== 'undefined') {
      const penalty = Math.min(
        this.player.cash,
        Math.max(
          CONFIG.PLAYER.deathCashPenalty,
          Math.round(this.player.cash * CONFIG.PLAYER.deathPenaltyRatio)
        )
      );
      const elPen = document.getElementById('wasted-penalty');
      if (elPen) elPen.textContent = `Штраф клиники: -$${penalty}`;
      if (document.exitPointerLock && document.pointerLockElement) {
        try {
          document.exitPointerLock();
        } catch (_e) {}
      }
    }
    this._showOverlayScreen('screen-wasted');
  }

  _onCampaignComplete() {
    const prevBest = loadStorage(CONFIG.STORAGE_KEYS.HIGH_SCORE, 0);
    const best = Math.max(prevBest, this.player.cash);
    saveStorage(CONFIG.STORAGE_KEYS.HIGH_SCORE, best);
    this._refreshBestScoreUI();

    this.state = 'victory';
    this.input.resetTransient();
    this.audio.setEngineSpeed(0, false);
    if (typeof document !== 'undefined') {
      const elCash = document.getElementById('victory-cash');
      const elKills = document.getElementById('victory-kills');
      const elBest = document.getElementById('victory-best');
      if (elCash) elCash.textContent = `$${this.player.cash}`;
      if (elKills) elKills.textContent = `${this.player.kills}`;
      if (elBest) elBest.textContent = `$${best}`;
      if (document.exitPointerLock && document.pointerLockElement) {
        try {
          document.exitPointerLock();
        } catch (_e) {}
      }
    }
    this._showOverlayScreen('screen-victory');
  }

  // Один шаг фиксированной физики (1/60 сек)
  stepPhysics(dt) {
    this.elapsedTime += dt;
    this.world.updateWaves(this.elapsedTime, this.player);

    if (this.state !== 'playing') return;

    this.player.update(dt, this.input, this.audio);
    if (this.player.dead) {
      this._onPlayerDied();
      return;
    }

    this.weapons.update(
      dt,
      this.input,
      this.player,
      this.enemies,
      this.civilians,
      this.vehicles,
      this.wanted,
      this.audio
    );
    this.vehicles.update(
      dt,
      this.input,
      this.player,
      this.enemies,
      this.civilians,
      this.wanted,
      this.audio
    );
    this.enemies.update(dt, this.player, this.audio);
    this.civilians.update(dt, this.player);
    this.pickups.update(dt, this.elapsedTime, this.player, this.weapons, this.hud, this.audio);
    this.wanted.update(dt, this.player, this.audio);
    this.missions.update(dt, this.elapsedTime, this.player, this.audio);
    this.particles.update(dt);
    this.audio.update(dt, this.player);

    this.hud.update(dt, {
      player: this.player,
      weapons: this.weapons,
      enemies: this.enemies,
      vehicles: this.vehicles,
      wanted: this.wanted,
      missions: this.missions,
      world: this.world,
      audio: this.audio,
      engine: this.engine,
    });
  }

  startLoop() {
    if (typeof requestAnimationFrame === 'undefined') return;
    const loop = (nowMs) => {
      requestAnimationFrame(loop);
      const now = nowMs * 0.001;
      const frameDt = this._lastFrameTime ? Math.min(0.1, now - this._lastFrameTime) : CONFIG.FIXED_TIMESTEP;
      this._lastFrameTime = now;

      this.engine.updateFps(frameDt);
      this._accumulator += frameDt;

      let steps = 0;
      while (this._accumulator >= CONFIG.FIXED_TIMESTEP && steps < CONFIG.MAX_SUBSTEPS) {
        this.stepPhysics(CONFIG.FIXED_TIMESTEP);
        this._accumulator -= CONFIG.FIXED_TIMESTEP;
        steps++;
      }

      this.engine.render();
    };
    requestAnimationFrame(loop);
  }
}

if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  window.addEventListener('DOMContentLoaded', () => {
    const game = new NeonMiamiGame();
    window.__miami84Game = game;
    game.startLoop();
  });
}
