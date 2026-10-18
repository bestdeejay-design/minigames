import { MAP_SIZE, RULES, TILE_SIZE } from './config.js';
import { tileCenter } from './map.js';

// Neutral objectives create a choice between defending the base and holding the map.
const SITES = [[20, 11], [32, 36], [44, 53]];

export function createRelays(game) {
  return SITES.map(([cx, cy], index) => {
    let spot = null;
    for (let radius = 0; radius <= 6 && !spot; radius++) {
      for (let dy = -radius; dy <= radius && !spot; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          const x = cx + dx, y = cy + dy;
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== radius || x < 2 || y < 2 || x >= MAP_SIZE - 2 || y >= MAP_SIZE - 2) continue;
          if (game.isTileOpen(x, y)) { spot = { x, y }; break; }
        }
      }
    }
    if (!spot) throw new Error('No open tile for relay');
    const relay = {
      id: game.nextId++, kind: 'relay', name: `Ретранслятор ${index + 1}`,
      tx: spot.x, ty: spot.y, x: tileCenter(spot.x), y: tileCenter(spot.y),
      owner: null, control: 0, index: index + 1,
    };
    game.entities.set(relay.id, relay);
    return relay;
  });
}

export function updateRelays(game, dt) {
  for (const relay of game.relays) {
    let player = false, enemy = false;
    for (const unit of game.units) {
      if (unit.hp <= 0 || Math.abs(unit.x - relay.x) > RULES.relayRadius || Math.abs(unit.y - relay.y) > RULES.relayRadius) continue;
      if (Math.hypot(unit.x - relay.x, unit.y - relay.y) > RULES.relayRadius) continue;
      if (unit.team === 'player') player = true;
      else enemy = true;
      if (player && enemy) break;
    }
    if (player !== enemy) {
      const direction = player ? 1 : -1;
      relay.control = Math.max(-1, Math.min(1, relay.control + direction * dt / RULES.relayCaptureSeconds));
      if (relay.owner === 'player' && relay.control <= 0 || relay.owner === 'enemy' && relay.control >= 0) relay.owner = null;
      if (relay.owner === null && Math.abs(relay.control) >= 1 - 1e-8) {
        relay.owner = relay.control > 0 ? 'player' : 'enemy';
        game.announce(relay.owner === 'player'
          ? `${relay.name} подключён: +${RULES.relayIncome} минерала/с`
          : `Противник захватил ${relay.name.toLowerCase()}`, relay.owner === 'player' ? 'normal' : 'warning');
        game.audio?.play(relay.owner === 'player' ? 'relay' : 'error');
      }
    }
    if (relay.owner) game[relay.owner].minerals += RULES.relayIncome * dt;
  }
}

export function relayCount(game, team) { return game.relays.filter(relay => relay.owner === team).length; }
