// ─── Setup ───────────────────────────────────────────────
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const scoreEl = document.getElementById('score');
const livesEl = document.getElementById('lives');
const shieldIcon = document.getElementById('shield-icon');
const effectIndicator = document.getElementById('effect-indicator');
const overlay = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlay-title');
const overlaySub = document.getElementById('overlay-sub');
const overlayItems = document.getElementById('overlay-items');
const btnNext = document.getElementById('btn-next');

let W, H, dpr;
let rectW, rectH;

function resize() {
  const rect = canvas.getBoundingClientRect();
  dpr = window.devicePixelRatio || 1;
  W = canvas.width = rect.width * dpr;
  H = canvas.height = rect.height * dpr;
  rectW = rect.width;
  rectH = rect.height;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
resize();
window.addEventListener('resize', resize);

// ─── Item Types ──────────────────────────────────────────
const TYPES = {
  coin:   { emoji: '🪙', size: 32, points: 1,  color: '#ffd700', label: 'Монета' },
  gold:   { emoji: '💰', size: 38, points: 3,  color: '#ffec8b', label: 'Золотая' },
  bomb:   { emoji: '💣', size: 30, points: 0,  color: '#555',    label: 'Бомба' },
  magnet: { emoji: '🧲', size: 26, points: 0,  color: '#9b59b6', label: 'Магнит' },
  slow:   { emoji: '🐌', size: 26, points: 0,  color: '#3498db', label: 'Замедление' },
  curse:  { emoji: '😈', size: 26, points: 0,  color: '#8e44ad', label: 'Проклятье' },
  speed:  { emoji: '⚡', size: 26, points: 0,  color: '#e74c3c', label: 'Ускорение' },
  shield: { emoji: '🛡', size: 26, points: 0,  color: '#2ecc71', label: 'Щит' },
};

const TYPE_KEYS = Object.keys(TYPES);

// ─── Level Config ────────────────────────────────────────
const GROUP_SUBS = {
  'level-start': [
    { text: 'Тапай по монеткам!', types: ['coin', 'gold'] },
    { text: 'Осторожно, бомбы! 🧨', types: ['coin', 'gold', 'bomb'] },
    { text: 'Магниты помогут! 🧲', types: ['coin', 'gold', 'bomb', 'magnet'] },
    { text: 'Замедление и проклятье!', types: ['coin', 'gold', 'bomb', 'magnet', 'slow', 'curse'] },
    { text: 'Всё сразу! 💥', types: Object.keys(TYPES) },
  ],
};

function getLevelConfig(level) {
  const t = Math.min((level - 1) / 49, 1);
  const group = level <= 5 ? 0 : level <= 10 ? 1 : level <= 20 ? 2 : level <= 35 ? 3 : 4;

  const base = {
    spawnInterval: Math.round(1100 - t * 500),
    speedMult: 1 + t * 2.5,
    target: 10,
    group,
  };

  const weightsByGroup = [
    { coin: 100, gold: 0 },
    { coin: 88, gold: 12 },
    { coin: 72, gold: 10, bomb: 12, magnet: 6 },
    { coin: 55, gold: 8, bomb: 18, magnet: 5, slow: 5, curse: 5, speed: 2, shield: 2 },
    { coin: 35, gold: 5, bomb: 25, magnet: 5, slow: 5, curse: 10, speed: 10, shield: 5 },
  ];

  const w = weightsByGroup[group];
  base.weights = w;
  base.types = Object.keys(w);

  return base;
}

// ─── Game State ──────────────────────────────────────────
let level = 1;
let score = 0;
let lives = 3;
let hasShield = false;
let items = [];
let pops = [];
let effects = {};
let shake = 0;
let spawnTimer = 0;
let gameRunning = false;
let itemId = 0;
let cfg = null;
let stunTimer = 0;

// ─── Item Class ──────────────────────────────────────────
class Item {
  constructor(type) {
    this.id = itemId++;
    this.type = type;
    this.info = TYPES[type];
    this.size = this.info.size;
    this.points = this.info.points;
    this.x = this.size + Math.random() * (rectW - this.size * 2);
    this.y = -this.size;
    this.baseSpeed = 1.5 * (cfg ? cfg.speedMult : 1);
    this.collected = false;
    this.rot = Math.random() * Math.PI * 2;
    this.sparkle = Math.random() * 100;
  }

  getSpeed() {
    let s = this.baseSpeed;
    if (effects.slow) s *= 0.45;
    if (effects.speed) s *= 2.2;
    return s;
  }

  update() {
    if (this.collected) return;

    // Magnet effect: pull toward center
    if (effects.magnet && this.type !== 'bomb') {
      const cx = rectW / 2;
      const dx = cx - this.x;
      this.x += dx * 0.025;
    }

    this.y += this.getSpeed();
    this.rot += 0.01;
    this.sparkle += 0.05;
  }

  draw() {
    if (this.collected) return;
    const s = effects.curse && this.type !== 'curse' ? this.size * 0.6 : this.size;
    const x = this.x;
    const y = this.y;

    // Glow
    ctx.shadowColor = this.info.color;
    ctx.shadowBlur = 10;
    ctx.fillStyle = this.info.color + '33';
    ctx.beginPath();
    ctx.arc(x, y, s + 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // Circle bg
    ctx.fillStyle = this.info.color;
    ctx.beginPath();
    ctx.arc(x, y, s, 0, Math.PI * 2);
    ctx.fill();

    // Dark rim
    ctx.strokeStyle = 'rgba(0,0,0,0.3)';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Emoji
    ctx.font = `${s * 1.3}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(this.info.emoji, x, y + 1);

    // Sparkle
    if (this.type === 'gold') {
      const angle = this.sparkle;
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      ctx.beginPath();
      ctx.arc(x + Math.cos(angle) * s * 0.5, y + Math.sin(angle) * s * 0.5, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  contains(tx, ty) {
    if (this.collected) return false;
    const s = effects.curse && this.type !== 'curse' ? this.size * 0.6 : this.size;
    const dx = tx - this.x;
    const dy = ty - this.y;
    return dx * dx + dy * dy <= s * s;
  }
}

// ─── Pop Effect ──────────────────────────────────────────
class Pop {
  constructor(x, y, color) {
    this.x = x;
    this.y = y;
    this.life = 1;
    this.size = 10;
    this.color = color;
    this.particles = [];
    for (let i = 0; i < 6; i++) {
      const a = (Math.PI * 2 / 6) * i + Math.random() * 0.3;
      this.particles.push({
        vx: Math.cos(a) * (2 + Math.random() * 3),
        vy: Math.sin(a) * (2 + Math.random() * 3),
        size: 2 + Math.random() * 4,
      });
    }
  }

  update() {
    this.life -= 0.04;
    this.size += 0.5;
    for (const p of this.particles) {
      p.vx *= 0.97;
      p.vy *= 0.97;
      p.x = (p.x || 0) + p.vx;
      p.y = (p.y || 0) + p.vy;
    }
  }

  draw() {
    if (this.life <= 0) return;
    ctx.globalAlpha = this.life;

    // Ring
    ctx.strokeStyle = this.color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
    ctx.stroke();

    // Particles
    ctx.fillStyle = this.color;
    for (const p of this.particles) {
      ctx.beginPath();
      ctx.arc(this.x + (p.x || 0), this.y + (p.y || 0), p.size * this.life, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.globalAlpha = 1;
  }
}

// ─── Spawn ───────────────────────────────────────────────
function pickType() {
  const types = cfg.types;
  const weights = types.map(t => cfg.weights[t]);
  const total = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (let i = 0; i < types.length; i++) {
    r -= weights[i];
    if (r <= 0) return types[i];
  }
  return types[0];
}

function spawnItem() {
  if (!gameRunning) return;
  // Don't spawn if there are too many items on screen
  const active = items.filter(i => !i.collected).length;
  if (active > 18) return;
  items.push(new Item(pickType()));
}

// ─── Tap Handling ────────────────────────────────────────
function handleTap(x, y) {
  if (!gameRunning || stunTimer > 0) return;

  for (let i = items.length - 1; i >= 0; i--) {
    const item = items[i];
    if (!item.contains(x, y)) continue;

    item.collected = true;
    const type = item.type;

    if (type === 'coin' || type === 'gold') {
      const pts = type === 'gold' ? 3 : 1;
      score += pts;
      if (score > cfg.target) score = cfg.target;
      pops.push(new Pop(item.x, item.y, TYPES[type].color));
      updateHUD();

      if (score >= cfg.target) {
        levelComplete();
        return;
      }
    } else if (type === 'bomb') {
      if (hasShield) {
        hasShield = false;
        pops.push(new Pop(item.x, item.y, '#2ecc71'));
        screenShake(4);
      } else {
        lives--;
        screenShake(8);
        stunTimer = 20;
        updateHUD();
        pops.push(new Pop(item.x, item.y, '#ff4444'));
        if (lives <= 0) {
          gameOver();
          return;
        }
      }
    } else if (type === 'magnet') {
      effects.magnet = { timer: 180 };
      pops.push(new Pop(item.x, item.y, TYPES.magnet.color));
    } else if (type === 'slow') {
      effects.slow = { timer: 180 };
      pops.push(new Pop(item.x, item.y, TYPES.slow.color));
    } else if (type === 'curse') {
      effects.curse = { timer: 180 };
      pops.push(new Pop(item.x, item.y, TYPES.curse.color));
    } else if (type === 'speed') {
      effects.speed = { timer: 180 };
      pops.push(new Pop(item.x, item.y, TYPES.speed.color));
    } else if (type === 'shield') {
      hasShield = true;
      pops.push(new Pop(item.x, item.y, TYPES.shield.color));
    }

    updateHUD();
    break;
  }
}

// ─── Screen Shake ────────────────────────────────────────
function screenShake(intensity) {
  shake = intensity;
}

// ─── Level Flow ──────────────────────────────────────────
function showLevelStart() {
  cfg = getLevelConfig(level);
  overlay.classList.remove('hidden');
  overlayTitle.textContent = `Уровень ${level}`;
  overlaySub.textContent = GROUP_SUBS['level-start'][cfg.group].text;

  const newTypes = cfg.types;
  overlayItems.innerHTML = newTypes.map(t =>
    `<span title="${TYPES[t].label}">${TYPES[t].emoji}</span>`
  ).join('');

  btnNext.textContent = 'Начать';
  btnNext.onclick = startLevel;
}

function startLevel() {
  overlay.classList.add('hidden');
  score = 0;
  items = [];
  pops = [];
  effects = {};
  spawnTimer = 0;
  gameRunning = true;
  itemId = 0;
  updateHUD();
}

function levelComplete() {
  gameRunning = false;
  overlay.classList.remove('hidden');
  overlayTitle.textContent = `Уровень ${level} пройден! 🎉`;
  overlaySub.textContent = '';
  overlayItems.innerHTML = '';
  btnNext.textContent = 'Дальше →';
  btnNext.onclick = () => {
    level++;
    showLevelStart();
  };
}

function gameOver() {
  gameRunning = false;
  overlay.classList.remove('hidden');
  overlayTitle.textContent = '💀 Игра окончена';
  overlaySub.textContent = `Дошёл до уровня ${level}`;
  overlayItems.innerHTML = '';
  btnNext.textContent = 'Заново с 1 уровня';
  btnNext.onclick = () => {
    level = 1;
    lives = 3;
    hasShield = false;
    showLevelStart();
  };
}

// ─── HUD ─────────────────────────────────────────────────
function updateHUD() {
  scoreEl.textContent = `${score} / ${cfg ? cfg.target : 10}`;
  livesEl.textContent = '❤️'.repeat(Math.max(0, lives)) + '🖤'.repeat(Math.max(0, 3 - lives));
  shieldIcon.classList.toggle('hidden', !hasShield);

  const active = [];
  if (effects.magnet) active.push('🧲');
  if (effects.slow) active.push('🐌');
  if (effects.curse) active.push('😈');
  if (effects.speed) active.push('⚡');
  effectIndicator.textContent = active.join(' ');
}

// ─── Update ──────────────────────────────────────────────
function update() {
  if (!gameRunning) return;

  if (stunTimer > 0) stunTimer--;

  // Spawn
  spawnTimer += 16;
  if (spawnTimer >= cfg.spawnInterval) {
    spawnTimer = 0;
    spawnItem();
  }

  // Update items
  for (const item of items) item.update();
  items = items.filter(i => !i.collected && i.y < rectH + 50);

  // Update pops
  for (const p of pops) p.update();
  pops = pops.filter(p => p.life > 0);

  // Update effects
  for (const key of Object.keys(effects)) {
    effects[key].timer--;
    if (effects[key].timer <= 0) delete effects[key];
  }

  // Shake decay
  if (shake > 0) shake *= 0.85;
  if (shake < 0.5) shake = 0;

  updateHUD();
}

// ─── Draw ────────────────────────────────────────────────
function draw() {
  ctx.save();

  // Screen shake
  if (shake > 0) {
    const sx = (Math.random() - 0.5) * shake;
    const sy = (Math.random() - 0.5) * shake;
    ctx.translate(sx, sy);
  }

  // Background
  ctx.fillStyle = 'transparent';
  ctx.clearRect(0, 0, rectW, rectH);

  // Items
  for (const item of items) item.draw();

  // Pops
  for (const p of pops) p.draw();

  ctx.restore();
}

// ─── Loop ────────────────────────────────────────────────
function loop() {
  update();
  draw();
  requestAnimationFrame(loop);
}

// ─── Input ───────────────────────────────────────────────
canvas.addEventListener('touchstart', (e) => {
  e.preventDefault();
  const touch = e.touches[0];
  const rect = canvas.getBoundingClientRect();
  handleTap(touch.clientX - rect.left, touch.clientY - rect.top);
});

canvas.addEventListener('mousedown', (e) => {
  const rect = canvas.getBoundingClientRect();
  handleTap(e.clientX - rect.left, e.clientY - rect.top);
});

// ─── Start ───────────────────────────────────────────────
showLevelStart();
loop();
