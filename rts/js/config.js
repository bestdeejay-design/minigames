// ============================================================
// config.js — ВСЕ числовые параметры игры собраны в одном месте.
// Балансировку можно вести, не трогая остальной код.
//
// Две играбельные расы (зеркальные техдеревья, у каждой свой облик):
//   human — «Гелиос-Индастриз» (люди-корпоранты, техника);
//   alien — «кхарид» (кристаллорождённые аборигены планет).
// Ключи юнитов/зданий общие; облик и подписи зависят от фракции.
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
export const BULLET_SPEED = 540;      // скорость пули/шипа, px/с
export const SHELL_SPEED = 380;       // скорость снаряда тяжёлой единицы, px/с
export const REPAIR_HP_PER_MINERAL = 6; // сколько HP ремонтируется за 1 минерал

// --- Юниты ---
// r — радиус корпуса (px); sightTiles — обзор в тайлах (туман войны);
// range — дальность атаки (px); speed — скорость (px/с).
// projectile: 'bullet' — самонаводящийся снаряд, 'shell' — снаряд с
// осколками (splash), 'none' — удар в упор.
// vehicle: true — «техника»: ремонтируется рабочими, взрывается крупнее
// (у кхарид вместо техники — крупные существа, логика та же).
// hname/aname — имя юнита у людей / у кхарид.
export const UNITS = {
  worker: {
    key: 'worker', hname: 'Рабочий', aname: 'Сборщик', hp: 60, dmg: 4, range: 26, cooldown: 1.0,
    sightTiles: 7, speed: 88, r: 10, supply: 1, cost: 50, trainTime: 12,
    canMine: true, canBuild: true, canRepair: true,
    projectile: 'none',
    hdesc: 'Добывает минералы, возводит и ремонтирует здания и технику',
    adesc: 'Собирает эрг-кристаллы, взращивает улей и латаёт сородичей',
  },
  marine: {
    key: 'marine', hname: 'Морпех', aname: 'Жалящий', hp: 45, dmg: 6, range: 134, cooldown: 0.85,
    sightTiles: 7, speed: 96, r: 10, supply: 1, cost: 50, trainTime: 13,
    canMine: false, canBuild: false, projectile: 'bullet',
    hdesc: 'Стрелок — основной боец; помещается в бункер',
    adesc: 'Плюётся кристаллическими шипами; прячется в коконе',
  },
  buggy: {
    key: 'buggy', hname: 'Багги «Оса»', aname: 'Скорч', hp: 90, dmg: 7, range: 132, cooldown: 0.5,
    sightTiles: 8, speed: 150, r: 11, supply: 2, cost: 100, trainTime: 16,
    canMine: false, canBuild: false, vehicle: true, projectile: 'bullet',
    hdesc: 'Быстрый разведчик с пулемётом — рейды по флангам',
    adesc: 'Четвероногий хищник-скаут, налетает и исчезает',
  },
  tank: {
    key: 'tank', hname: 'Танк «Гроза»', aname: 'Колосс', hp: 240, dmg: 34, range: 190, cooldown: 2.4,
    sightTiles: 9, speed: 62, r: 14, supply: 3, cost: 180, trainTime: 28,
    canMine: false, canBuild: false, vehicle: true, projectile: 'shell',
    splash: { r: 46, frac: 0.6 },
    hdesc: 'Тяжёлая пушка, осколки задевают всех вокруг цели',
    adesc: 'Громадина; его плевок взрывается снопом осколков',
  },
};

// --- Здания ---
// w/h — размер в тайлах; supplyGain — прибавка населения; produces — кого
// обучает (строка или массив); attack:true — само стреляет (турель);
// garrisonCap — сколько пехоты помещается (бункер/кокон); requires — какое
// здание должно быть достроено, прежде чем это можно ставить.
export const BUILDINGS = {
  cc:       { key: 'cc',       hname: 'Командный центр', aname: 'Гнездо-улей', w: 4, h: 3, hp: 1500, cost: 400, buildTime: 30, supplyGain: 10, sightTiles: 9, produces: 'worker' },
  depot:    { key: 'depot',    hname: 'Дом',             aname: 'Нарост-кладовая', w: 2, h: 2, hp: 500,  cost: 100, buildTime: 14, supplyGain: 8,  sightTiles: 5, produces: null   },
  barracks: { key: 'barracks', hname: 'Казарма',         aname: 'Инкубатор', w: 3, h: 2, hp: 1000, cost: 150, buildTime: 20, supplyGain: 0,  sightTiles: 6, produces: 'marine' },
  turret:   { key: 'turret',   hname: 'Турель «Скорпион»', aname: 'Жвала', w: 1, h: 1, hp: 380, cost: 100, buildTime: 12, supplyGain: 0, sightTiles: 9,
              attack: true, dmg: 8, range: 150, cooldown: 0.65, projectile: 'bullet' },
  wall:     { key: 'wall',     hname: 'Секция стены',    aname: 'Хитиновая стена', w: 1, h: 1, hp: 900,  cost: 30,  buildTime: 5,  supplyGain: 0,  sightTiles: 2 },
  bunker:   { key: 'bunker',   hname: 'Бункер',          aname: 'Кокон', w: 2, h: 2, hp: 1100, cost: 120, buildTime: 16, supplyGain: 0,  sightTiles: 8,
              garrisonCap: 4, range: 140 },
  factory:  { key: 'factory',  hname: 'Завод техники',   aname: 'Яма выводка', w: 3, h: 3, hp: 1300, cost: 250, buildTime: 35, supplyGain: 0,  sightTiles: 7,
              produces: ['buggy', 'tank'], requires: 'barracks' },
};

// --- ИИ противника (базовый профиль; миссии переопределяют) ---
export const AI = {
  workerTarget: 12,      // до скольких рабочих добывать
  maxMarines: 30,        // максимум живой пехоты у ИИ одновременно
  firstWave: 4,          // размер первой волны атаки
  waveGrowth: 2,         // прибавка к каждой следующей волне
  waveMax: 18,           // потолок размера волны
  minWaveInterval: 40,   // минимальная пауза между волнами, сек
  secondBarracksAt: 150, // время постройки второй казармы, сек
  maxTurrets: 0,         // турели у базы
  factory: false,        // строить ли завод техники
  maxBuggies: 0,         // лимит быстрых единиц
  maxTanks: 0,           // лимит тяжёлых единиц
  repair: false,         // чинить ли здания и технику
};

// --- Камера ---
export const EDGE_SCROLL_SPEED = 560; // прокрутка мышью у края экрана, px/с
export const KEY_SCROLL_SPEED = 720;  // прокрутка стрелками, px/с
export const EDGE_MARGIN = 26;        // ширина зоны у края экрана, px

// --- Палитра сторон (цвет игрока/врага одинаков для обеих рас) ---
export const COLORS = {
  player: '#4f8fe8', playerDark: '#2c5da8',
  enemy:  '#d84f3f', enemyDark:  '#8f2f26',
  mineral: '#3fd3e8',
};

// --- Подписи по фракции: у людей и кхарид разные имена/описания ---
export function fname(cfg, faction) {
  return faction === 'alien' ? (cfg.aname || cfg.hname) : cfg.hname;
}
export function fdesc(cfg, faction) {
  return faction === 'alien' ? (cfg.adesc || cfg.hdesc) : cfg.hdesc;
}

// --- Биомы планет (палитры генератора карт) ---
export const BIOMES = {
  mars: { // Актан-4: ржавая пустыня, базальтовые гряды, солёные низины
    ground: '#6e4630', tones: ['#5e3a28', '#7d5136', '#83553a', '#67422c'],
    speck1: 'rgba(40,20,12,0.28)', speck2: 'rgba(200,150,110,0.18)',
    water: '#3a5d6e', waterGlint: 'rgba(140,210,220,0.3)', shore: 'rgba(160,110,70,0.5)',
    rock: ['#5a4440', '#6f544e', '#866460'], dust: 'rgba(150,95,60,0.3)',
  },
  nest: { // Брок-Тхаал: фиолетовые пустоши улья, светящиеся кислотные озёра
    ground: '#4a3a5c', tones: ['#3f3150', '#56436c', '#5d4a75', '#443557'],
    speck1: 'rgba(20,12,32,0.3)', speck2: 'rgba(190,160,230,0.16)',
    water: '#2e6e4e', waterGlint: 'rgba(150,255,190,0.35)', shore: 'rgba(90,60,120,0.5)',
    rock: ['#4c4458', '#5f566e', '#746a86'], dust: 'rgba(120,90,160,0.3)',
  },
  moon: { // Селенит-Б: серые лунные равнины, реголит, кратеры
    ground: '#55565c', tones: ['#4a4b51', '#616269', '#68696f', '#4f5056'],
    speck1: 'rgba(20,20,24,0.28)', speck2: 'rgba(190,190,200,0.16)',
    water: '#26455c', waterGlint: 'rgba(150,200,240,0.3)', shore: 'rgba(120,120,130,0.5)',
    rock: ['#4a4d54', '#5d6168', '#71767e'], dust: 'rgba(130,130,140,0.3)',
  },
};
