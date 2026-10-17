// ============================================================
// input.js — управление: выделение кликом и рамкой (ЛКМ), приказы
// (ПКМ: идти/добывать/атаковать/точка сбора), группы
// Ctrl/Shift+1…9, размещение зданий, камера (края экрана, стрелки),
// горячие клавиши панели команд.
// ============================================================
import { TILE, MAP_W, MAP_H, WORLD_W, WORLD_H, EDGE_MARGIN, EDGE_SCROLL_SPEED, KEY_SCROLL_SPEED, BUILDINGS } from './config.js';
import { unitAt } from './units.js';
import { buildingAt } from './buildings.js';

export function attachInput(game) {
  const cv = game.canvas;
  const held = new Set();
  game.inputHeld = held;

  const screenToWorld = (e) => {
    const r = cv.getBoundingClientRect();
    return {
      x: e.clientX - r.left + game.state.camera.x,
      y: e.clientY - r.top + game.state.camera.y,
    };
  };

  window.addEventListener('mousemove', (e) => {
    game.mouse.x = e.clientX;
    game.mouse.y = e.clientY;
    const st = game.state;
    if (!st) return;
    const w = screenToWorld(e);
    st.mouseWorld = w;
    if (st.placing) updatePlacing(st, w);
    if (game.box) { game.box.x1 = w.x; game.box.y1 = w.y; }
  });

  cv.addEventListener('mousedown', (e) => {
    const st = game.state;
    if (!st || !game.started || st.gameOver) return;
    const w = screenToWorld(e);
    if (e.button === 0) {
      if (st.placing) { game.hooks.tryPlace(st.placing.tx, st.placing.ty); return; }
      game.box = { x0: w.x, y0: w.y, x1: w.x, y1: w.y };
    } else if (e.button === 2) {
      if (st.placing) { st.placing = null; return; }
      game.hooks.issueRMB(w.x, w.y);
    }
  });

  window.addEventListener('mouseup', (e) => {
    const st = game.state;
    if (e.button !== 0 || !st || !game.box) return;
    const box = game.box;
    game.box = null;
    const w = screenToWorld(e);
    box.x1 = w.x; box.y1 = w.y;
    if (Math.abs(box.x1 - box.x0) < 5 && Math.abs(box.y1 - box.y0) < 5) {
      clickSelect(game, st, w, e.shiftKey);
    } else {
      boxSelect(game, st, box, e.shiftKey);
    }
    game.sound.click();
  });

  // ПКМ — игровые приказы, поэтому контекстное меню отключаем.
  cv.addEventListener('contextmenu', (e) => e.preventDefault());

  window.addEventListener('keydown', (e) => {
    const st = game.state;
    if (!st) return;
    if (e.code.startsWith('Arrow')) { held.add(e.code); e.preventDefault(); return; }
    if (!game.started || st.gameOver || e.repeat) return;

    // 1…9: выбор группы; Ctrl/Shift+1…9: назначить группу.
    const m = e.code.match(/^(?:Digit|Numpad)([1-9])$/);
    if (m) {
      e.preventDefault();
      const n = +m[1];
      if (e.ctrlKey || e.shiftKey) game.hooks.assignGroup(n);
      else game.hooks.selectGroup(n);
      return;
    }
    if (e.code === 'Escape') {
      if (st.placing) st.placing = null;
      else if (st.buildMenu) st.buildMenu = false;
      else st.selection = [];
      return;
    }
    if (e.code === 'KeyP') { game.togglePause(); return; }
    if (e.code === 'Space') { e.preventDefault(); return; } // пробел не скроллит страницу
    // Хоткеи панели команд (Q/W/E — стройка и производство, B, S).
    if (!e.ctrlKey && !e.altKey) game.ui.handleHotkey(e.code);
  });

  window.addEventListener('keyup', (e) => held.delete(e.code));
  window.addEventListener('blur', () => held.clear());
}

// Призрак здания следует за курсором, привязан к сетке тайлов.
function updatePlacing(st, w) {
  const cfg = BUILDINGS[st.placing.type];
  st.placing.tx = Math.max(0, Math.min(MAP_W - cfg.w, Math.round(w.x / TILE - cfg.w / 2)));
  st.placing.ty = Math.max(0, Math.min(MAP_H - cfg.h, Math.round(w.y / TILE - cfg.h / 2)));
}

function clickSelect(game, st, w, shift) {
  let picked = unitAt(st, w.x, w.y, 'player');
  let inspect = false;
  if (!picked) {
    const e = unitAt(st, w.x, w.y, 'enemy');
    if (e) { picked = e; inspect = true; }
  }
  if (!picked) {
    const b = buildingAt(st, w.x, w.y);
    if (b) { picked = b; inspect = b.side === 'enemy'; }
  }
  if (!picked) {
    if (!shift) st.selection = [];
    st.buildMenu = false;
    return;
  }
  // Врага можно только осмотреть — приказы на него из выделения не идут.
  if (inspect) { st.selection = [picked]; st.buildMenu = false; return; }
  if (shift) {
    const i = st.selection.indexOf(picked);
    if (i >= 0) st.selection.splice(i, 1);
    else st.selection.push(picked);
  } else {
    st.selection = [picked];
  }
  st.buildMenu = false;
}

function boxSelect(game, st, box, shift) {
  const x0 = Math.min(box.x0, box.x1), x1 = Math.max(box.x0, box.x1);
  const y0 = Math.min(box.y0, box.y1), y1 = Math.max(box.y0, box.y1);
  const inR = (x, y) => x >= x0 && x <= x1 && y >= y0 && y <= y1;
  // Приоритет юнитам; если юнитов нет — берём одно здание.
  // Сидящие в бункере (u.garrison) не выделяются — они «внутри».
  let picked = st.units.filter((u) => !u.dead && !u.garrison && u.side === 'player' && inR(u.x, u.y));
  if (!picked.length) {
    picked = st.buildings.filter((b) => !b.dead && b.side === 'player' &&
      b.tx * TILE < x1 && (b.tx + b.w) * TILE > x0 &&
      b.ty * TILE < y1 && (b.ty + b.h) * TILE > y0).slice(0, 1);
  }
  if (shift) {
    const set = new Set(st.selection);
    for (const p of picked) { if (set.has(p)) set.delete(p); else set.add(p); }
    picked = [...set];
  }
  st.selection = picked;
  st.buildMenu = false;
}

// Камера: стрелки + мышь у края экрана, кламп по границам мира.
export function updateCamera(game, dt) {
  const st = game.state;
  if (!st) return;
  const held = game.inputHeld;
  let dx = 0, dy = 0;
  if (held.has('ArrowLeft')) dx -= 1;
  if (held.has('ArrowRight')) dx += 1;
  if (held.has('ArrowUp')) dy -= 1;
  if (held.has('ArrowDown')) dy += 1;

  if (dx || dy) {
    st.camera.x += dx * KEY_SCROLL_SPEED * dt;
    st.camera.y += dy * KEY_SCROLL_SPEED * dt;
  } else if (game.started && !st.gameOver && game.mouse.x >= 0) {
    const m = game.mouse, M = EDGE_MARGIN;
    const w = window.innerWidth, h = window.innerHeight;
    if (m.x < M) st.camera.x -= EDGE_SCROLL_SPEED * dt;
    else if (m.x > w - M) st.camera.x += EDGE_SCROLL_SPEED * dt;
    if (m.y < M) st.camera.y -= EDGE_SCROLL_SPEED * dt;
    else if (m.y > h - M) st.camera.y += EDGE_SCROLL_SPEED * dt;
  }
  game.clampCam();
}
