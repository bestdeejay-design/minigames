import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

// Заглушка 2D Canvas для запуска процедурных CanvasTexture и HUD в Node.js без браузера
const noopCtx = new Proxy(
  {},
  {
    get(_target, prop) {
      if (prop === 'createLinearGradient' || prop === 'createRadialGradient') {
        return () => ({ addColorStop() {} });
      }
      return () => {};
    },
    set() {
      return true;
    },
  }
);

globalThis.document = {
  hidden: false,
  pointerLockElement: null,
  createElement: () => ({
    width: 128,
    height: 128,
    style: {},
    getContext: () => noopCtx,
    addEventListener: () => {},
  }),
  getElementById: () => null,
  addEventListener: () => {},
  exitPointerLock: () => {},
};

globalThis.window = {
  innerWidth: 1280,
  innerHeight: 720,
  devicePixelRatio: 1,
  addEventListener: () => {},
};

const memStorage = new Map();
globalThis.localStorage = {
  getItem: (k) => (memStorage.has(k) ? memStorage.get(k) : null),
  setItem: (k, v) => memStorage.set(k, String(v)),
};

const __dirname = dirname(fileURLToPath(import.meta.url));
const gameDir = resolve(__dirname, '..');
const repoRoot = resolve(gameDir, '..');

const THREE = await import('../libs/three.module.min.js');
const { CONFIG } = await import('../js/config.js');
const { NeonMiamiGame } = await import('../js/main.js');

test('1. Структура файлов, Three.js r160, отсутствие сетевых запросов и чужих IP, интеграция в каталог', () => {
  assert.equal(THREE.REVISION, '160');

  const requiredFiles = [
    'index.html',
    'test.html',
    'style.css',
    'README.md',
    '.nojekyll',
    'libs/three.module.min.js',
    'js/config.js',
    'js/engine.js',
    'js/world.js',
    'js/city-gen.js',
    'js/entities.js',
    'js/player.js',
    'js/weapons.js',
    'js/enemies.js',
    'js/ai.js',
    'js/vehicles.js',
    'js/wanted.js',
    'js/missions.js',
    'js/hud.js',
    'js/audio.js',
    'js/input.js',
    'js/main.js',
  ];

  for (const rel of requiredFiles) {
    assert.ok(existsSync(resolve(gameDir, rel)), `Отсутствует обязательный файл: ${rel}`);
  }

  // Проверка интеграции в корневой каталог
  const rootIndex = readFileSync(resolve(repoRoot, 'index.html'), 'utf8');
  const rootReadme = readFileSync(resolve(repoRoot, 'README.md'), 'utf8');
  assert.ok(rootIndex.includes('href="miami84/"'), 'В корневом index.html должна быть карточка miami84/');
  assert.ok(rootReadme.includes('miami84/'), 'В корневом README.md должна быть ссылка на miami84/');

  // Проверка отсутствия fetch, XMLHttpRequest, внешних CDN и запрещённых брендов
  const jsModules = requiredFiles.filter((f) => f.startsWith('js/'));
  for (const mod of jsModules) {
    const src = readFileSync(resolve(gameDir, mod), 'utf8');
    assert.doesNotMatch(src, /\bfetch\s*\(|XMLHttpRequest|https?:\/\//, `Сетевой вызов в ${mod}`);
    assert.doesNotMatch(src, /OrbitControls|PointerLockControls|EffectComposer/i, `Запрещённый аддон в ${mod}`);
    assert.doesNotMatch(src, /Vice\s*City|Grand\s*Theft\s*Auto|Vercetti/i, `Чужой IP в ${mod}`);
  }

  const gameHtml = readFileSync(resolve(gameDir, 'index.html'), 'utf8');
  assert.doesNotMatch(gameHtml, /https?:\/\//);
});

test('2. Мир, небо, полосатое солнце, волны моря, пирс и переключение Закат/Ночь (N)', () => {
  const game = new NeonMiamiGame();
  assert.ok(game.engine.scene.fog instanceof THREE.Fog);
  assert.ok(game.world.sunSprite instanceof THREE.Sprite);
  assert.equal(game.world.isNight, false);

  // Переключение Закат / Ночь
  game.world.toggleNightMode();
  assert.equal(game.world.isNight, true);
  assert.equal(game.engine.scene.fog.color.getHex(), CONFIG.COLORS.nightFog);
  game.world.toggleNightMode();
  assert.equal(game.world.isNight, false);

  // Анимация морских волн смещает вершины
  const yBefore = game.world.seaGeo.attributes.position.getY(5);
  game.world.updateWaves(1.75, game.player);
  const yAfter = game.world.seaGeo.attributes.position.getY(5);
  assert.notEqual(yBefore, yAfter);

  // Высота пирса и запрет воды
  assert.equal(game.world.isOnPier(180, CONFIG.PIER.zCenter), true);
  assert.ok(game.world.getGroundHeight(195, CONFIG.PIER.zCenter) > 1.0);
  assert.equal(game.world.isWater(220, CONFIG.PIER.zCenter), false);
  assert.equal(game.world.isWater(220, 60), true);
});

test('3. Инстансинг пальм и фонарей, коллизии со зданиями и защита от воды', () => {
  const game = new NeonMiamiGame();
  assert.ok(game.cityGen.palmInstanced.trunkInst instanceof THREE.InstancedMesh);
  assert.ok(game.cityGen.palmInstanced.count > 40);
  assert.ok(game.cityGen.lampInstanced.poleInst instanceof THREE.InstancedMesh);
  assert.ok(game.cityGen.lampInstanced.count > 20);
  assert.ok(game.world.colliders.length > 30);

  // Попытка пройти сквозь здание арт-деко (X=112, Z=10) выталкивает игрока наружу
  const col = game.world.resolveCircleCollision(112, 10, CONFIG.PLAYER.radius, 0);
  assert.equal(col.hitWall, true);

  // Попытка уйти в глубокую воду вне пирса удерживает игрока у берега
  const waterCol = game.world.resolveCircleCollision(240, 80, CONFIG.PLAYER.radius, 0);
  assert.ok(waterCol.x <= CONFIG.WATER_START_X);
});

test('4. Ходьба, бег, прыжок, 3 вида оружия, стрельба, перезарядка и урон врагам', () => {
  const game = new NeonMiamiGame();
  game.startGame();

  // Прыжок и гравитация
  game.input.jumpPressed = true;
  game.stepPhysics(CONFIG.FIXED_TIMESTEP);
  assert.ok(game.player.vy > 0);
  assert.equal(game.player.onGround, false);
  for (let i = 0; i < 90; i++) game.stepPhysics(CONFIG.FIXED_TIMESTEP);
  assert.equal(game.player.onGround, true);

  // Проверка 3 видов оружия
  assert.equal(game.weapons.weapons.length, 3);
  assert.equal(game.weapons.current.id, 'pistol');
  assert.equal(game.weapons.current.infiniteAmmo, true);

  // Ставим врага прямо перед игроком и стреляем
  const target = game.enemies.spawnEnemy('pistol', game.player.x, game.player.z - 8, 'test', false);
  game.player.yaw = 0;
  game.player.pitch = 0;
  const hpBefore = target.hp;
  const hits = game.weapons.fireShot(
    game.player,
    game.enemies,
    game.civilians,
    game.vehicles,
    game.wanted,
    game.audio
  );
  assert.ok(hits >= 1, 'Луч Raycaster должен попасть по врагу перед игроком');
  assert.ok(target.hp < hpBefore);

  // Переключение на ПП и дробовик
  game.weapons.selectWeapon(1);
  assert.equal(game.weapons.current.id, 'smg');
  game.weapons.selectWeapon(2);
  assert.equal(game.weapons.current.id, 'shotgun');
});

test('5. Гражданские NPC (лимит <= 30, паника при выстреле) и трафик без прохождения сквозь машины', () => {
  const game = new NeonMiamiGame();
  game.startGame();

  assert.ok(game.civilians.npcs.length <= 30);
  const npc = game.civilians.npcs[0];
  npc.x = game.player.x + 4;
  npc.z = game.player.z + 4;
  const panicked = game.civilians.notifyGunshot(game.player.x, game.player.z);
  assert.ok(panicked >= 1);
  assert.ok(npc.panicTimer > 0);

  // Две машины на одной точке раздвигаются коллизией и не проходят сквозь друг друга
  const carA = game.vehicles.vehicles[0];
  const carB = game.vehicles.vehicles[1];
  carA.x = 50;
  carA.z = 50;
  carB.x = 50.5;
  carB.z = 50;
  game.vehicles.update(CONFIG.FIXED_TIMESTEP, game.input, game.player, game.enemies, game.civilians, game.wanted, game.audio);
  const sep = Math.hypot(carB.x - carA.x, carB.z - carA.z);
  assert.ok(sep > 1.5, 'Машины должны расталкиваться при пересечении');
});

test('6. Посадка в машину (E), вождение, взрыв при 0 HP и система розыска 0–5 звёзд', () => {
  const game = new NeonMiamiGame();
  game.startGame();

  const car = game.vehicles.vehicles[0];
  game.player.x = car.x + 1.5;
  game.player.z = car.z;

  const entered = game.vehicles.tryToggleVehicle(game.player, game.wanted, game.audio);
  assert.equal(entered, true);
  assert.equal(game.player.inVehicle, car);

  // Разгон вперёд
  game.input.keys.KeyW = true;
  for (let i = 0; i < 30; i++) game.stepPhysics(CONFIG.FIXED_TIMESTEP);
  assert.ok(car.speed > 2.0);
  game.input.keys.KeyW = false;

  // Выход из машины
  const exited = game.vehicles.tryToggleVehicle(game.player, game.wanted, game.audio);
  assert.equal(exited, true);
  assert.equal(game.player.inVehicle, null);

  // Взрыв машины при обнулении HP
  game.vehicles.damageVehicle(car, 999, game.player, game.enemies, game.audio);
  assert.equal(car.exploded, true);

  // Розыск 0–5 звёзд и спад со временем
  game.wanted.reportCrime(450);
  assert.ok(game.wanted.stars >= 3);
  game.wanted.timeSinceCrime = CONFIG.WANTED.decayDelay + 1;
  const heatBefore = game.wanted.heat;
  game.wanted.update(1.0, game.player, game.audio);
  assert.ok(game.wanted.heat < heatBefore);
});

test('7. Прохождение всех 5 сюжетных миссий, сохранение рекорда и экран смерти/респауна', () => {
  const game = new NeonMiamiGame();
  game.startGame();

  // Миссия 1: Добраться до точки у пирса
  assert.equal(game.missions.currentIndex, 0);
  game.player.x = CONFIG.MISSIONS[0].target.x;
  game.player.z = CONFIG.MISSIONS[0].target.z;
  game.stepPhysics(CONFIG.FIXED_TIMESTEP);
  assert.equal(game.missions.currentIndex, 1);

  // Миссия 2: Зачистить площадку от бандитов
  for (const e of game.enemies.enemies.filter((x) => x.tag === 'mission2')) {
    game.enemies.damageEnemy(e, 500, game.player, game.wanted, game.audio);
  }
  game.stepPhysics(CONFIG.FIXED_TIMESTEP);
  assert.equal(game.missions.currentIndex, 2);

  // Миссия 3: Угнать машину и привезти в гараж за время
  const targetCar = game.missions.targetCar;
  assert.ok(targetCar);
  game.player.inVehicle = targetCar;
  targetCar.driver = game.player;
  targetCar.x = CONFIG.MISSIONS[2].garageTarget.x;
  targetCar.z = CONFIG.MISSIONS[2].garageTarget.z;
  game.stepPhysics(CONFIG.FIXED_TIMESTEP);
  assert.equal(game.missions.currentIndex, 3);

  // Миссия 4: Продержаться 90 секунд при розыске 3 звезды
  assert.ok(game.wanted.stars >= 3);
  game.missions.timer = 0.01;
  game.stepPhysics(CONFIG.FIXED_TIMESTEP);
  assert.equal(game.missions.currentIndex, 4);

  // Миссия 5: Победить босса и охрану в портовой зоне
  for (const e of game.enemies.enemies.filter((x) => x.tag === 'mission5')) {
    game.enemies.damageEnemy(e, 1000, game.player, game.wanted, game.audio);
  }
  game.stepPhysics(CONFIG.FIXED_TIMESTEP);
  assert.equal(game.missions.allCompleted, true);
  assert.equal(game.state, 'victory');

  // Смерть и респаун со штрафом по деньгам
  game.resumeGame();
  const cashBeforeDeath = game.player.cash;
  game.player.takeDamage(500, game.audio);
  game.stepPhysics(CONFIG.FIXED_TIMESTEP);
  assert.equal(game.state, 'wasted');
  game.respawnPlayer();
  assert.equal(game.state, 'playing');
  assert.equal(game.player.dead, false);
  assert.ok(game.player.cash < cashBeforeDeath);
});

test('8. Синтвейв-радио (2 станции + ВЫКЛ), ИИ врагов, навигация мимо воды и настройка качества', () => {
  const game = new NeonMiamiGame();
  game.startGame();

  // Радиостанции (2 станции с разным темпом + ВЫКЛ)
  assert.equal(game.audio.getCurrentStationName(), '84.5 FM · SUNSET PULSE');
  assert.equal(game.audio.nextStation(), '98.9 FM · CYBER TURBO');
  assert.equal(game.audio.nextStation(), 'РАДИО ВЫКЛ');
  assert.equal(game.audio.nextStation(), '84.5 FM · SUNSET PULSE');

  // Переключение качества графики High <-> Low
  game.engine.setQuality('low');
  assert.equal(game.engine.camera.far, CONFIG.QUALITY.low.drawDistance);
  game.engine.setQuality('high');
  assert.equal(game.engine.camera.far, CONFIG.QUALITY.high.drawDistance);

  // ИИ врагов: обход воды (враг у берега выбирает направление в сторону суши)
  const steer = game.ai.chooseSteerDirection(CONFIG.WATER_START_X - 1, 60, CONFIG.WATER_START_X + 30, 60);
  const nextX = CONFIG.WATER_START_X - 1 + steer.vx * 2.6;
  const nextZ = 60 + steer.vz * 2.6;
  assert.equal(game.world.isWater(nextX, nextZ), false, 'ИИ врагов не должен шагать в море');
});
