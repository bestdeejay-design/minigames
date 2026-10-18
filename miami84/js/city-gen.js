import * as THREE from '../libs/three.module.min.js';
import { CONFIG } from './config.js';
import {
  createAsphaltTexture,
  createWindowTexture,
  createNeonSignTexture,
  createGlowTexture,
} from './world.js';

// Объединение массива BufferGeometry в один буфер для статичной геометрии (60 FPS)
export function mergeBufferGeometries(geometries) {
  if (!geometries.length) return new THREE.BufferGeometry();
  let totalVerts = 0;
  let totalIndices = 0;
  for (const g of geometries) {
    totalVerts += g.attributes.position.count;
    if (g.index) totalIndices += g.index.count;
  }

  const positions = new Float32Array(totalVerts * 3);
  const normals = new Float32Array(totalVerts * 3);
  const uvs = new Float32Array(totalVerts * 2);
  const indices = totalIndices > 0 ? new Uint32Array(totalIndices) : null;

  let vOffset = 0;
  let iOffset = 0;

  for (const g of geometries) {
    const pos = g.attributes.position;
    const norm = g.attributes.normal;
    const uv = g.attributes.uv;
    const count = pos.count;

    positions.set(pos.array, vOffset * 3);
    if (norm) normals.set(norm.array, vOffset * 3);
    if (uv) uvs.set(uv.array, vOffset * 2);

    if (indices && g.index) {
      const idx = g.index.array;
      for (let j = 0; j < idx.length; j++) {
        indices[iOffset + j] = idx[j] + vOffset;
      }
      iOffset += idx.length;
    }
    vOffset += count;
  }

  const merged = new THREE.BufferGeometry();
  merged.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  merged.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  merged.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  if (indices) merged.setIndex(new THREE.BufferAttribute(indices, 1));
  return merged;
}

export class CityGenerator {
  constructor(world, quality = 'high') {
    this.world = world;
    this.scene = world.scene;
    this.quality = quality;
    this.glowTexPink = createGlowTexture('#ff2a85');
    this.glowTexCyan = createGlowTexture('#00f5d4');
    this.glowTexWarm = createGlowTexture('#ffbe0b');
    this.palmPositions = [];
    this.lampPositions = [];
    this.coverPoints = []; // точки укрытий для ИИ врагов
  }

  generate() {
    this._buildRoadsAndIntersections();
    this._buildPierAndBeachDecor();
    this._buildDistricts();
    this._buildBillboards();
    this._buildInstancedPalms();
    this._buildInstancedStreetLamps();
  }

  _buildRoadsAndIntersections() {
    const asphaltTex = createAsphaltTexture();
    const roadMat = new THREE.MeshLambertMaterial({ map: asphaltTex });
    const sidewalkGeos = [];
    const crosswalkGeos = [];

    // Проспекты Север-Юг
    for (const ax of CONFIG.AVENUES_X) {
      const geo = new THREE.PlaneGeometry(CONFIG.ROAD_WIDTH, 520);
      geo.rotateX(-Math.PI / 2);
      const uv = geo.attributes.uv;
      for (let i = 0; i < uv.count; i++) {
        uv.setY(i, uv.getY(i) * 28);
      }
      const mesh = new THREE.Mesh(geo, roadMat);
      mesh.position.set(ax, 0.02, 0);
      this.scene.add(mesh);

      // Тротуары вдоль проспекта
      for (const side of [-1, 1]) {
        const sw = new THREE.BoxGeometry(CONFIG.SIDEWALK_WIDTH, 0.16, 520);
        sw.translate(ax + side * (CONFIG.ROAD_WIDTH * 0.5 + CONFIG.SIDEWALK_WIDTH * 0.5), 0.08, 0);
        sidewalkGeos.push(sw);
      }

      // Пальмы и фонари вдоль проспектов
      for (let z = -240; z <= 240; z += 26) {
        if (CONFIG.STREETS_Z.some((sz) => Math.abs(sz - z) < 16)) continue;
        this.lampPositions.push({ x: ax - 9.5, z, rotY: 0 });
        if (ax >= -40) {
          this.palmPositions.push({ x: ax + 10.5, z: z + 6, scale: 0.9 + ((Math.abs(z) % 5) * 0.08) });
        }
      }
    }

    // Улицы Запад-Восток
    for (const sz of CONFIG.STREETS_Z) {
      const geo = new THREE.PlaneGeometry(410, CONFIG.ROAD_WIDTH);
      geo.rotateX(-Math.PI / 2);
      geo.rotateY(Math.PI / 2);
      const uv = geo.attributes.uv;
      for (let i = 0; i < uv.count; i++) {
        uv.setY(i, uv.getY(i) * 22);
      }
      const mesh = new THREE.Mesh(geo, roadMat);
      mesh.position.set(-45, 0.025, sz);
      this.scene.add(mesh);

      // Зебры и светофоры на перекрёстках
      for (const ax of CONFIG.AVENUES_X) {
        for (let s = -5; s <= 5; s += 2.5) {
          const stripe = new THREE.PlaneGeometry(1.1, 3.2);
          stripe.rotateX(-Math.PI / 2);
          stripe.translate(ax + s, 0.04, sz + 9.5);
          crosswalkGeos.push(stripe);
        }
      }
    }

    // Объединённый меш тротуаров и зебр
    if (sidewalkGeos.length) {
      const mergedSw = mergeBufferGeometries(sidewalkGeos);
      const swMesh = new THREE.Mesh(
        mergedSw,
        new THREE.MeshLambertMaterial({ color: CONFIG.COLORS.sidewalk })
      );
      this.scene.add(swMesh);
    }
    if (crosswalkGeos.length) {
      const mergedCw = mergeBufferGeometries(crosswalkGeos);
      const cwMesh = new THREE.Mesh(
        mergedCw,
        new THREE.MeshBasicMaterial({ color: 0xf8f9fa })
      );
      this.scene.add(cwMesh);
    }

    // Светофоры на ключевых перекрёстках
    const poleMat = new THREE.MeshLambertMaterial({ color: 0x222634 });
    const redMat = new THREE.MeshBasicMaterial({ color: 0xff2a55 });
    const greenMat = new THREE.MeshBasicMaterial({ color: 0x00f5d4 });
    const yellowMat = new THREE.MeshBasicMaterial({ color: 0xffbe0b });

    for (let i = 0; i < CONFIG.AVENUES_X.length; i++) {
      for (let j = 0; j < CONFIG.STREETS_Z.length; j++) {
        if ((i + j) % 2 !== 0) continue;
        const ix = CONFIG.AVENUES_X[i] + 9.2;
        const iz = CONFIG.STREETS_Z[j] + 9.2;
        const group = new THREE.Group();
        group.position.set(ix, 0, iz);

        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.18, 5.4, 6), poleMat);
        pole.position.y = 2.7;
        group.add(pole);

        const arm = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.16, 0.16), poleMat);
        arm.position.set(-1.3, 5.1, 0);
        group.add(arm);

        const box = new THREE.Mesh(new THREE.BoxGeometry(0.45, 1.2, 0.45), poleMat);
        box.position.set(-2.3, 4.7, 0);
        group.add(box);

        const lRed = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.22, 0.5), redMat);
        lRed.position.set(-2.3, 5.05, 0);
        const lYel = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.22, 0.5), yellowMat);
        lYel.position.set(-2.3, 4.7, 0);
        const lGrn = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.22, 0.5), greenMat);
        lGrn.position.set(-2.3, 4.35, 0);
        group.add(lRed, lYel, lGrn);

        this.scene.add(group);
      }
    }
  }

  _buildPierAndBeachDecor() {
    const p = CONFIG.PIER;
    const len = p.xMax - p.xMin;
    const woodMat = new THREE.MeshLambertMaterial({ color: 0x8d5b4c });
    const railMat = new THREE.MeshLambertMaterial({ color: 0xfde49e });
    const neonMat = new THREE.MeshBasicMaterial({ color: CONFIG.COLORS.neonPink });

    // Настил пирса
    const deck = new THREE.Mesh(new THREE.BoxGeometry(len, 0.45, p.width), woodMat);
    deck.position.set(p.xMin + len * 0.5, p.deckY - 0.22, p.zCenter);
    this.scene.add(deck);
    this.world.raycastMeshes.push(deck);

    // Опоры пирса в воде
    for (let x = p.xMin + 8; x <= p.xMax - 4; x += 12) {
      for (const side of [-1, 1]) {
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 4.2, 6), woodMat);
        post.position.set(x, 0.4, p.zCenter + side * (p.width * 0.44));
        this.scene.add(post);
      }
    }

    // Перила и неоновая арка «SUNSET PIER '84»
    for (const side of [-1, 1]) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(len - 8, 0.9, 0.25), railMat);
      rail.position.set(p.xMin + len * 0.5 + 2, p.deckY + 0.45, p.zCenter + side * (p.width * 0.48));
      this.scene.add(rail);
    }

    const archGroup = new THREE.Group();
    archGroup.position.set(p.xMin + 4, p.deckY, p.zCenter);
    const colGeo = new THREE.BoxGeometry(0.7, 6.5, 0.7);
    const colL = new THREE.Mesh(colGeo, neonMat);
    colL.position.set(0, 3.25, -p.width * 0.42);
    const colR = new THREE.Mesh(colGeo, neonMat);
    colR.position.set(0, 3.25, p.width * 0.42);
    archGroup.add(colL, colR);

    const signTex = createNeonSignTexture('SUNSET PIER 84', 'OCEAN BOARDWALK', '#00f5d4');
    const signMat = new THREE.MeshBasicMaterial({ map: signTex });
    const signBoard = new THREE.Mesh(new THREE.BoxGeometry(0.6, 2.4, p.width * 0.9), signMat);
    signBoard.position.set(0, 6.2, 0);
    archGroup.add(signBoard);
    this.scene.add(archGroup);

    // Пальмы вдоль набережной и пляжа
    for (let z = -250; z <= 250; z += 18) {
      if (Math.abs(z - p.zCenter) < 12) continue;
      this.palmPositions.push({ x: 153 + ((Math.abs(z) % 3) * 1.5), z, scale: 1.05 });
      if (Math.abs(z) % 36 === 0) {
        this.palmPositions.push({ x: 166, z: z + 7, scale: 0.92 });
      }
    }

    // Пляжные зонтики и вышки спасателей
    const umbrellaColors = [0xff2a85, 0x00f5d4, 0xffbe0b, 0xff7b00];
    for (let z = -190; z <= 190; z += 32) {
      if (Math.abs(z - p.zCenter) < 18) continue;
      const ux = 169 + ((z * 7) % 5);
      const uGroup = new THREE.Group();
      uGroup.position.set(ux, 0, z);
      const stick = new THREE.Mesh(
        new THREE.CylinderGeometry(0.08, 0.08, 2.4, 6),
        new THREE.MeshLambertMaterial({ color: 0xffffff })
      );
      stick.position.y = 1.2;
      const top = new THREE.Mesh(
        new THREE.ConeGeometry(1.9, 0.85, 8),
        new THREE.MeshLambertMaterial({
          color: umbrellaColors[Math.abs(z) % umbrellaColors.length],
        })
      );
      top.position.y = 2.45;
      uGroup.add(stick, top);
      this.scene.add(uGroup);
    }
  }

  _buildDistricts() {
    // 1. НАБЕРЕЖНАЯ-БУЛЬВАР: Пастельные арт-деко отели и клубы (X от 64 до 126)
    const boulevardBlocksZ = [-185, -155, -25, 10, 85, 115, 175, 205];
    const pastelHexes = ['#ffafcc', '#98f5e1', '#fde49e', '#cdb4db', '#a2d2ff', '#ffcfd2'];
    const trimHexes = ['#ff2a85', '#00f5d4', '#ff7b00', '#8338ec'];

    boulevardBlocksZ.forEach((bz, idx) => {
      const w = 24;
      const d = 22;
      const h = 16 + (idx % 3) * 5;
      const bx = 112;
      const baseHex = pastelHexes[idx % pastelHexes.length];
      const trimHex = trimHexes[idx % trimHexes.length];
      this._createArtDecoBuilding(bx, bz, w, h, d, baseHex, trimHex, CONFIG.NEON_SIGNS[idx % CONFIG.NEON_SIGNS.length]);
    });

    // Открытая неоновая площадка «КОРАЛЛ-КЛУБ» для Миссии 2 (X=95, Z=-85)
    this._buildCoralClubPlaza(95, -85);

    // Вторая линия арт-деко зданий (X = 76)
    const secondLineZ = [-175, 5, 95, 185];
    secondLineZ.forEach((bz, idx) => {
      const baseHex = pastelHexes[(idx + 2) % pastelHexes.length];
      const trimHex = trimHexes[(idx + 1) % trimHexes.length];
      this._createArtDecoBuilding(76, bz, 22, 18 + (idx % 2) * 6, 22, baseHex, trimHex, CONFIG.NEON_SIGNS[(idx + 4) % CONFIG.NEON_SIGNS.length]);
    });

    // 2. ДЕЛОВЫЕ ВЫСОТКИ (Downtown, X от -115 до +30, Z от -200 до +120)
    const towers = [
      { x: 5, z: -175, w: 28, d: 28, h: 48, base: '#2b3a67', trim: '#00f5d4' },
      { x: 5, z: -85, w: 26, d: 26, h: 56, base: '#3c2a6e', trim: '#ff2a85' },
      { x: 5, z: 5, w: 30, d: 26, h: 42, base: '#1f4e5f', trim: '#ffbe0b' },
      { x: 5, z: 95, w: 26, d: 26, h: 50, base: '#4a2c5a', trim: '#00f5d4' },
      { x: -85, z: -175, w: 30, d: 28, h: 62, base: '#232946', trim: '#ff2a85' },
      { x: -85, z: -85, w: 28, d: 28, h: 52, base: '#1b3a4b', trim: '#00f5d4' },
      { x: -85, z: 5, w: 28, d: 26, h: 44, base: '#312244', trim: '#ffbe0b' },
      { x: -85, z: 95, w: 26, d: 26, h: 38, base: '#2b3a67', trim: '#ff2a85' },
    ];
    towers.forEach((t, idx) => {
      this._createSkyscraper(t.x, t.z, t.w, t.h, t.d, t.base, t.trim, CONFIG.NEON_SIGNS[(idx + 6) % CONFIG.NEON_SIGNS.length]);
    });

    // 3. ПОРТОВАЯ ЗОНА С КОНТЕЙНЕРАМИ, СКЛАДАМИ, ГАРАЖОМ И АРЕНОЙ БОССА (X от -250 до -145, Z от -210 до +220)
    this._buildPortZone();
  }

  _createArtDecoBuilding(x, z, w, h, d, baseHex, trimHex, signInfo) {
    const tex = createWindowTexture(baseHex, trimHex, false, 'artdeco');
    const mat = new THREE.MeshLambertMaterial({ map: tex });
    const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    body.position.set(x, h * 0.5, z);
    this.scene.add(body);
    this.world.addCollider(x - w * 0.5, x + w * 0.5, z - d * 0.5, z + d * 0.5, h, 'building', body);

    // Ступенчатая корона арт-деко на крыше
    const crownColor = new THREE.Color(trimHex);
    const crownMat = new THREE.MeshBasicMaterial({ color: crownColor });
    this.world.neonMaterials.push(crownMat);

    const step1 = new THREE.Mesh(new THREE.BoxGeometry(w * 0.72, 2.2, d * 0.72), mat);
    step1.position.set(x, h + 1.1, z);
    const step2 = new THREE.Mesh(new THREE.BoxGeometry(w * 0.42, 2.0, d * 0.42), crownMat);
    step2.position.set(x, h + 3.1, z);
    this.scene.add(step1, step2);

    // Неоновая вывеска на фасаде
    if (signInfo) {
      const signTex = createNeonSignTexture(signInfo.text, signInfo.sub, signInfo.color);
      const signMat = new THREE.MeshBasicMaterial({ map: signTex });
      const signMesh = new THREE.Mesh(new THREE.BoxGeometry(0.4, 3.2, 9.5), signMat);
      const signX = x + w * 0.5 + 0.25;
      signMesh.position.set(signX, Math.min(h - 2.5, 7.2), z);
      this.scene.add(signMesh);

      // Спрайт-ореол неона
      const haloMat = new THREE.SpriteMaterial({
        map: signInfo.color === '#00f5d4' ? this.glowTexCyan : this.glowTexPink,
        transparent: true,
        blending: THREE.AdditiveBlending,
        opacity: 0.55,
        depthWrite: false,
      });
      const halo = new THREE.Sprite(haloMat);
      halo.position.set(signX + 0.6, Math.min(h - 2.5, 7.2), z);
      halo.scale.set(14, 8, 1);
      this.scene.add(halo);
      this.world.neonSprites.push(halo);
    }

    // Точки укрытий по углам здания
    this.coverPoints.push(
      { x: x + w * 0.5 + 2.2, z: z - d * 0.5 - 1.5 },
      { x: x + w * 0.5 + 2.2, z: z + d * 0.5 + 1.5 },
      { x: x - w * 0.5 - 2.2, z: z - d * 0.5 - 1.5 },
      { x: x - w * 0.5 - 2.2, z: z + d * 0.5 + 1.5 }
    );
  }

  _buildCoralClubPlaza(cx, cz) {
    // Неоновый павильон и низкие укрытия для перестрелки Миссии 2
    const floor = new THREE.Mesh(
      new THREE.BoxGeometry(36, 0.2, 36),
      new THREE.MeshLambertMaterial({ color: 0x3b2d54 })
    );
    floor.position.set(cx, 0.1, cz);
    this.scene.add(floor);

    const stage = new THREE.Mesh(
      new THREE.BoxGeometry(10, 1.2, 8),
      new THREE.MeshLambertMaterial({ color: 0xffafcc })
    );
    stage.position.set(cx - 8, 0.6, cz);
    this.scene.add(stage);
    this.world.addCollider(cx - 13, cx - 3, cz - 4, cz + 4, 1.4, 'prop', stage);

    const signTex = createNeonSignTexture('CORAL CLUB 84', 'VIP OPEN STAGE', '#ff2a85');
    const sign = new THREE.Mesh(
      new THREE.BoxGeometry(0.5, 3.6, 10),
      new THREE.MeshBasicMaterial({ map: signTex })
    );
    sign.position.set(cx - 12.5, 4.2, cz);
    this.scene.add(sign);

    // Декоративные неоновые тумбы-укрытия на площадке
    const crateOffsets = [
      { dx: 6, dz: -8 },
      { dx: 6, dz: 8 },
      { dx: -1, dz: -10 },
      { dx: -1, dz: 10 },
    ];
    for (const off of crateOffsets) {
      const bx = cx + off.dx;
      const bz = cz + off.dz;
      const wall = new THREE.Mesh(
        new THREE.BoxGeometry(3.6, 1.6, 1.8),
        new THREE.MeshLambertMaterial({ color: 0x00f5d4 })
      );
      wall.position.set(bx, 0.8, bz);
      this.scene.add(wall);
      this.world.addCollider(bx - 1.8, bx + 1.8, bz - 0.9, bz + 0.9, 1.6, 'cover', wall);
      this.coverPoints.push({ x: bx - 2.4, z: bz }, { x: bx + 2.4, z: bz });
    }
  }

  _createSkyscraper(x, z, w, h, d, baseHex, trimHex, signInfo) {
    const tex = createWindowTexture(baseHex, trimHex, true, 'tower');
    const mat = new THREE.MeshLambertMaterial({ map: tex });
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    mesh.position.set(x, h * 0.5, z);
    this.scene.add(mesh);
    this.world.addCollider(x - w * 0.5, x + w * 0.5, z - d * 0.5, z + d * 0.5, h, 'building', mesh);

    // Светящийся неоновый контур крыши и шпиль
    const neonMat = new THREE.MeshBasicMaterial({ color: trimHex });
    this.world.neonMaterials.push(neonMat);
    const roofTrim = new THREE.Mesh(new THREE.BoxGeometry(w + 0.6, 1.2, d + 0.6), neonMat);
    roofTrim.position.set(x, h + 0.6, z);
    const spire = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.6, 9, 6), neonMat);
    spire.position.set(x, h + 5.2, z);
    this.scene.add(roofTrim, spire);

    if (signInfo) {
      const sTex = createNeonSignTexture(signInfo.text, signInfo.sub, signInfo.color);
      const sMat = new THREE.MeshBasicMaterial({ map: sTex });
      const sMesh = new THREE.Mesh(new THREE.BoxGeometry(11, 3.6, 0.5), sMat);
      sMesh.position.set(x, 9.0, z + d * 0.5 + 0.3);
      this.scene.add(sMesh);
    }

    this.coverPoints.push(
      { x: x + w * 0.5 + 2.5, z: z },
      { x: x - w * 0.5 - 2.5, z: z },
      { x: x, z: z + d * 0.5 + 2.5 }
    );
  }

  _buildPortZone() {
    // Крупные портовые склады
    const warehouses = [
      { x: -185, z: -85, w: 34, d: 22, h: 11, color: 0x4a5568 },
      { x: -185, z: 5, w: 34, d: 24, h: 12, color: 0x3b4252 },
      { x: -185, z: 95, w: 32, d: 22, h: 11, color: 0x434c5e },
      { x: -85, z: 185, w: 36, d: 22, h: 12, color: 0x4a5568 },
    ];
    for (const wh of warehouses) {
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(wh.w, wh.h, wh.d),
        new THREE.MeshLambertMaterial({ color: wh.color })
      );
      mesh.position.set(wh.x, wh.h * 0.5, wh.z);
      this.scene.add(mesh);
      this.world.addCollider(
        wh.x - wh.w * 0.5,
        wh.x + wh.w * 0.5,
        wh.z - wh.d * 0.5,
        wh.z + wh.d * 0.5,
        wh.h,
        'warehouse',
        mesh
      );
    }

    // Морские контейнеры (разноцветные, в том числе на арене Босса X=-175, Z=-175)
    const containerStacks = [
      { x: -160, z: -162, rot: 0, floors: 2, colorIdx: 0 },
      { x: -190, z: -162, rot: 0, floors: 2, colorIdx: 1 },
      { x: -160, z: -188, rot: 0, floors: 1, colorIdx: 2 },
      { x: -190, z: -188, rot: 0, floors: 2, colorIdx: 3 },
      { x: -175, z: -152, rot: 1, floors: 1, colorIdx: 4 },
      { x: -202, z: -175, rot: 1, floors: 2, colorIdx: 5 },
      { x: -165, z: 45, rot: 0, floors: 2, colorIdx: 0 },
      { x: -195, z: 45, rot: 0, floors: 1, colorIdx: 2 },
    ];
    const colors = CONFIG.COLORS.portContainers;
    for (const c of containerStacks) {
      const cw = c.rot ? 3.2 : 9.0;
      const cd = c.rot ? 9.0 : 3.2;
      const ch = 3.0 * c.floors;
      const mat = new THREE.MeshLambertMaterial({
        color: colors[c.colorIdx % colors.length],
      });
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(cw, ch, cd), mat);
      mesh.position.set(c.x, ch * 0.5, c.z);
      this.scene.add(mesh);
      this.world.addCollider(
        c.x - cw * 0.5,
        c.x + cw * 0.5,
        c.z - cd * 0.5,
        c.z + cd * 0.5,
        ch,
        'container',
        mesh
      );
      this.coverPoints.push(
        { x: c.x + cw * 0.5 + 1.8, z: c.z },
        { x: c.x - cw * 0.5 - 1.8, z: c.z },
        { x: c.x, z: c.z + cd * 0.5 + 1.8 },
        { x: c.x, z: c.z - cd * 0.5 - 1.8 }
      );
    }

    // ГАРАЖ ПОРТА для Миссии 3 (X = -175, Z = 185) — открытый въезд со светящейся вывеской
    const gx = CONFIG.MISSIONS[2].garageTarget.x;
    const gz = CONFIG.MISSIONS[2].garageTarget.z;
    const gMat = new THREE.MeshLambertMaterial({ color: 0x2b2d42 });
    const leftWall = new THREE.Mesh(new THREE.BoxGeometry(1.2, 6, 14), gMat);
    leftWall.position.set(gx - 7, 3, gz);
    const rightWall = new THREE.Mesh(new THREE.BoxGeometry(1.2, 6, 14), gMat);
    rightWall.position.set(gx + 7, 3, gz);
    const roof = new THREE.Mesh(new THREE.BoxGeometry(15.2, 1.0, 14), gMat);
    roof.position.set(gx, 6.2, gz);
    this.scene.add(leftWall, rightWall, roof);
    this.world.addCollider(gx - 7.6, gx - 6.4, gz - 7, gz + 7, 6, 'garage', leftWall);
    this.world.addCollider(gx + 6.4, gx + 7.6, gz - 7, gz + 7, 6, 'garage', rightWall);

    const gSignTex = createNeonSignTexture('PORT GARAGE', 'IMPORT DROP-OFF', '#ffbe0b');
    const gSign = new THREE.Mesh(
      new THREE.BoxGeometry(12, 2.6, 0.5),
      new THREE.MeshBasicMaterial({ map: gSignTex })
    );
    gSign.position.set(gx, 7.8, gz - 6.8);
    this.scene.add(gSign);
  }

  _buildBillboards() {
    const spots = [
      { x: 64, z: -48, title: 'SUNSET PULSE 84.5', sub: 'SYNTHWAVE RADIO' },
      { x: -24, z: 62, title: 'TURBO GT-84', sub: 'V8 BI-TURBO COUPE' },
      { x: -116, z: -28, title: 'CYBER TURBO 98.9', sub: 'NIGHT DRIVE FM' },
      { x: 126, z: 64, title: 'PALM ROYALE', sub: 'OCEANFRONT LUXURY' },
    ];
    const poleMat = new THREE.MeshLambertMaterial({ color: 0x2b2d42 });
    spots.forEach((b, i) => {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.45, 9, 6), poleMat);
      pole.position.set(b.x, 4.5, b.z);
      this.scene.add(pole);
      this.world.addCollider(b.x - 0.6, b.x + 0.6, b.z - 0.6, b.z + 0.6, 9, 'pole', pole);

      const tex = createNeonSignTexture(b.title, b.sub, i % 2 === 0 ? '#ff2a85' : '#00f5d4');
      const board = new THREE.Mesh(
        new THREE.BoxGeometry(10.5, 4.2, 0.6),
        new THREE.MeshBasicMaterial({ map: tex })
      );
      board.position.set(b.x, 10.2, b.z);
      board.rotation.y = i % 2 === 0 ? Math.PI * 0.25 : -Math.PI * 0.25;
      this.scene.add(board);
    });
  }

  _buildInstancedPalms() {
    const maxPalms = Math.min(
      this.palmPositions.length,
      CONFIG.QUALITY[this.quality].palmCount
    );
    if (maxPalms === 0) return;

    const trunkGeo = new THREE.CylinderGeometry(0.22, 0.42, 7.6, 6);
    trunkGeo.translate(0, 3.8, 0);
    const trunkMat = new THREE.MeshLambertMaterial({ color: 0x6d4c3d });

    // Крона пальмы из нескольких раскидистых листьев, объединённых в один BufferGeometry
    const frondGeos = [];
    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * Math.PI * 2;
      const leaf = new THREE.ConeGeometry(0.95, 3.8, 4);
      leaf.rotateZ(Math.PI * 0.38);
      leaf.rotateY(angle);
      leaf.translate(Math.cos(angle) * 1.4, 7.5, Math.sin(angle) * 1.4);
      frondGeos.push(leaf);
    }
    const crownGeo = mergeBufferGeometries(frondGeos);
    const crownMat = new THREE.MeshLambertMaterial({ color: 0x2ec4b6 });

    const trunkInst = new THREE.InstancedMesh(trunkGeo, trunkMat, maxPalms);
    const crownInst = new THREE.InstancedMesh(crownGeo, crownMat, maxPalms);

    const dummy = new THREE.Object3D();
    for (let i = 0; i < maxPalms; i++) {
      const p = this.palmPositions[i];
      dummy.position.set(p.x, 0, p.z);
      dummy.rotation.set(0.05, (i * 1.7) % (Math.PI * 2), 0);
      dummy.scale.setScalar(p.scale || 1);
      dummy.updateMatrix();
      trunkInst.setMatrixAt(i, dummy.matrix);
      crownInst.setMatrixAt(i, dummy.matrix);
      this.world.addCollider(p.x - 0.45, p.x + 0.45, p.z - 0.45, p.z + 0.45, 7.5, 'palm');
    }
    trunkInst.instanceMatrix.needsUpdate = true;
    crownInst.instanceMatrix.needsUpdate = true;
    this.scene.add(trunkInst, crownInst);
    this.palmInstanced = { trunkInst, crownInst, count: maxPalms };
  }

  _buildInstancedStreetLamps() {
    const maxLamps = Math.min(
      this.lampPositions.length,
      CONFIG.QUALITY[this.quality].lampCount
    );
    if (maxLamps === 0) return;

    const poleGeo = new THREE.CylinderGeometry(0.12, 0.18, 6.4, 6);
    poleGeo.translate(0, 3.2, 0);
    const poleMat = new THREE.MeshLambertMaterial({ color: 0x2b2d42 });

    const bulbGeo = new THREE.BoxGeometry(0.9, 0.25, 0.45);
    bulbGeo.translate(0.5, 6.35, 0);
    const bulbMat = new THREE.MeshBasicMaterial({ color: 0x00f5d4 });
    this.world.neonMaterials.push(bulbMat);

    const poleInst = new THREE.InstancedMesh(poleGeo, poleMat, maxLamps);
    const bulbInst = new THREE.InstancedMesh(bulbGeo, bulbMat, maxLamps);

    const dummy = new THREE.Object3D();
    for (let i = 0; i < maxLamps; i++) {
      const lp = this.lampPositions[i];
      dummy.position.set(lp.x, 0, lp.z);
      dummy.rotation.set(0, lp.rotY || 0, 0);
      dummy.scale.setScalar(1);
      dummy.updateMatrix();
      poleInst.setMatrixAt(i, dummy.matrix);
      bulbInst.setMatrixAt(i, dummy.matrix);
    }
    poleInst.instanceMatrix.needsUpdate = true;
    bulbInst.instanceMatrix.needsUpdate = true;
    this.scene.add(poleInst, bulbInst);
    this.lampInstanced = { poleInst, bulbInst, count: maxLamps };
  }
}
