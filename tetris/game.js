'use strict';
/* AXIIOM · Тетрис — падающие блоки.
   SRS-вращение с wall kicks, 7-bag, призрак, холдер, комбо,
   T-спины, back-to-back, эффекты и синтезированный звук. */

/* ===================== Константы ===================== */
var COLS = 10, ROWS = 22, HIDDEN = 2, VISIBLE = 20;
var LOCK_DELAY = 0.5, MAX_LOCK_RESETS = 15, CLEAR_DUR = 0.3;
var DAS = 0.15, ARR = 0.033, SOFT_IV = 0.03;
var SPRINT_LINES = 40, SPRINT_GRAV = 0.12;

var COLORS = {
  I:'#4FC3F7', J:'#64B5F6', L:'#FFB74D', O:'#FFD54F',
  S:'#81C784', T:'#BA68C8', Z:'#E57373'
};
var SHAPES = {
  I:[[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]],
  J:[[1,0,0],[1,1,1],[0,0,0]],
  L:[[0,0,1],[1,1,1],[0,0,0]],
  O:[[1,1],[1,1]],
  S:[[0,1,1],[1,1,0],[0,0,0]],
  T:[[0,1,0],[1,1,1],[0,0,0]],
  Z:[[1,1,0],[0,1,1],[0,0,0]]
};
/* SRS wall kicks: [dx, dyUp] — при применении y уменьшается на dyUp */
var KICKS_JLSTZ = {
  '01':[[0,0],[-1,0],[-1,1],[0,-2],[-1,-2]],
  '10':[[0,0],[1,0],[1,-1],[0,2],[1,2]],
  '12':[[0,0],[1,0],[1,-1],[0,2],[1,2]],
  '21':[[0,0],[-1,0],[-1,1],[0,-2],[-1,-2]],
  '23':[[0,0],[1,0],[1,1],[0,-2],[1,-2]],
  '32':[[0,0],[-1,0],[-1,-1],[0,2],[-1,2]],
  '30':[[0,0],[-1,0],[-1,-1],[0,2],[-1,2]],
  '03':[[0,0],[1,0],[1,1],[0,-2],[1,-2]]
};
var KICKS_I = {
  '01':[[0,0],[-2,0],[1,0],[-2,-1],[1,2]],
  '10':[[0,0],[2,0],[-1,0],[2,1],[-1,-2]],
  '12':[[0,0],[-1,0],[2,0],[-1,2],[2,-1]],
  '21':[[0,0],[1,0],[-2,0],[1,-2],[-2,1]],
  '23':[[0,0],[2,0],[-1,0],[2,1],[-1,-2]],
  '32':[[0,0],[-2,0],[1,0],[-2,-1],[1,2]],
  '30':[[0,0],[1,0],[-2,0],[1,-2],[-2,1]],
  '03':[[0,0],[-1,0],[2,0],[-1,2],[2,-1]]
};
var LINE_SCORES = [0,100,300,500,800];

/* ===================== Состояние ===================== */
var board, cur, hold, canHold, bag, queue;
var score, lines, level, combo, b2b;
var mode = 'marathon';                 // 'marathon' | 'sprint'
var state = 'welcome';                 // welcome | playing | clearing | paused | over
var prevState = 'playing';
var gravT, lockT, lockResets, forceLock, grounded, softDrop;
var lastAction, usedKick;              // для T-спина
var clearRows, clearT, pendingScore;
var particles, floats, elapsed;
var newRecord = false, prevBest = 0;
var cell = 24;                         // px клетки (пересчитывается)

/* Ввод */
var keys = { left:false, right:false, down:false, dir:0, dasT:0, arrT:0 };
var touchRepeat = null, touchTimer = null;

/* localStorage */
function lsGet(k, d){ try { var v = localStorage.getItem(k); return v === null ? d : v; } catch(e){ return d; } }
function lsSet(k, v){ try { localStorage.setItem(k, v); } catch(e){} }
function getBest(){ return parseInt(lsGet('tetris_best', '0'), 10) || 0; }
function getSprintBest(){ return parseInt(lsGet('tetris_sprint_best_ms', '0'), 10) || 0; }

/* ===================== Мешок и очередь ===================== */
function refillBag(){
  var t = ['I','J','L','O','S','T','Z'];
  for (var i = t.length - 1; i > 0; i--) {
    var j = Math.floor(Math.random() * (i + 1));
    var tmp = t[i]; t[i] = t[j]; t[j] = tmp;
  }
  bag = bag.concat(t);
}
function nextType(){
  while (queue.length < 5) { if (!bag || !bag.length) refillBag(); if (queue.length < 5) queue.push(bag.shift()); }
  return queue.shift();
}
function peekQueue(){ return queue; }

/* ===================== Фигуры ===================== */
function cloneM(m){ return m.map(function(r){ return r.slice(); }); }
function rotateCW(m){
  var N = m.length, r = [];
  for (var y = 0; y < N; y++) { var row = []; for (var x = 0; x < N; x++) row.push(m[N-1-x][y]); r.push(row); }
  return r;
}
function rotateCCW(m){
  var N = m.length, r = [];
  for (var y = 0; y < N; y++) { var row = []; for (var x = 0; x < N; x++) row.push(m[x][N-1-y]); r.push(row); }
  return r;
}
function collide(m, px, py){
  for (var y = 0; y < m.length; y++) for (var x = 0; x < m.length; x++) {
    if (!m[y][x]) continue;
    var bx = px + x, by = py + y;
    if (bx < 0 || bx >= COLS || by >= ROWS) return true;
    if (by >= 0 && board[by][bx]) return true;
  }
  return false;
}
function makePiece(type){
  return { type:type, m:cloneM(SHAPES[type]), x: type === 'O' ? 4 : 3, y:0, rot:0 };
}
function spawn(type){
  cur = makePiece(type);
  gravT = 0; lockT = 0; lockResets = 0; forceLock = false; grounded = false;
  lastAction = 'drop'; usedKick = 0;
  if (collide(cur.m, cur.x, cur.y)) { mergePiece(); gameOver(); return false; }
  drawPreviews();
  return true;
}
function spawnNext(){ spawn(nextType()); }

/* ===================== Движение ===================== */
function tryMove(dx, dy){
  if (!cur || state !== 'playing') return false;
  if (collide(cur.m, cur.x + dx, cur.y + dy)) return false;
  cur.x += dx; cur.y += dy;
  if (dy > 0) { lastAction = 'drop'; } else { lastAction = 'move'; }
  return true;
}
function moveH(dx){
  if (tryMove(dx, 0)) {
    sfx.move();
    if (collide(cur.m, cur.x, cur.y + 1)) { // на земле — сброс задержки фиксации
      if (lockResets < MAX_LOCK_RESETS) { lockT = 0; lockResets++; }
    }
  }
}
function rotatePiece(dir){
  if (!cur || state !== 'playing') return false;
  if (cur.type === 'O') return false;
  var newRot = (cur.rot + dir + 4) % 4;
  var newM = dir === 1 ? rotateCW(cur.m) : rotateCCW(cur.m);
  var table = (cur.type === 'I') ? KICKS_I : KICKS_JLSTZ;
  var kicks = table['' + cur.rot + newRot];
  for (var i = 0; i < kicks.length; i++) {
    var k = kicks[i], nx = cur.x + k[0], ny = cur.y - k[1];
    if (!collide(newM, nx, ny)) {
      cur.m = newM; cur.rot = newRot; cur.x = nx; cur.y = ny;
      lastAction = 'rotate'; usedKick = i;
      sfx.rotate();
      if (collide(cur.m, cur.x, cur.y + 1)) {
        if (lockResets < MAX_LOCK_RESETS) { lockT = 0; lockResets++; }
      }
      return true;
    }
  }
  return false;
}
function hardDrop(){
  if (!cur || state !== 'playing') return;
  var cells = 0;
  while (!collide(cur.m, cur.x, cur.y + 1)) { cur.y++; cells++; }
  if (cells > 0) score += cells * 2;
  sfx.hard();
  shake(cells > 6 ? 'big' : 'small');
  spawnDropParticles();
  lockPiece();
}
function holdSwap(){
  if (!cur || !canHold || state !== 'playing') return;
  sfx.hold();
  var t = cur.type;
  if (hold === null) { hold = t; spawnNext(); }
  else { var tmp = hold; hold = t; spawn(tmp); }
  canHold = false;
  drawPreviews();
}
function ghostY(){
  if (!cur) return 0;
  var y = cur.y;
  while (!collide(cur.m, cur.x, y + 1)) y++;
  return y;
}

/* ===================== T-спин ===================== */
function detectTSpin(){
  if (!cur || cur.type !== 'T' || lastAction !== 'rotate') return null;
  var cx = cur.x + 1, cy = cur.y + 1;
  function filled(dx, dy){
    var bx = cx + dx, by = cy + dy;
    if (bx < 0 || bx >= COLS || by >= ROWS) return true;
    if (by < 0) return false;
    return !!board[by][bx];
  }
  var corners = [filled(-1,-1), filled(1,-1), filled(-1,1), filled(1,1)];
  var count = corners.filter(Boolean).length;
  if (count < 3) return null;
  var fronts = [
    [corners[0], corners[1]], // rot 0 — вверх
    [corners[1], corners[3]], // rot 1 — вправо
    [corners[2], corners[3]], // rot 2 — вниз
    [corners[0], corners[2]]  // rot 3 — влево
  ][cur.rot];
  var full = (fronts[0] && fronts[1]) || usedKick === 4;
  return full ? 'full' : 'mini';
}

/* ===================== Фиксация и очистка ===================== */
function mergePiece(){
  var allHidden = true;
  for (var y = 0; y < cur.m.length; y++) for (var x = 0; x < cur.m.length; x++) {
    if (!cur.m[y][x]) continue;
    var by = cur.y + y, bx = cur.x + x;
    if (by >= 0 && by < ROWS && bx >= 0 && bx < COLS) board[by][bx] = cur.type;
    if (by >= HIDDEN) allHidden = false;
  }
  return allHidden;
}
function lockPiece(){
  var ts = detectTSpin();
  var allHidden = mergePiece();
  cur = null;
  canHold = true;
  if (allHidden) { gameOver(); return; }
  var full = [];
  for (var y = 0; y < ROWS; y++) {
    var ok = true;
    for (var x = 0; x < COLS; x++) if (!board[y][x]) { ok = false; break; }
    if (ok) full.push(y);
  }
  var n = full.length;
  if (n > 0) {
    /* Очки: линии × уровень, T-спин, B2B ×1.5, комбо */
    var base;
    if (ts === 'full')      base = [400, 800, 1200, 1600][n-1] || 1600;
    else if (ts === 'mini') base = [100, 200, 400][n-1] || 400;
    else                    base = LINE_SCORES[n];
    var difficult = (n === 4) || !!ts;
    var useB2B = difficult && b2b;
    b2b = difficult;
    combo++;
    var comboBonus = combo > 0 ? 50 * combo * level : 0;
    var pts = Math.floor(base * level * (useB2B ? 1.5 : 1)) + comboBonus;
    score += pts;
    pendingScore = pts;
    startClearing(full, ts, useB2B);
  } else {
    combo = -1;
    sfx.lock();
    spawnNext();
  }
  updateHUD();
}
function startClearing(rows, ts, useB2B){
  clearRows = rows; clearT = 0;
  state = 'clearing';
  spawnClearParticles(rows);
  /* Баннеры */
  var title = '', sub = '';
  if (ts === 'full')      { title = 'T-SPIN!'; }
  else if (ts === 'mini') { title = 'T-SPIN MINI'; }
  else if (rows.length === 4) { title = 'ТЕТРИС!'; }
  else if (rows.length === 3) { title = 'ТРОЙНАЯ!'; }
  else if (rows.length === 2) { title = 'ДВОЙНАЯ!'; }
  else { title = 'ЛИНИЯ!'; }
  if (useB2B) sub = 'B2B ×1.5';
  if (combo >= 1) sub = (sub ? sub + ' · ' : '') + 'Комбо ×' + (combo + 1);
  showBanner(title, sub);
  addFloat('+' + pendingScore, rows[0]);
  /* Звук */
  if (rows.length === 4) sfx.tetris();
  else if (ts) sfx.tspin();
  else sfx.clear(rows.length);
  if (combo >= 1) sfx.combo(combo);
  if (rows.length === 4) shake('big');
}
function finishClear(){
  var n = clearRows.length;
  for (var i = 0; i < n; i++) {
    var y = clearRows[i];
    board.splice(y, 1);
    board.unshift([]);
    for (var x = 0; x < COLS; x++) board[0][x] = null;
  }
  /* splice+unshift сдвигает индексы: удаляли сверху вниз, поэтому
     после каждой вставки индексы remaining rows корректны — rows шли по возрастанию */
  lines += n;
  clearRows = [];
  if (mode === 'sprint') {
    if (lines >= SPRINT_LINES) { winSprint(); return; }
  } else {
    var nl = Math.floor(lines / 10) + 1;
    if (nl > level) { level = nl; showBanner('УРОВЕНЬ ' + level, 'быстрее!'); sfx.levelup(); }
  }
  state = 'playing';
  spawnNext();
  updateHUD();
}

/* ===================== Скорость ===================== */
function gravInterval(){
  if (mode === 'sprint') return SPRINT_GRAV;
  return Math.max(0.008, Math.pow(0.8 - (level - 1) * 0.007, level - 1));
}

/* ===================== Запуск / конец ===================== */
function resetGame(){
  board = [];
  for (var y = 0; y < ROWS; y++) { var row = []; for (var x = 0; x < COLS; x++) row.push(null); board.push(row); }
  hold = null; canHold = true; bag = []; queue = [];
  score = 0; lines = 0; level = 1; combo = -1; b2b = false;
  gravT = 0; lockT = 0; lockResets = 0; forceLock = false; grounded = false; softDrop = false;
  clearRows = []; clearT = 0; pendingScore = 0;
  particles = []; floats = []; elapsed = 0;
  newRecord = false;
  keys.left = keys.right = keys.down = false; keys.dir = 0;
  softDrop = false;
}
function startGame(m){
  mode = m;
  resetGame();
  prevBest = (m === 'sprint') ? getSprintBest() : getBest();
  spawnNext();
  state = 'playing';
  document.getElementById('welcome').classList.add('hidden');
  document.getElementById('game').classList.remove('hidden');
  var fb = document.getElementById('fx-banner');
  fb.classList.remove('pop');
  fb.innerHTML = '';
  hideModal();
  var chip = document.getElementById('mode-chip');
  chip.textContent = m === 'sprint' ? 'Спринт · 40' : 'Маратон';
  chip.classList.toggle('sprint', m === 'sprint');
  updateHUD();
  drawPreviews();
  resize();
}
function gameOver(){
  state = 'over';
  sfx.over();
  var isRecord = false;
  if (mode === 'marathon') {
    if (score > getBest()) { lsSet('tetris_best', String(score)); isRecord = score > 0 && score > prevBest; }
  }
  showModal('over', 'Игра окончена',
    'Счёт: <b>' + fmtNum(score) + '</b> · Линий: <b>' + lines + '</b> · Уровень: <b>' + level + '</b><br>Время: <b>' + fmtTime(elapsed * 1000) + '</b>',
    isRecord, 'Ещё раз');
  updateWelcomeRecords();
  updateHUD();
}
function winSprint(){
  state = 'over';
  sfx.win();
  var ms = Math.round(elapsed * 1000);
  var isRecord = false;
  var best = getSprintBest();
  if (!best || ms < best) { lsSet('tetris_sprint_best_ms', String(ms)); isRecord = !!best; }
  showModal('win', 'Спринт пройден!',
    'Время: <b>' + fmtTime(ms, true) + '</b> · Линий: <b>' + SPRINT_LINES + '</b><br>Счёт: <b>' + fmtNum(score) + '</b>',
    isRecord, 'Ещё раз');
  updateWelcomeRecords();
  updateHUD();
}

/* ===================== DOM и канвасы ===================== */
function $(id){ return document.getElementById(id); }
var gc, ctx, holdC, holdCtx, nextC, nextCtx;

function setupCanvas(c, w, h){
  var d = window.devicePixelRatio || 1;
  c.width = Math.round(w * d); c.height = Math.round(h * d);
  c.style.width = w + 'px'; c.style.height = h + 'px';
  var x = c.getContext('2d');
  x.setTransform(d, 0, 0, d, 0, 0);
  return x;
}
function resize(){
  var wrap = $('canvas-wrap');
  if (!wrap.clientWidth) return;
  var availW = wrap.clientWidth - 20, availH = wrap.clientHeight - 16;
  cell = Math.max(12, Math.floor(Math.min(availW / COLS, availH / VISIBLE)));
  ctx = setupCanvas(gc, COLS * cell, VISIBLE * cell);
}

/* ===================== Рендер ===================== */
function shade(hex, f){
  var n = parseInt(hex.slice(1), 16), r = n >> 16 & 255, g = n >> 8 & 255, b = n & 255;
  if (f >= 0) { r += (255 - r) * f; g += (255 - g) * f; b += (255 - b) * f; }
  else { r *= (1 + f); g *= (1 + f); b *= (1 + f); }
  return 'rgb(' + (r | 0) + ',' + (g | 0) + ',' + (b | 0) + ')';
}
function rr(c, x, y, w, h, r){
  c.beginPath();
  c.moveTo(x + r, y);
  c.arcTo(x + w, y, x + w, y + h, r);
  c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r);
  c.arcTo(x, y, x + w, y, r);
  c.closePath();
}
function drawCell(c, px, py, size, color, ghost, glow, alpha){
  var baseA = (alpha === undefined) ? 1 : alpha;
  if (baseA <= 0) return;
  c.globalAlpha = baseA;
  var pad = Math.max(1, size * 0.06);
  var x = px + pad, y = py + pad, w = size - pad * 2, h = size - pad * 2, r = Math.max(2, size * 0.16);
  if (ghost) {
    c.strokeStyle = color; c.lineWidth = Math.max(1.5, size * 0.07);
    c.globalAlpha = baseA * 0.4;
    rr(c, x, y, w, h, r); c.stroke();
    c.globalAlpha = baseA;
  } else {
    if (glow) { c.shadowColor = color; c.shadowBlur = size * 0.45; }
    var g = c.createLinearGradient(0, y, 0, y + h);
    g.addColorStop(0, shade(color, 0.32)); g.addColorStop(1, shade(color, -0.18));
    c.fillStyle = g;
    rr(c, x, y, w, h, r); c.fill();
    c.shadowBlur = 0;
    c.strokeStyle = 'rgba(0,0,0,.25)'; c.lineWidth = 1;
    rr(c, x + 0.5, y + 0.5, w - 1, h - 1, r); c.stroke();
    c.strokeStyle = 'rgba(255,255,255,.32)'; c.lineWidth = Math.max(1, size * 0.05);
    var hy = y + Math.max(1.5, size * 0.09);
    c.beginPath(); c.moveTo(x + r * 0.8, hy); c.lineTo(x + w - r * 0.8, hy); c.stroke();
  }
  c.globalAlpha = 1;
}
function drawPreviews(){
  if (!holdCtx) return;
  var hw = 96, hh = 48, mc = 11;
  holdCtx.clearRect(0, 0, hw, hh);
  if (hold) {
    holdCtx.globalAlpha = canHold ? 1 : 0.35;
    drawMini(holdCtx, hold, hw / 2, hh / 2, mc);
    holdCtx.globalAlpha = 1;
  }
  var nw = 204, nh = 48;
  nextCtx.clearRect(0, 0, nw, nh);
  var q = queue.slice(0, 3);
  for (var i = 0; i < q.length; i++) drawMini(nextCtx, q[i], 34 + i * 68, nh / 2, mc);
}
function drawMini(c2, type, cx, cy, mc){
  var m = SHAPES[type], minR = 9, maxR = -1, minC = 9, maxC = -1, y, x;
  for (y = 0; y < m.length; y++) for (x = 0; x < m.length; x++) if (m[y][x]) {
    if (y < minR) minR = y; if (y > maxR) maxR = y;
    if (x < minC) minC = x; if (x > maxC) maxC = x;
  }
  var ox = cx - (maxC - minC + 1) * mc / 2 - minC * mc;
  var oy = cy - (maxR - minR + 1) * mc / 2 - minR * mc;
  for (y = 0; y < m.length; y++) for (x = 0; x < m.length; x++) if (m[y][x])
    drawCell(c2, ox + x * mc, oy + y * mc, mc, COLORS[type], false, false);
}
function render(){
  if (state === 'welcome') return;
  var W = COLS * cell, H = VISIBLE * cell, x, y;
  ctx.clearRect(0, 0, W, H);
  /* сетка */
  ctx.strokeStyle = 'rgba(255,255,255,.03)'; ctx.lineWidth = 1;
  for (x = 1; x < COLS; x++) { ctx.beginPath(); ctx.moveTo(x * cell + 0.5, 0); ctx.lineTo(x * cell + 0.5, H); ctx.stroke(); }
  for (y = 1; y < VISIBLE; y++) { ctx.beginPath(); ctx.moveTo(0, y * cell + 0.5); ctx.lineTo(W, y * cell + 0.5); ctx.stroke(); }
  /* стакан */
  var cl = (state === 'clearing') ? Math.max(0, 1 - clearT / CLEAR_DUR) : 0;
  for (y = HIDDEN; y < ROWS; y++) {
    var isClr = (state === 'clearing') && clearRows.indexOf(y) >= 0;
    for (x = 0; x < COLS; x++) {
      var t = board[y][x];
      if (!t) continue;
      var py = (y - HIDDEN) * cell;
      drawCell(ctx, x * cell, py, cell, COLORS[t], false, false, isClr ? cl : 1);
    }
    if (isClr && cl < 1) {
      ctx.fillStyle = 'rgba(255,255,255,' + (0.8 * (1 - cl)) + ')';
      rr(ctx, 2, (y - HIDDEN) * cell + 1, W - 4, cell - 2, cell * 0.16);
      ctx.fill();
    }
  }
  /* призрак и фигура */
  if (cur && state === 'playing') {
    var gy = ghostY();
    if (gy !== cur.y) for (y = 0; y < cur.m.length; y++) for (x = 0; x < cur.m.length; x++)
      if (cur.m[y][x] && gy + y >= HIDDEN) drawCell(ctx, (cur.x + x) * cell, (gy + y - HIDDEN) * cell, cell, COLORS[cur.type], true, false);
    for (y = 0; y < cur.m.length; y++) for (x = 0; x < cur.m.length; x++)
      if (cur.m[y][x] && cur.y + y >= HIDDEN) drawCell(ctx, (cur.x + x) * cell, (cur.y + y - HIDDEN) * cell, cell, COLORS[cur.type], false, true);
  }
  /* частицы */
  for (var i = 0; i < particles.length; i++) {
    var p = particles[i];
    ctx.globalAlpha = Math.max(0, p.life / p.tot);
    ctx.fillStyle = p.color;
    rr(ctx, p.x - p.s / 2, p.y - p.s / 2, p.s, p.s, p.s * 0.3);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  /* всплывающие очки */
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  for (i = 0; i < floats.length; i++) {
    var fl = floats[i];
    var pr = 1 - fl.life / fl.tot;
    ctx.globalAlpha = Math.max(0, fl.life / fl.tot);
    ctx.font = '800 ' + Math.max(14, cell * 0.62) + 'px Inter, sans-serif';
    var fy = (fl.row - HIDDEN + 0.5) * cell - pr * cell * 1.2;
    ctx.strokeStyle = 'rgba(0,0,0,.55)'; ctx.lineWidth = 3;
    ctx.strokeText(fl.text, W / 2, fy);
    ctx.fillStyle = '#F5D9A8';
    ctx.fillText(fl.text, W / 2, fy);
  }
  ctx.globalAlpha = 1;
  /* тревога: стакан высокий */
  if (state === 'playing' || state === 'clearing') {
    var top = ROWS;
    for (y = HIDDEN; y < ROWS; y++) { var any = false; for (x = 0; x < COLS; x++) if (board[y][x]) { any = true; break; } if (any) { top = y; break; } }
    if (top - HIDDEN <= 6) {
      var a = 0.08 + 0.05 * Math.sin(performance.now() / 180);
      var gr = ctx.createLinearGradient(0, 0, 0, cell * 5);
      gr.addColorStop(0, 'rgba(201,106,106,' + a.toFixed(3) + ')');
      gr.addColorStop(1, 'rgba(201,106,106,0)');
      ctx.fillStyle = gr;
      ctx.fillRect(0, 0, W, cell * 5);
    }
  }
}

/* ===================== Эффекты ===================== */
function addFloat(text, row){ floats.push({ text:text, row:row, life:1, tot:1 }); }
function shake(kind){
  gc.classList.remove('shake', 'shake-big');
  void gc.offsetWidth;
  gc.classList.add(kind === 'big' ? 'shake-big' : 'shake');
}
function spawnClearParticles(rows){
  for (var i = 0; i < rows.length; i++) {
    var y = rows[i];
    for (var x = 0; x < COLS; x++) {
      var t = board[y][x]; if (!t) continue;
      var col = COLORS[t];
      for (var k = 0; k < 3; k++) particles.push({
        x: (x + 0.5) * cell + (Math.random() - 0.5) * cell * 0.6,
        y: (y - HIDDEN + 0.5) * cell,
        vx: (Math.random() - 0.5) * cell * 6,
        vy: -cell * (2 + Math.random() * 5),
        s: cell * (0.14 + Math.random() * 0.18),
        color: k === 0 ? '#FFFFFF' : col,
        life: 0.5 + Math.random() * 0.4, tot: 0.9
      });
    }
  }
}
function spawnDropParticles(){
  if (!cur) return;
  for (var x = 0; x < cur.m.length; x++) {
    var lowest = -1;
    for (var y = 0; y < cur.m.length; y++) if (cur.m[y][x]) lowest = y;
    if (lowest < 0 || cur.y + lowest + 1 < HIDDEN) continue;
    particles.push({
      x: (cur.x + x + 0.5) * cell,
      y: (cur.y + lowest + 1 - HIDDEN) * cell,
      vx: (Math.random() - 0.5) * cell * 4,
      vy: -cell * (1 + Math.random() * 2),
      s: cell * 0.12, color: '#8E8E93',
      life: 0.3 + Math.random() * 0.2, tot: 0.5
    });
  }
}
function updateFX(dt){
  var i;
  for (i = particles.length - 1; i >= 0; i--) {
    var p = particles[i];
    p.life -= dt;
    if (p.life <= 0) { particles.splice(i, 1); continue; }
    p.x += p.vx * dt; p.y += p.vy * dt;
    p.vy += cell * 22 * dt;
  }
  for (i = floats.length - 1; i >= 0; i--) {
    floats[i].life -= dt * 1.1;
    if (floats[i].life <= 0) floats.splice(i, 1);
  }
}

/* ===================== Баннер ===================== */
function showBanner(title, sub){
  var b = $('fx-banner');
  b.innerHTML = title + (sub ? '<small>' + sub + '</small>' : '');
  b.classList.remove('pop');
  void b.offsetWidth;
  b.classList.add('pop');
}

/* ===================== HUD ===================== */
function fmtNum(n){ try { return n.toLocaleString('ru-RU'); } catch(e) { return String(n); } }
function fmtTime(ms, tenths){
  var s = Math.floor(ms / 1000), m = Math.floor(s / 60); s = s % 60;
  var base = m + ':' + (s < 10 ? '0' : '') + s;
  if (tenths) base += '.' + Math.floor((ms % 1000) / 100);
  return base;
}
function updateHUD(){
  $('st-score').textContent = fmtNum(score);
  $('st-lines').textContent = (mode === 'sprint') ? lines + '/' + SPRINT_LINES : String(lines);
  $('st-level').textContent = String(level);
  var bestEl = $('st-best');
  if (mode === 'sprint') {
    var sb = getSprintBest();
    bestEl.textContent = sb ? fmtTime(sb, true) : '—';
  } else {
    bestEl.textContent = fmtNum(Math.max(getBest(), score));
  }
  var pw = 0;
  if (mode === 'sprint') pw = Math.min(100, lines / SPRINT_LINES * 100);
  else pw = (lines % 10) * 10;
  $('progress-fill').style.width = pw + '%';
  $('st-time').textContent = fmtTime(elapsed * 1000);
}

/* ===================== Обновление ===================== */
var hudT = 0;
function update(dt){
  elapsed += dt;
  /* Время в HUD */
  hudT += dt;
  if (hudT > 0.25) { hudT = 0; $('st-time').textContent = fmtTime(elapsed * 1000); }
  /* Анимация очистки линий */
  if (state === 'clearing') {
    clearT += dt;
    if (clearT >= CLEAR_DUR) finishClear();
    return;
  }
  if (!cur) return;
  /* DAS/ARR — автоповтор влево/вправо */
  if (keys.dir !== 0) {
    keys.dasT += dt;
    if (keys.dasT >= DAS) {
      keys.arrT += dt;
      while (keys.arrT >= ARR) { keys.arrT -= ARR; moveH(keys.dir); }
    }
  }
  /* Гравитация */
  var iv = (keys.down || softDrop) ? Math.min(gravInterval(), SOFT_IV) : gravInterval();
  gravT += dt;
  while (gravT >= iv && cur && state === 'playing') {
    gravT -= iv;
    if (!collide(cur.m, cur.x, cur.y + 1)) {
      cur.y++; lastAction = 'drop';
      lockT = 0; lockResets = 0; grounded = false;
      if (keys.down || softDrop) score += 1;
    } else { grounded = true; break; }
  }
  /* Задержка фиксации */
  if (cur && state === 'playing' && collide(cur.m, cur.x, cur.y + 1)) {
    lockT += dt;
    if (lockT >= LOCK_DELAY || forceLock) lockPiece();
  }
  /* Живой рекорд */
  if (mode === 'marathon' && score > getBest()) $('st-best').textContent = fmtNum(score);
}

/* ===================== Звук (WebAudio, без файлов) ===================== */
var muted = lsGet('tetris_muted', '0') === '1';
var actx = null, master = null;
function ensureAudio(){
  if (!actx) {
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    actx = new AC();
    master = actx.createGain();
    master.gain.value = 0.22;
    master.connect(actx.destination);
  }
  if (actx.state === 'suspended') actx.resume();
}
function tone(freq, dur, type, vol, slideTo, delay){
  if (muted || !actx) return;
  var t0 = actx.currentTime + (delay || 0);
  var o = actx.createOscillator(), g = actx.createGain();
  o.type = type || 'square';
  o.frequency.setValueAtTime(freq, t0);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(30, slideTo), t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(Math.max(0.001, vol * 0.5), t0 + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g); g.connect(master);
  o.start(t0); o.stop(t0 + dur + 0.02);
}
function noiseSfx(dur, vol, delay){
  if (muted || !actx) return;
  var t0 = actx.currentTime + (delay || 0);
  var len = Math.max(1, Math.floor(actx.sampleRate * dur));
  var buf = actx.createBuffer(1, len, actx.sampleRate);
  var d = buf.getChannelData(0);
  for (var i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
  var src = actx.createBufferSource(); src.buffer = buf;
  var g = actx.createGain(); g.gain.value = vol * 0.4;
  src.connect(g); g.connect(master);
  src.start(t0);
}
var sfx = {
  move:   function(){ tone(150, 0.03, 'square', 0.25); },
  rotate: function(){ tone(290, 0.05, 'square', 0.35); },
  lock:   function(){ tone(120, 0.06, 'triangle', 0.5); noiseSfx(0.03, 0.2); },
  hard:   function(){ noiseSfx(0.07, 0.5); tone(85, 0.09, 'triangle', 0.6); },
  hold:   function(){ tone(240, 0.07, 'sine', 0.4); tone(320, 0.06, 'sine', 0.3, 0, 0.05); },
  clear:  function(n){ var f = [0, 420, 480, 560, 660]; for (var i = 0; i < n && i < 3; i++) tone(f[1] + i * 90, 0.09, 'square', 0.4, 0, i * 0.06); },
  tetris: function(){ [523, 659, 784, 1047].forEach(function(f, i){ tone(f, 0.12, 'square', 0.45, 0, i * 0.07); }); },
  tspin:  function(){ tone(560, 0.14, 'sawtooth', 0.4, 900); tone(840, 0.1, 'square', 0.3, 0, 0.08); },
  combo:  function(c){ tone(380 + 70 * Math.min(c, 8), 0.07, 'square', 0.35); },
  levelup:function(){ tone(523, 0.1, 'square', 0.4); tone(784, 0.14, 'square', 0.4, 0, 0.1); },
  over:   function(){ tone(300, 0.5, 'sawtooth', 0.4, 70); tone(150, 0.6, 'triangle', 0.35, 50, 0.1); },
  win:    function(){ [523, 659, 784, 1047, 1319].forEach(function(f, i){ tone(f, 0.14, 'square', 0.45, 0, i * 0.09); }); }
};

/* ===================== Модалки ===================== */
var modalAction = null;
function showModal(kind, title, subHTML, isRecord, primaryLabel){
  var m = $('modal');
  m.className = 'modal-' + kind;
  m.classList.remove('hidden');
  $('modal-record').classList.toggle('hidden', !isRecord);
  $('modal-title').textContent = title;
  $('modal-sub').innerHTML = subHTML;
  $('modal-btn').textContent = primaryLabel;
  modalAction = (kind === 'pause') ? resumeGame : function(){ startGame(mode); };
}
function hideModal(){ $('modal').classList.add('hidden'); }
function resumeGame(){
  hideModal();
  state = prevState;
  lastT = performance.now();
}
function togglePause(){
  if (state === 'playing' || state === 'clearing') {
    prevState = state;
    state = 'paused';
    showModal('pause', 'Пауза', 'Фигура подождёт. Отдохни — и обратно в бой.', false, 'Продолжить');
  } else if (state === 'paused') {
    resumeGame();
  }
}
function toWelcome(){
  state = 'welcome';
  hideModal();
  $('game').classList.add('hidden');
  $('welcome').classList.remove('hidden');
  updateWelcomeRecords();
}
function updateWelcomeRecords(){
  var b = getBest(), sb = getSprintBest();
  var rm = $('rec-marathon'), rs = $('rec-sprint');
  rm.classList.toggle('hidden', !b);
  rm.querySelector('b').textContent = fmtNum(b);
  rs.classList.toggle('hidden', !sb);
  rs.querySelector('b').textContent = sb ? fmtTime(sb, true) : '—';
}
function updateSoundBtn(){ $('btn-sound').textContent = muted ? '🔇' : '🔊'; }
function toggleSound(){
  muted = !muted;
  lsSet('tetris_muted', muted ? '1' : '0');
  updateSoundBtn();
  if (!muted) { ensureAudio(); sfx.rotate(); }
}

/* ===================== Клавиатура ===================== */
function onKeyDown(e){
  var k = e.key;
  if (state === 'welcome') {
    if (k === 'Enter') { ensureAudio(); startGame('marathon'); }
    return;
  }
  if (k === 'ArrowLeft' || k === 'ArrowRight' || k === 'ArrowDown' || k === 'ArrowUp' || k === ' ') e.preventDefault();
  if (e.repeat) return;
  switch (k) {
    case 'ArrowLeft': case 'a': case 'A': case 'ф': case 'Ф':
      keys.left = true; keys.dir = -1; keys.dasT = 0; keys.arrT = 0; moveH(-1); break;
    case 'ArrowRight': case 'd': case 'D': case 'в': case 'В':
      keys.right = true; keys.dir = 1; keys.dasT = 0; keys.arrT = 0; moveH(1); break;
    case 'ArrowDown': case 's': case 'S': case 'ы': case 'Ы':
      keys.down = true; softDrop = true; break;
    case 'ArrowUp': case 'x': case 'X': case 'ч': case 'Ч':
      rotatePiece(1); break;
    case 'z': case 'Z': case 'я': case 'Я':
      rotatePiece(-1); break;
    case ' ':
      hardDrop(); break;
    case 'c': case 'C': case 'с': case 'С': case 'Shift':
      holdSwap(); break;
    case 'p': case 'P': case 'з': case 'З': case 'Escape':
      togglePause(); break;
    case 'm': case 'M': case 'ь': case 'Ь':
      toggleSound(); break;
    case 'r': case 'R': case 'к': case 'К':
      if (state !== 'welcome' && state !== 'over') startGame(mode);
      break;
  }
  ensureAudio();
}
function onKeyUp(e){
  switch (e.key) {
    case 'ArrowLeft': case 'a': case 'A': case 'ф': case 'Ф':
      keys.left = false; keys.dir = keys.right ? 1 : 0; keys.dasT = 0; keys.arrT = 0; break;
    case 'ArrowRight': case 'd': case 'D': case 'в': case 'В':
      keys.right = false; keys.dir = keys.left ? -1 : 0; keys.dasT = 0; keys.arrT = 0; break;
    case 'ArrowDown': case 's': case 'S': case 'ы': case 'Ы':
      keys.down = false; softDrop = false; break;
  }
}

/* ===================== Свайпы по полю ===================== */
var sw = null;
function bindSwipe(){
  gc.addEventListener('pointerdown', function(e){
    if (state !== 'playing' || !cur) return;
    sw = { x:e.clientX, y:e.clientY, t:performance.now(), accX:0, moved:false, softed:false };
    try { gc.setPointerCapture(e.pointerId); } catch(err) {}
  });
  gc.addEventListener('pointermove', function(e){
    if (!sw || state !== 'playing' || !cur) return;
    var dx = e.clientX - sw.x, dy = e.clientY - sw.y;
    while (dx - sw.accX > cell) { if (!tryMove(1, 0)) break; sw.accX += cell; sw.moved = true; }
    while (sw.accX - dx > cell) { if (!tryMove(-1, 0)) break; sw.accX -= cell; sw.moved = true; }
    if (Math.abs(dx) > 8 || Math.abs(dy) > 8) sw.moved = true;
    if (dy > 24 && !sw.softed) { softDrop = true; sw.softed = true; }
  });
  function endSwipe(e){
    if (!sw) return;
    var dx = e.clientX - sw.x, dy = e.clientY - sw.y, dt = performance.now() - sw.t;
    var adx = Math.abs(dx), ady = Math.abs(dy);
    if (state === 'playing' && cur) {
      if (adx < 10 && ady < 10 && dt < 260) rotatePiece(1);
      else if (dy < -40 && adx < 40 && ady > adx && dt < 300) holdSwap();
      else if (dy > 70 && adx < 40 && dt < 220) hardDrop();
    }
    softDrop = false;
    sw = null;
  }
  gc.addEventListener('pointerup', endSwipe);
  gc.addEventListener('pointercancel', function(){ softDrop = false; sw = null; });
}

/* ===================== Touch-кнопки ===================== */
function stopRepeat(){
  if (touchTimer) { clearTimeout(touchTimer); touchTimer = null; }
  if (touchRepeat) { clearInterval(touchRepeat); touchRepeat = null; }
}
function bindRepeat(btn, fn){
  btn.addEventListener('pointerdown', function(e){
    e.preventDefault();
    if (state !== 'playing') return;
    fn();
    touchTimer = setTimeout(function(){
      touchRepeat = setInterval(function(){ if (state === 'playing') fn(); }, 55);
    }, 180);
  });
  ['pointerup', 'pointercancel', 'pointerleave'].forEach(function(ev){
    btn.addEventListener(ev, stopRepeat);
  });
}
function bindTap(btn, fn){
  btn.addEventListener('pointerdown', function(e){
    e.preventDefault();
    if (state !== 'playing') return;
    fn();
  });
}

/* ===================== Привязка UI ===================== */
function bindUI(){
  $('btn-marathon').addEventListener('click', function(){ ensureAudio(); startGame('marathon'); });
  $('btn-sprint').addEventListener('click', function(){ ensureAudio(); startGame('sprint'); });
  $('btn-pause').addEventListener('click', function(){ ensureAudio(); togglePause(); });
  $('btn-restart').addEventListener('click', function(){ ensureAudio(); if (state !== 'welcome') startGame(mode); });
  $('btn-sound').addEventListener('click', toggleSound);
  $('modal-btn').addEventListener('click', function(){ ensureAudio(); if (modalAction) modalAction(); });
  $('modal-btn2').addEventListener('click', function(){ ensureAudio(); toWelcome(); });

  bindRepeat($('t-left'), function(){ moveH(-1); });
  bindRepeat($('t-right'), function(){ moveH(1); });
  bindTap($('t-rot'), function(){ rotatePiece(1); });
  bindTap($('t-drop'), function(){ hardDrop(); });
  bindTap($('t-hold'), function(){ holdSwap(); });
  var tdown = $('t-down');
  tdown.addEventListener('pointerdown', function(e){ e.preventDefault(); if (state === 'playing') softDrop = true; });
  ['pointerup', 'pointercancel', 'pointerleave'].forEach(function(ev){
    tdown.addEventListener(ev, function(){ softDrop = false; });
  });

  bindSwipe();
  document.addEventListener('keydown', onKeyDown);
  document.addEventListener('keyup', onKeyUp);
  document.addEventListener('visibilitychange', function(){
    if (document.hidden && (state === 'playing' || state === 'clearing')) togglePause();
  });
  window.addEventListener('resize', function(){ resize(); if (state !== 'welcome') drawPreviews(); });
  document.addEventListener('pointerdown', function(){ ensureAudio(); }, { once:false });
}

/* ===================== Игровой цикл ===================== */
var lastT = performance.now();
function frame(t){
  var dt = (t - lastT) / 1000;
  lastT = t;
  if (dt > 0.1) dt = 0.1;
  if (dt < 0) dt = 0;
  if (state === 'playing' || state === 'clearing') update(dt);
  updateFX(dt);
  render();
  requestAnimationFrame(frame);
}

/* ===================== Инициализация ===================== */
function init(){
  gc = $('gc');
  holdC = $('hold-c'); nextC = $('next-c');
  holdCtx = setupCanvas(holdC, 96, 48);
  nextCtx = setupCanvas(nextC, 204, 48);
  resetGame();
  resize();
  bindUI();
  updateWelcomeRecords();
  updateSoundBtn();
  requestAnimationFrame(frame);
}
init();


