// Gameplay tuning. World distances are pixels unless a name says "Tiles".
export const TILE_SIZE = 32;
export const MAP_SIZE = 64;
export const WORLD_SIZE = TILE_SIZE * MAP_SIZE;
export const FIXED_STEP = 1 / 30;

export const DIFFICULTIES = Object.freeze({
  easy: Object.freeze({
    name: 'Разведка', description: 'Время освоиться: редкие небольшие атаки.',
    firstWave: 280, waveInterval: 185, waveSize: 2, waveGrowth: 1, waveCap: 10,
    armyReserve: 5, armyGrowth: 2, workers: 5, health: .86, damage: .78,
    playerMinerals: 370, enemyMinerals: 175,
  }),
  normal: Object.freeze({
    name: 'Рубеж', description: 'Спокойное начало, затем борьба за карту.',
    firstWave: 225, waveInterval: 175, waveSize: 3, waveGrowth: 2, waveCap: 16,
    armyReserve: 7, armyGrowth: 3, workers: 6, health: 1, damage: 1,
    playerMinerals: 320, enemyMinerals: 230,
  }),
  hard: Object.freeze({
    name: 'Штурм', description: 'Меньше времени, сильнее роботы и крупнее волны.',
    firstWave: 110, waveInterval: 95, waveSize: 4, waveGrowth: 3, waveCap: 24,
    armyReserve: 10, armyGrowth: 4, workers: 8, health: 1.12, damage: 1.18,
    playerMinerals: 270, enemyMinerals: 310,
  }),
});

export const RULES = Object.freeze({
  maxSupply: 200,
  mineralAmount: 800,
  harvestAmount: 10,
  harvestSeconds: 1.4,
  mineralCrowdPenalty: 75,
  workerBuildReach: 42,
  depositReach: 32,
  mineralReach: 30,
  pathRetrySeconds: .85,
  maxPathsPerTick: 14,
  unitSpacing: 3,
  edgeScrollZone: 22,
  cameraSpeed: 540,
  fogRefreshSeconds: .25,
  aiThinkSeconds: 1.5,
  aiHouseLimit: 10,
  aiSupplyMargin: 4,
  aiBarracksReserve: 160,
  aiBarracksTarget: 2,
  aiBarracksAfterWave: 1,
  aiQueueTarget: 2,
  waveRetrySeconds: 12,
  waveWarningSeconds: 30,
  relayCaptureSeconds: 9,
  relayRadius: 55,
  relayIncome: 2.5,
  relayVision: 8,
  projectileSpeed: 570,
  projectileLifeSeconds: 1.6,
});

export const UNIT_TYPES = Object.freeze({
  worker: Object.freeze({
    name: 'Инженер', short: 'РАБ', hp: 65, speed: 96, radius: 10,
    vision: 6, range: 27, damage: 4, cooldown: 1.05, armor: 0,
    cost: 50, trainSeconds: 8, supply: 1,
  }),
  marine: Object.freeze({
    name: 'Штурмовик', short: 'ШТМ', hp: 90, speed: 84, radius: 11,
    vision: 7, range: 133, damage: 10, cooldown: .78, armor: 0,
    cost: 75, trainSeconds: 9, supply: 1,
  }),
  scout: Object.freeze({
    name: 'Разведчик', short: 'СКТ', hp: 65, speed: 132, radius: 9,
    vision: 11, range: 105, damage: 5, cooldown: .7, armor: 0,
    cost: 65, trainSeconds: 7, supply: 1,
  }),
  guardian: Object.freeze({
    name: 'Страж', short: 'СТР', hp: 240, speed: 66, radius: 15,
    vision: 7, range: 105, damage: 24, cooldown: 1.55, armor: 2, buildingBonus: 1.6,
    cost: 180, trainSeconds: 20, supply: 3,
  }),
  support: Object.freeze({
    name: 'Ремонтник', short: 'РЕМ', hp: 85, speed: 92, radius: 10,
    vision: 8, range: 90, damage: 3, cooldown: 1.3, armor: 0,
    healRange: 120, healAmount: 9, healInterval: .65,
    cost: 110, trainSeconds: 14, supply: 2,
  }),
});

export const BUILDING_TYPES = Object.freeze({
  command: Object.freeze({
    name: 'Штаб', short: 'ШТАБ', hp: 1250, size: 3, vision: 9,
    cost: 0, buildSeconds: 0, supply: 10, trains: ['worker'], deposit: true,
    range: 228, damage: 14, cooldown: 1.1,
  }),
  barracks: Object.freeze({
    name: 'Казарма', short: 'КАЗ', hp: 700, size: 3, vision: 6,
    cost: 140, buildSeconds: 14, supply: 0, trains: ['marine', 'scout'],
  }),
  house: Object.freeze({
    name: 'Жилой модуль', short: 'МОД', hp: 450, size: 2, vision: 5,
    cost: 90, buildSeconds: 10, supply: 6, trains: [],
  }),
  turret: Object.freeze({
    name: 'Оборонная башня', short: 'БАШ', hp: 530, size: 2, vision: 8,
    cost: 125, buildSeconds: 13, supply: 0, trains: [],
    range: 190, damage: 18, cooldown: 1.12, armor: 1,
  }),
  workshop: Object.freeze({
    name: 'Мастерская', short: 'ЦЕХ', hp: 850, size: 3, vision: 7,
    cost: 220, buildSeconds: 23, supply: 0, trains: ['guardian', 'support'], requires: 'barracks',
  }),
  outpost: Object.freeze({
    name: 'Полевой штаб', short: 'ПОСТ', hp: 780, size: 3, vision: 8,
    cost: 275, buildSeconds: 25, supply: 6, trains: ['worker'], deposit: true, requires: 'workshop',
  }),
});

export const UPGRADES = Object.freeze({
  drills: Object.freeze({
    name: 'Буровой модуль', short: 'ДОБЫЧА', hotkey: 'D', building: 'command',
    cost: 125, costStep: 0, seconds: 22, secondsStep: 0, max: 1,
    description: '+5 минералов за рейс инженера',
  }),
  plating: Object.freeze({
    name: 'Бронепластины', short: 'БРОНЯ', hotkey: 'P', building: 'workshop',
    cost: 165, costStep: 105, seconds: 27, secondsStep: 8, max: 2,
    description: '−2 урона по всем вашим юнитам за уровень',
  }),
  weapons: Object.freeze({
    name: 'Импульсное оружие', short: 'АТАКА', hotkey: 'J', building: 'workshop',
    cost: 165, costStep: 110, seconds: 26, secondsStep: 8, max: 2,
    description: '+2 урона стрелкам, +4 стражам за уровень',
  }),
});

export const TEAM_COLORS = Object.freeze({
  player: Object.freeze({ main: '#76e3d7', bright: '#c5fff1', dark: '#245e68' }),
  enemy: Object.freeze({ main: '#ff806e', bright: '#ffd0b5', dark: '#713943' }),
});

export const TERRAIN = Object.freeze({ GROUND: 0, SAND: 1, WATER: 2, ROCK: 3 });
