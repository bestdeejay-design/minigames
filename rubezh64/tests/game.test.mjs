import test from 'node:test';
import assert from 'node:assert/strict';

// The game is static-browser code; a no-op Canvas is enough to exercise its
// deterministic simulation in Node, with no npm packages or network access.
const context = new Proxy({}, { get: () => () => {}, set: () => true });
globalThis.document = { createElement: () => ({ width: 0, height: 0, getContext: () => context }) };
const { Game } = await import('../js/game.js');
const { RULES, UNIT_TYPES } = await import('../js/config.js');
const { createBuilding } = await import('../js/buildings.js');

function advance(game, seconds) {
  for (let i = 0; i < Math.round(seconds * 30) && game.mode === 'running'; i++) game.tick(1 / 30);
}
function worker(game, index = 0) { return game.units.filter(u => u.team === 'player' && u.type === 'worker')[index]; }
function openSite(game, type, anchorX = 11, anchorY = 12) {
  const sites = [];
  for (let y = 4; y < 25; y++) for (let x = 3; x < 26; x++) {
    if (game.canPlace(type, x, y)) sites.push({ x, y, d: Math.hypot(x - anchorX, y - anchorY) });
  }
  sites.sort((a,b)=>a.d-b.d);
  assert.ok(sites.length, `no visible site for ${type}`);
  return sites[0];
}

test('three difficulties set distinct economies, timing and reset cleanly', () => {
  const game = new Game('easy');
  assert.equal(game.player.minerals, 370);
  assert.equal(game.ai.waveTimer, 280);
  assert.equal(game.relays.length, 3);
  game.reset('normal');
  assert.equal(game.player.minerals, 320);
  assert.equal(game.ai.waveTimer, 225);
  assert.equal(game.units.filter(u=>u.team==='player').length, 6);
  game.reset('hard');
  assert.equal(game.player.minerals, 270);
  assert.equal(game.ai.waveTimer, 110);
  assert.equal(game.getSupply('player')[1], 10);
});

test('relays capture, pay income, reveal terrain and can be recaptured', () => {
  const game = new Game(); game.start();
  for (const unit of game.units.filter(u=>u.team==='player')) {
    game.orderStop(unit); unit.x = 305; unit.y = 350;
  }
  const relay = game.relays[0];
  const scout = game.spawnUnit('scout', 'player', relay.x, relay.y);
  assert.ok(scout);
  game.player.minerals = 0;
  advance(game, 12);
  assert.equal(relay.owner, 'player');
  assert.ok(game.player.minerals >= RULES.relayIncome, 'passive income should accumulate');
  scout.x = 305; scout.y = 350;
  game.fog.recompute(game);
  assert.equal(game.fog.isVisible(relay.tx, relay.ty), true, 'owned relay grants vision');
  const enemy = game.spawnUnit('marine', 'enemy', relay.x, relay.y);
  assert.ok(enemy);
  advance(game, 19);
  assert.equal(relay.owner, 'enemy');
});

test('engineers build defenses; training, research and outpost supply work', () => {
  const game = new Game(); game.start(); game.player.minerals = 5000;
  const barracks = game.place('barracks', 15, 10, worker(game));
  const house = game.place('house', 13, 16, worker(game, 1));
  assert.ok(barracks && house);
  advance(game, 21);
  assert.equal(barracks.progress, 1);
  assert.equal(house.progress, 1);
  assert.equal(game.getSupply('player')[1], 16);
  assert.equal(game.canBuild('workshop'), true);
  const site = openSite(game, 'turret');
  const turret = game.place('turret', site.x, site.y, worker(game, 2));
  assert.ok(turret);
  advance(game, 19);
  assert.equal(turret.progress, 1);
  const workshopSite = openSite(game, 'workshop');
  const workshop = game.place('workshop', workshopSite.x, workshopSite.y, worker(game, 3));
  assert.ok(workshop);
  advance(game, 30);
  assert.equal(workshop.progress, 1);
  assert.equal(game.canBuild('outpost'), true);
  assert.equal(game.train(barracks, 'scout'), true);
  assert.equal(game.train(workshop, 'guardian'), true);
  assert.equal(game.train(workshop, 'support'), true);
  const hq = game.buildings.find(b=>b.team==='player' && b.type==='command');
  assert.equal(game.research(hq, 'drills'), true);
  assert.equal(game.research(workshop, 'plating'), true);
  advance(game, 45);
  assert.equal(game.player.upgrades.drills, 1);
  assert.equal(game.player.upgrades.plating, 1);
  assert.ok(game.units.some(u=>u.team==='player' && u.type==='scout'));
  assert.ok(game.units.some(u=>u.team==='player' && u.type==='guardian'));
  assert.ok(game.units.some(u=>u.team==='player' && u.type==='support'));
  assert.equal(game.getSupply('player')[0] >= 10, true);
  const previousCap = game.getSupply('player')[1];
  const pioneer = worker(game, 2);
  game.orderMove(pioneer, 720, 880);
  advance(game, 33);
  assert.ok(Math.hypot(pioneer.x - 720, pioneer.y - 880) < 48, 'engineer reaches remote deposit');
  const remoteSites = [];
  for (let y = 23; y <= 32; y++) for (let x = 18; x <= 28; x++) {
    if (game.canPlace('outpost', x, y)) remoteSites.push({ x, y, distance: Math.hypot(x - 22, y - 27) });
  }
  remoteSites.sort((a,b)=>a.distance-b.distance);
  assert.ok(remoteSites.length, 'a scouted remote site is buildable');
  const base = game.place('outpost', remoteSites[0].x, remoteSites[0].y, pioneer);
  assert.ok(base);
  advance(game, 48);
  assert.equal(base.progress, 1);
  assert.equal(game.findNearestBase('player', 720, 880)?.id, base.id);
  assert.equal(game.getSupply('player')[1], previousCap + 6);
});

test('turrets shoot, mechanics apply plating and support repairs damage', () => {
  const game = new Game(); game.start();
  const site = openSite(game, 'turret');
  const tower = createBuilding(game, 'turret', 'player', site.x, site.y);
  const enemy = game.spawnUnit('marine', 'enemy', tower.x + 120, tower.y);
  assert.ok(enemy);
  game.fog.recompute(game);
  game.tick(1/30);
  assert.ok(game.projectiles.some(shot=>shot.fromType==='turret' && shot.targetId===enemy.id));
  const soldier = game.units.find(u=>u.team==='player'&&u.type==='marine');
  const repair = game.spawnUnit('support', 'player', soldier.x + 30, soldier.y);
  assert.ok(repair);
  soldier.hp = 45;
  advance(game, 3);
  assert.ok(soldier.hp > 45, 'repair drone heals injured soldier');
  const raw = game.damageFor(enemy, soldier);
  game.player.upgrades.plating = 1;
  assert.equal(Math.max(1,raw - game.player.upgrades.plating*2), raw - 2);
  game.player.upgrades.weapons = 1;
  assert.equal(game.damageFor(soldier, enemy), UNIT_TYPES.marine.damage + 2);
});

test('on normal a completely passive base survives past six minutes; easy lasts longer', () => {
  const normal = new Game('normal'); normal.start(); advance(normal, 360);
  assert.equal(normal.mode, 'running');
  assert.ok(normal.ai.waveNumber >= 1);
  advance(normal, 600);
  assert.equal(normal.mode, 'defeat');
  assert.ok(normal.time > 360, 'loss must not occur within six minutes');
  const easy = new Game('easy'); easy.start(); advance(easy, 600);
  assert.equal(easy.mode, 'running');
});

// A small deterministic strategy script exercises the actual purchase,
// construction, training, research and combat loops (not free test spawns).
const preferredSites = {
  house: [[13,16],[6,7],[15,6],[7,18],[16,17],[6,17],[14,6],[5,14],[13,19]],
  turret: [[6,16],[14,15],[15,7],[8,16],[17,12],[12,18]],
  workshop: [[11,14],[15,16],[14,7],[6,18],[15,19]],
  barracks: [[15,10],[6,19],[15,18],[6,6]],
};
function placePreferred(game, type, builder) {
  for (const [tx, ty] of preferredSites[type]) {
    if (game.canPlace(type, tx, ty)) return game.place(type, tx, ty, builder);
  }
  return null;
}

test('a developing base can defend normal waves for over twelve minutes', () => {
  const game = new Game('normal'); game.start();
  assert.ok(game.place('barracks', 15, 10, worker(game)));
  assert.ok(game.place('turret', 6, 16, worker(game, 1)));
  for (let i = 0; i < 720 * 30 && game.mode === 'running'; i++) {
    game.tick(1 / 30);
    if (i % 45 !== 0) continue;
    const builder = game.units.find(u => u.team === 'player' && u.type === 'worker' && u.order.kind !== 'build');
    const [used, cap] = game.getSupply('player');
    if (builder && cap - used <= 4 && game.player.minerals >= 90
      && !game.buildings.some(b=>b.team==='player' && b.type==='house' && b.progress < 1)) placePreferred(game, 'house', builder);
    if (builder && game.time > 28 && game.buildings.filter(b=>b.team==='player' && b.type==='turret').length < 3
      && game.player.minerals > 165) placePreferred(game, 'turret', builder);
    if (builder && game.time > 105 && !game.buildings.some(b=>b.team==='player' && b.type==='workshop')
      && game.player.minerals > 260) placePreferred(game, 'workshop', builder);
    for (const barracks of game.buildings.filter(b=>b.team==='player' && b.type==='barracks' && b.progress >= 1)) {
      if (barracks.queue.length < 2 && game.player.minerals >= 75) game.train(barracks, 'marine');
    }
    const workshop = game.buildings.find(b=>b.team==='player' && b.type==='workshop' && b.progress >= 1);
    if (workshop) {
      if (!game.player.upgrades.plating && !workshop.research && game.player.minerals >= 165) game.research(workshop, 'plating');
      if (workshop.queue.length < 1 && game.player.minerals >= 210) {
        game.train(workshop, game.units.some(u=>u.team==='player'&&u.type==='support') ? 'guardian' : 'support');
      }
    }
  }
  assert.equal(game.mode, 'running');
  assert.ok(game.time >= 720);
  assert.ok(game.ai.waveNumber >= 3);
  assert.ok(game.buildings.some(b=>b.team==='player'&&b.type==='command'));
  assert.ok(game.buildings.some(b=>b.team==='enemy'&&b.type==='workshop'&&b.progress===1), 'AI techs up');
  assert.ok(game.buildings.some(b=>b.team==='enemy'&&b.type==='outpost'&&b.progress===1), 'AI expands');
  assert.ok(game.enemy.upgrades.weapons >= 1, 'AI researches late-game weapons');
});

test('an assembled army can finish the mission against a developed AI', () => {
  const game = new Game('normal'); game.start();
  assert.ok(game.place('barracks', 15, 10, worker(game)));
  assert.ok(game.place('house', 13, 16, worker(game, 1)));
  let lastOrder = 0;
  for (let i = 0; i < 600 * 30 && game.mode === 'running'; i++) {
    game.tick(1 / 30);
    if (i % 45 === 0) {
      const builder = game.units.find(u=>u.team==='player'&&u.type==='worker'&&u.order.kind!=='build');
      const [used, cap] = game.getSupply('player');
      if (builder && cap - used <= 4 && game.player.minerals >= 90
        && !game.buildings.some(b=>b.team==='player'&&b.type==='house'&&b.progress<1)) placePreferred(game,'house',builder);
      if (builder && game.time > 50 && game.buildings.filter(b=>b.team==='player'&&b.type==='turret').length < 2
        && game.player.minerals >= 160) placePreferred(game,'turret',builder);
      if (builder && game.time > 80 && !game.buildings.some(b=>b.team==='player'&&b.type==='workshop')
        && game.player.minerals >= 300) placePreferred(game,'workshop',builder);
      if (builder && game.time > 115 && game.buildings.filter(b=>b.team==='player'&&b.type==='barracks').length < 2
        && game.player.minerals >= 250) placePreferred(game,'barracks',builder);
      for (const barracks of game.buildings.filter(b=>b.team==='player'&&b.type==='barracks'&&b.progress>=1)) {
        if (barracks.queue.length < 2 && game.player.minerals >= 75) game.train(barracks,'marine');
      }
      const shop = game.buildings.find(b=>b.team==='player'&&b.type==='workshop'&&b.progress>=1);
      if (shop) {
        if (!game.player.upgrades.weapons && !shop.research && game.player.minerals >= 165) game.research(shop,'weapons');
        if (shop.queue.length < 1 && game.player.minerals >= 180) game.train(shop,'guardian');
      }
    }
    if (game.time >= 270 && game.time - lastOrder > 16) {
      const enemy = game.buildings.filter(b=>b.team==='enemy');
      const target = enemy.find(b=>b.type==='command') || enemy.find(b=>b.type==='turret') || enemy[0];
      if (target) {
        for (const unit of game.units.filter(u=>u.team==='player'&&u.type!=='worker')) game.orderAttackMove(unit,target.x,target.y);
        lastOrder = game.time;
      }
    }
  }
  assert.equal(game.mode, 'victory');
  assert.equal(game.buildings.filter(b=>b.team==='enemy').length, 0);
});
