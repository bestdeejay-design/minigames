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
    grad.addColorStop(0, '#fff8a6');
    grad.addColorStop(0.32, '#ff9e00');
    grad.addColorStop(0.68, '#ff2a85');
    grad.addColorStop(1, '#7b2cbf');

    ctx.save();
    ctx.beginPath();
    ctx.arc(128, 128, 108, 0, Math.PI * 2);
    ctx.clip();
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 256, 256);

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
  const canvas = makeCanvas(128, 256);
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const grad = ctx.createLinearGradient(0, 0, 0, 256);
    if (!isNight) {
      grad.addColorStop(0.0, '#13072e');
      grad.addColorStop(0.28, '#3f1668');
      grad.addColorStop(0.52, '#9d1b82');
      grad.addColorStop(0.72, '#ff3e7f');
      grad.addColorStop(0.88, '#ff8533');
      grad.addColorStop(1.0, '#ffd166');
    } else {
      grad.addColorStop(0.0, '#03010a');
      grad.addColorStop(0.38, '#090521');
      grad.addColorStop(0.74, '#180c3d');
      grad.addColorStop(1.0, '#2a165c');
    }
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 128, 256);

    if (isNight) {
      ctx.fillStyle = '#ffffff';
      for (let i = 0; i < 65; i++) {
        const sx = (i * 29) % 124;
        const sy = (i * 43) % 165;
        ctx.fillRect(sx, sy, 1.5, 1.5);
      }
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
}

// Процедурная текстура морской поверхности с каустикой и солнечными бликами
export function createWaterTexture() {
  const canvas = makeCanvas(256, 256);
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#0e7c9e';
    ctx.fillRect(0, 0, 256, 256);

    // Мягкие волны и лазурные переливы
    for (let y = 0; y < 256; y += 8) {
      ctx.fillStyle = y % 16 === 0 ? 'rgba(0, 245, 212, 0.16)' : 'rgba(5, 45, 78, 0.18)';
      ctx.fillRect(0, y, 256, 4);
    }

    // Светлые ячейки каустики и солнечной ряби
    for (let i = 0; i < 220; i++) {
      const rx = (i * 53) % 256;
      const ry = (i * 97) % 256;
      const rw = 10 + (i % 5) * 6;
      ctx.fillStyle = i % 3 === 0 ? 'rgba(255, 255, 255, 0.22)' : 'rgba(114, 239, 221, 0.2)';
      ctx.fillRect(rx, ry, rw, 2);
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(38, 38);
  tex.needsUpdate = true;
  return tex;
}

export function createAsphaltTexture() {
  const canvas = makeCanvas(256, 256);
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#252630';
    ctx.fillRect(0, 0, 256, 256);

    // Полосы наката от шин
    ctx.fillStyle = '#1e1f28';
    ctx.fillRect(36, 0, 48, 256);
    ctx.fillRect(172, 0, 48, 256);

    // Зернистость асфальта
    for (let i = 0; i < 1400; i++) {
      const x = (i * 73) % 256;
      const y = (i * 137) % 256;
      ctx.fillStyle = i % 3 === 0 ? '#323442' : '#1b1c24';
      ctx.fillRect(x, y, 2, 2);
    }

    // Бордюрные кромки
    ctx.fillStyle = '#5c5f72';
    ctx.fillRect(0, 0, 6, 256);
    ctx.fillRect(250, 0, 6, 256);

    // Двойная жёлтая осевая и боковые прерывистые полосы
    ctx.fillStyle = '#ffbe0b';
    ctx.fillRect(122, 0, 4, 256);
    ctx.fillRect(130, 0, 4, 256);

    ctx.fillStyle = '#e8f1f5';
    for (let y = 0; y < 256; y += 32) {
      ctx.fillRect(62, y + 5, 3, 18);
      ctx.fillRect(191, y + 5, 3, 18);
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.needsUpdate = true;
  return tex;
}

export function createSandTexture() {
  const canvas = makeCanvas(256, 256);
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#eed294';
    ctx.fillRect(0, 0, 256, 256);

    // Мягкие песчаные барханы
    for (let y = 0; y < 256; y += 12) {
      ctx.fillStyle = y % 24 === 0 ? 'rgba(255, 240, 200, 0.35)' : 'rgba(210, 172, 102, 0.25)';
      ctx.fillRect(0, y, 256, 5);
    }
    for (let i = 0; i < 900; i++) {
      const x = (i * 41) % 256;
      const y = (i * 89) % 256;
      ctx.fillStyle = i % 3 === 0 ? '#fff1c9' : '#d6ad60';
      ctx.fillRect(x, y, 2, 2);
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(24, 24);
  tex.needsUpdate = true;
  return tex;
}

export function createGrassParkTexture() {
  const canvas = makeCanvas(128, 128);
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#2d4c3e';
    ctx.fillRect(0, 0, 128, 128);
    for (let i = 0; i < 500; i++) {
      const x = (i * 37) % 128;
      const y = (i * 71) % 128;
      ctx.fillStyle = i % 2 === 0 ? '#365b4a' : '#243e32';
      ctx.fillRect(x, y, 2, 2);
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(32, 32);
  tex.needsUpdate = true;
  return tex;
}

export function createWindowTexture(baseHex, trimHex, isNight = false, style = 'artdeco') {
  const canvas = makeCanvas(256, 512);
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = baseHex;
    ctx.fillRect(0, 0, 256, 512);

    // Межэтажные карнизы и текстура фасада
    for (let y = 0; y < 512; y += 32) {
      ctx.fillStyle = 'rgba(0,0,0,0.12)';
      ctx.fillRect(0, y, 256, 3);
      ctx.fillStyle = 'rgba(255,255,255,0.1)';
      ctx.fillRect(0, y + 3, 256, 2);
    }

    // Декоративные пилястры арт-деко
    ctx.fillStyle = trimHex;
    ctx.fillRect(0, 0, 12, 512);
    ctx.fillRect(244, 0, 12, 512);
    if (style === 'artdeco') {
      ctx.fillRect(118, 0, 20, 512);
    }

    const cols = style === 'tower' ? 6 : 4;
    const rows = style === 'tower' ? 14 : 8;
    const padX = 22;
    const padY = 24;
    const cellW = (256 - padX * 2) / cols;
    const cellH = (440 - padY) / rows;

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const hash = (r * 17 + c * 31) % 11;
        const lit = isNight ? hash < 8 : hash < 5;
        const wx = padX + c * cellW + 5;
        const wy = padY + r * cellH + 5;
        const ww = Math.max(8, cellW - 10);
        const wh = Math.max(10, cellH - 10);

        // Рама окна с углублением
        ctx.fillStyle = '#121324';
        ctx.fillRect(wx - 2, wy - 2, ww + 4, wh + 4);

        if (lit) {
          const g = ctx.createLinearGradient(0, wy, 0, wy + wh);
          if (hash % 3 === 0) {
            g.addColorStop(0, '#98f5e1');
            g.addColorStop(1, '#00bbf9');
          } else if (hash % 2 === 0) {
            g.addColorStop(0, '#fff3b0');
            g.addColorStop(1, '#ff9e00');
          } else {
            g.addColorStop(0, '#ffcfd2');
            g.addColorStop(1, '#ff2a85');
          }
          ctx.fillStyle = g;
        } else {
          const g = ctx.createLinearGradient(0, wy, 0, wy + wh);
          g.addColorStop(0, '#29324c');
          g.addColorStop(1, '#14192b');
          ctx.fillStyle = g;
        }
        ctx.fillRect(wx, wy, ww, wh);

        // Горизонтальные жалюзи / переплёт
        ctx.fillStyle = 'rgba(15, 16, 32, 0.35)';
        ctx.fillRect(wx, wy + wh * 0.48, ww, 2);
      }
    }

    // Первый этаж — витрины и неоновый фриз
    ctx.fillStyle = trimHex;
    ctx.fillRect(0, 456, 256, 8);
    ctx.fillStyle = '#141b2d';
    ctx.fillRect(16, 468, 224, 44);
    ctx.fillStyle = 'rgba(0, 245, 212, 0.32)';
    ctx.fillRect(24, 474, 96, 32);
    ctx.fillRect(136, 474, 96, 32);
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
    this.colliders = [];
    this.raycastMeshes = [];
    this.neonMaterials = [];
    this.neonSprites = [];
    this.windowMeshes = [];

    this._initAtmosphere();
    this._initIslandAndOcean();
  }

  _initAtmosphere() {
    const q = CONFIG.QUALITY[this.quality];
    this.scene.background = new THREE.Color(CONFIG.COLORS.sunsetFog);
    this.scene.fog = new THREE.Fog(CONFIG.COLORS.sunsetFog, q.fogNear, q.fogFar);

    this.ambientLight = new THREE.AmbientLight(0xffe3f0, 0.78);
    this.scene.add(this.ambientLight);

    this.sunLight = new THREE.DirectionalLight(0xffa96b, 1.45);
    this.sunLight.position.set(240, 115, -35);
    this.scene.add(this.sunLight);

    this.hemiLight = new THREE.HemisphereLight(0xff85b3, 0x1d3557, 0.65);
    this.scene.add(this.hemiLight);

    // Купол неба
    this.skyTexSunset = createSkyTexture(false);
    this.skyTexNight = createSkyTexture(true);
    const skyGeo = new THREE.SphereGeometry(330, 28, 18);
    this.skyMat = new THREE.MeshBasicMaterial({
      map: this.skyTexSunset,
      side: THREE.BackSide,
      fog: false,
      depthWrite: false,
    });
    this.skyDome = new THREE.Mesh(skyGeo, this.skyMat);
    this.scene.add(this.skyDome);

    // Большое полосатое солнце над морским горизонтом
    const sunTex = createStripedSunTexture();
    const sunMat = new THREE.SpriteMaterial({
      map: sunTex,
      transparent: true,
      fog: false,
      depthWrite: false,
    });
    this.sunSprite = new THREE.Sprite(sunMat);
    this.sunSprite.position.set(295, 58, -20);
    this.sunSprite.scale.set(105, 105, 1);
    this.scene.add(this.sunSprite);

    const sunGlowMat = new THREE.SpriteMaterial({
      map: createGlowTexture('#ff2a85'),
      transparent: true,
      blending: THREE.AdditiveBlending,
      fog: false,
      depthWrite: false,
      opacity: 0.68,
    });
    this.sunGlow = new THREE.Sprite(sunGlowMat);
    this.sunGlow.position.set(294, 58, -20);
    this.sunGlow.scale.set(180, 180, 1);
    this.scene.add(this.sunGlow);
  }

  _initIslandAndOcean() {
    const isl = CONFIG.ISLAND;
    const islandW = isl.maxX - isl.minX; // 433 м (от -248 до +185)
    const islandD = isl.maxZ - isl.minZ; // 496 м (от -248 до +248)
    const centerX = (isl.minX + isl.maxX) * 0.5; // -31.5
    const centerZ = (isl.minZ + isl.maxZ) * 0.5; // 0

    // 1. Песчаное основание острова со всех 4 сторон (пляжное кольцо вокруг всего острова)
    const sandTex = createSandTexture();
    const beachMat = new THREE.MeshLambertMaterial({
      map: sandTex,
      color: CONFIG.COLORS.sand,
    });
    const islandBeachGeo = new THREE.BoxGeometry(islandW, 0.7, islandD);
    this.beachMesh = new THREE.Mesh(islandBeachGeo, beachMat);
    this.beachMesh.position.set(centerX, -0.36, centerZ);
    this.scene.add(this.beachMesh);
    this.raycastMeshes.push(this.beachMesh);

    // 2. Внутреннее городское плато острова (оставляет песчаные пляжи по всему периметру острова)
    const urbanMinX = isl.minX + 14;
    const urbanMaxX = CONFIG.SHORE_X; // до +150, чтобы с востока был широкий океанский пляж
    const urbanMinZ = isl.minZ + 14;
    const urbanMaxZ = isl.maxZ - 14;
    const urbanW = urbanMaxX - urbanMinX;
    const urbanD = urbanMaxZ - urbanMinZ;

    const landGeo = new THREE.PlaneGeometry(urbanW, urbanD);
    landGeo.rotateX(-Math.PI / 2);
    const landMat = new THREE.MeshLambertMaterial({
      map: createGrassParkTexture(),
      color: 0x8d99ae,
    });
    this.landMesh = new THREE.Mesh(landGeo, landMat);
    this.landMesh.position.set((urbanMinX + urbanMaxX) * 0.5, 0.0, (urbanMinZ + urbanMaxZ) * 0.5);
    this.scene.add(this.landMesh);
    this.raycastMeshes.push(this.landMesh);

    // 3. Полоса береговой морской пены и бирюзового мелководья вокруг всего острова
    const foamGeo = new THREE.RingGeometry(1, 1.06, 64);
    foamGeo.rotateX(-Math.PI / 2);
    this.foamMat = new THREE.MeshBasicMaterial({
      color: 0xe0fbfc,
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
    });
    this.foamRing = new THREE.Mesh(foamGeo, this.foamMat);
    this.foamRing.position.set(centerX, -0.18, centerZ);
    this.foamRing.scale.set(islandW * 0.52, 1, islandD * 0.52);
    this.scene.add(this.foamRing);

    // 4. Океан на 360 градусов вокруг всего острова (с каустикой, градиентом глубины и бликами солнца)
    const segs = CONFIG.QUALITY[this.quality].waveSegments;
    const oceanSize = CONFIG.OCEAN_SIZE;
    this.seaGeo = new THREE.PlaneGeometry(oceanSize, oceanSize, segs, segs);
    this.seaGeo.rotateX(-Math.PI / 2);

    const pos = this.seaGeo.attributes.position;
    this._seaBaseY = new Float32Array(pos.count);
    const colors = new Float32Array(pos.count * 3);
    const shallowColor = new THREE.Color(0x00e5c3); // бирюзовая лагуна у берегов острова
    const midColor = new THREE.Color(0x0077b6); // лазурное море
    const deepColor = new THREE.Color(0x03254c); // глубокий океан
    const tmpColor = new THREE.Color();

    for (let i = 0; i < pos.count; i++) {
      this._seaBaseY[i] = pos.getY(i);
      const vx = pos.getX(i);
      const vz = pos.getZ(i);

      // Расстояние до береговой рамки острова
      const dx = Math.max(isl.minX - vx, 0, vx - isl.maxX);
      const dz = Math.max(isl.minZ - vz, 0, vz - isl.maxZ);
      const shoreDist = Math.hypot(dx, dz);

      if (shoreDist < 36) {
        tmpColor.copy(shallowColor).lerp(midColor, shoreDist / 36);
      } else {
        const t = Math.min(1, (shoreDist - 36) / 160);
        tmpColor.copy(midColor).lerp(deepColor, t);
      }
      colors[i * 3] = tmpColor.r;
      colors[i * 3 + 1] = tmpColor.g;
      colors[i * 3 + 2] = tmpColor.b;
    }
    this.seaGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    this.waterTex = createWaterTexture();
    this.seaMat = new THREE.MeshPhongMaterial({
      map: this.waterTex,
      vertexColors: true,
      color: 0xffffff,
      emissive: 0x07223b,
      specular: 0xffbe76,
      shininess: 92,
      transparent: true,
      opacity: 0.94,
    });
    this.seaMesh = new THREE.Mesh(this.seaGeo, this.seaMat);
    this.seaMesh.position.set(0, -0.26, 0);
    this.scene.add(this.seaMesh);
  }

  updateWaves(time, playerPos) {
    if (playerPos) {
      this.skyDome.position.set(playerPos.x, 0, playerPos.z);
    }

    // Движение текстуры воды и пены у берега
    if (this.waterTex) {
      this.waterTex.offset.x = (time * 0.025) % 1;
      this.waterTex.offset.y = (time * 0.018) % 1;
    }
    if (this.foamRing) {
      const pulse = 1 + Math.sin(time * 2.2) * 0.012;
      const isl = CONFIG.ISLAND;
      this.foamRing.scale.set(
        (isl.maxX - isl.minX) * 0.515 * pulse,
        1,
        (isl.maxZ - isl.minZ) * 0.515 * pulse
      );
      this.foamMat.opacity = 0.42 + Math.sin(time * 2.2) * 0.18;
    }

    const pos = this.seaGeo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const vx = pos.getX(i);
      const vz = pos.getZ(i);
      const wave =
        Math.sin(vx * 0.08 + time * 2.2) * 0.24 +
        Math.cos(vz * 0.07 + time * 1.7) * 0.2 +
        Math.sin((vx + vz) * 0.12 - time * 2.8) * 0.1;
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
      this.ambientLight.intensity = 0.48;
      this.sunLight.color.setHex(0x72efdd);
      this.sunLight.intensity = 0.62;
      this.seaMat.color.setHex(0x88b8e6);
      this.seaMat.emissive.setHex(0x040d21);
      this.seaMat.specular.setHex(0x00f5d4);
      this.sunSprite.material.opacity = 0.35;
      this.sunGlow.material.opacity = 0.35;
    } else {
      this.ambientLight.color.setHex(0xffe3f0);
      this.ambientLight.intensity = 0.78;
      this.sunLight.color.setHex(0xffa96b);
      this.sunLight.intensity = 1.45;
      this.seaMat.color.setHex(0xffffff);
      this.seaMat.emissive.setHex(0x07223b);
      this.seaMat.specular.setHex(0xffbe76);
      this.sunSprite.material.opacity = 1.0;
      this.sunGlow.material.opacity = 0.68;
    }

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
      if (x < p.xMin + 8) {
        const t = (x - p.xMin) / 8;
        return t * p.deckY;
      }
      return p.deckY;
    }
    return 0;
  }

  // Проверка воды вокруг всего острова (на 360 градусов, с исключением для настила пирса)
  isWater(x, z) {
    if (this.isOnPier(x, z)) return false;
    const isl = CONFIG.ISLAND;
    return (
      x > isl.maxX ||
      x < isl.minX ||
      z > isl.maxZ ||
      z < isl.minZ
    );
  }

  // Скользящая коллизия окружности против зданий и береговой линии острова со всех 4 сторон
  resolveCircleCollision(x, z, radius, y = 0) {
    const isl = CONFIG.ISLAND;
    let nx = x;
    let nz = z;
    let hitWall = false;

    // Западный, северный и южный берега острова
    if (nx < isl.minX + radius) {
      nx = isl.minX + radius;
      hitWall = true;
    }
    if (nz < isl.minZ + radius) {
      nz = isl.minZ + radius;
      hitWall = true;
    }
    if (nz > isl.maxZ - radius) {
      nz = isl.maxZ - radius;
      hitWall = true;
    }

    // Восточный берег острова и пирс
    if (!this.isOnPier(nx, nz) && nx > isl.maxX - radius) {
      nx = isl.maxX - radius;
      hitWall = true;
    }
    if (nx > isl.maxX - 1 && Math.abs(nz - CONFIG.PIER.zCenter) > CONFIG.PIER.width * 0.5 - radius) {
      const sign = nz >= CONFIG.PIER.zCenter ? 1 : -1;
      nz = CONFIG.PIER.zCenter + sign * (CONFIG.PIER.width * 0.5 - radius);
      hitWall = true;
    }
    if (nx > CONFIG.PIER.xMax - radius) {
      nx = CONFIG.PIER.xMax - radius;
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
            const left = Math.abs(nx - b.minX);
            const right = Math.abs(b.maxX - nx);
            const top = Math.abs(nz - b.minZ);
            const bottom = Math.abs(nz - b.maxZ);
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
