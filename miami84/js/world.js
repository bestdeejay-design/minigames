import * as THREE from '../libs/three.module.min.js';
import { CONFIG } from './config.js';
import { SpatialGrid } from './engine.js';

function makeCanvas(w, h) {
  if (typeof document !== 'undefined' && document.createElement) {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    return c;
  }
  return { width: w, height: h, getContext: () => null };
}

export function createGlowTexture(colorHex = '#ff2a85') {
  const canvas = makeCanvas(128, 128);
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const grad = ctx.createRadialGradient(64, 64, 4, 64, 64, 62);
    grad.addColorStop(0, '#ffffff');
    grad.addColorStop(0.25, colorHex);
    grad.addColorStop(0.65, colorHex + '55');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 128, 128);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
}

export function createStripedSunTexture() {
  const canvas = makeCanvas(256, 256);
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.clearRect(0, 0, 256, 256);
    const grad = ctx.createLinearGradient(0, 20, 0, 236);
    grad.addColorStop(0, '#fff36d');
    grad.addColorStop(0.35, '#ff9e00');
    grad.addColorStop(0.7, '#ff2a85');
    grad.addColorStop(1, '#7b2cbf');

    ctx.save();
    ctx.beginPath();
    ctx.arc(128, 128, 108, 0, Math.PI * 2);
    ctx.clip();
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 256, 256);

    // Полосы заката в нижней половине солнца (стиль синтвейв 80-х)
    ctx.globalCompositeOperation = 'destination-out';
    const stripes = [
      { y: 142, h: 4 },
      { y: 156, h: 6 },
      { y: 173, h: 8 },
      { y: 193, h: 10 },
      { y: 215, h: 13 },
    ];
    ctx.fillStyle = '#000';
    for (const s of stripes) {
      ctx.fillRect(0, s.y, 256, s.h);
    }
    ctx.restore();
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
}

export function createSkyTexture(isNight = false) {
  const canvas = makeCanvas(64, 256);
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const grad = ctx.createLinearGradient(0, 0, 0, 256);
    if (!isNight) {
      grad.addColorStop(0.0, '#180636');
      grad.addColorStop(0.32, '#481268');
      grad.addColorStop(0.54, '#b5179e');
      grad.addColorStop(0.72, '#ff2a85');
      grad.addColorStop(0.88, '#ff7b00');
      grad.addColorStop(1.0, '#ffbe0b');
    } else {
      grad.addColorStop(0.0, '#04010c');
      grad.addColorStop(0.4, '#0c0524');
      grad.addColorStop(0.75, '#1d0b46');
      grad.addColorStop(1.0, '#3a0ca3');
    }
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 64, 256);

    if (isNight) {
      ctx.fillStyle = '#ffffff';
      for (let i = 0; i < 45; i++) {
        const sx = (i * 19) % 62;
        const sy = (i * 37) % 160;
        ctx.fillRect(sx, sy, 1.5, 1.5);
      }
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
}

export function createAsphaltTexture() {
  const canvas = makeCanvas(256, 256);
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#232331';
    ctx.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 900; i++) {
      const x = (i * 73) % 256;
      const y = (i * 137) % 256;
      ctx.fillStyle = i % 2 === 0 ? '#2b2b3c' : '#1b1b27';
      ctx.fillRect(x, y, 2, 2);
    }
    // Двойная жёлтая осевая и боковые бирюзовые/белые полосы
    ctx.fillStyle = '#ffbe0b';
    ctx.fillRect(122, 0, 4, 256);
    ctx.fillRect(130, 0, 4, 256);

    ctx.fillStyle = '#e0fbfc';
    for (let y = 0; y < 256; y += 32) {
      ctx.fillRect(62, y + 4, 3, 18);
      ctx.fillRect(191, y + 4, 3, 18);
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.needsUpdate = true;
  return tex;
}

export function createSandTexture() {
  const canvas = makeCanvas(128, 128);
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#f3d38c';
    ctx.fillRect(0, 0, 128, 128);
    for (let i = 0; i < 500; i++) {
      const x = (i * 41) % 128;
      const y = (i * 89) % 128;
      ctx.fillStyle = i % 3 === 0 ? '#ffe6a7' : '#e0b96c';
      ctx.fillRect(x, y, 2, 2);
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(16, 48);
  tex.needsUpdate = true;
  return tex;
}

export function createWindowTexture(baseHex, trimHex, isNight = false, style = 'artdeco') {
  const canvas = makeCanvas(128, 256);
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = baseHex;
    ctx.fillRect(0, 0, 128, 256);

    // Декоративные вертикальные полосы арт-деко
    ctx.fillStyle = trimHex;
    ctx.fillRect(0, 0, 8, 256);
    ctx.fillRect(120, 0, 8, 256);
    if (style === 'artdeco') {
      ctx.fillRect(58, 0, 12, 256);
    }

    const cols = style === 'tower' ? 6 : 4;
    const rows = style === 'tower' ? 14 : 8;
    const padX = 14;
    const padY = 14;
    const cellW = (128 - padX * 2) / cols;
    const cellH = (256 - padY * 2) / rows;

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const hash = (r * 17 + c * 31) % 11;
        const lit = isNight ? hash < 8 : hash < 4;
        if (lit) {
          ctx.fillStyle = hash % 3 === 0 ? '#00f5d4' : hash % 2 === 0 ? '#ffbe0b' : '#ff70a6';
        } else {
          ctx.fillStyle = '#1b1936';
        }
        ctx.fillRect(
          padX + c * cellW + 3,
          padY + r * cellH + 3,
          Math.max(4, cellW - 6),
          Math.max(6, cellH - 6)
        );
      }
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.needsUpdate = true;
  return tex;
}

export function createNeonSignTexture(title, subtitle, colorHex = '#ff2a85') {
  const canvas = makeCanvas(256, 96);
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#100624';
    ctx.fillRect(0, 0, 256, 96);

    ctx.strokeStyle = colorHex;
    ctx.lineWidth = 5;
    ctx.strokeRect(6, 6, 244, 84);

    ctx.strokeStyle = '#00f5d4';
    ctx.lineWidth = 2;
    ctx.strokeRect(12, 12, 232, 72);

    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = colorHex;
    ctx.shadowBlur = 12;
    ctx.font = 'bold 26px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(title, 128, 48);

    ctx.shadowBlur = 6;
    ctx.fillStyle = colorHex;
    ctx.font = 'bold 14px monospace';
    ctx.fillText(subtitle || 'NEON BAY 84', 128, 72);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
}

export class World {
  constructor(scene, quality = 'high') {
    this.scene = scene;
    this.quality = quality;
    this.isNight = false;
    this.spatialGrid = new SpatialGrid(CONFIG.SPATIAL_CELL_SIZE);
    this.colliders = []; // { minX, maxX, minZ, maxZ, maxY, tag, mesh }
    this.raycastMeshes = [];
    this.neonMaterials = [];
    this.neonSprites = [];
    this.windowMeshes = [];

    this._initAtmosphere();
    this._initGroundAndSea();
  }

  _initAtmosphere() {
    const q = CONFIG.QUALITY[this.quality];
    this.scene.background = new THREE.Color(CONFIG.COLORS.sunsetFog);
    this.scene.fog = new THREE.Fog(CONFIG.COLORS.sunsetFog, q.fogNear, q.fogFar);

    this.ambientLight = new THREE.AmbientLight(0xffd6e8, 0.85);
    this.scene.add(this.ambientLight);

    this.sunLight = new THREE.DirectionalLight(0xff9e5e, 1.25);
    this.sunLight.position.set(220, 95, -40);
    this.scene.add(this.sunLight);

    this.hemiLight = new THREE.HemisphereLight(0xff70a6, 0x240b4c, 0.55);
    this.scene.add(this.hemiLight);

    // Купол неба
    this.skyTexSunset = createSkyTexture(false);
    this.skyTexNight = createSkyTexture(true);
    const skyGeo = new THREE.SphereGeometry(290, 24, 16);
    this.skyMat = new THREE.MeshBasicMaterial({
      map: this.skyTexSunset,
      side: THREE.BackSide,
      fog: false,
      depthWrite: false,
    });
    this.skyDome = new THREE.Mesh(skyGeo, this.skyMat);
    this.scene.add(this.skyDome);

    // Большое полосатое солнце над морским горизонтом (Восток, +X)
    const sunTex = createStripedSunTexture();
    const sunMat = new THREE.SpriteMaterial({
      map: sunTex,
      transparent: true,
      fog: false,
      depthWrite: false,
    });
    this.sunSprite = new THREE.Sprite(sunMat);
    this.sunSprite.position.set(275, 52, -20);
    this.sunSprite.scale.set(95, 95, 1);
    this.scene.add(this.sunSprite);

    // Ореол вокруг солнца
    const sunGlowMat = new THREE.SpriteMaterial({
      map: createGlowTexture('#ff2a85'),
      transparent: true,
      blending: THREE.AdditiveBlending,
      fog: false,
      depthWrite: false,
      opacity: 0.65,
    });
    this.sunGlow = new THREE.Sprite(sunGlowMat);
    this.sunGlow.position.set(274, 52, -20);
    this.sunGlow.scale.set(165, 165, 1);
    this.scene.add(this.sunGlow);
  }

  _initGroundAndSea() {
    // Основная земля города (X от -300 до +150)
    const landWidth = 450;
    const landGeo = new THREE.PlaneGeometry(landWidth, CONFIG.WORLD_SIZE);
    landGeo.rotateX(-Math.PI / 2);
    const landMat = new THREE.MeshLambertMaterial({ color: 0x322f42 });
    this.landMesh = new THREE.Mesh(landGeo, landMat);
    this.landMesh.position.set(-75, -0.05, 0);
    this.scene.add(this.landMesh);
    this.raycastMeshes.push(this.landMesh);

    // Пляж с песком (X от +148 до +188)
    const beachGeo = new THREE.PlaneGeometry(42, CONFIG.WORLD_SIZE);
    beachGeo.rotateX(-Math.PI / 2);
    const beachMat = new THREE.MeshLambertMaterial({
      map: createSandTexture(),
      color: CONFIG.COLORS.sand,
    });
    this.beachMesh = new THREE.Mesh(beachGeo, beachMat);
    this.beachMesh.position.set(168, -0.02, 0);
    this.scene.add(this.beachMesh);
    this.raycastMeshes.push(this.beachMesh);

    // Анимированное море с волнами (X от +185 до +300)
    const segs = CONFIG.QUALITY[this.quality].waveSegments;
    this.seaGeo = new THREE.PlaneGeometry(125, CONFIG.WORLD_SIZE, 20, segs);
    this.seaGeo.rotateX(-Math.PI / 2);
    const pos = this.seaGeo.attributes.position;
    this._seaBaseY = new Float32Array(pos.count);
    for (let i = 0; i < pos.count; i++) {
      this._seaBaseY[i] = pos.getY(i);
    }
    this.seaMat = new THREE.MeshLambertMaterial({
      color: CONFIG.COLORS.seaSunset,
      emissive: 0x102542,
    });
    this.seaMesh = new THREE.Mesh(this.seaGeo, this.seaMat);
    this.seaMesh.position.set(244, -0.35, 0);
    this.scene.add(this.seaMesh);
  }

  updateWaves(time, playerPos) {
    if (playerPos) {
      this.skyDome.position.set(playerPos.x, 0, playerPos.z);
    }
    const pos = this.seaGeo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const vx = pos.getX(i);
      const vz = pos.getZ(i);
      const wave =
        Math.sin(vx * 0.22 + time * 2.4) * 0.28 +
        Math.cos(vz * 0.14 + time * 1.8) * 0.22;
      pos.setY(i, this._seaBaseY[i] + wave);
    }
    pos.needsUpdate = true;
  }

  toggleNightMode() {
    this.setNightMode(!this.isNight);
    return this.isNight;
  }

  setNightMode(isNight) {
    this.isNight = Boolean(isNight);
    const fogColor = this.isNight ? CONFIG.COLORS.nightFog : CONFIG.COLORS.sunsetFog;
    this.scene.background.setHex(fogColor);
    if (this.scene.fog) {
      this.scene.fog.color.setHex(fogColor);
    }
    this.skyMat.map = this.isNight ? this.skyTexNight : this.skyTexSunset;
    this.skyMat.needsUpdate = true;

    if (this.isNight) {
      this.ambientLight.color.setHex(0x6b5b95);
      this.ambientLight.intensity = 0.45;
      this.sunLight.color.setHex(0x72efdd);
      this.sunLight.intensity = 0.55;
      this.seaMat.color.setHex(CONFIG.COLORS.seaNight);
      this.seaMat.emissive.setHex(0x091834);
      this.sunSprite.material.opacity = 0.35;
      this.sunGlow.material.opacity = 0.35;
    } else {
      this.ambientLight.color.setHex(0xffd6e8);
      this.ambientLight.intensity = 0.85;
      this.sunLight.color.setHex(0xff9e5e);
      this.sunLight.intensity = 1.25;
      this.seaMat.color.setHex(CONFIG.COLORS.seaSunset);
      this.seaMat.emissive.setHex(0x102542);
      this.sunSprite.material.opacity = 1.0;
      this.sunGlow.material.opacity = 0.65;
    }

    // Усиливаем свечение неоновых вывесок и ореолов ночью
    for (const mat of this.neonMaterials) {
      if (mat.emissiveIntensity !== undefined) {
        mat.emissiveIntensity = this.isNight ? 1.5 : 0.85;
      }
    }
    for (const sp of this.neonSprites) {
      sp.material.opacity = this.isNight ? 0.92 : 0.52;
    }
  }

  addCollider(minX, maxX, minZ, maxZ, maxY = 20, tag = 'building', mesh = null) {
    const col = { minX, maxX, minZ, maxZ, maxY, tag, mesh };
    this.colliders.push(col);
    this.spatialGrid.insertAABB(col, minX, maxX, minZ, maxZ);
    if (mesh) {
      this.raycastMeshes.push(mesh);
    }
    return col;
  }

  isOnPier(x, z) {
    const p = CONFIG.PIER;
    return (
      x >= p.xMin &&
      x <= p.xMax &&
      Math.abs(z - p.zCenter) <= p.width * 0.5
    );
  }

  getGroundHeight(x, z) {
    const p = CONFIG.PIER;
    if (Math.abs(z - p.zCenter) <= p.width * 0.5 && x >= p.xMin && x <= p.xMax) {
      // Плавный пандус с бульвара (146..154) на настил пирса
      if (x < p.xMin + 8) {
        const t = (x - p.xMin) / 8;
        return t * p.deckY;
      }
      return p.deckY;
    }
    return 0;
  }

  isWater(x, z) {
    if (this.isOnPier(x, z)) return false;
    return x > CONFIG.WATER_START_X;
  }

  // Скользящая коллизия окружности (игрок или машина) против AABB зданий, границ карты и глубокой воды
  resolveCircleCollision(x, z, radius, y = 0) {
    const bound = CONFIG.HALF_WORLD - 12;
    let nx = Math.max(-bound, Math.min(bound, x));
    let nz = Math.max(-bound, Math.min(bound, z));
    let hitWall = false;

    // Не даём уходить в глубокую воду мимо пирса
    if (!this.isOnPier(nx, nz) && nx > CONFIG.WATER_START_X - radius) {
      nx = CONFIG.WATER_START_X - radius;
      hitWall = true;
    }

    // Бортики пирса, если игрок находится над водой на пирсе
    if (nx > CONFIG.WATER_START_X - 1 && Math.abs(nz - CONFIG.PIER.zCenter) > CONFIG.PIER.width * 0.5 - radius) {
      const sign = nz >= CONFIG.PIER.zCenter ? 1 : -1;
      nz = CONFIG.PIER.zCenter + sign * (CONFIG.PIER.width * 0.5 - radius);
      hitWall = true;
    }

    const nearby = this.spatialGrid.queryRadius(nx, nz, radius + 8);
    for (let iter = 0; iter < 3; iter++) {
      for (let i = 0; i < nearby.length; i++) {
        const b = nearby[i];
        if (y >= b.maxY) continue;
        const closestX = Math.max(b.minX, Math.min(nx, b.maxX));
        const closestZ = Math.max(b.minZ, Math.min(nz, b.maxZ));
        const dx = nx - closestX;
        const dz = nz - closestZ;
        const distSq = dx * dx + dz * dz;

        if (distSq < radius * radius) {
          hitWall = true;
          if (distSq > 1e-6) {
            const dist = Math.sqrt(distSq);
            const overlap = radius - dist;
            nx += (dx / dist) * overlap;
            nz += (dz / dist) * overlap;
          } else {
            // Центр оказался внутри AABB — выталкиваем к ближайшей грани
            const left = Math.abs(nx - b.minX);
            const right = Math.abs(b.maxX - nx);
            const top = Math.abs(nz - b.minZ);
            const bottom = Math.abs(b.maxZ - nz);
            const m = Math.min(left, right, top, bottom);
            if (m === left) nx = b.minX - radius;
            else if (m === right) nx = b.maxX + radius;
            else if (m === top) nz = b.minZ - radius;
            else nz = b.maxZ + radius;
          }
        }
      }
    }

    return { x: nx, z: nz, hitWall };
  }

  // Проверка прямой видимости между двумя точками (против AABB зданий)
  hasLineOfSight(x1, z1, x2, z2) {
    const dx = x2 - x1;
    const dz = z2 - z1;
    const dist = Math.hypot(dx, dz);
    if (dist < 0.5) return true;
    const steps = Math.ceil(dist / 2.0);
    for (let s = 1; s < steps; s++) {
      const t = s / steps;
      const px = x1 + dx * t;
      const pz = z1 + dz * t;
      const list = this.spatialGrid.queryRadius(px, pz, 2.0);
      for (let i = 0; i < list.length; i++) {
        const b = list[i];
        if (b.maxY < 1.5) continue;
        if (px >= b.minX && px <= b.maxX && pz >= b.minZ && pz <= b.maxZ) {
          return false;
        }
      }
    }
    return true;
  }
}
