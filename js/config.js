// All gameplay tuning lives here. Distances are in world pixels unless marked as tiles.
export const TILE_SIZE = 32;
export const MAP_SIZE = 64;
export const WORLD_SIZE = TILE_SIZE * MAP_SIZE;
export const FIXED_STEP = 1 / 30;

export const RULES = Object.freeze({
  playerMinerals: 240,
  enemyMinerals: 230,
  maxSupply: 200,
  mineralAmount: 600,
  harvestAmount: 10,
  harvestSeconds: 1.45,
  mineralCrowdPenalty: 75,
  workerBuildReach: 42,
  depositReach: 32,
  mineralReach: 30,
  pathRetrySeconds: 0.85,
  maxPathsPerTick: 14,
  unitSpacing: 3,
  edgeScrollZone: 22,
  cameraSpeed: 540,
  fogRefreshSeconds: 0.25,
  aiThinkSeconds: 1.5,
  aiWorkerTarget: 6,
  aiHouseLimit: 8,
  aiSupplyMargin: 3,
  aiBarracksReserve: 150,
  aiBarracksTarget: 2,
  aiBarracksAfterWave: 1,
  aiQueueTarget: 2,
  firstWaveSeconds: 75,
  waveIntervalSeconds: 55,
  waveRetrySeconds: 9,
  firstWaveSize: 3,
  waveGrowth: 2,
  projectileSpeed: 570,
  projectileLifeSeconds: 1.5,
});

export const UNIT_TYPES = Object.freeze({
  worker: Object.freeze({
    name: 'Инженер', short: 'РАБ', hp: 65, speed: 96, radius: 10,
    vision: 6, range: 27, damage: 4, cooldown: 1.05,
    cost: 50, trainSeconds: 8, supply: 1,
  }),
  marine: Object.freeze({
    name: 'Штурмовик', short: 'ШТМ', hp: 90, speed: 84, radius: 11,
    vision: 7, range: 133, damage: 10, cooldown: 0.78,
    cost: 75, trainSeconds: 9, supply: 1,
  }),
});

export const BUILDING_TYPES = Object.freeze({
  command: Object.freeze({
    name: 'Штаб', short: 'ШТАБ', hp: 1050, size: 3, vision: 9,
    cost: 0, buildSeconds: 0, supply: 10, trains: 'worker',
  }),
  barracks: Object.freeze({
    name: 'Казарма', short: 'КАЗ', hp: 650, size: 3, vision: 6,
    cost: 140, buildSeconds: 14, supply: 0, trains: 'marine',
  }),
  house: Object.freeze({
    name: 'Жилой модуль', short: 'МОД', hp: 410, size: 2, vision: 5,
    cost: 90, buildSeconds: 10, supply: 6, trains: null,
  }),
});

export const TEAM_COLORS = Object.freeze({
  player: Object.freeze({ main: '#76e3d7', bright: '#c5fff1', dark: '#245e68' }),
  enemy: Object.freeze({ main: '#ff806e', bright: '#ffd0b5', dark: '#713943' }),
});

export const TERRAIN = Object.freeze({ GROUND: 0, SAND: 1, WATER: 2, ROCK: 3 });
