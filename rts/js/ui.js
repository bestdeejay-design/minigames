// ============================================================
// ui.js — интерфейс: верхняя панель ресурсов, панель команд,
// миникарта, всплывающие сообщения, экраны старта и финала.
// Весь UI — DOM поверх canvas; иконки команд рисуются кодом.
// ============================================================
import { TILE, UNITS, BUILDINGS, WORLD_W, WORLD_H, MAP_W, MAP_H, SUPPLY_MAX, COLORS } from './config.js';

const $ = (id) => document.getElementById(id);

// ------------------------------------------------------------
// Иконки команд: маленькие canvas 26×26, рисуются один раз.
// ------------------------------------------------------------
const iconCache = {};
function icon(type) {
  if (iconCache[type]) return iconCache[type];
  const c = document.createElement('canvas');
  c.width = 26; c.height = 26;
  const g = c.getContext('2d');
  g.translate(13, 13);
  const blue = '#4f8fe8', orange = '#f0a53a', steel = '#9aa2ad';
  switch (type) {
    case 'worker':
      g.fillStyle = blue; g.beginPath(); g.arc(0, 2, 7, 0, Math.PI * 2); g.fill();
      g.fillStyle = orange; g.fillRect(-9, -2, 4, 8);
      g.fillStyle = '#d7e3f5'; g.beginPath(); g.arc(2, 0, 3, 0, Math.PI * 2); g.fill();
      break;
    case 'marine':
      g.fillStyle = blue; g.beginPath(); g.arc(0, 2, 7, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#2c3138'; g.fillRect(2, -1, 11, 3);
      g.fillStyle = '#d7e3f5'; g.beginPath(); g.arc(1, 0, 3, 0, Math.PI * 2); g.fill();
      break;
    case 'cc':
      g.fillStyle = steel; g.fillRect(-10, -8, 20, 15);
      g.strokeStyle = blue; g.lineWidth = 2;
      g.beginPath(); g.ellipse(0, 0, 6, 4.5, 0, 0, Math.PI * 2); g.stroke();
      break;
    case 'barracks':
      g.fillStyle = steel; g.fillRect(-10, -7, 20, 14);
      g.fillStyle = '#3a3f45'; g.fillRect(-4, 0, 8, 7);
      g.fillStyle = blue; g.fillRect(-10, -7, 20, 3);
      break;
    case 'depot':
      g.fillStyle = steel; g.fillRect(-10, -5, 20, 11);
      g.fillStyle = blue; g.fillRect(-10, -5, 20, 3);
      g.fillStyle = '#3a3f45';
      g.beginPath(); g.moveTo(-4, 0); g.lineTo(1, 3); g.lineTo(-4, 6); g.closePath(); g.fill();
      break;
    case 'build':
      g.fillStyle = steel; g.fillRect(-9, -8, 10, 8);           // боёк молота
      g.fillStyle = orange; g.fillRect(-2, -4, 12, 4);          // ручка
      g.fillStyle = blue; g.fillRect(-11, 4, 22, 4);            // «фундамент»
      break;
    case 'stop':
      g.strokeStyle = '#e04b3f'; g.lineWidth = 3;
      g.beginPath(); g.moveTo(-7, -7); g.lineTo(7, 7); g.moveTo(7, -7); g.lineTo(-7, 7); g.stroke();
      break;
  }
  iconCache[type] = c;
  return c;
}
// Содержимое canvas нельзя «расшарить» между узлами DOM — копируем.
function iconEl(type) {
  const src = icon(type);
  const c = document.createElement('canvas');
  c.width = 26; c.height = 26;
  c.getContext('2d').drawImage(src, 0, 0);
  return c;
}

let els = null;        // кэш DOM-элементов
let dyn = null;        // динамические ссылки для апдейтов без перестройки
let sig = '';          // «подпись» текущей панели

export function initUI(game) {
  els = {
    canvas: $('game-canvas'),
    minimap: $('minimap'),
    minerals: $('res-minerals'),
    supply: $('res-supply'),
    time: $('res-time'),
    sound: $('btn-sound'),
    pause: $('btn-pause'),
    restart: $('btn-restart'),
    selInfo: $('sel-info'),
    cmdGrid: $('cmd-grid'),
    toasts: $('toasts'),
    overlay: $('overlay'),
    endOverlay: $('end-overlay'),
    endTitle: $('end-title'),
    endStats: $('end-stats'),
    pauseOverlay: $('pause-overlay'),
    startBtn: $('btn-start'),
    againBtn: $('btn-again'),
  };

  els.startBtn.addEventListener('click', () => game.start());
  els.againBtn.addEventListener('click', () => game.restart());
  els.restart.addEventListener('click', () => game.restart());
  els.pause.addEventListener('click', () => game.togglePause());
  els.sound.addEventListener('click', () => game.toggleSound());

  // Миникарта: ЛКМ — прыжок/перетаскивание камеры, ПКМ — приказ.
  const mm = els.minimap;
  const mmWorld = (e) => {
    const r = mm.getBoundingClientRect();
    return {
      x: ((e.clientX - r.left) / r.width) * WORLD_W,
      y: ((e.clientY - r.top) / r.height) * WORLD_H,
    };
  };
  mm.addEventListener('mousedown', (e) => {
    e.preventDefault();
    const w = mmWorld(e);
    if (e.button === 0) game.hooks.centerCamera(w.x, w.y);
    else if (e.button === 2) game.hooks.issueRMB(w.x, w.y);
  });
  mm.addEventListener('mousemove', (e) => {
    if (e.buttons & 1) { const w = mmWorld(e); game.hooks.centerCamera(w.x, w.y); }
  });
  mm.addEventListener('contextmenu', (e) => e.preventDefault());
}

export function toast(msg, kind = 'info') {
  if (!els) return;
  const now = performance.now();
  if (toast.last && toast.last.msg === msg && now - toast.last.t < 1600) return; // анти-спам
  toast.last = { msg, t: now };
  const div = document.createElement('div');
  div.className = 'toast' + (kind === 'error' ? ' err' : '');
  div.textContent = msg;
  els.toasts.appendChild(div);
  while (els.toasts.children.length > 3) els.toasts.firstChild.remove();
  setTimeout(() => div.remove(), 2400);
}

export function showEnd(win, stats) {
  els.endTitle.textContent = win ? 'Победа!' : 'Поражение';
  els.endTitle.className = win ? 'win' : 'lose';
  const mm = String(Math.floor(stats.time / 60)).padStart(2, '0');
  const ss = String(Math.floor(stats.time % 60)).padStart(2, '0');
  els.endStats.innerHTML =
    `<div class="row"><span>Время боя</span><b>${mm}:${ss}</b></div>` +
    `<div class="row"><span>Уничтожено врагов</span><b>${stats.kills}</b></div>` +
    `<div class="row"><span>Потери</span><b>${stats.losses}</b></div>` +
    `<div class="row"><span>Добыто минералов</span><b>${stats.mined}</b></div>`;
  els.endOverlay.classList.remove('hidden');
}

export function hideEnd() { els.endOverlay.classList.add('hidden'); }
export function hideStart() { els.overlay.classList.add('hidden'); }
// Сброс кэша панели при новой партии — заставит её перестроиться.
export function resetPanel() { sig = ''; dyn = null; }
export function setPausedUI(p) {
  els.pauseOverlay.classList.toggle('hidden', !p);
  els.pause.textContent = p ? 'Продолжить' : 'Пауза';
}
export function setSoundUI(muted) { els.sound.textContent = muted ? 'Звук: выкл' : 'Звук: вкл'; }

// Клавиатурные хоткеи панели: нажимаем «виртуальную кнопку».
export function handleHotkey(code) {
  if (!dyn) return false;
  const btn = dyn.cmds.find((c) => c.code === code);
  if (btn) { btn.el.click(); return true; }
  return false;
}

// ------------------------------------------------------------
// Панель команд: перестраивается только при смене «подписи»
// (состав выделения, меню стройки, очередь) — иначе апдейт полосок.
// ------------------------------------------------------------
export function update(game) {
  const st = game.state;
  if (!st || !els) return;

  // Верхняя панель.
  els.minerals.textContent = Math.floor(st.minerals.player);
  const sup = st.supply.player;
  els.supply.textContent = `${sup.used}/${sup.cap}`;
  els.supply.classList.toggle('blocked', sup.used >= sup.cap);
  const mm = String(Math.floor(st.time / 60)).padStart(2, '0');
  const ss = String(Math.floor(st.time % 60)).padStart(2, '0');
  els.time.textContent = `${mm}:${ss}`;
  els.canvas.style.cursor = st.placing ? 'crosshair' : 'default';

  // Подпись панели.
  const sel = st.selection.filter((e) => !e.dead);
  const newSig = sel.map((e) => e.id + (e.done === false ? 'c' : '')).join(',') +
    '|' + (st.buildMenu ? 'B' : '') + (st.placing ? 'P' + st.placing.type : '');
  if (newSig !== sig) {
    sig = newSig;
    rebuildPanel(game, sel);
  }
  refreshDynamic(game, sel);
}

function rebuildPanel(game, sel) {
  const st = game.state;
  dyn = { cmds: [] };
  els.cmdGrid.innerHTML = '';
  els.selInfo.innerHTML = '';

  // Режим размещения здания.
  if (st.placing) {
    els.selInfo.innerHTML = '<div class="hint">Клик по карте — поставить здание.<br>ПКМ / ESC — отмена.</div>';
    return;
  }
  if (!sel.length) {
    els.selInfo.innerHTML = '<div class="hint">Выделите юнита ЛКМ или рамкой.<br>ПКМ — приказ: идти / добывать / атаковать.</div>';
    return;
  }

  const first = sel[0];

  // --- Выделено здание ---
  if (first.kind === 'building') {
    const b = first;
    const box = document.createElement('div');
    box.className = 'sel-box';
    const name = document.createElement('div');
    name.className = 'sel-name';
    name.textContent = b.cfg.name + (b.done ? '' : ' — строится');
    box.appendChild(name);
    const hp = bar(b.hp / b.maxHp);
    box.appendChild(hp.el);
    if (!b.done) {
      const p = bar(b.progress);
      p.fill.classList.add('amber');
      box.appendChild(p.el);
      dyn.progFill = p.fill;
      const hint = document.createElement('div');
      hint.className = 'small';
      hint.textContent = 'Стройку ведёт назначенный рабочий.';
      box.appendChild(hint);
    } else if (b.queue.length) {
      const q = document.createElement('div');
      q.className = 'queue';
      b.queue.forEach((item, i) => {
        const chip = document.createElement('button');
        chip.className = 'chip';
        chip.title = UNITS[item.type].name + ' — клик: отмена (возврат минералов)';
        chip.appendChild(iconEl(item.type));
        if (i === 0) {
          const pr = document.createElement('div');
          pr.className = 'chip-progress';
          chip.appendChild(pr);
          dyn.chipFill = pr;
        }
        chip.addEventListener('click', () => game.hooks.cancelQueue(b, i));
        q.appendChild(chip);
      });
      box.appendChild(q);
    } else if (b.cfg.produces) {
      const hint = document.createElement('div');
      hint.className = 'small';
      hint.textContent = 'ПКМ по земле — точка сбора новых юнитов.';
      box.appendChild(hint);
    }
    els.selInfo.appendChild(box);
    infoStats(box, b);
  } else {
    // --- Выделены юниты ---
    const counts = {};
    for (const u of sel) counts[u.type] = (counts[u.type] || 0) + 1;
    const box = document.createElement('div');
    box.className = 'sel-box';
    const name = document.createElement('div');
    name.className = 'sel-name';
    const parts = Object.entries(counts).map(([t, n]) => UNITS[t].name + ' ×' + n);
    name.textContent = parts.join(', ');
    box.appendChild(name);
    const hp = bar(first.hp / first.maxHp);
    box.appendChild(hp.el);
    dyn.hpFill = hp.fill;
    const sub = document.createElement('div');
    sub.className = 'small';
    sub.textContent = `${first.cfg.desc} · урон ${first.cfg.dmg} · перезарядка ${first.cfg.cooldown}с`;
    box.appendChild(sub);
    els.selInfo.appendChild(box);
  }

  // --- Кнопки команд (от игры — контекстный список) ---
  const cmds = game.getCommands();
  for (const c of cmds) {
    const btn = document.createElement('button');
    btn.className = 'cmd';
    btn.dataset.code = c.code;
    btn.appendChild(iconEl(c.icon));
    const label = document.createElement('span');
    label.className = 'cmd-label';
    label.textContent = c.label;
    btn.appendChild(label);
    if (c.cost) {
      const cost = document.createElement('span');
      cost.className = 'cmd-cost';
      cost.textContent = c.cost;
      btn.appendChild(cost);
    }
    const key = document.createElement('kbd');
    key.textContent = c.code.replace('Key', '');
    btn.appendChild(key);
    btn.addEventListener('click', () => c.on());
    els.cmdGrid.appendChild(btn);
    dyn.cmds.push({ code: c.code, el: btn, cmd: c });
  }
}

function refreshDynamic(game, sel) {
  if (!dyn) return;
  const st = game.state;
  // Доступность кнопок (минералы).
  for (const c of dyn.cmds) {
    if (c.cmd.enabled) c.el.classList.toggle('disabled', !c.cmd.enabled());
  }
  // Полоски HP / прогресса.
  const first = sel[0];
  if (first) {
    if (dyn.hpFill) dyn.hpFill.style.width = Math.max(0, (first.hp / first.maxHp) * 100) + '%';
    if (dyn.progFill) dyn.progFill.style.width = Math.min(100, first.progress * 100) + '%';
    if (dyn.chipFill && first.kind === 'building' && first.queue.length) {
      const q = first.queue[0];
      dyn.chipFill.style.width = ((1 - q.t / q.total) * 100) + '%';
    }
  }
}

function bar(frac) {
  const el = document.createElement('div');
  el.className = 'bar';
  const fill = document.createElement('div');
  fill.className = 'bar-fill';
  fill.style.width = Math.max(0, Math.min(100, frac * 100)) + '%';
  el.appendChild(fill);
  return { el, fill };
}

function infoStats(box, b) {
  const s = document.createElement('div');
  s.className = 'small';
  s.textContent = `Прочность ${Math.ceil(b.hp)}/${b.maxHp}`;
  box.appendChild(s);
}

// ------------------------------------------------------------
// Миникарта: террейн-кэш + точки сущностей + туман + рамка камеры.
// ------------------------------------------------------------
export function drawMinimap(game) {
  const st = game.state;
  if (!st || !els) return;
  const g = els.minimap.getContext('2d');
  const S = els.minimap.width; // 176
  const k = S / WORLD_W;
  g.imageSmoothingEnabled = false;
  g.drawImage(st.map.miniCanvas, 0, 0, S, S);

  // Кристаллы (только разведанные).
  for (const c of st.map.crystals) {
    if (c.amount <= 0 || !st.fog.tileExplored(c.tx, c.ty)) continue;
    g.fillStyle = COLORS.mineral;
    g.fillRect(c.tx * TILE * k, c.ty * TILE * k, 3, 3);
  }
  // Здания.
  for (const b of st.buildings) {
    if (b.dead) continue;
    if (b.side === 'enemy' && !b.spotted) continue;
    g.fillStyle = b.side === 'player' ? '#6db1ff' : '#ff7a6b';
    g.fillRect(b.tx * TILE * k, b.ty * TILE * k, Math.max(4, b.w * TILE * k), Math.max(3, b.h * TILE * k));
  }
  // Юниты (враги — только видимые).
  for (const u of st.units) {
    if (u.dead) continue;
    if (u.side === 'enemy' && !u.visible) continue;
    g.fillStyle = u.side === 'player' ? '#a8d4ff' : '#ffb1a8';
    g.fillRect(u.x * k - 1.5, u.y * k - 1.5, 3, 3);
  }
  // Туман войны.
  if (st.fog.dirty) st.fog.paint();
  g.imageSmoothingEnabled = false;
  g.drawImage(st.fog.canvas, 0, 0, MAP_W, MAP_H, 0, 0, S, S);
  // Рамка обзора камеры.
  g.strokeStyle = 'rgba(255,255,255,0.85)';
  g.lineWidth = 1;
  g.strokeRect(st.camera.x * k, st.camera.y * k, game.cssW * k, game.cssH * k);
  // Пинги тревоги.
  for (const p of st.pings) {
    const a = 1 - p.t / 2.5;
    g.strokeStyle = `rgba(255,70,50,${a})`;
    g.lineWidth = 2;
    g.beginPath();
    g.arc(p.x * k, p.y * k, 4 + p.t * 10, 0, Math.PI * 2);
    g.stroke();
  }
}
