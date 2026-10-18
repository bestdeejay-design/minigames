import * as THREE from '../libs/three.module.min.js';
import { CONFIG } from './config.js';

export function loadStorage(key, fallback) {
  try {
    if (typeof localStorage === 'undefined') return fallback;
    const raw = localStorage.getItem(key);
    return raw !== null ? JSON.parse(raw) : fallback;
  } catch (_e) {
    return fallback;
  }
}

export function saveStorage(key, value) {
  try {
    if (typeof localStorage === 'undefined') return false;
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (_e) {
    return false;
  }
}

// Пространственная сетка для быстрого поиска зданий, укрытий, машин и NPC
export class SpatialGrid {
  constructor(cellSize = CONFIG.SPATIAL_CELL_SIZE) {
    this.cellSize = cellSize;
    this.cells = new Map();
  }

  clear() {
    this.cells.clear();
  }

  _key(cx, cz) {
    return `${cx},${cz}`;
  }

  insertAABB(item, minX, maxX, minZ, maxZ) {
    const cMinX = Math.floor(minX / this.cellSize);
    const cMaxX = Math.floor(maxX / this.cellSize);
    const cMinZ = Math.floor(minZ / this.cellSize);
    const cMaxZ = Math.floor(maxZ / this.cellSize);
    for (let cx = cMinX; cx <= cMaxX; cx++) {
      for (let cz = cMinZ; cz <= cMaxZ; cz++) {
        const k = this._key(cx, cz);
        let list = this.cells.get(k);
        if (!list) {
          list = [];
          this.cells.set(k, list);
        }
        list.push(item);
      }
    }
  }

  insertPoint(item, x, z, radius = 1) {
    this.insertAABB(item, x - radius, x + radius, z - radius, z + radius);
  }

  queryRadius(x, z, radius) {
    const cMinX = Math.floor((x - radius) / this.cellSize);
    const cMaxX = Math.floor((x + radius) / this.cellSize);
    const cMinZ = Math.floor((z - radius) / this.cellSize);
    const cMaxZ = Math.floor((z + radius) / this.cellSize);
    const seen = new Set();
    const out = [];
    for (let cx = cMinX; cx <= cMaxX; cx++) {
      for (let cz = cMinZ; cz <= cMaxZ; cz++) {
        const list = this.cells.get(this._key(cx, cz));
        if (!list) continue;
        for (let i = 0; i < list.length; i++) {
          const item = list[i];
          if (!seen.has(item)) {
            seen.add(item);
            out.push(item);
          }
        }
      }
    }
    return out;
  }
}

export class Engine {
  constructor(canvas, quality = 'high') {
    this.canvas = canvas;
    this.quality = quality === 'low' ? 'low' : 'high';
    this.scene = new THREE.Scene();

    const q = CONFIG.QUALITY[this.quality];
    this.camera = new THREE.PerspectiveCamera(72, 16 / 9, 0.15, q.drawDistance);
    this.camera.rotation.order = 'YXZ';
    this.scene.add(this.camera);

    this.renderer = null;
    this.fps = 60;
    this._fpsFrames = 0;
    this._fpsAccum = 0;

    if (canvas && typeof window !== 'undefined') {
      canvas.addEventListener('contextmenu', (e) => e.preventDefault());
      try {
        this.renderer = new THREE.WebGLRenderer({
          canvas,
          antialias: this.quality === 'high',
          powerPreference: 'high-performance',
        });
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.12;
      } catch (_err) {
        this.renderer = null;
      }
      this.resize();
      window.addEventListener('resize', () => this.resize());
    }
  }

  setQuality(quality) {
    this.quality = quality === 'low' ? 'low' : 'high';
    const q = CONFIG.QUALITY[this.quality];
    this.camera.far = q.drawDistance;
    this.camera.updateProjectionMatrix();
    if (this.scene.fog) {
      this.scene.fog.near = q.fogNear;
      this.scene.fog.far = q.fogFar;
    }
    this.resize();
  }

  resize() {
    if (typeof window === 'undefined') return;
    const width = Math.max(1, window.innerWidth || 800);
    const height = Math.max(1, window.innerHeight || 600);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    if (this.renderer) {
      const maxDpr = this.quality === 'high' ? CONFIG.MAX_PIXEL_RATIO_HIGH : CONFIG.MAX_PIXEL_RATIO_LOW;
      const dpr = Math.min(window.devicePixelRatio || 1, maxDpr);
      this.renderer.setPixelRatio(dpr);
      this.renderer.setSize(width, height, false);
    }
  }

  updateFps(dt) {
    this._fpsFrames++;
    this._fpsAccum += dt;
    if (this._fpsAccum >= 0.5) {
      this.fps = Math.round(this._fpsFrames / this._fpsAccum);
      this._fpsFrames = 0;
      this._fpsAccum = 0;
    }
  }

  render() {
    if (this.renderer) {
      this.renderer.render(this.scene, this.camera);
    }
  }
}
