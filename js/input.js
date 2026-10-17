import { BUILDING_TYPES, RULES, TILE_SIZE, UNIT_TYPES, WORLD_SIZE } from './config.js';
import { worldToTile } from './map.js';

export class Input {
  constructor(game, renderer, ui) {
    this.game = game;
    this.renderer = renderer;
    this.ui = ui;
    this.canvas = renderer.canvas;
    this.keys = new Set();
    this.pointer = { x: 0, y: 0, inside: false };
    this.dragBox = null;
    this.buildType = null;
    this.attackMove = false;
    this.lastGroup = 0;
    this.lastGroupTime = 0;
    this.miniDragging = false;
    ui.commandHandler = command => this.handleCommand(command);
    this.bind();
  }
  localPoint(event) {
    const rect = this.canvas.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }
  worldPoint(point) {
    return { x: Math.max(0, Math.min(WORLD_SIZE - 1, this.game.camera.x + point.x)),
      y: Math.max(0, Math.min(WORLD_SIZE - 1, this.game.camera.y + point.y)) };
  }
  bind() {
    this.canvas.addEventListener('contextmenu', event => event.preventDefault());
    this.canvas.addEventListener('pointerenter', event => {
      const point = this.localPoint(event);
      this.pointer.x = point.x; this.pointer.y = point.y;
      this.pointer.inside = true;
    });
    this.canvas.addEventListener('pointerleave', () => { this.pointer.inside = false; });
    this.canvas.addEventListener('pointermove', event => {
      const point = this.localPoint(event);
      this.pointer.x = point.x; this.pointer.y = point.y;
      if (this.dragBox && event.pointerId === this.dragBox.pointerId) {
        this.dragBox.endX = point.x; this.dragBox.endY = point.y;
      }
      const world = this.worldPoint(point);
      document.getElementById('coordinates').textContent = `X ${String(worldToTile(world.x)).padStart(2, '0')} · Y ${String(worldToTile(world.y)).padStart(2, '0')}`;
    });
    this.canvas.addEventListener('pointerdown', event => {
      if (this.game.mode !== 'running') return;
      const point = this.localPoint(event);
      this.pointer.x = point.x; this.pointer.y = point.y;
      const world = this.worldPoint(point);
      if (event.button === 2) {
        event.preventDefault();
        if (this.buildType || this.attackMove) { this.cancelMode(); return; }
        this.rightClick(world);
      } else if (event.button === 0) {
        event.preventDefault();
        if (this.buildType) { this.placeBuilding(world); return; }
        if (this.attackMove) {
          const units = this.game.selected().filter(e => e.kind === 'unit' && e.team === 'player');
          if (units.length) this.game.orderGroupMove(units, world.x, world.y, true);
          this.cancelMode();
          this.game.audio?.play('order');
          return;
        }
        this.dragBox = { pointerId: event.pointerId, startX: point.x, startY: point.y, endX: point.x, endY: point.y,
          startWorld: world };
        this.canvas.setPointerCapture(event.pointerId);
      }
    });
    this.canvas.addEventListener('pointerup', event => {
      if (!this.dragBox || event.pointerId !== this.dragBox.pointerId) return;
      const box = this.dragBox;
      this.dragBox = null;
      if (this.canvas.hasPointerCapture(event.pointerId)) this.canvas.releasePointerCapture(event.pointerId);
      const point = this.localPoint(event), world = this.worldPoint(point);
      if (Math.hypot(point.x - box.startX, point.y - box.startY) < 7) {
        const hit = this.game.entityAt(world.x, world.y);
        if (hit) this.game.select([hit.id], event.shiftKey && hit.team === 'player');
        else if (!event.shiftKey) this.game.select([]);
      } else {
        const left = Math.min(box.startWorld.x, world.x), right = Math.max(box.startWorld.x, world.x);
        const top = Math.min(box.startWorld.y, world.y), bottom = Math.max(box.startWorld.y, world.y);
        const selected = this.game.units.filter(unit => unit.team === 'player' && unit.hp > 0 && unit.x >= left && unit.x <= right && unit.y >= top && unit.y <= bottom).map(unit => unit.id);
        if (selected.length) this.game.select(selected, event.shiftKey);
        else if (!event.shiftKey) this.game.select([]);
      }
    });
    this.canvas.addEventListener('pointercancel', event => {
      if (this.dragBox?.pointerId === event.pointerId) this.dragBox = null;
    });
    this.canvas.addEventListener('lostpointercapture', event => {
      if (this.dragBox?.pointerId === event.pointerId) this.dragBox = null;
    });
    window.addEventListener('keydown', event => this.keyDown(event));
    window.addEventListener('keyup', event => this.keys.delete(event.code));
    window.addEventListener('blur', () => { this.keys.clear(); this.dragBox = null; });

    const mini = this.renderer.minimapCanvas;
    const moveMini = event => {
      const rect = mini.getBoundingClientRect();
      this.game.centerCamera((event.clientX - rect.left) / rect.width * WORLD_SIZE,
        (event.clientY - rect.top) / rect.height * WORLD_SIZE, this.renderer.width, this.renderer.height);
    };
    mini.addEventListener('pointerdown', event => {
      if (this.game.mode !== 'running') return;
      this.miniDragging = true;
      mini.setPointerCapture(event.pointerId);
      moveMini(event);
    });
    mini.addEventListener('pointermove', event => { if (this.miniDragging) moveMini(event); });
    mini.addEventListener('pointerup', () => { this.miniDragging = false; });
    mini.addEventListener('pointercancel', () => { this.miniDragging = false; });
  }
  keyDown(event) {
    if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space'].includes(event.code)) event.preventDefault();
    this.keys.add(event.code);
    if (this.game.mode !== 'running' || event.repeat) return;
    const number = /^Digit([1-9])$/.exec(event.code) || /^Numpad([1-9])$/.exec(event.code);
    if (number) {
      event.preventDefault();
      const index = Number(number[1]);
      if (event.ctrlKey || event.metaKey) {
        this.game.groups[index] = this.game.selected().filter(e => e.team === 'player').map(e => e.id);
        this.game.announce(`Группа ${index} назначена`, 'normal');
      } else {
        const ids = this.game.groups[index].filter(id => this.game.entities.get(id)?.hp > 0);
        if (ids.length) {
          this.game.select(ids);
          if (this.lastGroup === index && performance.now() - this.lastGroupTime < 500) {
            const group = this.game.selected();
            const x = group.reduce((sum,e)=>sum+e.x,0) / group.length;
            const y = group.reduce((sum,e)=>sum+e.y,0) / group.length;
            this.game.centerCamera(x,y,this.renderer.width,this.renderer.height);
          }
          this.lastGroup = index; this.lastGroupTime = performance.now();
        }
      }
      return;
    }
    if (event.code === 'Escape') { this.cancelMode(); return; }
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    const shortcuts = { KeyB: 'house', KeyR: 'barracks', KeyW: 'worker', KeyM: 'marine', KeyS: 'stop', KeyA: 'attackMove', KeyG: 'gather' };
    if (shortcuts[event.code]) this.handleCommand(shortcuts[event.code]);
  }
  rightClick(world) {
    const selection = this.game.selected().filter(e => e.team === 'player');
    if (!selection.length) return;
    const target = this.game.entityAt(world.x, world.y);
    const units = selection.filter(e => e.kind === 'unit');
    const workers = units.filter(e => e.type === 'worker');
    const structures = selection.filter(e => e.kind === 'building');
    if (structures.length && !units.length) {
      for (const building of structures) building.rally = { x: world.x, y: world.y,
        mineralId: target?.kind === 'mineral' ? target.id : null };
      this.game.announce('Точка сбора назначена', 'normal');
    } else if (target?.kind === 'mineral' && workers.length) {
      workers.forEach(worker => this.game.orderHarvest(worker, target.id));
      units.filter(unit => unit.type !== 'worker').forEach(unit => this.game.orderMove(unit, world.x, world.y));
    } else if (target?.team === 'enemy') {
      units.forEach(unit => this.game.orderAttack(unit, target.id));
    } else if (target?.kind === 'building' && target.team === 'player' && target.progress < 1 && workers.length) {
      workers.forEach(worker => this.game.orderBuild(worker, target));
    } else this.game.orderGroupMove(units, world.x, world.y);
    this.game.audio?.play('order');
  }
  placeBuilding(world) {
    const tx = worldToTile(world.x), ty = worldToTile(world.y);
    const workers = this.game.selected().filter(e => e.kind === 'unit' && e.team === 'player' && e.type === 'worker');
    const worker = workers.sort((a,b)=>Math.hypot(a.x-world.x,a.y-world.y)-Math.hypot(b.x-world.x,b.y-world.y))[0];
    const building = worker && this.game.place(this.buildType, tx, ty, worker);
    if (!building) {
      this.game.announce('Нельзя строить здесь или не хватает минералов', 'warning');
      this.game.audio?.play('error');
      return;
    }
    this.game.select([building.id]);
    this.game.announce(`${BUILDING_TYPES[building.type].name}: строительство началось`, 'normal');
    this.game.audio?.play('build');
    this.cancelMode();
  }
  handleCommand(command) {
    if (this.game.mode !== 'running') return;
    const selected = this.game.selected().filter(e => e.team === 'player');
    const workers = selected.filter(e => e.kind === 'unit' && e.type === 'worker');
    if (command === 'house' || command === 'barracks') {
      if (!workers.length) return;
      if (this.game.player.minerals < BUILDING_TYPES[command].cost) {
        this.game.announce('Недостаточно минералов', 'warning'); this.game.audio?.play('error'); return;
      }
      this.buildType = command;
      this.attackMove = false;
      this.ui.setCommandHint?.('Выберите место постройки · Esc или ПКМ — отмена');
      this.game.announce('Выберите место для постройки', 'normal');
    } else if (command === 'worker' || command === 'marine') {
      const building = selected.find(e => e.kind === 'building' && BUILDING_TYPES[e.type].trains === command);
      if (building && this.game.train(building, command)) {
        this.game.announce(`${UNIT_TYPES[command].name}: добавлен в очередь`, 'normal');
        this.game.audio?.play('train');
      } else { this.game.announce('Не хватает минералов, места или лимита населения', 'warning'); this.game.audio?.play('error'); }
    } else if (command === 'stop') {
      selected.filter(e => e.kind === 'unit').forEach(unit => this.game.orderStop(unit));
      this.game.audio?.play('order');
    } else if (command === 'gather') {
      workers.forEach(worker => this.game.assignNearestMineral(worker));
      this.game.audio?.play('order');
    } else if (command === 'attackMove') {
      if (!selected.some(e => e.kind === 'unit')) return;
      this.attackMove = true; this.buildType = null;
      this.game.announce('Атаковать с продвижением: выберите точку', 'normal');
    }
  }
  cancelMode() { this.buildType = null; this.attackMove = false; this.ui.setCommandHint?.('ЛКМ — выделить · ПКМ — приказ'); }
  updateCamera(dt) {
    if (this.game.mode !== 'running') return;
    let dx = 0, dy = 0;
    if (this.keys.has('ArrowLeft')) dx--;
    if (this.keys.has('ArrowRight')) dx++;
    if (this.keys.has('ArrowUp')) dy--;
    if (this.keys.has('ArrowDown')) dy++;
    if (this.pointer.inside && !this.dragBox) {
      const zone = RULES.edgeScrollZone;
      if (this.pointer.x < zone) dx--;
      if (this.pointer.x > this.renderer.width - zone) dx++;
      if (this.pointer.y < zone) dy--;
      if (this.pointer.y > this.renderer.height - zone) dy++;
    }
    if (dx || dy) {
      const length = Math.hypot(dx, dy);
      this.game.camera.x += dx / length * RULES.cameraSpeed * dt;
      this.game.camera.y += dy / length * RULES.cameraSpeed * dt;
      this.game.clampCamera(this.renderer.width, this.renderer.height);
    }
  }
}
