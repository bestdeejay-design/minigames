const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const statusEl = document.getElementById('status');

canvas.width = 400;
canvas.height = 300;

const GRAVITY = 0.5;
const JUMP_FORCE = -9;
const MOVE_SPEED = 4;

const keys = { left: false, right: false };

const player = {
  x: 50, y: 250, w: 20, h: 20,
  vx: 0, vy: 0,
  grounded: false,
  color: '#e94560',
};

let coin = { x: 260, y: 147, w: 14, h: 14, collected: false };

const platforms = [
  { x: 0, y: 280, w: 400, h: 20 },
  { x: 80, y: 220, w: 80, h: 12 },
  { x: 190, y: 170, w: 90, h: 12 },
  { x: 310, y: 210, w: 70, h: 12 },
];

function resetGame() {
  player.x = 50;
  player.y = 250;
  player.vx = 0;
  player.vy = 0;
  player.grounded = false;
  coin.collected = false;
  statusEl.textContent = 'Собери монетку!';
}

function collide(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x &&
         a.y < b.y + b.h && a.y + a.h > b.y;
}

function update() {
  if (keys.left) player.vx = -MOVE_SPEED;
  else if (keys.right) player.vx = MOVE_SPEED;
  else player.vx *= 0.7;

  player.vy += GRAVITY;
  player.grounded = false;

  // Horizontal collision
  player.x += player.vx;
  for (const p of platforms) {
    if (collide(player, p)) {
      if (player.vx > 0) player.x = p.x - player.w;
      else if (player.vx < 0) player.x = p.x + p.w;
      player.vx = 0;
    }
  }

  // Vertical collision
  player.y += player.vy;
  for (const p of platforms) {
    if (collide(player, p)) {
      if (player.vy > 0) {
        player.y = p.y - player.h;
        player.vy = 0;
        player.grounded = true;
      } else if (player.vy < 0) {
        player.y = p.y + p.h;
        player.vy = 0;
      }
    }
  }

  // Boundaries
  if (player.x < 0) player.x = 0;
  if (player.x + player.w > canvas.width) player.x = canvas.width - player.w;
  if (player.y + player.h > canvas.height) player.y = canvas.height - player.h;

  // Fall off screen
  if (player.y > canvas.height + 50) {
    resetGame();
    return;
  }

  // Coin collection
  if (!coin.collected && collide(player, coin)) {
    coin.collected = true;
    statusEl.textContent = 'Монетка собрана! ✅';
  }
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Platforms
  ctx.fillStyle = '#0f3460';
  for (const p of platforms) {
    ctx.fillRect(p.x, p.y, p.w, p.h);
  }

  // Player
  ctx.fillStyle = player.color;
  ctx.fillRect(player.x, player.y, player.w, player.h);

  // Coin
  if (!coin.collected) {
    ctx.fillStyle = '#ffd700';
    const cx = coin.x + coin.w / 2;
    const cy = coin.y + coin.h / 2;
    ctx.beginPath();
    ctx.arc(cx, cy, coin.w / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffaa00';
    ctx.beginPath();
    ctx.arc(cx, cy, coin.w / 4, 0, Math.PI * 2);
    ctx.fill();
  }
}

function gameLoop() {
  update();
  draw();
  requestAnimationFrame(gameLoop);
}

// Input
document.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowLeft' || e.key === 'a') keys.left = true;
  if (e.key === 'ArrowRight' || e.key === 'd') keys.right = true;
  if (e.key === 'ArrowUp' || e.key === 'w') {
    if (player.grounded) {
      player.vy = JUMP_FORCE;
      player.grounded = false;
    }
  }
});

document.addEventListener('keyup', (e) => {
  if (e.key === 'ArrowLeft' || e.key === 'a') keys.left = false;
  if (e.key === 'ArrowRight' || e.key === 'd') keys.right = false;
});

// Touch controls
function setupBtn(id, key) {
  const btn = document.getElementById(id);
  btn.addEventListener('touchstart', (e) => {
    e.preventDefault();
    keys[key] = true;
  });
  btn.addEventListener('touchend', (e) => {
    e.preventDefault();
    keys[key] = false;
  });
  btn.addEventListener('mousedown', () => { keys[key] = true; });
  btn.addEventListener('mouseup', () => { keys[key] = false; });
}

setupBtn('btn-left', 'left');
setupBtn('btn-right', 'right');

document.getElementById('btn-jump').addEventListener('touchstart', (e) => {
  e.preventDefault();
  if (player.grounded) {
    player.vy = JUMP_FORCE;
    player.grounded = false;
  }
});
document.getElementById('btn-jump').addEventListener('mousedown', () => {
  if (player.grounded) {
    player.vy = JUMP_FORCE;
    player.grounded = false;
  }
});

document.getElementById('btn-reset').addEventListener('click', resetGame);

gameLoop();
