import { FIXED_STEP } from './config.js';
import { Game } from './game.js';
import { Renderer } from './render.js';
import { Input } from './input.js';
import { UI } from './ui.js';
import { AudioSystem } from './audio.js';

const game = new Game();
const renderer = new Renderer(document.getElementById('game-canvas'), document.getElementById('minimap-canvas'));
const audio = new AudioSystem();
game.audio = audio;
const ui = new UI(game, audio);
const input = new Input(game, renderer, ui);
ui.input = input;
renderer.resize(game);

// A sound context is never created before a real user gesture.
window.addEventListener('pointerdown', () => audio.unlock(), { once: true });
window.addEventListener('keydown', () => audio.unlock(), { once: true });
window.addEventListener('resize', () => renderer.resize(game));
if (window.ResizeObserver) {
  new ResizeObserver(() => renderer.resize(game)).observe(document.getElementById('battlefield'));
  new ResizeObserver(() => renderer.resize(game)).observe(document.getElementById('minimap-frame'));
}

document.addEventListener('visibilitychange', () => {
  if (document.hidden) ui.pause();
  previous = performance.now();
  accumulator = 0;
});

let previous = performance.now();
let accumulator = 0;
function frame(now) {
  const elapsed = Math.min(0.15, Math.max(0, (now - previous) / 1000));
  previous = now;
  if (game.mode === 'running') {
    input.updateCamera(elapsed);
    accumulator += elapsed;
    let steps = 0;
    while (accumulator >= FIXED_STEP && steps < 5) {
      game.tick(FIXED_STEP);
      accumulator -= FIXED_STEP;
      steps++;
    }
    if (steps === 5) accumulator = 0; // Never try to catch up an inactive tab in one frame.
  } else accumulator = 0;
  renderer.draw(game, input, now);
  ui.update();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
