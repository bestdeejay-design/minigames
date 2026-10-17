import { MAP_SIZE, TILE_SIZE } from './config.js';
import { tileCenter, tileIndex } from './map.js';

const DIRECTIONS = [
  [1, 0, 10], [-1, 0, 10], [0, 1, 10], [0, -1, 10],
  [1, 1, 14], [1, -1, 14], [-1, 1, 14], [-1, -1, 14],
];

// The heap and score arrays are reused across searches: a mass order does not
// allocate a new 64×64 grid for every soldier.
export function createPathfinder(isOpen) {
  const size = MAP_SIZE * MAP_SIZE;
  const score = new Float32Array(size);
  const parent = new Int32Array(size);
  const seen = new Uint32Array(size);
  const closed = new Uint32Array(size);
  let generation = 0;
  const heap = [];

  function push(id, priority) {
    let index = heap.length;
    heap.push({ id, priority });
    while (index > 0) {
      const above = (index - 1) >> 1;
      if (heap[above].priority <= priority) break;
      heap[index] = heap[above];
      index = above;
    }
    heap[index] = { id, priority };
  }
  function pop() {
    const first = heap[0];
    const last = heap.pop();
    if (heap.length) {
      let index = 0;
      while (true) {
        const left = index * 2 + 1;
        if (left >= heap.length) break;
        const right = left + 1;
        const child = right < heap.length && heap[right].priority < heap[left].priority ? right : left;
        if (heap[child].priority >= last.priority) break;
        heap[index] = heap[child];
        index = child;
      }
      heap[index] = last;
    }
    return first;
  }
  function heuristic(x, y, goalX, goalY, range) {
    const dx = Math.abs(x - goalX), dy = Math.abs(y - goalY);
    return Math.max(0, (10 * (dx + dy) - 6 * Math.min(dx, dy)) - range * 10);
  }
  function inBounds(x, y) { return x >= 0 && y >= 0 && x < MAP_SIZE && y < MAP_SIZE; }

  function nearestOpen(goalX, goalY, fromX, fromY, maxRadius = 7) {
    if (inBounds(goalX, goalY) && isOpen(goalX, goalY)) return { x: goalX, y: goalY };
    let candidate = null;
    for (let radius = 1; radius <= maxRadius; radius++) {
      let best = Infinity;
      for (let y = goalY - radius; y <= goalY + radius; y++) {
        for (let x = goalX - radius; x <= goalX + radius; x++) {
          if (Math.max(Math.abs(x - goalX), Math.abs(y - goalY)) !== radius || !inBounds(x, y) || !isOpen(x, y)) continue;
          const cost = Math.hypot(x - goalX, y - goalY) * 3 + Math.hypot(x - fromX, y - fromY) * .08;
          if (cost < best) { best = cost; candidate = { x, y }; }
        }
      }
      if (candidate) return candidate;
    }
    return null;
  }

  function find(startX, startY, goalX, goalY, range = 0) {
    startX = Math.max(0, Math.min(MAP_SIZE - 1, Math.floor(startX)));
    startY = Math.max(0, Math.min(MAP_SIZE - 1, Math.floor(startY)));
    goalX = Math.max(0, Math.min(MAP_SIZE - 1, Math.floor(goalX)));
    goalY = Math.max(0, Math.min(MAP_SIZE - 1, Math.floor(goalY)));
    if (range === 0 && !isOpen(goalX, goalY)) {
      const alternative = nearestOpen(goalX, goalY, startX, startY);
      if (!alternative) return null;
      goalX = alternative.x; goalY = alternative.y;
    }
    if (!isOpen(startX, startY)) return null;
    if ((startX - goalX) ** 2 + (startY - goalY) ** 2 <= range ** 2) return [];
    generation++;
    if (generation === 0xffffffff) { seen.fill(0); closed.fill(0); generation = 1; }
    heap.length = 0;
    const start = tileIndex(startX, startY);
    seen[start] = generation; score[start] = 0; parent[start] = -1;
    push(start, heuristic(startX, startY, goalX, goalY, range));
    let visited = 0;

    while (heap.length && visited < size) {
      const node = pop().id;
      if (closed[node] === generation) continue; // An improved path can leave an old heap entry.
      closed[node] = generation;
      visited++;
      const x = node % MAP_SIZE, y = (node / MAP_SIZE) | 0;
      if ((x - goalX) ** 2 + (y - goalY) ** 2 <= range ** 2) {
        const path = [];
        let current = node;
        while (current !== start && current !== -1) {
          const tx = current % MAP_SIZE, ty = (current / MAP_SIZE) | 0;
          path.push({ x: tileCenter(tx), y: tileCenter(ty), tx, ty });
          current = parent[current];
        }
        path.reverse();
        return path;
      }
      for (const [dx, dy, cost] of DIRECTIONS) {
        const nx = x + dx, ny = y + dy;
        if (!inBounds(nx, ny) || !isOpen(nx, ny)) continue;
        // Diagonal steps may not cut across a corner of two impassable tiles.
        if (dx && dy && (!isOpen(x + dx, y) || !isOpen(x, y + dy))) continue;
        const next = tileIndex(nx, ny);
        if (closed[next] === generation) continue;
        const nextScore = score[node] + cost;
        if (seen[next] !== generation || nextScore < score[next]) {
          seen[next] = generation;
          score[next] = nextScore;
          parent[next] = node;
          push(next, nextScore + heuristic(nx, ny, goalX, goalY, range));
        }
      }
    }
    return null;
  }

  return { find, nearestOpen };
}
