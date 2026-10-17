import { MAP_SIZE, TILE_SIZE, TERRAIN, WORLD_SIZE } from './config.js';

export const tileIndex = (x, y) => y * MAP_SIZE + x;
export const tileCenter = tile => (tile + 0.5) * TILE_SIZE;
export const worldToTile = world => Math.floor(world / TILE_SIZE);

const MINERAL_SPOTS = [
  [5, 9], [5, 11], [6, 13], [7, 7], [12, 6], [14, 9],
  [56, 49], [57, 51], [55, 54], [49, 55], [48, 53], [53, 57],
  [22, 26], [24, 27], [25, 35], [27, 37], [37, 19], [39, 22],
  [37, 40], [39, 42], [18, 49], [20, 51], [49, 29], [51, 31],
];

// A deterministic integer hash keeps the terrain identical after every restart.
function hash(x, y, salt = 0) {
  let n = Math.imul(x + 37, 374761393) + Math.imul(y + 71, 668265263) + salt;
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967295;
}

function makeCanvas(width, height) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

export function createMap() {
  const tiles = new Uint8Array(MAP_SIZE * MAP_SIZE);
  for (let y = 0; y < MAP_SIZE; y++) {
    for (let x = 0; x < MAP_SIZE; x++) {
      tiles[tileIndex(x, y)] = hash(x, y) < 0.16 ? TERRAIN.SAND : TERRAIN.GROUND;
    }
  }

  const ellipse = (cx, cy, rx, ry, type) => {
    for (let y = Math.max(1, Math.floor(cy - ry - 1)); y < Math.min(MAP_SIZE - 1, Math.ceil(cy + ry + 1)); y++) {
      for (let x = Math.max(1, Math.floor(cx - rx - 1)); x < Math.min(MAP_SIZE - 1, Math.ceil(cx + rx + 1)); x++) {
        const uneven = (hash(x, y, 19) - 0.5) * 0.28;
        if (((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 < 1 + uneven) tiles[tileIndex(x, y)] = type;
      }
    }
  };
  ellipse(31, 30, 6, 4, TERRAIN.WATER);
  ellipse(13, 39, 3, 6, TERRAIN.WATER);
  ellipse(49, 20, 5, 3, TERRAIN.WATER);
  ellipse(42, 47, 3, 4, TERRAIN.WATER);
  ellipse(21, 19, 2.5, 5, TERRAIN.ROCK);
  ellipse(43, 34, 2.5, 6, TERRAIN.ROCK);
  ellipse(29, 48, 4, 2.5, TERRAIN.ROCK);
  ellipse(11, 29, 4, 2, TERRAIN.ROCK);
  ellipse(32, 14, 4, 2, TERRAIN.ROCK);
  ellipse(55, 36, 3, 2, TERRAIN.ROCK);

  // Keep the starting areas roomy enough for a headquarters and two new buildings.
  for (const [cx, cy] of [[11, 12], [52, 51]]) {
    for (let y = cy - 8; y <= cy + 8; y++) {
      for (let x = cx - 8; x <= cx + 8; x++) {
        if (x > 0 && x < MAP_SIZE - 1 && y > 0 && y < MAP_SIZE - 1 && (x - cx) ** 2 + (y - cy) ** 2 < 65) {
          tiles[tileIndex(x, y)] = hash(x, y, 42) < 0.26 ? TERRAIN.SAND : TERRAIN.GROUND;
        }
      }
    }
  }
  for (let i = 0; i < MAP_SIZE; i++) {
    tiles[tileIndex(i, 0)] = tiles[tileIndex(i, MAP_SIZE - 1)] = TERRAIN.ROCK;
    tiles[tileIndex(0, i)] = tiles[tileIndex(MAP_SIZE - 1, i)] = TERRAIN.ROCK;
  }
  for (const [x, y] of MINERAL_SPOTS) tiles[tileIndex(x, y)] = TERRAIN.GROUND;

  const terrainCanvas = makeCanvas(WORLD_SIZE, WORLD_SIZE);
  const context = terrainCanvas.getContext('2d');
  for (let y = 0; y < MAP_SIZE; y++) {
    for (let x = 0; x < MAP_SIZE; x++) {
      const type = tiles[tileIndex(x, y)];
      const px = x * TILE_SIZE, py = y * TILE_SIZE;
      const variation = Math.floor(hash(x, y, 5) * 4);
      if (type === TERRAIN.GROUND) {
        context.fillStyle = ['#18332f', '#1b3832', '#1c3932', '#203c33'][variation];
        context.fillRect(px, py, TILE_SIZE, TILE_SIZE);
        context.fillStyle = 'rgba(131,192,139,.12)';
        for (let i = 0; i < 3; i++) {
          const ox = Math.floor(hash(x, y, i + 11) * 27) + 3;
          const oy = Math.floor(hash(x, y, i + 21) * 27) + 3;
          context.fillRect(px + ox, py + oy, 2, 2);
        }
      } else if (type === TERRAIN.SAND) {
        context.fillStyle = ['#343b31', '#394034', '#3c4235', '#404437'][variation];
        context.fillRect(px, py, TILE_SIZE, TILE_SIZE);
        context.strokeStyle = 'rgba(193,175,114,.13)';
        context.beginPath(); context.moveTo(px + 5, py + 19); context.lineTo(px + 24, py + 14); context.stroke();
      } else if (type === TERRAIN.WATER) {
        context.fillStyle = ['#102e3c', '#123340', '#143746', '#163948'][variation];
        context.fillRect(px, py, TILE_SIZE, TILE_SIZE);
        context.strokeStyle = 'rgba(113,198,214,.16)';
        context.beginPath();
        context.moveTo(px + 4, py + 12); context.lineTo(px + 16, py + 10);
        context.moveTo(px + 17, py + 24); context.lineTo(px + 29, py + 22);
        context.stroke();
      } else {
        context.fillStyle = ['#353f42', '#394348', '#3c4649', '#414a4b'][variation];
        context.fillRect(px, py, TILE_SIZE, TILE_SIZE);
        context.fillStyle = 'rgba(224,231,213,.09)';
        context.beginPath(); context.moveTo(px + 2, py + 5); context.lineTo(px + 27, py + 2);
        context.lineTo(px + 18, py + 15); context.closePath(); context.fill();
        context.strokeStyle = 'rgba(7,17,22,.27)';
        context.beginPath(); context.moveTo(px + 11, py + 18); context.lineTo(px + 21, py + 29); context.stroke();
      }
      context.strokeStyle = 'rgba(7,18,21,.11)';
      context.strokeRect(px + .5, py + .5, TILE_SIZE, TILE_SIZE);
    }
  }

  // Detached canvases are caches, not network assets. Only the visible crop is copied each frame.
  const minimapCanvas = makeCanvas(192, 192);
  const mini = minimapCanvas.getContext('2d');
  const colors = ['#315b4a', '#585a42', '#24526a', '#737577'];
  for (let y = 0; y < MAP_SIZE; y++) {
    for (let x = 0; x < MAP_SIZE; x++) {
      mini.fillStyle = colors[tiles[tileIndex(x, y)]];
      mini.fillRect(x * 3, y * 3, 3, 3);
    }
  }

  return {
    tiles, terrainCanvas, minimapCanvas,
    mineralSpots: MINERAL_SPOTS.map(([tx, ty]) => ({ tx, ty })),
    inBounds(tx, ty) { return tx >= 0 && ty >= 0 && tx < MAP_SIZE && ty < MAP_SIZE; },
    isTerrainWalkable(tx, ty) {
      return this.inBounds(tx, ty) && tiles[tileIndex(tx, ty)] < TERRAIN.WATER;
    },
  };
}
