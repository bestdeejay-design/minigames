// ============================================================
// config.js — ВСЕ числовые параметры игры собраны в одном месте.
// Балансировку можно вести, не трогая остальной код.
// ============================================================

// --- Мир ---
export const TILE = 32;               // размер одного тайла, px мира
export const MAP_W = 64;              // ширина карты в тайлах
export const MAP_H = 64;              // высота карты в тайлах
export const WORLD_W = MAP_W * TILE;  // размер мира, px (2048)
export const WORLD_H = MAP_H * TILE;

// --- Игровой цикл ---
export const LOGIC_DT = 1 / 30;       // фиксированный шаг логики, сек
export const MAX_FRAME_DT = 0.25;     // потолок кадра — защита от «спирали смерти» после лагов

// --- Экономика ---
export const START_MINERALS = 150;    // минералы у каждой стороны на старте
export const MINERAL_PER_TRIP = 8;    // сколько рабочий приносит за рейс
export const MINE_TIME = 1.8;         // время добычи одного кристалла, сек
export const SUPPLY_MAX = 200;        // жёсткий потолок населения
export const WORKER_START = 4;        // рабочих у каждой стороны на старте

// --- Бой ---
export const BULLET_SPEED = 540;      // скорость пули морпеха, px/с

// --- Юниты ---
// r — радиус корпуса (px); sightTiles — обзор в тайлах (туман войны);
// range — дальность атаки (px); speed — скорость (px/с).
export const UNITS = {
  worker: {
    key: 'worker', name: 'Рабочий', hp: 60, dmg: 4, range: 26, cooldown: 1.0,
    sightTiles: 7, speed: 88, r: 10, supply: 1, cost: 50, trainTime: 12,
    canMine: true, canBuild: true, desc: 'Добывает минералы и возводит здания',
  },
  marine: {
    key: 'marine', name: 'Морпех', hp: 45, dmg: 6, range: 134, cooldown: 0.85,
    sightTiles: 7, speed: 96, r: 10, supply: 1, cost: 50, trainTime: 13,
    canMine: false, canBuild: false, desc: 'Стрелок — основной боец',
  },
};

// --- Здания ---
// w/h — размер в тайлах; supplyGain — прибавка населения; produces — кого обучает.
export const BUILDINGS = {
  cc:       { key: 'cc',       name: 'Командный центр', w: 4, h: 3, hp: 1500, cost: 400, buildTime: 30, supplyGain: 10, sightTiles: 9, produces: 'worker' },
  depot:    { key: 'depot',    name: 'Дом',             w: 2, h: 2, hp: 500,  cost: 100, buildTime: 14, supplyGain: 8,  sightTiles: 5, produces: null   },
  barracks: { key: 'barracks', name: 'Казарма',         w: 3, h: 2, hp: 1000, cost: 150, buildTime: 20, supplyGain: 0,  sightTiles: 6, produces: 'marine' },
};

// --- ИИ противника ---
export const AI = {
  workerTarget: 12,      // до скольких рабочих добывать
  maxMarines: 30,        // максимум живых морпехов у ИИ одновременно
  firstWave: 4,          // размер первой волны атаки
  waveGrowth: 2,         // прибавка к каждой следующей волне
  waveMax: 18,           // потолок размера волны
  minWaveInterval: 40,   // минимальная пауза между волнами, сек
  secondBarracksAt: 150, // время постройки второй казармы, сек
};

// --- Камера ---
export const EDGE_SCROLL_SPEED = 560; // прокрутка мышью у края экрана, px/с
export const KEY_SCROLL_SPEED = 720;  // прокрутка стрелками, px/с
export const EDGE_MARGIN = 26;        // ширина зоны у края экрана, px

// --- Палитра сторон ---
export const COLORS = {
  player: '#4f8fe8', playerDark: '#2c5da8',
  enemy:  '#d84f3f', enemyDark:  '#8f2f26',
  mineral: '#3fd3e8',
};
