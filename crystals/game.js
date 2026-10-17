'use strict';
/* Кристаллы — merge-drop игра AXIIOM. Canvas + vanilla JS, без зависимостей.
   Механика: падают кристаллы, два одинаковых сливаются в следующий тир.
   Вызов дня: seeded-генератор по дате Europe/Moscow — один расклад на всех. */

// ===== Утилиты и RNG =====
function xmur3(str){
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++){
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return function(){
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return (h ^= h >>> 16) >>> 0;
  };
}
function mulberry32(a){
  return function(){
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
// Дата в Europe/Moscow в формате YYYY-MM-DD (Intl 'sv-SE' даёт ISO-подобный вид)
function moscowDate(){
  try { return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Moscow' }).format(new Date()); }
  catch (e) { return new Date().toISOString().slice(0, 10); }
}
const MONTHS_RU = ['января','февраля','марта','апреля','мая','июня','июля','августа','сентября','октября','ноября','декабря'];
function dateRu(iso){
  const p = iso.split('-');
  return parseInt(p[2], 10) + ' ' + MONTHS_RU[parseInt(p[1], 10) - 1];
}
function clamp(v, a, b){ return v < a ? a : (v > b ? b : v); }
// Осветлить/затемнить hex (#RRGGBB): f>0 к белому, f<0 к чёрному
function shade(hex, f){
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  if (f >= 0){ r += (255 - r) * f; g += (255 - g) * f; b += (255 - b) * f; }
  else { r *= 1 + f; g *= 1 + f; b *= 1 + f; }
  return 'rgb(' + Math.round(r) + ',' + Math.round(g) + ',' + Math.round(b) + ')';
}

// ===== Тиры кристаллов =====
const TIERS = [
  { name: 'Осколок',       r: 13,  color: '#9AA0AA', sides: 5 },
  { name: 'Кварц',         r: 18,  color: '#E8DCC8', sides: 6 },
  { name: 'Янтарь',        r: 24,  color: '#D4A574', sides: 5 },
  { name: 'Топаз',         r: 31,  color: '#E8B04B', sides: 6 },
  { name: 'Аметист',       r: 39,  color: '#9B6FD4', sides: 7 },
  { name: 'Изумруд',       r: 48,  color: '#4FC98E', sides: 6 },
  { name: 'Рубин',         r: 58,  color: '#E4545F', sides: 8 },
  { name: 'Сапфир',        r: 69,  color: '#4F8FE4', sides: 7 },
  { name: 'Алмаз',         r: 81,  color: '#BFE3F2', sides: 9 },
  { name: 'Звезда AXIIOM', r: 94,  color: '#F2C94C', sides: 10 },
  { name: 'Сердце AXIIOM', r: 108, color: '#FFD98E', sides: 12 }
];
// Очки за слияние двух кристаллов тира i (в следующий)
const MERGE_POINTS = [1, 3, 6, 10, 15, 21, 28, 36, 45, 55];
const FINAL_BONUS = 200;          // слияние двух Сердец AXIIOM
const SPAWN_WEIGHTS = [28, 24, 20, 16, 12]; // тиры 0..4

// Формы фиксированы на тир (стабильные «грани»)
(function bakeShapes(){
  const sh = mulberry32(20260101);
  TIERS.forEach(t => {
    t.jitter = [];
    for (let i = 0; i < t.sides; i++) t.jitter.push(0.92 + sh() * 0.13);
  });
})();

// ===== Поле =====
const W = 400, H = 580;          // логические размеры
const LINE_Y = 96;               // линия переполнения
const SPAWN_Y = 40;              // точка появления
const GRAV = 0.11;               // ускорение на подшаг
const SUBSTEPS = 3, ITER = 6;
const STEP_MS = 16.6;            // шаг физики
const AIR_DAMP = 0.9985;
const WALL_BOUNCE = 0.32;
const DROP_COOLDOWN = 460;
const CHAIN_WINDOW = 900;        // мс для комбо
const DANGER_LIMIT = 2000;       // мс над линией до проигрыша

// ===== Состояние =====
let crystals = [], particles = [], popups = [];
let curTier = 0, nextTier = 0;
let score = 0, mode = 'daily';
let running = false, over = false;
let aimX = W / 2, lastDrop = -9999;
let dangerAcc = 0, chainN = 0, lastMergeAt = 0;
let shakeT = 0, acc = 0, lastFrame = 0;
let rng = Math.random;
let uid = 1;

// ===== localStorage =====
const LS = {
  get(k, d){ try { const v = localStorage.getItem(k); return v === null ? d : v; } catch (e) { return d; } },
  set(k, v){ try { localStorage.setItem(k, v); } catch (e) {} }
};
function bestEver(){ return parseInt(LS.get('crystals.best', '0'), 10) || 0; }
function bestDaily(){ return parseInt(LS.get('crystals.daily.' + moscowDate(), '0'), 10) || 0; }

// ===== Звук (WebAudio, разблокировка по жесту — урок match3) =====
let AC = null;
let muted = LS.get('crystals.sound', '1') === '0';
function ensureAudio(){
  if (!AC){ try { AC = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { AC = null; } }
  if (AC && AC.state === 'suspended') AC.resume();
}
function tone(freq, dur, type, vol, slideTo){
  if (muted || !AC) return;
  try {
    const o = AC.createOscillator(), g = AC.createGain(), t = AC.currentTime;
    o.type = type || 'sine';
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(30, slideTo), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol || 0.1, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(AC.destination);
    o.start(t); o.stop(t + dur + 0.02);
  } catch (e) {}
}
function sfxDrop(){ tone(170, 0.07, 'triangle', 0.07); }
function sfxMerge(tier){
  tone(240 + tier * 55, 0.13, 'sine', 0.11);
  if (tier >= 5) tone(480 + tier * 55, 0.16, 'sine', 0.06);
  if (tier >= 9) tone(700 + tier * 40, 0.2, 'triangle', 0.05);
}
function sfxOver(){ tone(320, 0.25, 'sawtooth', 0.06, 150); setTimeout(() => tone(180, 0.4, 'sawtooth', 0.06, 70), 160); }
function sfxRecord(){ [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => tone(f, 0.14, 'triangle', 0.09), i * 90)); }

// ===== DOM =====
const $ = id => document.getElementById(id);
const elWelcome = $('welcome'), elGame = $('game'), elModal = $('modal');
const elScore = $('score-val'), elDaily = $('daily-val'), elBest = $('best-val');
const elDanger = $('danger-fill');
const elModalBadge = $('modal-badge'), elModalScore = $('modal-score');
const elModalCard = $('modal-card');
const cv = $('gc'), ctx = cv.getContext('2d');
const nc = $('nc'), nctx = nc.getContext('2d');

// ===== Размеры канваса (DPR + вписывание в обёртку) =====
let view = { s: 1, dpr: 1 };
function resizeCanvas(){
  const wrap = $('canvas-wrap');
  const availW = wrap.clientWidth - 24, availH = wrap.clientHeight - 24;
  const s = Math.min(availW / W, availH / H, 1.15);
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  view = { s: s, dpr: dpr };
  cv.style.width = Math.round(W * s) + 'px';
  cv.style.height = Math.round(H * s) + 'px';
  cv.width = Math.round(W * s * dpr);
  cv.height = Math.round(H * s * dpr);
  nc.width = 30 * dpr; nc.height = 30 * dpr;
  drawNext();
}
window.addEventListener('resize', resizeCanvas);

// ===== Спавн =====
function rollTier(){
  if (rng === Math.random){
    let sum = 0, i;
    for (i = 0; i < SPAWN_WEIGHTS.length; i++) sum += SPAWN_WEIGHTS[i];
    let v = Math.random() * sum;
    for (let t = 0; t < SPAWN_WEIGHTS.length; t++){ v -= SPAWN_WEIGHTS[t]; if (v < 0) return t; }
    return 0;
  }
  let sum = 0; for (let i = 0; i < SPAWN_WEIGHTS.length; i++) sum += SPAWN_WEIGHTS[i];
  let v = rng() * sum;
  for (let t = 0; t < SPAWN_WEIGHTS.length; t++){ v -= SPAWN_WEIGHTS[t]; if (v < 0) return t; }
  return 0;
}
function makeCrystal(tier, x, y){
  const r = TIERS[tier].r;
  return { id: uid++, tier: tier, r: r, x: clamp(x, r + 2, W - r - 2), y: y,
           px: clamp(x, r + 2, W - r - 2), py: y,
           // угол — на Math.random, чтобы НЕ расходовать сид вызова дня:
           // последовательность тиров зависит только от числа бросков
           angle: Math.random() * Math.PI * 2,
           born: performance.now(), merged: false };
}

// ===== Физика (verlet + проекция коллизий) =====
function stepPhysics(){
  const now = performance.now();
  for (let s = 0; s < SUBSTEPS; s++){
    // интеграция
    for (let i = 0; i < crystals.length; i++){
      const c = crystals[i];
      if (c.dead) continue;
      let vx = (c.x - c.px) * AIR_DAMP, vy = (c.y - c.py) * AIR_DAMP;
      // притяжение к ближайшему одинакового тира (мягкий магнит Suika)
      for (let j = 0; j < crystals.length; j++){
        if (j === i) continue;
        const o = crystals[j];
        if (o.dead || o.tier !== c.tier) continue;
        const ddx = o.x - c.x, ddy = o.y - c.y;
        const rs2 = c.r + o.r;
        const dd = Math.sqrt(ddx * ddx + ddy * ddy);
        if (dd > rs2 * 0.6 && dd < rs2 * 1.6){
          vx += (ddx / dd) * 0.07;
          vy += (ddy / dd) * 0.07;
          break;
        }
      }
      c.px = c.x; c.py = c.y;
      c.x += vx; c.y += vy + GRAV;
      if (Math.abs(vy) > 7) c.y = c.py + 7; // кламп скорости
      c.angle += (c.x - c.px) * 0.05 / (c.r / 20);
    }
    // мгновенные слияния по контакту
    collectMerges();
    // релаксация коллизий
    for (let it = 0; it < ITER; it++){
      for (let a = 0; a < crystals.length; a++){
        const c1 = crystals[a];
        if (c1.dead) continue;
        for (let b = a + 1; b < crystals.length; b++){
          const c2 = crystals[b];
          if (c2.dead) continue;
          let dx = c2.x - c1.x, dy = c2.y - c1.y;
          const rs = c1.r + c2.r;
          let d2 = dx * dx + dy * dy;
          if (d2 >= rs * rs) continue;
          let d = Math.sqrt(d2);
          if (d < 0.01){ dx = 1; dy = 0; d = 1; }
          const ov = (rs - d) / d;
          const m1 = c2.r * c2.r, m2 = c1.r * c1.r, mt = m1 + m2;
          const w1 = m1 / mt * ov, w2 = m2 / mt * ov;
          c1.x -= dx * w1; c1.y -= dy * w1;
          c2.x += dx * w2; c2.y += dy * w2;
        }
        // стены
        wall(c1);
      }
    }
  }
  // частицы и всплывающие очки
  updateFx(now);
}
function wall(c){
  if (c.x < c.r){ c.x = c.r; c.px = c.x + (c.px - c.x) * -WALL_BOUNCE; }
  if (c.x > W - c.r){ c.x = W - c.r; c.px = c.x + (c.px - c.x) * -WALL_BOUNCE; }
  if (c.y > H - c.r){ c.y = H - c.r; c.py = c.y + (c.py - c.y) * -WALL_BOUNCE; }
  if (c.y < c.r - 60) c.y = c.r - 60; // страховка сверху
}
function collectMerges(){
  const now = performance.now();
  for (let a = 0; a < crystals.length; a++){
    const c1 = crystals[a];
    if (c1.dead || c1.merged) continue;
    for (let b = a + 1; b < crystals.length; b++){
      const c2 = crystals[b];
      if (c2.dead || c2.merged || c2.tier !== c1.tier) continue;
      const dx = c2.x - c1.x, dy = c2.y - c1.y;
      const rs = c1.r + c2.r;
      if (dx * dx + dy * dy > rs * rs * 1.002) continue; // слияние по касанию
      doMerge(c1, c2, now);
      break;
    }
  }
}
function doMerge(c1, c2, now){
  const t = c1.tier;
  c1.dead = true; c2.dead = true; c1.merged = c2.merged = true;
  // комбо
  chainN = (now - lastMergeAt < CHAIN_WINDOW) ? chainN + 1 : 1;
  lastMergeAt = now;
  const mult = Math.min(chainN, 5);
  let pts;
  const cx = (c1.x * c1.r + c2.x * c2.r) / (c1.r + c2.r);
  const cy = (c1.y * c1.r + c2.y * c2.r) / (c1.r + c2.r);
  if (t >= TIERS.length - 1){
    pts = FINAL_BONUS * mult;
    spawnBurst(cx, cy, TIERS[TIERS.length - 1].color, 26, 5);
    shakeT = 200;
  } else {
    pts = MERGE_POINTS[t] * mult;
    const nc2 = makeCrystal(t + 1, cx, cy);
    nc2.merged = false;
    // лёгкий подброс после слияния
    nc2.py = nc2.y + 1.6;
    crystals.push(nc2);
    spawnBurst(cx, cy, TIERS[t].color, 10 + t * 2, 2.2 + t * 0.4);
    if (t >= 6) shakeT = 130;
  }
  score += pts;
  popups.push({ x: cx, y: cy, txt: '+' + pts + (mult > 1 ? ' ×' + mult : ''), life: 1, color: t >= 6 ? '#F2C94C' : '#D4A574' });
  // убрать мёртвых
  for (let i = crystals.length - 1; i >= 0; i--) if (crystals[i].dead) crystals.splice(i, 1);
  sfxMerge(t);
  updateHud();
}
function spawnBurst(x, y, color, n, power){
  for (let i = 0; i < n; i++){
    const a = (Math.PI * 2 * i) / n + Math.random() * 0.5;
    const v = (0.5 + Math.random()) * power;
    particles.push({ x: x, y: y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 1,
                     rot: Math.random() * 6.28, vr: (Math.random() - 0.5) * 0.3,
                     size: 2 + Math.random() * 3.5, life: 1, color: color });
  }
}
function updateFx(now){
  for (let i = particles.length - 1; i >= 0; i--){
    const p = particles[i];
    p.x += p.vx; p.y += p.vy; p.vy += 0.08; p.rot += p.vr; p.life -= 0.028;
    if (p.life <= 0) particles.splice(i, 1);
  }
  for (let i = popups.length - 1; i >= 0; i--){
    const p = popups[i];
    p.y -= 0.7; p.life -= 0.016;
    if (p.life <= 0) popups.splice(i, 1);
  }
  if (shakeT > 0) shakeT -= STEP_MS;
}

// ===== Переполнение =====
function checkDanger(dt){
  let over = false;
  const now = performance.now();
  for (let i = 0; i < crystals.length; i++){
    const c = crystals[i];
    if (now - c.born > 500 && c.y - c.r < LINE_Y){ over = true; break; }
  }
  if (over) dangerAcc += dt;
  else dangerAcc = Math.max(0, dangerAcc - dt * 1.6);
  elDanger.style.width = Math.min(100, (dangerAcc / DANGER_LIMIT) * 100) + '%';
  if (dangerAcc >= DANGER_LIMIT) endRun();
}

// ===== Ввод =====
let pointerActive = false;
function canvasX(e){
  const r = cv.getBoundingClientRect();
  return clamp((e.clientX - r.left) / r.width * W, 0, W);
}
cv.addEventListener('pointerdown', function(e){ pointerActive = true; aimX = canvasX(e); e.preventDefault(); });
cv.addEventListener('pointermove', function(e){ if (pointerActive || e.pointerType === 'mouse') aimX = canvasX(e); e.preventDefault(); });
cv.addEventListener('pointerup', function(e){ aimX = canvasX(e); drop(); pointerActive = false; e.preventDefault(); });
document.addEventListener('keydown', function(e){
  if (!running) return;
  if (e.key === 'ArrowLeft') aimX = clamp(aimX - 14, 0, W);
  else if (e.key === 'ArrowRight') aimX = clamp(aimX + 14, 0, W);
  else if (e.key === ' ' || e.key === 'Enter'){ e.preventDefault(); drop(); }
});
function drop(){
  if (!running || over) return;
  const now = performance.now();
  if (now - lastDrop < DROP_COOLDOWN) return;
  lastDrop = now;
  ensureAudio();
  const c = makeCrystal(curTier, aimX, SPAWN_Y);
  c.born = now;
  crystals.push(c);
  sfxDrop();
  curTier = nextTier;
  nextTier = rollTier();
  drawNext();
}
document.addEventListener('pointerdown', ensureAudio, { once: false });

// ===== Рендер =====
function drawGem(g, tier, x, y, r, angle, tGlobal){
  const T = TIERS[tier];
  const pulse = tier === TIERS.length - 1 ? 1 + 0.03 * Math.sin(tGlobal / 300) : 1;
  g.save();
  g.translate(x, y);
  g.rotate(angle);
  g.scale(pulse, pulse);
  if (tier >= 6){ g.shadowColor = T.color; g.shadowBlur = r * 0.5; }
  const grad = g.createRadialGradient(-r * 0.3, -r * 0.35, r * 0.1, 0, 0, r);
  grad.addColorStop(0, shade(T.color, 0.45));
  grad.addColorStop(0.55, T.color);
  grad.addColorStop(1, shade(T.color, -0.38));
  g.beginPath();
  for (let i = 0; i < T.sides; i++){
    const a = (Math.PI * 2 * i) / T.sides - Math.PI / 2;
    const rr = r * 0.97 * T.jitter[i];
    if (i === 0) g.moveTo(Math.cos(a) * rr, Math.sin(a) * rr);
    else g.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
  }
  g.closePath();
  g.fillStyle = grad;
  g.fill();
  g.shadowBlur = 0;
  // грани
  g.strokeStyle = 'rgba(255,255,255,0.14)';
  g.lineWidth = Math.max(0.6, r * 0.02);
  for (let i = 0; i < T.sides; i++){
    const a = (Math.PI * 2 * i) / T.sides - Math.PI / 2;
    const rr = r * 0.97 * T.jitter[i];
    g.beginPath();
    g.moveTo(Math.cos(a) * rr * 0.42, Math.sin(a) * rr * 0.42);
    g.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
    g.stroke();
  }
  g.beginPath();
  g.arc(0, 0, r * 0.42, 0, 6.283);
  g.strokeStyle = 'rgba(255,255,255,0.10)';
  g.stroke();
  // блик
  g.beginPath();
  g.arc(-r * 0.32, -r * 0.36, r * 0.13, 0, 6.283);
  g.fillStyle = 'rgba(255,255,255,0.45)';
  g.fill();
  g.restore();
}
function drawNext(){
  const dpr = view.dpr;
  nctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  nctx.clearRect(0, 0, 30, 30);
  if (!running) return;
  drawGem(nctx, nextTier, 15, 15, 11, -0.4, performance.now());
}
function render(){
  const t = performance.now();
  const dpr = view.dpr, s = view.s;
  ctx.setTransform(dpr * s, 0, 0, dpr * s, 0, 0);
  // фон
  ctx.clearRect(0, 0, W, H);
  if (shakeT > 0){
    const k = shakeT / 200 * 3;
    ctx.translate((Math.random() - 0.5) * k, (Math.random() - 0.5) * k);
  }
  ctx.fillStyle = '#0E0E14';
  ctx.fillRect(-4, -4, W + 8, H + 8);
  // сетка
  ctx.strokeStyle = 'rgba(255,255,255,0.028)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let gx = 40; gx < W; gx += 40){ ctx.moveTo(gx, 0); ctx.lineTo(gx, H); }
  for (let gy = 40; gy < H; gy += 40){ ctx.moveTo(0, gy); ctx.lineTo(W, gy); }
  ctx.stroke();
  // линия переполнения
  const warn = dangerAcc / DANGER_LIMIT;
  ctx.save();
  ctx.setLineDash([7, 7]);
  ctx.lineWidth = warn > 0 ? 1.6 : 1;
  ctx.strokeStyle = warn > 0 ? 'rgba(228,84,95,' + (0.45 + 0.4 * Math.sin(t / 90)) + ')' : 'rgba(212,165,116,0.28)';
  ctx.beginPath(); ctx.moveTo(0, LINE_Y); ctx.lineTo(W, LINE_Y); ctx.stroke();
  ctx.restore();
  // прицел + призрак
  if (running && !over){
    const gr = TIERS[curTier].r;
    ctx.save();
    ctx.setLineDash([4, 9]);
    ctx.strokeStyle = 'rgba(212,165,116,0.25)';
    ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(aimX, SPAWN_Y + gr); ctx.lineTo(aimX, H); ctx.stroke();
    ctx.restore();
    ctx.globalAlpha = 0.5;
    drawGem(ctx, curTier, aimX, SPAWN_Y, gr, t / 1200, t);
    ctx.globalAlpha = 1;
  }
  // кристаллы
  for (let i = 0; i < crystals.length; i++){
    const c = crystals[i];
    drawGem(ctx, c.tier, c.x, c.y, c.r, c.angle, t);
  }
  // частицы
  for (let i = 0; i < particles.length; i++){
    const p = particles[i];
    ctx.save();
    ctx.globalAlpha = Math.max(0, p.life);
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rot);
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.moveTo(0, -p.size); ctx.lineTo(p.size, p.size); ctx.lineTo(-p.size, p.size);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
  // всплывающие очки
  for (let i = 0; i < popups.length; i++){
    const p = popups[i];
    ctx.save();
    ctx.globalAlpha = Math.max(0, Math.min(1, p.life * 1.4));
    ctx.font = '700 15px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = p.color;
    ctx.fillText(p.txt, p.x, p.y);
    ctx.restore();
  }
}
// ===== Цикл =====
function loop(ts){
  requestAnimationFrame(loop);
  if (!lastFrame) lastFrame = ts;
  let dt = ts - lastFrame;
  lastFrame = ts;
  if (dt > 100) dt = 100;
  if (running && !over){
    acc += dt;
    let steps = 0;
    while (acc >= STEP_MS && steps < 4){
      stepPhysics();
      checkDanger(STEP_MS);
      acc -= STEP_MS;
      steps++;
      if (over) break;
    }
    if (acc > STEP_MS * 4) acc = 0;
  } else {
    updateFx(performance.now());
  }
  render();
}
requestAnimationFrame(loop);

// ===== HUD и записи =====
function updateHud(){
  elScore.textContent = score;
  elDaily.textContent = Math.max(bestDaily(), mode === 'daily' ? score : 0);
  elBest.textContent = Math.max(bestEver(), score);
}
function refreshWelcome(){
  $('w-daily-best').textContent = bestDaily();
  $('w-best').textContent = bestEver();
  $('daily-date').textContent = 'Вызов дня · ' + dateRu(moscowDate());
}

// ===== Конец забега =====
function endRun(){
  if (over) return;
  over = true;
  running = false;
  let record = false;
  if (mode === 'daily'){
    const key = 'crystals.daily.' + moscowDate();
    const prev = parseInt(LS.get(key, '0'), 10) || 0;
    if (score > prev){ LS.set(key, String(score)); record = true; }
  }
  if (score > bestEver()){ LS.set('crystals.best', String(score)); record = true; }
  if (record) sfxRecord(); else sfxOver();
  elModalBadge.textContent = record ? 'Новый рекорд!' : 'Забег окончен';
  elModalBadge.classList.toggle('record', record);
  elModalCard.classList.toggle('modal-record', record);
  elModalScore.innerHTML = 'Очки: <b>' + score + '</b><br>Рекорд дня: <b>' + bestDaily() + '</b> · Рекорд: <b>' + bestEver() + '</b>';
  updateHud();
  setTimeout(function(){ elModal.classList.remove('hidden'); }, 550);
}

// ===== Режимы =====
function setMode(m){
  mode = m;
  $('mode-daily').classList.toggle('active', m === 'daily');
  $('mode-free').classList.toggle('active', m === 'free');
  $('daily-date').textContent = m === 'daily' ? 'Вызов дня · ' + dateRu(moscowDate()) : 'Свободная игра';
  LS.set('crystals.mode', m);
}
function seededForToday(){
  const h = xmur3('crystals-' + moscowDate());
  return mulberry32(h());
}

// ===== Старт/меню =====
function startGame(){
  crystals = []; particles = []; popups = [];
  score = 0; chainN = 0; lastMergeAt = 0; dangerAcc = 0; lastDrop = -9999;
  over = false; acc = 0; uid = 1;
  rng = (mode === 'daily') ? seededForToday() : Math.random;
  curTier = rollTier();
  nextTier = rollTier();
  elWelcome.classList.add('hidden');
  elGame.classList.remove('hidden');
  elModal.classList.add('hidden');
  running = true;
  lastFrame = 0;
  resizeCanvas();
  updateHud();
}
function toMenu(){
  running = false;
  elGame.classList.add('hidden');
  elModal.classList.add('hidden');
  elWelcome.classList.remove('hidden');
  refreshWelcome();
}

// ===== Кнопки =====
$('btn-play').addEventListener('click', function(){ ensureAudio(); startGame(); });
$('mode-daily').addEventListener('click', function(){ setMode('daily'); });
$('mode-free').addEventListener('click', function(){ setMode('free'); });
$('btn-new').addEventListener('click', startGame);
$('btn-menu').addEventListener('click', toMenu);
$('modal-btn').addEventListener('click', function(){ startGame(); });
$('btn-sound').addEventListener('click', function(){
  muted = !muted;
  LS.set('crystals.sound', muted ? '0' : '1');
  $('btn-sound').textContent = muted ? '🔇' : '🔊';
  if (!muted){ ensureAudio(); tone(660, 0.08, 'sine', 0.08); }
});

// ===== Инициализация =====
(function init(){
  setMode(LS.get('crystals.mode', 'daily'));
  const row = $('gem-row');
  TIERS.forEach(function(t){
    const i = document.createElement('i');
    i.style.background = t.color;
    row.appendChild(i);
  });
  $('btn-sound').textContent = muted ? '🔇' : '🔊';
  refreshWelcome();
  resizeCanvas();
})();
