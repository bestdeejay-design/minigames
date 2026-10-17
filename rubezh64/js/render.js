import { BUILDING_TYPES, MAP_SIZE, TEAM_COLORS, TILE_SIZE, UNIT_TYPES, WORLD_SIZE } from './config.js';
import { worldToTile } from './map.js';

function roundRect(ctx, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
function healthBar(ctx, x, y, width, amount, team) {
  ctx.fillStyle = 'rgba(4,15,19,.88)';
  ctx.fillRect(x - width / 2 - 1, y - 1, width + 2, 6);
  ctx.fillStyle = amount < .33 ? '#ff806e' : team === 'player' ? '#8cedcc' : '#ffb078';
  ctx.fillRect(x - width / 2, y, width * Math.max(0, amount), 4);
}
function drawMineral(ctx, mineral, now) {
  const glint = Math.sin(now * .003 + mineral.id) * 1.8;
  const size = 1 + Math.min(1, mineral.amount / 250) * .18;
  ctx.save();
  ctx.translate(mineral.x, mineral.y);
  ctx.scale(size, size);
  ctx.fillStyle = 'rgba(5,19,24,.45)';
  ctx.beginPath(); ctx.ellipse(0, 10, 12, 5, 0, 0, Math.PI * 2); ctx.fill();
  ctx.shadowColor = '#7ed9e7'; ctx.shadowBlur = 13;
  ctx.fillStyle = '#61b6c8';
  ctx.beginPath(); ctx.moveTo(0, -13 - glint); ctx.lineTo(10, -2); ctx.lineTo(5, 11); ctx.lineTo(-8, 9); ctx.lineTo(-10, -3); ctx.closePath(); ctx.fill();
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#b9f5ed';
  ctx.beginPath(); ctx.moveTo(0, -12 - glint); ctx.lineTo(3, 4); ctx.lineTo(-4, 8); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#3b809a';
  ctx.beginPath(); ctx.moveTo(3, 4); ctx.lineTo(10, -2); ctx.lineTo(5, 11); ctx.closePath(); ctx.fill();
  ctx.restore();
}
function drawBuilding(ctx, building, selected, now) {
  const size = building.size * TILE_SIZE;
  const x = building.tx * TILE_SIZE, y = building.ty * TILE_SIZE;
  const team = TEAM_COLORS[building.team];
  ctx.save();
  ctx.fillStyle = 'rgba(0,7,13,.48)';
  roundRect(ctx, x + 5, y + 8, size - 7, size - 4, 10); ctx.fill();
  ctx.fillStyle = building.progress < 1 ? '#3e4c4b' : team.dark;
  ctx.strokeStyle = building.progress < 1 ? '#9da79a' : team.main;
  ctx.lineWidth = 2;
  roundRect(ctx, x + 4, y + 3, size - 8, size - 8, 9); ctx.fill(); ctx.stroke();
  const inner = x + 12, top = y + 11, innerSize = size - 24;
  if (building.type === 'command') {
    ctx.fillStyle = building.progress < 1 ? '#455658' : '#1d3b46';
    roundRect(ctx, inner, top, innerSize, innerSize, 12); ctx.fill();
    ctx.fillStyle = building.progress < 1 ? '#829b95' : team.main;
    for (const [ox, oy] of [[0,0],[innerSize-12,0],[0,innerSize-12],[innerSize-12,innerSize-12]]) {
      roundRect(ctx, inner + ox, top + oy, 12, 12, 3); ctx.fill();
    }
    const cx = building.x, cy = building.y;
    ctx.shadowColor = team.main; ctx.shadowBlur = building.progress < 1 ? 0 : 13;
    ctx.fillStyle = building.progress < 1 ? '#60767a' : team.main;
    ctx.beginPath(); ctx.arc(cx, cy, 17, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#16333c';
    ctx.beginPath(); ctx.arc(cx, cy, 10, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = team.bright; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(cx, cy, 12, -.35 + Math.sin(now * .001) * .1, 2.4); ctx.stroke();
  } else if (building.type === 'barracks') {
    ctx.fillStyle = '#243841';
    roundRect(ctx, inner, top + 2, innerSize, innerSize - 3, 5); ctx.fill();
    ctx.strokeStyle = team.main; ctx.lineWidth = 3;
    for (let i = 0; i < 3; i++) {
      const yy = top + 10 + i * (innerSize - 18) / 2;
      ctx.beginPath(); ctx.moveTo(inner + 7, yy); ctx.lineTo(inner + innerSize - 7, yy); ctx.stroke();
    }
    ctx.fillStyle = '#0b1b24';
    roundRect(ctx, inner + innerSize * .26, top + innerSize * .33, innerSize * .48, innerSize * .43, 4); ctx.fill();
    ctx.fillStyle = team.main;
    ctx.fillRect(inner + innerSize * .43, top + innerSize * .41, innerSize * .14, innerSize * .2);
  } else {
    ctx.fillStyle = '#223d41';
    roundRect(ctx, inner, top, innerSize, innerSize, 7); ctx.fill();
    ctx.strokeStyle = team.main; ctx.lineWidth = 2;
    ctx.strokeRect(inner + 7, top + 7, innerSize - 14, innerSize - 14);
    ctx.fillStyle = team.main;
    ctx.beginPath(); ctx.arc(building.x, building.y, 7, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#e5fff0';
    ctx.beginPath(); ctx.arc(building.x, building.y, 3, 0, Math.PI * 2); ctx.fill();
  }
  if (building.progress < 1) {
    ctx.fillStyle = 'rgba(8,18,23,.48)';
    ctx.fillRect(x + 4, y + 4, size - 8, size - 8);
    ctx.strokeStyle = team.main; ctx.lineWidth = 1;
    for (let i = 10; i < size - 8; i += 13) {
      ctx.beginPath(); ctx.moveTo(x + i, y + 5); ctx.lineTo(x + 5, y + i); ctx.stroke();
    }
    healthBar(ctx, building.x, y + size - 12, size - 22, building.progress, building.team);
  }
  if (building.hitFlash > 0) {
    ctx.fillStyle = `rgba(255,255,255,${building.hitFlash * 1.6})`;
    roundRect(ctx, x + 5, y + 4, size - 10, size - 10, 8); ctx.fill();
  }
  if (selected) {
    ctx.strokeStyle = team.bright; ctx.lineWidth = 2;
    ctx.setLineDash([7, 4]);
    ctx.strokeRect(x - 3, y - 3, size + 6, size + 6);
    ctx.setLineDash([]);
  }
  if (building.hp < building.maxHp || selected) healthBar(ctx, building.x, y - 8, size - 8, building.hp / building.maxHp, building.team);
  ctx.restore();
}
function drawUnit(ctx, unit, selected, now) {
  const team = TEAM_COLORS[unit.team];
  ctx.save();
  ctx.translate(unit.x, unit.y);
  ctx.fillStyle = 'rgba(0,8,13,.47)';
  ctx.beginPath(); ctx.ellipse(0, 6, unit.radius + 3, unit.radius * .55, 0, 0, Math.PI * 2); ctx.fill();
  if (selected) {
    ctx.strokeStyle = team.bright; ctx.lineWidth = 1.8;
    ctx.beginPath(); ctx.ellipse(0, 2, unit.radius + 6, unit.radius + 4, 0, 0, Math.PI * 2); ctx.stroke();
  }
  ctx.rotate(unit.facing);
  if (unit.type === 'worker') {
    ctx.fillStyle = '#182b35';
    ctx.fillRect(-7, -11, 14, 22);
    ctx.fillStyle = team.main;
    roundRect(ctx, -7, -7, 14, 14, 4); ctx.fill();
    ctx.fillStyle = '#d9a976';
    ctx.fillRect(3, -11, 7, 4); ctx.fillRect(3, 7, 7, 4);
    ctx.fillStyle = '#d3f8ee';
    ctx.fillRect(1, -3, 6, 6);
    if (unit.cargo) {
      ctx.shadowColor = '#8ce9f3'; ctx.shadowBlur = 8; ctx.fillStyle = '#9de4ee';
      ctx.beginPath(); ctx.moveTo(-7, -5); ctx.lineTo(-3, -9); ctx.lineTo(0, -5); ctx.lineTo(-3, -1); ctx.closePath(); ctx.fill();
    }
  } else {
    ctx.fillStyle = '#213840';
    ctx.fillRect(-8, -10, 15, 20);
    ctx.fillStyle = team.main;
    ctx.beginPath(); ctx.moveTo(10, 0); ctx.lineTo(4, -9); ctx.lineTo(-7, -9); ctx.lineTo(-10, 0);
    ctx.lineTo(-7, 9); ctx.lineTo(4, 9); ctx.closePath(); ctx.fill();
    ctx.fillStyle = team.bright;
    ctx.fillRect(0, -4, 6, 8);
    ctx.fillStyle = '#a6bcb7';
    ctx.fillRect(7, -3, 11, 6);
    ctx.fillStyle = '#0a262b';
    ctx.fillRect(-10, -11, 5, 6); ctx.fillRect(-10, 5, 5, 6);
  }
  if (unit.hitFlash > 0) {
    ctx.fillStyle = `rgba(255,255,255,${unit.hitFlash * 2.8})`;
    ctx.beginPath(); ctx.arc(0, 0, unit.radius + 2, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
  if (unit.hp < unit.maxHp || selected) healthBar(ctx, unit.x, unit.y - unit.radius - 11, 25, unit.hp / unit.maxHp, unit.team);
}

export class Renderer {
  constructor(canvas, minimapCanvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.minimapCanvas = minimapCanvas;
    this.mini = minimapCanvas.getContext('2d');
    this.width = 1; this.height = 1;
    this.miniWidth = 1; this.miniHeight = 1;
    this.dpr = 1;
  }
  resize(game) {
    const rect = this.canvas.getBoundingClientRect();
    const miniRect = this.minimapCanvas.getBoundingClientRect();
    const width = Math.max(1, Math.round(rect.width));
    const height = Math.max(1, Math.round(rect.height));
    const miniWidth = Math.max(1, Math.round(miniRect.width));
    const miniHeight = Math.max(1, Math.round(miniRect.height));
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    if (width === this.width && height === this.height && miniWidth === this.miniWidth && miniHeight === this.miniHeight && dpr === this.dpr) return;
    this.width = width; this.height = height; this.miniWidth = miniWidth; this.miniHeight = miniHeight; this.dpr = dpr;
    this.canvas.width = Math.round(width * dpr); this.canvas.height = Math.round(height * dpr);
    this.minimapCanvas.width = Math.round(miniWidth * dpr); this.minimapCanvas.height = Math.round(miniHeight * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0); this.mini.setTransform(dpr, 0, 0, dpr, 0, 0);
    game.clampCamera(width, height);
  }
  visible(game, entity) {
    return entity.team !== 'enemy' || !game.fog || game.fog.isWorldVisible(entity.x, entity.y);
  }
  draw(game, input, now = performance.now()) {
    const ctx = this.ctx;
    const { x, y } = game.camera;
    ctx.fillStyle = '#0c2328'; ctx.fillRect(0, 0, this.width, this.height);
    const sourceWidth = Math.min(this.width, WORLD_SIZE - x), sourceHeight = Math.min(this.height, WORLD_SIZE - y);
    if (sourceWidth > 0 && sourceHeight > 0) ctx.drawImage(game.map.terrainCanvas, x, y, sourceWidth, sourceHeight, 0, 0, sourceWidth, sourceHeight);
    ctx.save(); ctx.translate(-x, -y);
    for (const mineral of game.minerals) {
      if (mineral.amount <= 0 || mineral.x < x - 25 || mineral.y < y - 25 || mineral.x > x + this.width + 25 || mineral.y > y + this.height + 25) continue;
      if (game.fog && !game.fog.isExplored(mineral.tx, mineral.ty)) continue;
      drawMineral(ctx, mineral, now);
    }
    for (const building of game.buildings) {
      if (building.hp <= 0 || building.x < x - 110 || building.y < y - 110 || building.x > x + this.width + 110 || building.y > y + this.height + 110 || !this.visible(game, building)) continue;
      drawBuilding(ctx, building, game.selection.includes(building.id), now);
    }
    for (const unit of game.units) {
      if (unit.hp <= 0 || unit.x < x - 25 || unit.y < y - 25 || unit.x > x + this.width + 25 || unit.y > y + this.height + 25 || !this.visible(game, unit)) continue;
      drawUnit(ctx, unit, game.selection.includes(unit.id), now);
    }
    for (const shot of game.projectiles) {
      if (shot.x < x - 15 || shot.y < y - 15 || shot.x > x + this.width + 15 || shot.y > y + this.height + 15) continue;
      ctx.save(); ctx.shadowColor = shot.fromTeam === 'player' ? '#9efded' : '#ffae87'; ctx.shadowBlur = 10;
      ctx.fillStyle = shot.fromTeam === 'player' ? '#d9fff0' : '#ffd7a4';
      ctx.beginPath(); ctx.arc(shot.x, shot.y, shot.fromType === 'worker' ? 2.4 : 3.1, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    }
    for (const effect of game.effects) {
      ctx.save(); ctx.globalAlpha = Math.max(0, effect.life / effect.maxLife);
      if (effect.kind === 'text') {
        ctx.textAlign = 'center'; ctx.font = '800 15px system-ui'; ctx.lineWidth = 4;
        ctx.strokeStyle = '#10252b'; ctx.strokeText(effect.text, effect.x, effect.y);
        ctx.fillStyle = effect.color; ctx.fillText(effect.text, effect.x, effect.y);
      } else {
        ctx.strokeStyle = effect.kind === 'explosion' ? '#ffcf89' : TEAM_COLORS[effect.team].main;
        ctx.lineWidth = effect.kind === 'explosion' ? 3 : 2;
        const radius = effect.kind === 'explosion' ? (1 - effect.life / effect.maxLife) * 34 : (1 - effect.life / effect.maxLife) * 11;
        ctx.beginPath(); ctx.arc(effect.x, effect.y, radius, 0, Math.PI * 2); ctx.stroke();
      }
      ctx.restore();
    }
    ctx.restore();
    if (game.fog) this.drawFog(game);
    this.drawOrders(game, input);
    this.drawMinimap(game);
  }
  drawOrders(game, input) {
    const ctx = this.ctx, camera = game.camera;
    const first = game.selected().find(e => e.kind === 'unit' && e.team === 'player');
    if (first && first.order && ['move', 'attackMove', 'attack', 'harvest'].includes(first.order.kind)) {
      const target = first.order.targetId ? game.entities.get(first.order.targetId)
        : first.order.mineralId ? game.entities.get(first.order.mineralId) : first.order;
      if (target?.x !== undefined && (target.team !== 'enemy' || this.visible(game, target))) {
        ctx.save(); ctx.strokeStyle = 'rgba(174,255,233,.32)'; ctx.lineWidth = 1;
        ctx.setLineDash([5, 6]); ctx.beginPath();
        ctx.moveTo(first.x - camera.x, first.y - camera.y); ctx.lineTo(target.x - camera.x, target.y - camera.y); ctx.stroke();
        ctx.setLineDash([]); ctx.restore();
      }
    }
    if (input.dragBox) {
      const box = input.dragBox;
      const left = Math.min(box.startX, box.endX), top = Math.min(box.startY, box.endY);
      const width = Math.abs(box.endX - box.startX), height = Math.abs(box.endY - box.startY);
      ctx.fillStyle = 'rgba(118,227,215,.13)'; ctx.fillRect(left, top, width, height);
      ctx.strokeStyle = '#aaf7e2'; ctx.lineWidth = 1; ctx.strokeRect(left + .5, top + .5, width, height);
    }
    if (input.buildType && input.pointer.inside) {
      const building = BUILDING_TYPES[input.buildType];
      const tx = worldToTile(camera.x + input.pointer.x), ty = worldToTile(camera.y + input.pointer.y);
      const px = tx * TILE_SIZE - camera.x, py = ty * TILE_SIZE - camera.y;
      const valid = game.canPlace(input.buildType, tx, ty);
      ctx.fillStyle = valid ? 'rgba(118,227,215,.28)' : 'rgba(255,96,87,.32)';
      ctx.fillRect(px, py, building.size * TILE_SIZE, building.size * TILE_SIZE);
      ctx.strokeStyle = valid ? '#a8fbe0' : '#ff8a7e'; ctx.lineWidth = 2;
      ctx.strokeRect(px + 1, py + 1, building.size * TILE_SIZE - 2, building.size * TILE_SIZE - 2);
    }
  }
  drawFog(game) {
    const ctx = this.ctx, camera = game.camera;
    const left = Math.max(0, worldToTile(camera.x));
    const top = Math.max(0, worldToTile(camera.y));
    const right = Math.min(MAP_SIZE, worldToTile(camera.x + this.width) + 2);
    const bottom = Math.min(MAP_SIZE, worldToTile(camera.y + this.height) + 2);
    for (let ty = top; ty < bottom; ty++) {
      for (let tx = left; tx < right; tx++) {
        const state = game.fog.get(tx, ty);
        if (state === 2) continue;
        ctx.fillStyle = state === 1 ? 'rgba(3,12,19,.73)' : '#071218';
        ctx.fillRect(tx * TILE_SIZE - camera.x, ty * TILE_SIZE - camera.y, TILE_SIZE + .5, TILE_SIZE + .5);
      }
    }
  }
  drawMinimap(game) {
    const ctx = this.mini;
    ctx.clearRect(0, 0, this.miniWidth, this.miniHeight);
    ctx.drawImage(game.map.minimapCanvas, 0, 0, this.miniWidth, this.miniHeight);
    for (const mineral of game.minerals) {
      if (mineral.amount <= 0 || game.fog && !game.fog.isExplored(mineral.tx, mineral.ty)) continue;
      ctx.fillStyle = '#b7eaf0';
      ctx.fillRect(mineral.x / WORLD_SIZE * this.miniWidth - 1, mineral.y / WORLD_SIZE * this.miniHeight - 1, 2, 2);
    }
    if (game.fog) ctx.drawImage(game.fog.minimapCanvas, 0, 0, this.miniWidth, this.miniHeight);
    for (const building of game.buildings) {
      if (building.hp <= 0 || !this.visible(game, building)) continue;
      ctx.fillStyle = TEAM_COLORS[building.team].main;
      ctx.fillRect(building.tx / MAP_SIZE * this.miniWidth, building.ty / MAP_SIZE * this.miniHeight,
        Math.max(3, building.size / MAP_SIZE * this.miniWidth), Math.max(3, building.size / MAP_SIZE * this.miniHeight));
    }
    for (const unit of game.units) {
      if (unit.hp <= 0 || !this.visible(game, unit)) continue;
      ctx.fillStyle = TEAM_COLORS[unit.team].bright;
      ctx.fillRect(unit.x / WORLD_SIZE * this.miniWidth, unit.y / WORLD_SIZE * this.miniHeight, 2, 2);
    }
    ctx.strokeStyle = '#e7fff4'; ctx.lineWidth = 1.2;
    ctx.strokeRect(game.camera.x / WORLD_SIZE * this.miniWidth, game.camera.y / WORLD_SIZE * this.miniHeight,
      this.width / WORLD_SIZE * this.miniWidth, this.height / WORLD_SIZE * this.miniHeight);
  }
}
