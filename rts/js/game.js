// ============================================================
// game.js — точка входа. Состояние партии, фиксированный игровой
// цикл (логика 30 тик/с, отрисовка через requestAnimationFrame с
// интерполяцией), команды игрока, победа/поражение, рестарт без
// перезагрузки страницы.
// ============================================================
import {
  TILE, MAP_W, MAP_H, WORLD_W, WORLD_H, LOGIC_DT, MAX_FRAME_DT,
  START_MINERALS, WORKER_START, BUILDINGS, UNITS, SUPPLY_MAX,
} from './config.js';
import { GameMap, BASE } from './map.js';
import { Fog } from './fog.js';
import { Sound } from './audio.js';
import * as U from './units.js';
import * as B from './buildings.js';
import { AIController } from './ai.js';
import * as ui from './ui.js';
import { attachInput, updateCamera } from './input.js';

export class Game {
  constructor() {
    this.canvas = document.getElementById('game-canvas');
    this.ctx = this.canvas.getContext('2d', { alpha: false });
    this.sound = new Sound();
    this.ui = ui;
    this.state = null;
    this.started = false;
    this.paused = false;
    this.box = null;                 // рамка выделения (мировые координаты)
    this.mouse = { x: -1, y: -1 };
    this.cssW = window.innerWidth;
    this.cssH = window.innerHeight;
    this.acc = 0;
    this.last = 0;
    this.grid = new U.SpatialGrid(64);

    window.addEventListener('resize', () => this.resize());
    this.resize();
    // При возврате на вкладку не накапливаем «долгие» тики.
    document.addEventListener('visibilitychange', () => { this.last = performance.now(); });

    this.hooks = this.makeHooks();
    ui.initUI(this);
    ui.setSoundUI(this.sound.muted);
    attachInput(this);
    this.newGame();

    requestAnimationFrame((t) => this.loop(t));
  }

  // ----------------------------------------------------------
  // Новая партия (используется и для рестарта без перезагрузки).
  // ----------------------------------------------------------
  newGame() {
    const seed = (Math.random() * 0xFFFFFFFF) >>> 0;
    const st = {
      tick: 0, time: 0, seed,
      minerals: { player: START_MINERALS, enemy: START_MINERALS },
      supply: { player: { used: 0, cap: 0 }, enemy: { used: 0, cap: 0 } },
      units: [], buildings: [], projectiles: [], effects: [], floats: [], pings: [],
      selection: [], groups: {}, placing: null, buildMenu: false,
      camera: { x: 0, y: 0 }, mouseWorld: { x: 0, y: 0 },
      gameOver: null,
      stats: { kills: 0, losses: 0, mined: 0 },
      bcount: { player: 0, enemy: 0 },
      lastAlertT: -99, lastSupplyToast: -99,
    };
    st.map = new GameMap(seed);
    st.fog = new Fog();
    st.game = this;
    this.state = st;
    this.box = null;
    this.paused = false;
    ui.setPausedUI(false);

    // Стартовые базы: командный центр + рабочие (позиции зеркальны).
    const pOffs = [[8, 52], [10, 52], [12, 52], [9, 53]];
    const eOffs = pOffs.map(([x, y]) => [MAP_W - 1 - x, MAP_H - 1 - y]);
    for (const side of ['player', 'enemy']) {
      const base = BASE[side];
      const cc = new B.Building(st, side, 'cc', base.cc.x, base.cc.y, true);
      st.map.markBuilding(cc);
      st.bcount[side]++;
      const offs = side === 'player' ? pOffs : eOffs;
      for (const [x, y] of offs) {
        U.spawnUnit(st, side, 'worker', (x + 0.5) * TILE, (y + 0.5) * TILE, true);
      }
    }

    st.ai = new AIController();
    calcSupply(st);
    st.fog.recompute(st);

    // Камера — на базу игрока.
    this.centerCamera(BASE.player.cc.x * TILE + 2 * TILE, BASE.player.cc.y * TILE + 1.5 * TILE);

    ui.resetPanel();
    ui.update(this);
    ui.drawMinimap(this);
  }

  start() {
    this.sound.unlock();      // разрешено только из жеста пользователя
    if (!this.started) {
      this.started = true;
      ui.hideStart();
      ui.toast('Добывайте минералы, стройте базу и уничтожьте красных!');
    }
  }

  restart() {
    ui.hideEnd();
    this.newGame();
    this.started = true;
    ui.hideStart();
    this.sound.click();
  }

  togglePause() {
    if (!this.started || (this.state && this.state.gameOver)) return;
    this.paused = !this.paused;
    ui.setPausedUI(this.paused);
    this.sound.click();
  }

  toggleSound() {
    ui.setSoundUI(this.sound.toggle());
  }

  resize() {
    this.cssW = window.innerWidth;
    this.cssH = window.innerHeight;
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = Math.round(this.cssW * dpr);
    this.canvas.height = Math.round(this.cssH * dpr);
    this.canvas.style.width = this.cssW + 'px';
    this.canvas.style.height = this.cssH + 'px';
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.clampCam();
  }

  clampCam() {
    const st = this.state;
    if (!st) return;
    st.camera.x = Math.max(0, Math.min(WORLD_W - this.cssW, st.camera.x));
    st.camera.y = Math.max(0, Math.min(WORLD_H - this.cssH, st.camera.y));
  }

  centerCamera(wx, wy) {
    const st = this.state;
    if (!st) return;
    st.camera.x = wx - this.cssW / 2;
    st.camera.y = wy - this.cssH / 2;
    this.clampCam();
  }

  // ----------------------------------------------------------
  // Контекстные команды панели (кнопки + хоткеи Q/W/E/B/S).
  // ----------------------------------------------------------
  getCommands() {
    const st = this.state;
    const sel = st.selection.filter((e) => !e.dead);
    const cmds = [];
    if (st.placing) {
      cmds.push({ code: 'Escape', icon: 'stop', label: 'Отмена', on: () => { st.placing = null; } });
      return cmds;
    }
    const b = sel.length === 1 && sel[0].kind === 'building' ? sel[0] : null;
    if (b && b.side === 'player') {
      if (b.done && b.cfg.produces) {
        const ut = UNITS[b.cfg.produces];
        cmds.push({
          code: 'KeyQ', icon: b.cfg.produces, label: ut.name, cost: ut.cost,
          enabled: () => st.minerals.player >= ut.cost,
          on: () => this.hooks.train(b, b.cfg.produces),
        });
      }
      return cmds;
    }
    const units = sel.filter((e) => e.kind === 'unit' && e.side === 'player');
    if (units.length) {
      const workers = units.filter((u) => u.cfg.canBuild);
      if (workers.length) {
        if (!st.buildMenu) {
          cmds.push({ code: 'KeyB', icon: 'build', label: 'Строить', on: () => { st.buildMenu = true; } });
        } else {
          for (const [code, type] of [['KeyQ', 'cc'], ['KeyW', 'depot'], ['KeyE', 'barracks']]) {
            const cfg = BUILDINGS[type];
            cmds.push({
              code, icon: type, label: cfg.name, cost: cfg.cost,
              enabled: () => st.minerals.player >= cfg.cost,
              on: () => this.hooks.beginPlace(type),
            });
          }
          cmds.push({ code: 'KeyX', icon: 'stop', label: 'Назад', on: () => { st.buildMenu = false; } });
        }
      }
      cmds.push({ code: 'KeyS', icon: 'stop', label: 'Стоп', on: () => this.hooks.stopSelected() });
    }
    return cmds;
  }

  makeHooks() {
    const st = () => this.state;
    return {
      centerCamera: (wx, wy) => this.centerCamera(wx, wy),

      issueRMB: (wx, wy) => this.issueRMB(wx, wy),

      beginPlace: (type) => {
        st().buildMenu = false;
        st().placing = { type, tx: -999, ty: -999 };
        this.sound.click();
      },

      tryPlace: (tx, ty) => this.tryPlace(tx, ty),

      train: (b, type) => {
        const r = B.enqueueUnit(st(), b, type);
        if (r === 'money') { ui.toast('Не хватает минералов', 'error'); this.sound.error(); }
        else if (r === 'queue') { ui.toast('Очередь заполнена', 'error'); this.sound.error(); }
        else this.sound.click();
      },

      cancelQueue: (b, i) => B.cancelQueueItem(st(), b, i),

      stopSelected: () => {
        for (const e of st().selection) if (e.kind === 'unit') U.orderStop(e);
        this.sound.click();
      },

      assignGroup: (n) => {
        const g = st().selection.filter((e) => e.kind === 'unit' && !e.dead);
        if (g.length) { st().groups[n] = g; this.sound.click(); }
      },

      selectGroup: (n) => {
        const g = (st().groups[n] || []).filter((u) => !u.dead);
        if (g.length) { st().selection = g; st().buildMenu = false; this.sound.click(); }
      },
    };
  }

  // ПКМ: атака врага / добыча кристалла / помочь достроить / движение.
  issueRMB(wx, wy) {
    const st = this.state;
    if (!st || st.gameOver) return;
    const sel = st.selection.filter((e) => !e.dead);

    // Выделено своё здание — ставим точку сбора.
    if (!sel.length && st.selection[0] && st.selection[0].kind === 'building' &&
        st.selection[0].side === 'player') {
      st.selection[0].rally = { x: wx, y: wy };
      U.addFloat(st, wx, wy, 'Точка сбора', '#9be29e');
      this.sound.ack();
      return;
    }
    const units = sel.filter((e) => e.kind === 'unit' && e.side === 'player');
    if (!units.length) return;

    const target = U.unitAt(st, wx, wy, 'enemy') || B.buildingAt(st, wx, wy);
    if (target && target.side === 'enemy') {
      for (const u of units) U.orderAttack(st, u, target);
      this.sound.ack();
      return;
    }
    const crystal = U.crystalAt(st, wx, wy);
    if (crystal) {
      for (const u of units) {
        if (u.type === 'worker') U.orderGather(st, u, crystal);
        else U.orderMove(st, u, wx, wy);
      }
      this.sound.ack();
      return;
    }
    const own = B.buildingAt(st, wx, wy);
    if (own && own.side === 'player' && !own.done) {
      // Достроить брошенную стройку.
      for (const u of units) {
        if (u.type === 'worker') U.orderBuild(st, u, own);
        else U.orderMove(st, u, wx, wy);
      }
      this.sound.ack();
      return;
    }
    U.orderMoveGroup(st, units, wx, wy);
    this.sound.ack();
  }

  // ЛКМ в режиме размещения: проверки → постройка.
  tryPlace(tx, ty) {
    const st = this.state;
    const pl = st.placing;
    if (!pl) return;
    const cfg = BUILDINGS[pl.type];
    tx = Math.max(0, Math.min(MAP_W - cfg.w, tx));
    ty = Math.max(0, Math.min(MAP_H - cfg.h, ty));
    for (let y = ty; y < ty + cfg.h; y++)
      for (let x = tx; x < tx + cfg.w; x++)
        if (!st.fog.tileExplored(x, y)) {
          ui.toast('Территория не разведана', 'error'); this.sound.error(); return;
        }
    if (!B.canPlace(st.map, tx, ty, cfg.w, cfg.h)) {
      ui.toast('Здесь строить нельзя', 'error'); this.sound.error(); return;
    }
    if (st.minerals.player < cfg.cost) {
      ui.toast('Не хватает минералов', 'error'); this.sound.error(); return;
    }
    const builders = st.selection.filter((e) => e.kind === 'unit' && e.side === 'player' &&
      e.cfg.canBuild && !e.dead);
    if (!builders.length) {
      ui.toast('Выделите рабочего', 'error'); this.sound.error(); return;
    }
    const b = B.placeBuildingCmd(st, 'player', pl.type, tx, ty, builders);
    if (b) { st.placing = null; this.sound.build(); }
  }

  // ----------------------------------------------------------
  // Фиксированный шаг логики.
  // ----------------------------------------------------------
  tick() {
    const st = this.state;
    st.tick++;
    st.time += LOGIC_DT;

    updateCamera(this, LOGIC_DT);

    this.grid.clear();
    for (const u of st.units) if (!u.dead) this.grid.insert(u);

    U.updateUnits(st, LOGIC_DT, this.grid);
    B.updateBuildings(st, LOGIC_DT);
    st.units = st.units.filter((u) => !u.dead);
    st.buildings = st.buildings.filter((b) => !b.dead);
    U.updateProjectiles(st, LOGIC_DT);
    U.updateEffects(st, LOGIC_DT);
    st.ai.update(LOGIC_DT, st);

    if (st.tick % 3 === 0) st.fog.recompute(st);
    calcSupply(st);
    if (st.tick % 2 === 0) ui.update(this);
    if (st.tick % 3 === 0) ui.drawMinimap(this);
    this.checkEnd();
  }

  checkEnd() {
    const st = this.state;
    if (st.gameOver) return;
    if (st.bcount.enemy <= 0) {
      st.gameOver = 'win';
      this.sound.win();
      ui.showEnd(true, st.stats);
    } else if (st.bcount.player <= 0) {
      st.gameOver = 'lose';
      this.sound.lose();
      ui.showEnd(false, st.stats);
    }
  }

  // ----------------------------------------------------------
  // Цикл: накопитель фиксированных тиков + интерполяция рендера.
  // ----------------------------------------------------------
  loop(t) {
    requestAnimationFrame((tt) => this.loop(tt));
    const dt = Math.min(MAX_FRAME_DT, Math.max(0, (t - this.last) / 1000));
    this.last = t;
    if (this.started && !this.paused && this.state && !document.hidden) {
      this.acc += dt;
      let guard = 0;
      while (this.acc >= LOGIC_DT && guard++ < 8) {
        this.tick();
        this.acc -= LOGIC_DT;
      }
    }
    this.render(this.acc / LOGIC_DT);
  }

  // ----------------------------------------------------------
  // Отрисовка кадра: рельеф одним blit → кристаллы → здания →
  // юниты → снаряды → эффекты → туман → UI-слои.
  // ----------------------------------------------------------
  render(alpha) {
    const st = this.state;
    if (!st) return;
    const ctx = this.ctx, W = this.cssW, H = this.cssH;
    const cam = st.camera;

    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W, H);

    // Рельеф: один drawImage видимого куска кэша 2048×2048.
    const sw = Math.min(W, WORLD_W - cam.x), sh = Math.min(H, WORLD_H - cam.y);
    if (sw > 0 && sh > 0) {
      ctx.drawImage(st.map.terrainCanvas, cam.x, cam.y, sw, sh, 0, 0, sw, sh);
    }

    const inView = (x, y, m) =>
      x > cam.x - m && x < cam.x + W + m && y > cam.y - m && y < cam.y + H + m;

    // Кристаллы минералов (на разведанной территории).
    for (const c of st.map.crystals) {
      if (c.amount <= 0 || !inView(c.x, c.y, 40)) continue;
      if (!st.fog.tileExplored(c.tx, c.ty)) continue;
      this.drawCrystal(ctx, c, cam.x, cam.y);
    }

    // Здания: свои всегда; вражеские — видимые или «запомненные».
    for (const b of st.buildings) {
      if (b.dead) continue;
      const bx = b.tx * TILE, by = b.ty * TILE;
      if (bx > cam.x + W || by > cam.y + H ||
          bx + b.w * TILE < cam.x || by + b.h * TILE < cam.y) continue;
      const visibleNow = b.side === 'player' ||
        st.fog.tileVisible(b.tx + (b.w >> 1), b.ty + (b.h >> 1));
      if (b.side === 'enemy' && !b.spotted && !visibleNow) continue;
      B.drawBuilding(ctx, b, b.side === 'enemy' && !visibleNow, cam.x, cam.y);
    }

    // Юниты с интерполяцией между логическими тиками.
    for (const u of st.units) {
      if (u.dead) continue;
      if (u.side === 'enemy' && !u.visible) continue;
      const wx = u.prevX + (u.x - u.prevX) * alpha;
      const wy = u.prevY + (u.y - u.prevY) * alpha;
      if (!inView(wx, wy, 30)) continue;
      U.drawUnit(ctx, u, wx - cam.x, wy - cam.y);
    }

    // Снаряды — светящиеся трассеры.
    ctx.lineWidth = 2;
    for (const p of st.projectiles) {
      if (!inView(p.x, p.y, 20)) continue;
      ctx.strokeStyle = '#ffd977';
      ctx.beginPath();
      ctx.moveTo(p.x - cam.x, p.y - cam.y);
      ctx.lineTo(p.x - (p.tx - p.x) * 0.03 - cam.x, p.y - (p.ty - p.y) * 0.03 - cam.y);
      ctx.stroke();
    }

    this.drawEffects(ctx, st, inView, cam.x, cam.y);

    // Туман войны поверх мира (мягкие края за счёт масштабирования 64→экран).
    if (st.fog.dirty) st.fog.paint();
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(st.fog.canvas, cam.x / TILE, cam.y / TILE, W / TILE, H / TILE, 0, 0, W, H);

    // Рамка выделения.
    if (this.box) {
      const b = this.box;
      ctx.strokeStyle = 'rgba(120,255,150,0.9)';
      ctx.setLineDash([5, 4]);
      ctx.lineWidth = 1.5;
      ctx.strokeRect(Math.min(b.x0, b.x1) - cam.x, Math.min(b.y0, b.y1) - cam.y,
        Math.abs(b.x1 - b.x0), Math.abs(b.y1 - b.y0));
      ctx.setLineDash([]);
    }

    // Призрак размещаемого здания.
    if (st.placing && st.placing.tx > -900) this.drawGhost(ctx, st, cam);

    // Всплывающий текст (+8 минералов и т.п.).
    ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.textAlign = 'center';
    for (const f of st.floats) {
      ctx.globalAlpha = Math.max(0, 1 - f.t / f.life);
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, f.x - cam.x, f.y - cam.y);
    }
    ctx.globalAlpha = 1;
    ctx.textAlign = 'left';
  }

  drawCrystal(ctx, c, camX, camY) {
    const s = 0.45 + 0.55 * (c.amount / c.max);
    ctx.save();
    ctx.translate(c.x - camX, c.y - camY);
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath(); ctx.ellipse(0, 7, 13 * s, 5 * s, 0, 0, Math.PI * 2); ctx.fill();
    ctx.scale(s, s);
    const shard = (pts, fill, stroke) => {
      ctx.beginPath();
      ctx.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
      ctx.closePath();
      ctx.fillStyle = fill; ctx.fill();
      ctx.strokeStyle = stroke; ctx.lineWidth = 1; ctx.stroke();
    };
    shard([[-10, 7], [-4, -13], [1, 7]], '#38cfe0', '#a5edf5');
    shard([[0, 8], [7, -9], [12, 8]], '#2fb9cc', '#7fd4de');
    shard([[-4, 9], [0, -2], [5, 9]], '#229aa8', '#66b8c2');
    ctx.restore();
  }

  drawGhost(ctx, st, cam) {
    const pl = st.placing;
    const cfg = BUILDINGS[pl.type];
    const tx = Math.max(0, Math.min(MAP_W - cfg.w, pl.tx));
    const ty = Math.max(0, Math.min(MAP_H - cfg.h, pl.ty));
    let ok = st.minerals.player >= cfg.cost;
    for (let y = ty; y < ty + cfg.h && ok; y++)
      for (let x = tx; x < tx + cfg.w && ok; x++)
        if (st.map.blockedAt(x, y) || !st.fog.tileExplored(x, y)) ok = false;

    ctx.globalAlpha = 0.35;
    ctx.fillStyle = ok ? '#3fff6e' : '#ff4b3f';
    ctx.fillRect(tx * TILE - cam.x, ty * TILE - cam.y, cfg.w * TILE, cfg.h * TILE);
    ctx.globalAlpha = 0.55;
    B.drawBuilding(ctx, {
      tx, ty, w: cfg.w, h: cfg.h, side: 'player', type: pl.type, cfg,
      done: true, progress: 1, hp: 1, maxHp: 1, flashT: 0, selected: false,
    }, false, cam.x, cam.y);
    ctx.globalAlpha = 1;
  }

  drawEffects(ctx, st, inView, camX, camY) {
    for (const e of st.effects) {
      if (!inView(e.x, e.y, 60)) continue;
      const k = e.t / e.life;
      const ex = e.x - camX, ey = e.y - camY;
      if (e.kind === 'boom') {
        const R = (e.big ? 46 : 18) * (0.3 + 0.7 * k);
        ctx.globalAlpha = 1 - k;
        ctx.fillStyle = 'rgba(255,140,50,0.8)';
        ctx.beginPath(); ctx.arc(ex, ey, R, 0, Math.PI * 2); ctx.fill();
        if (k < 0.4) {
          ctx.fillStyle = 'rgba(255,235,140,0.9)';
          ctx.beginPath(); ctx.arc(ex, ey, R * 0.5, 0, Math.PI * 2); ctx.fill();
        }
      } else if (e.kind === 'spark') {
        ctx.globalAlpha = 1 - k;
        ctx.strokeStyle = '#ffe9a8';
        ctx.lineWidth = 1.5;
        const d = 6 * (1 - k) + 2;
        ctx.beginPath();
        ctx.moveTo(ex, ey);
        ctx.lineTo(ex + Math.cos(e.ang) * d, ey + Math.sin(e.ang) * d);
        ctx.stroke();
      } else if (e.kind === 'muzzle') {
        ctx.globalAlpha = 1 - k;
        ctx.fillStyle = '#fff3b0';
        ctx.beginPath(); ctx.arc(ex, ey, 3.5, 0, Math.PI * 2); ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  }
}

// Пересчёт населения: cap — по достроенным зданиям, used — по живым юнитам.
function calcSupply(st) {
  st.supply.player.used = 0;
  st.supply.enemy.used = 0;
  for (const u of st.units) if (!u.dead) st.supply[u.side].used += u.cfg.supply;
  for (const side of ['player', 'enemy']) {
    let cap = 0;
    for (const b of st.buildings) {
      if (!b.dead && b.side === side && b.done) cap += b.cfg.supplyGain || 0;
    }
    st.supply[side].cap = Math.min(cap, SUPPLY_MAX);
  }
}

// --- Запуск ---
const game = new Game();
window.game = game; // отладочная ручка: window.game.state в консоли
