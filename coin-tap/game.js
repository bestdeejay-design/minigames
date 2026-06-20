const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const scoreEl = document.getElementById('score');
const overlay = document.getElementById('overlay');
const overlayText = document.getElementById('overlay-text');
const btnNext = document.getElementById('btn-next');

let W, H;

function resize() {
  const rect = canvas.getBoundingClientRect();
  W = canvas.width = rect.width * (window.devicePixelRatio || 1);
  H = canvas.height = rect.height * (window.devicePixelRatio || 1);
  ctx.scale(W / rect.width, H / rect.height);
  rectW = rect.width;
  rectH = rect.height;
}
let rectW, rectH;
resize();
window.addEventListener('resize', resize);

const TARGET = 10;
const COIN_SIZE = 36;
const SPAWN_INTERVAL = 1000;
const BASE_SPEED = 1.8;

let level = 1;
let score = 0;
let coins = [];
let pops = [];
let spawnTimer = 0;
let gameRunning = true;

class Coin {
  constructor() {
    this.x = COIN_SIZE + Math.random() * (rectW - COIN_SIZE * 2);
    this.y = -COIN_SIZE;
    this.size = COIN_SIZE;
    this.speed = BASE_SPEED + (level - 1) * 0.3;
    this.collected = false;
  }

  update() {
    if (this.collected) return;
    this.y += this.speed;
  }

  draw() {
    if (this.collected) return;

    // Glow
    ctx.shadowColor = '#ffd700';
    ctx.shadowBlur = 12;

    // Coin body
    const grad = ctx.createRadialGradient(
      this.x - this.size * 0.3, this.y - this.size * 0.3, 0,
      this.x, this.y, this.size
    );
    grad.addColorStop(0, '#fff4a3');
    grad.addColorStop(0.4, '#ffd700');
    grad.addColorStop(0.8, '#e6a800');
    grad.addColorStop(1, '#b8860b');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
    ctx.fill();

    ctx.shadowBlur = 0;

    // Shine
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.beginPath();
    ctx.ellipse(
      this.x - this.size * 0.25, this.y - this.size * 0.25,
      this.size * 0.25, this.size * 0.15, -0.5, 0, Math.PI * 2
    );
    ctx.fill();

    // Star/icon
    ctx.fillStyle = '#b8860b';
    ctx.font = `${this.size * 0.7}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('$', this.x, this.y + 1);
  }

  contains(tx, ty) {
    if (this.collected) return false;
    const dx = tx - this.x;
    const dy = ty - this.y;
    return dx * dx + dy * dy <= this.size * this.size;
  }
}

class Pop {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.life = 1;
    this.size = COIN_SIZE;
  }

  update() {
    this.life -= 0.035;
    this.size += 1.5;
  }

  draw() {
    if (this.life <= 0) return;
    ctx.globalAlpha = this.life;
    ctx.strokeStyle = '#ffd700';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
}

function spawnCoin() {
  coins.push(new Coin());
}

function handleTap(x, y) {
  for (let i = coins.length - 1; i >= 0; i--) {
    const c = coins[i];
    if (c.contains(x, y)) {
      c.collected = true;
      pops.push(new Pop(c.x, c.y));
      score++;
      scoreEl.textContent = `${score} / ${TARGET}`;
      if (score >= TARGET) {
        gameRunning = false;
        overlayText.textContent = `Уровень ${level} пройден!`;
        overlay.classList.remove('hidden');
      }
      break;
    }
  }
}

canvas.addEventListener('touchstart', (e) => {
  e.preventDefault();
  if (!gameRunning) return;
  const touch = e.touches[0];
  const rect = canvas.getBoundingClientRect();
  const x = touch.clientX - rect.left;
  const y = touch.clientY - rect.top;
  handleTap(x, y);
});

canvas.addEventListener('mousedown', (e) => {
  if (!gameRunning) return;
  const rect = canvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  handleTap(x, y);
});

btnNext.addEventListener('click', () => {
  level++;
  score = 0;
  coins = [];
  pops = [];
  spawnTimer = 0;
  gameRunning = true;
  scoreEl.textContent = `0 / ${TARGET}`;
  overlay.classList.add('hidden');
});

function update() {
  if (!gameRunning) return;

  spawnTimer += 16;
  if (spawnTimer >= SPAWN_INTERVAL / (1 + (level - 1) * 0.08)) {
    spawnTimer = 0;
    spawnCoin();
  }

  for (const c of coins) c.update();
  for (const p of pops) p.update();

  coins = coins.filter(c => !c.collected && c.y < H + 50);
  pops = pops.filter(p => p.life > 0);
}

function draw() {
  ctx.clearRect(0, 0, rectW, rectH);

  for (const c of coins) c.draw();
  for (const p of pops) p.draw();
}

function loop() {
  update();
  draw();
  requestAnimationFrame(loop);
}

loop();
