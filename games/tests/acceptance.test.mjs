// Run with: node --experimental-default-type=module --test games/tests/acceptance.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname,resolve} from 'node:path';
import {groupAt,recoverEnergy,Game as Garden} from '../merge-garden/js/game.js';
import {CONFIG as gardenConfig} from '../merge-garden/js/config.js';
import {milestone,upgradeCost,offlineIncome,prestigeGain,Game as Miner} from '../idle-miner/js/game.js';
import {CONFIG as minerConfig} from '../idle-miner/js/config.js';
import {landing,Game as Tower} from '../tower-stack/js/game.js';
import {CONFIG as towerConfig} from '../tower-stack/js/config.js';
import {generateLevel,scan,possibleMoves,playMove} from '../candy-match/js/logic.js';
import {CONFIG as candyConfig} from '../candy-match/js/config.js';
import {SpatialHash,Game as Swarm} from '../swarm-survivor/js/game.js';
import {CONFIG as swarmConfig} from '../swarm-survivor/js/config.js';
import {Game as Ball} from '../ball-blitz/js/game.js';
import {CONFIG as ballConfig} from '../ball-blitz/js/config.js';
import {generate,verifyCertificate,solve,colorCount} from '../color-sort/js/logic.js';
import {CONFIG as sortConfig} from '../color-sort/js/config.js';
import {Physics} from '../fruit-drop/js/game.js';
import {CONFIG as fruitConfig} from '../fruit-drop/js/config.js';
import {Game as Hopper} from '../road-hopper/js/game.js';
import {CONFIG as roadConfig} from '../road-hopper/js/config.js';
import {Game as Hole,radiusFor} from '../hungry-hole/js/game.js';
import {CONFIG as holeConfig} from '../hungry-hole/js/config.js';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
let counter=0;
function api(){return {
  slug:`acceptance-${++counter}`,w:390,h:620,status:'playing',
  hud(){},actions(){},actionState(){},toast(){},combo(){},impact(){},
  sound:{play(){}},fx:{burst(){},float(){},kick(){},ring(){},squash(){}},
  choice(_k,_t,_b,options){this.options=options;},finish(...result){this.result=result;},
};}

test('GitHub Pages: ten static, self-contained games and ten catalogue links',()=>{
  const slugs=['merge-garden','idle-miner','tower-stack','candy-match','swarm-survivor','ball-blitz','color-sort','fruit-drop','road-hopper','hungry-hole'];
  const hub=readFileSync(resolve(root,'index.html'),'utf8');
  assert.ok(existsSync(resolve(root,'.nojekyll')));
  for(const slug of slugs){
    const dir=resolve(root,'games',slug);
    for(const file of ['index.html','style.css','js/main.js','js/config.js','js/game.js'])assert.ok(existsSync(resolve(dir,file)),`${slug}: ${file}`);
    assert.ok(hub.includes(`href="games/${slug}/"`),slug);
    const html=readFileSync(resolve(dir,'index.html'),'utf8');
    assert.match(html,/viewport-fit=cover/);assert.match(html,/type="module" src="\.\/js\/main\.js"/);
    assert.doesNotMatch(html,/https?:\/\//);
    for(const file of ['js/main.js','js/game.js','js/config.js'])assert.doesNotMatch(readFileSync(resolve(dir,file),'utf8'),/\bfetch\s*\(|XMLHttpRequest|https?:\/\//);
  }
});

test('Merge Garden: 5×7, three-neighbour chains, 20-second energy, golden finish',()=>{
  assert.equal(gardenConfig.columns,5);assert.equal(gardenConfig.initialRows,7);
  assert.deepEqual(groupAt([1,1,0,0,0,1,1,0,0,0],0,5).sort((a,b)=>a-b),[0,1,5,6]);
  assert.deepEqual(recoverEnergy(8,1000,41_000),{energy:10,stamp:41_000,gained:2});
  const a=api(),g=new Garden(a);g.data.board.fill(0);g.data.board[0]=g.data.board[1]=g.data.board[5]=3;
  g.chain(0);assert.equal(g.data.board[0],4);assert.equal(g.data.coins,27);
  g.data.bestTier=gardenConfig.maxLevel;g.checkGolden(1);assert.match(a.result[0],/Победа/);
});

test('Idle Miner: eight mines, milestones 25/50/100, offline cap and prestige',()=>{
  assert.equal(minerConfig.maxMines,8);assert.deepEqual([24,25,50,100].map(milestone),[1,2,4,8]);
  assert.ok(upgradeCost(0,2)>upgradeCost(0,1));
  const mines=[{level:25,manager:true}];assert.equal(offlineIncome(mines,0,86_400),offlineIncome(mines,0,8*3600));
  assert.equal(prestigeGain(2*minerConfig.prestigeThreshold),2);
  const a=api(),g=new Miner(a);g.data.cash=minerConfig.prestigeThreshold;g.data.earned=minerConfig.prestigeThreshold;g.prestige();
  assert.ok(a.result[2].includes('Макс. капитал'));assert.ok(g.data.crystals>=1);
});

test('Tower Stack: ≤3 px Perfect, widening after the third, and miss result',()=>{
  assert.equal(landing({x:40,width:100},{x:43,width:100}).perfect,true);
  assert.equal(landing({x:0,width:20},{x:30,width:20}).overlap,0);
  const a=api(),g=new Tower(a);const original=g.blocks.at(-1).width;
  for(let i=0;i<towerConfig.perfectExpansionStart;i++){const top=g.blocks.at(-1);g.active={x:top.x,width:top.width,y:-(g.floors+1)*towerConfig.blockHeight};g.settle();}
  assert.ok(g.blocks.at(-1).width>original);
  g.active.x=-1000;g.settle();g.update(1);assert.equal(g.mode,'end');assert.ok(a.result);
});

test('Candy Match: 15 start boards without matches, each with a legal witnessed goal',()=>{
  assert.equal(candyConfig.size,8);assert.equal(candyConfig.levels,15);
  for(let level=1;level<=candyConfig.levels;level++){
    const made=generateLevel(level,level*8167);assert.equal(scan(made.state.board).length,0);assert.ok(possibleMoves(made.state.board).length);
    assert.ok(made.witness.length>0&&made.witness.length<=made.moveLimit);assert.ok(made.goal.amount>0);
    let state={...made.state,board:made.state.board.map(tile=>({...tile})),ice:[...made.state.ice]},score=0;
    const collected=Array(candyConfig.colors).fill(0);
    for(const [from,to] of made.witness){const result=playMove(state,from,to);assert.ok(result.valid,`level ${level}: witness move`);state={board:result.board,ice:result.ice,seed:result.seed};score+=result.score;result.colors.forEach((amount,color)=>collected[color]+=amount);}
    const goal=made.goal;
    assert.ok(goal.kind==='score'?score>=goal.amount:goal.kind==='color'?collected[goal.color]>=goal.amount:state.ice.every(hit=>hit===0),`level ${level}: witnessed goal`);
  }
});

test('Swarm Survivor: spatial hash, enemy cap and boss at 120 seconds',()=>{
  assert.equal(swarmConfig.runGoalSeconds,600);assert.equal(swarmConfig.enemyCap,400);
  const a=api(),g=new Swarm(a),hash=new SpatialHash(64);hash.rebuild([{x:0,y:0},{x:300,y:300}]);
  assert.equal(hash.nearby(0,0,20).length,1);g.t=119.99;g.update(.02);
  assert.equal(g.enemies.filter(e=>e.type==='boss').length,1);assert.equal(g.bossAt,240);
  g.t=swarmConfig.runGoalSeconds-.01;g.update(.02);assert.match(a.result[0],/Победа/);
});

test('Ball Blitz: first row, bounces and three independent perks every ten rounds',()=>{
  assert.equal(ballConfig.columns,7);const a=api(),g=new Ball(a);
  assert.equal(g.blocks.length,ballConfig.initialBlocks);g.round=10;g.endRound();
  assert.equal(g.round,11);assert.equal(a.options.length,3);
  assert.equal(new Set(a.options.map(o=>o.label)).size,3);
  assert.equal(new Set(g.blocks.map(b=>`${b.col},${b.row}`)).size,g.blocks.length);
});

test('Color Sort: 30 levels, exactly two empty tubes, valid construction certificates',()=>{
  assert.equal(sortConfig.levels,30);
  for(let level=1;level<=30;level++){
    const made=generate(level,0x13579b+level*199);
    assert.equal(made.tubes.length,colorCount(level)+2);
    assert.equal(made.tubes.filter(t=>!t.length).length,2);
    assert.ok(verifyCertificate(made.tubes,made.certificate));
    if(level<=3)assert.ok(solve(made.tubes));
  }
});

test('Fruit Drop: same-level merging cascades while different fruits collide',()=>{
  assert.equal(fruitConfig.maxLevel,11);const merges=[],physics=new Physics(390,600,o=>merges.push(o.level));
  physics.add(1,190,200);physics.add(1,190,200);physics.step(1/60);
  assert.ok(merges.includes(2));physics.add(2,190,200);physics.step(1/60);
  assert.ok(merges.includes(3));
});

test('Road Hopper: safe beginning, 5-second eagle, warning, gacha and bounded rows',()=>{
  const a=api(),g=new Hopper(a);assert.equal(roadConfig.columns,9);
  assert.ok(!g.row(1).trees.has(4));g.hop(0,1);assert.equal(g.score,1);
  g.meta.coins=roadConfig.skinPrice;g.buySkin();g.update(roadConfig.gachaSeconds+.01);
  assert.equal(g.meta.owned.length,2);g.restart(false);g.update(roadConfig.idleEagleSeconds+.01);
  assert.equal(g.dead,true);assert.match(g.reason,/орёл/);
  g.restart(false);const rail=g.row(1);rail.type='rail';rail.phase=rail.period-roadConfig.trainDuration-roadConfig.railWarningSeconds-.01;
  g.update(.02);assert.equal(rail.warning,true);g.update(roadConfig.railWarningSeconds+.01);assert.equal(rail.train,true);
  g.restart(false);g.player.row=90;g.camera=85;g.stepRows();assert.ok(g.rows.size<50);
});

test('Hungry Hole: 800 objects, five active bots, growth, penalty and three-second respawn',()=>{
  const a=api(),g=new Hole(a);assert.equal(holeConfig.worldSize,2000);
  assert.equal(g.objects.length,800);assert.equal(g.actors.length,6);
  assert.ok(radiusFor(100)>radiusFor(0));
  const rival=g.actors[1];g.player.score=100;g.player.r=radiusFor(100);
  rival.score=1000;rival.r=radiusFor(1000);rival.x=g.player.x;rival.y=g.player.y;
  g.collideHoles();assert.equal(g.player.score,70);assert.equal(g.player.respawn,3);
  g.update(3.1);assert.equal(g.player.respawn,0);
  g.time=1;g.update(1);assert.ok(a.result?.[0].startsWith('Место'));
});

test('Hungry Hole bots navigate city streets without stalling against buildings',()=>{
  const g=new Hole(api()),bots=g.actors.slice(1),last=bots.map(b=>[b.x,b.y]),travel=Array(holeConfig.bots).fill(0);
  for(let second=0;second<60;second++){
    for(let frame=0;frame<60;frame++)g.update(1/60);
    bots.forEach((bot,i)=>{travel[i]+=Math.hypot(bot.x-last[i][0],bot.y-last[i][1]);last[i]=[bot.x,bot.y];});
  }
  assert.ok(travel.every(d=>d>500),`bots did not move: ${travel.map(Math.round)}`);
});
