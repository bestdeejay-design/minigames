'use strict';
/* ═══════════════ ШТУРМ v2.0 · рейкастинг-шутер · AXIIOM canon ═══════════════ */
const $=id=>document.getElementById(id);
const clamp=(v,a,b)=>v<a?a:v>b?b:v;
const rand=(a,b)=>a+Math.random()*(b-a);
const TAU=Math.PI*2;
function xmur3(str){let h=1779033703^str.length;for(let i=0;i<str.length;i++){h=Math.imul(h^str.charCodeAt(i),3432918353);h=h<<13|h>>>19;}return function(){h=Math.imul(h^h>>>16,2246822507);h=Math.imul(h^h>>>13,3266489909);return (h^=h>>>16)>>>0;};}
function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return ((t^t>>>14)>>>0)/4294967296;};}
function lsGet(k,d){try{const v=localStorage.getItem(k);return v===null?d:JSON.parse(v);}catch(e){return d;}}
function lsSet(k,v){try{localStorage.setItem(k,JSON.stringify(v));}catch(e){}}
const fmt=n=>Math.floor(n).toLocaleString('ru-RU');
const now=new Date();
const today=new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Moscow'}).format(now);
const yDate=new Date(now.getTime()-86400000);
const yesterday=new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Moscow'}).format(yDate);
if(window.CanvasRenderingContext2D&&!CanvasRenderingContext2D.prototype.roundRect){CanvasRenderingContext2D.prototype.roundRect=function(x,y,w,h,r){r=Math.min(r||0,w/2,h/2);this.moveTo(x+r,y);this.arcTo(x+w,y,x+w,y+h,r);this.arcTo(x+w,y+h,x,y+h,r);this.arcTo(x,y+h,x,y,r);this.arcTo(x,y,x+w,y,r);this.closePath();return this;};}
/* ─── Аудио ─── */
let AC=null,master=null;
function audioInit(){ if(AC)return; try{ AC=new (window.AudioContext||window.webkitAudioContext)(); master=AC.createGain(); master.gain.value=muted?0:0.5; master.connect(AC.destination); }catch(e){} }
function tone(freq,dur,type,vol,slide,delay){ if(!AC||muted)return; const t0=AC.currentTime+(delay||0); const o=AC.createOscillator(),g=AC.createGain(); o.type=type||'square'; o.frequency.setValueAtTime(freq,t0); if(slide)o.frequency.exponentialRampToValueAtTime(Math.max(30,freq+slide),t0+dur); g.gain.setValueAtTime(vol||.15,t0); g.gain.exponentialRampToValueAtTime(.001,t0+dur); o.connect(g);g.connect(master); o.start(t0);o.stop(t0+dur+.02); }
function noise(dur,vol,fc,delay){ if(!AC||muted)return; const t0=AC.currentTime+(delay||0); const n=Math.floor(AC.sampleRate*dur); const buf=AC.createBuffer(1,n,AC.sampleRate); const d=buf.getChannelData(0); for(let i=0;i<n;i++)d[i]=(Math.random()*2-1)*(1-i/n); const src=AC.createBufferSource(); src.buffer=buf; const f=AC.createBiquadFilter(); f.type='lowpass'; f.frequency.setValueAtTime(fc||1000,t0); f.frequency.exponentialRampToValueAtTime(150,t0+dur); const g=AC.createGain(); g.gain.setValueAtTime(vol||.3,t0); g.gain.exponentialRampToValueAtTime(.001,t0+dur); src.connect(f);f.connect(g);g.connect(master); src.start(t0); }
const sfx={
  pistol(){ noise(.08,.25,2400); tone(320,.06,'square',.1,-160); },
  shotgun(){ noise(.22,.5,1600); tone(120,.18,'sawtooth',.28,-70); },
  pump(){ tone(220,.05,'square',.08,60,.12); tone(180,.05,'square',.08,-40,.2); },
  reload(){ tone(300,.06,'square',.09,-60); tone(360,.06,'square',.09,-60,.15); },
  hitE(){ tone(260,.05,'triangle',.12,-60); },
  kill(){ noise(.3,.35,900); tone(90,.25,'triangle',.2,-40); },
  boom(){ noise(.6,.5,700); tone(70,.4,'sawtooth',.3,-30); },
  hurt(){ noise(.18,.35,600); tone(150,.15,'sawtooth',.2,-70); },
  pickup(){ tone(660,.09,'sine',.13); tone(990,.11,'sine',.12,0,.08); },
  alarm(){ tone(180,.22,'sawtooth',.15,60); tone(180,.22,'sawtooth',.15,60,.3); },
  clear(){ tone(523,.1,'triangle',.13); tone(659,.1,'triangle',.13,0,.09); tone(784,.16,'triangle',.15,0,.18); },
  empty(){ tone(180,.05,'square',.08,-40); },
  over(){ tone(300,.5,'sawtooth',.2,-220); noise(.6,.4,700,.1); },
};
/* ─── Хранилище/мета ─── */
const K_BEST='f3.best',K_DAILY='f3.daily.'+today,K_STREAK='f3.streak',K_LASTDAY='f3.lastDay',K_MUTE='f3.muted',K_MISS='f3.missions.'+today;
const el={ score:$('score-val'),daily:$('daily-val'),best:$('best-val'),wave:$('wave-val'),hull:$('hull-fill'),streakN:$('streak-n'),multN:$('mult-n'),missionsN:$('missions-n'),wDaily:$('w-daily-best'),wBest:$('w-best'),wStreak:$('w-streak'),announce:$('announce'),gc:$('gc') };
const cv=el.gc,ctx=cv.getContext('2d');
let CW=400,CH=520,dpr=1;
function fitCanvas(){ const wrap=$('canvas-wrap'); const r=wrap.getBoundingClientRect(); CW=Math.max(280,Math.floor(r.width-16)); CH=Math.max(300,Math.floor(r.height-16)); dpr=Math.min(window.devicePixelRatio||1,2); cv.width=CW*dpr; cv.height=CH*dpr; cv.style.width=CW+'px'; cv.style.height=CH+'px'; ctx.setTransform(dpr,0,0,dpr,0,0); zbuf=new Float32Array(Math.ceil(CW/COL_W)); }
/* ─── Карта 12×16 (1=стена) ─── */
const MAP=[
'1111111111111111',
'1000000000000001',
'1011011011011101',
'1010000000000101',
'1010110000110101',
'1000010000100001',
'1000010000100001',
'1010110000110101',
'1010000000000101',
'1011011011011101',
'1000000000000001',
'1111111111111111'].map(r=>r.split('').map(Number));
const MW=16,MH=12;
const FLOORS=[]; for(let y=0;y<MH;y++)for(let x=0;x<MW;x++)if(!MAP[y][x])FLOORS.push([x+.5,y+.5]);
function cell(x,y){ if(x<0||y<0||x>=MW||y>=MH)return 1; return MAP[y|0][x|0]; }
function castRay(px,py,ang){ /* DDA → {dist,side,mapX,mapY} */ const dx=Math.cos(ang),dy=Math.sin(ang); let mapX=px|0,mapY=py|0; const ddx=Math.abs(1/dx),ddy=Math.abs(1/dy); let stepX,stepY,sdx,sdy; if(dx<0){stepX=-1;sdx=(px-mapX)*ddx;}else{stepX=1;sdx=(mapX+1-px)*ddx;} if(dy<0){stepY=-1;sdy=(py-mapY)*ddy;}else{stepY=1;sdy=(mapY+1-py)*ddy;} let side=0; for(let i=0;i<64;i++){ if(sdx<sdy){ sdx+=ddx; mapX+=stepX; side=0; } else { sdy+=ddy; mapY+=stepY; side=1; } if(MAP[mapY]&&MAP[mapY][mapX])break; } const dist=side===0?sdx-ddx:sdy-ddy; return {dist:Math.max(dist,.01),side,mapX,mapY}; }
function losClear(ax,ay,bx,by){ const d=Math.hypot(bx-ax,by-ay); if(d<.001)return true; const steps=Math.ceil(d*3); for(let i=1;i<steps;i++){ const t=i/steps; if(cell(ax+(bx-ax)*t,ay+(by-ay)*t))return false; } return true; }
/* ─── Состояние ─── */
let muted=lsGet(K_MUTE,false),mode='daily';
let running=false,over=false;
let score=0,mult=1,wave=0,sector=0;
let best=lsGet(K_BEST,0),dailyBest=lsGet(K_DAILY,0);
let streak=lsGet(K_STREAK,0),lastDay=lsGet(K_LASTDAY,'');
let dailyRng=Math.random;
const sr=(a,b)=>a+(mode==='daily'?dailyRng():Math.random())*(b-a);
const player={x:1.5,y:5.5,a:0,hp:100,weapon:0,moving:0,bob:0,kick:0,flash:0,hurtT:0,reload:0,reloadMax:0,swapT:0};
const WEAPONS=[
  {name:'ПИСТОЛЕТ',mag:12,dmg:1,pellets:1,spread:.012,rate:.36,reload:1.1,ammo:96,kick:3},
  {name:'ДРОБОВИК',mag:6,dmg:1,pellets:5,spread:.10,rate:.85,reload:1.7,ammo:14,kick:9},
];
const gun={mag:[12,6],reserve:[96,14],cool:[0,0]};
let enemies=[],projs=[],drops=[],parts=[],annT=0;
let spawnQueue=[],waveT=0,waveState='idle',dmgThisWave=0,combo=0,comboT=0;
let shake=0,aimT=0,kills=0;
const COL_W=2;
let zbuf=new Float32Array(200);
/* сектора: палитры стен */
const SECTORS=[
  {wall:[124,138,158],floor:'#15151D',ceil:'#0B0B12',name:'Стальной сектор'},
  {wall:[158,96,96], floor:'#1D1414',ceil:'#120B0B',name:'Багровый сектор'},
  {wall:[158,140,90],floor:'#1D1A12',ceil:'#121008',name:'Золотой сектор'},
];
function wallShade(d,side,flash){ const s=SECTORS[Math.min(sector,2)]; const b=Math.max(0,1-d/9)*(side?0.72:1)*(flash?1.7:1); return `rgb(${(s.wall[0]*b)|0},${(s.wall[1]*b)|0},${(s.wall[2]*b)|0})`; }
/* ─── Мета ─── */
function effStreak(){ return (lastDay===today||lastDay===yesterday)?streak:0; }
function getMult(s){ return 1+Math.min(Math.max(s-1,0),10)*0.05; }
function touchStreak(){ if(lastDay===today){ mult=getMult(streak); return; } streak=(lastDay===yesterday)?(streak||0)+1:1; lastDay=today; lsSet(K_STREAK,streak); lsSet(K_LASTDAY,lastDay); mult=getMult(streak); if(streak>1)toast(`🔥 Стрик <b>${streak}</b> · очки ×<b>${mult.toFixed(2)}</b>`); }
const MISSIONS=[
  {id:'kills30', name:'Уничтожить 30 врагов',      target:30, track:'kills'},
  {id:'waves8',  name:'Пройти 8 волн',             target:8,  track:'waves'},
  {id:'sg15',    name:'15 убийств из дробовика',   target:15, track:'sgkills'},
  {id:'med3',    name:'Подобрать 3 аптечки',       target:3,  track:'meds'},
  {id:'sector2', name:'Достичь сектора 2',         target:2,  track:'sector'},
  {id:'flaw4',   name:'4 волны без урона',         target:4,  track:'flawless'},
  {id:'gun12',   name:'Уничтожить 12 стрелков',    target:12, track:'gunners'},
  {id:'boss1',   name:'Победить босса сектора',    target:1,  track:'bosses'},
];
let missionData=lsGet(K_MISS,{p:{},done:{}});
if(!missionData.p)missionData={p:{},done:{}};
function saveMissions(){ lsSet(K_MISS,missionData); }
function missionAward(mid){ if(missionData.done[mid])return; missionData.done[mid]=1; saveMissions(); const bonus=Math.round(25*mult); if(running&&!over){ score+=bonus; } toast(`🎯 Миссия выполнена: <b>+${bonus}</b>`); sfx.clear(); refreshMissionsUI(); }
function missionTick(track,val,absolute){ MISSIONS.forEach(m=>{ if(m.track!==track||missionData.done[m.id])return; if(absolute){ if(val>(missionData.p[m.id]||0))missionData.p[m.id]=val; } else missionData.p[m.id]=(missionData.p[m.id]||0)+val; if(missionData.p[m.id]>=m.target)missionAward(m.id); }); saveMissions(); refreshMissionsUI(); }
function refreshMissionsUI(){ const done=MISSIONS.filter(m=>missionData.done[m.id]).length; el.missionsN.textContent=done+'/3'; }
function renderMissionsModal(){ const list=$('mmodal-list'); list.innerHTML=''; MISSIONS.forEach(m=>{ const p=Math.min(missionData.p[m.id]||0,m.target); const done=!!missionData.done[m.id]; const d=document.createElement('div'); d.className='mm-item'+(done?' done':''); d.innerHTML=`<span class="mm-check">✓</span><span class="mm-body"><span class="mm-name">${m.name}</span><span class="mm-prog"><b>${fmt(p)}</b> / ${fmt(m.target)}</span></span>`; list.appendChild(d); }); }
function toast(html){ const t=document.createElement('span'); t.className='toast'; t.innerHTML=html; $('toasts').appendChild(t); setTimeout(()=>t.classList.add('out'),2600); setTimeout(()=>t.remove(),3000); }
function announce(big,sub){ el.announce.innerHTML=`<span class="an-big">${big}</span>${sub?`<span class="an-sub">${sub}</span>`:''}`; el.announce.classList.remove('hidden'); clearTimeout(annT); annT=setTimeout(()=>el.announce.classList.add('hidden'),1700); }
/* ─── Враги ─── */
const ETYPES={
  drone: {r:.32,hp:3,pts:100,speed:1.32,color:'#E4545F',melee:10},
  gunner:{r:.30,hp:2,pts:200,speed:1.15,color:'#B06AE4',ranged:9},
  boss:  {r:.55,hp:55,pts:2200,speed:.62,color:'#E8B04B',ranged:16},
};
function farCell(){ const far=FLOORS.filter(c=>Math.hypot(c[0]-player.x,c[1]-player.y)>6); const pick=far.length?far[(dailyRng()*far.length)|0]:FLOORS[(dailyRng()*FLOORS.length)|0]; return pick; }
function spawnEnemy(type){ const t=ETYPES[type]; const c=farCell(); enemies.push({type,x:c[0],y:c[1],r:t.r,hp:t.hp,maxHp:t.hp,pts:t.pts,speed:t.speed,color:t.color,flash:0,dead:false,dt:0,fireT:sr(1.2,2.4),strafe:Math.random()<.5?1:-1,meleeT:0}); }
function spawnProj(e){ const ang=Math.atan2(player.y-e.y,player.x-e.x)+(e.type==='boss'?(sr(-.14,.14)):sr(-.04,.04)); const spd=e.type==='boss'?2.6:2.2; projs.push({x:e.x+Math.cos(ang)*.4,y:e.y+Math.sin(ang)*.4,vx:Math.cos(ang)*spd,vy:Math.sin(ang)*spd,dmg:e.type==='boss'?16:9,t:0}); }
function killEnemy(e,i){ e.dead=true; e.dt=.28; kills++; const cm=1+0.15*Math.min(combo,10); const pts=Math.round(e.pts*cm*mult); score+=pts; combo++; comboT=2; sfx.kill(); missionTick('kills',1); if(e.type==='gunner')missionTick('gunners',1); if(e.type==='boss'){ missionTick('bosses',1); sfx.boom(); shake=Math.min(shake+14,20); announce('БОСС ПАЛ','сектор зачищен'); } /* дроп */ const roll=dailyRng(); if(roll<.2)drops.push({x:e.x,y:e.y,kind:'med',t:0}); else if(roll<.5)drops.push({x:e.x,y:e.y,kind:player.weapon===1?'sgammo':'ammo',t:0}); }
function hitscan(ang,dmg){ const ray=castRay(player.x,player.y,ang); const wallD=ray.dist; let bestE=null,bestT=1e9; for(const e of enemies){ if(e.dead)continue; const ex=e.x-player.x,ey=e.y-player.y; const t=ex*Math.cos(ang)+ey*Math.sin(ang); if(t<=0||t>wallD+.2)continue; const perp=Math.abs(-ex*Math.sin(ang)+ey*Math.cos(ang)); if(perp<e.r&&t<bestT){ bestT=t; bestE=e; } } if(bestE){ bestE.hp-=dmg; bestE.flash=.07; sfx.hitE(); aimT=.15; if(bestE.hp<=0){ const i=enemies.indexOf(bestE); if(i>=0)killEnemy(bestE,i); } return true; } return false; }
/* ─── Волны ─── */
function buildWave(n){ const q=[]; const isBoss=n%6===0; let count=Math.min(3+Math.ceil(n*.9),14); let t=1.2; if(isBoss){ q.push({t,type:'boss'}); count=Math.ceil(count/2); } for(let i=0;i<count;i++){ const type=(n>=2&&dailyRng()<.35)?'gunner':'drone'; q.push({t:t+i*1.05,type}); } spawnQueue=q; waveT=0; }
function startWave(n){ wave=n; waveState='run'; dmgThisWave=0; buildWave(n); const ns=Math.floor((n-1)/6); if(ns!==sector){ sector=ns; announce('СЕКТОР '+(sector+1),SECTORS[Math.min(sector,2)].name); sfx.alarm(); } else { const isBoss=n%6===0; if(isBoss){ sfx.alarm(); announce('ВОЛНА '+n,'⚠ БОСС СЕКТОРА'); } else announce('ВОЛНА '+n,SECTORS[Math.min(sector,2)].name); } el.wave.textContent=n; missionTick('waves',n,true); missionTick('sector',sector+1,true); }
function waveCleared(){ waveState='clear'; waveT=0; const bonus=Math.round((60+wave*15)*mult); score+=bonus; if(dmgThisWave===0){ missionTick('flawless',1); score+=60; announce('ВОЛНА +'+fmt(bonus+60),'без урона · престиж'); } else announce('ВОЛНА ПРОЙДЕНА','+'+fmt(bonus)); sfx.clear(); }
/* ─── Оружие ─── */
function tryShoot(){ if(!running||over||player.reload>0||player.swapT>0)return; const w=WEAPONS[player.weapon]; if(gun.cool[player.weapon]>0)return; if(gun.mag[player.weapon]<=0){ sfx.empty(); startReload(); return; } gun.mag[player.weapon]--; gun.cool[player.weapon]=w.rate; player.kick=w.kick; player.flash=.08; shake=Math.min(shake+w.kick*.3,10); for(let i=0;i<w.pellets;i++){ const a=player.a+(w.pellets>1?(i-(w.pellets-1)/2)*w.spread+sr(-w.spread*.4,w.spread*.4):sr(-w.spread,w.spread)); hitscan(a,w.dmg); } if(player.weapon===0)sfx.pistol(); else{ sfx.shotgun(); sfx.pump(); } if(gun.mag[player.weapon]===0)startReload(); }
function startReload(){ const w=WEAPONS[player.weapon]; if(player.reload>0||gun.mag[player.weapon]===w.mag||gun.reserve[player.weapon]<=0)return; player.reload=w.reload; player.reloadMax=w.reload; sfx.reload(); }
function finishReload(){ const w=WEAPONS[player.weapon]; const need=w.mag-gun.mag[player.weapon]; const take=Math.min(need,gun.reserve[player.weapon]); gun.mag[player.weapon]+=take; gun.reserve[player.weapon]-=take; sfx.pump(); }
function swapWeapon(){ if(player.swapT>0||player.reload>0)return; player.weapon=1-player.weapon; player.swapT=.4; sfx.reload(); }
/* ─── Урон игроку ─── */
function damagePlayer(d){ if(over||player.hurtT>0)return; player.hurtT=.35; dmgThisWave++; combo=0; player.hp=Math.max(0,player.hp-d); el.hull.style.width=player.hp+'%'; shake=Math.min(shake+7,16); sfx.hurt(); if(player.hp<=0)gameOver(); }
/* ─── Апдейт ─── */
function tryMove(dx,dy){ const rad=.26; if(!cell(player.x+dx+Math.sign(dx)*rad,player.y))player.x+=dx; if(!cell(player.x,player.y+dy+Math.sign(dy)*rad))player.y+=dy; }
function update(dt){ if(over)return;
  /* таймеры */
  if(player.flash>0)player.flash-=dt; if(player.hurtT>0)player.hurtT-=dt; if(player.swapT>0)player.swapT-=dt;
  if(player.kick>0)player.kick=Math.max(0,player.kick-dt*40);
  if(shake>0)shake=Math.max(0,shake-dt*38);
  if(aimT>0)aimT-=dt; if(comboT>0){ comboT-=dt; if(comboT<=0)combo=0; }
  gun.cool[0]=Math.max(0,gun.cool[0]-dt); gun.cool[1]=Math.max(0,gun.cool[1]-dt);
  if(player.reload>0){ player.reload-=dt; if(player.reload<=0){ player.reload=0; finishReload(); } }
  /* автоогонь при удержании */
  if(firing)tryShoot();
  /* частицы */
  parts=parts.filter(p=>{ p.life-=dt; p.x+=p.vx*dt; p.y+=p.vy*dt; return p.life>0; });
  /* волна */
  if(waveState==='run'){ waveT+=dt; while(spawnQueue.length&&spawnQueue[0].t<=waveT){ spawnEnemy(spawnQueue.shift().type); } if(!spawnQueue.length&&!enemies.some(e=>!e.dead))waveCleared(); }
  else if(waveState==='clear'){ waveT+=dt; if(waveT>3.2)startWave(wave+1); }
  /* враги */
  for(let i=enemies.length-1;i>=0;i--){ const e=enemies[i]; if(e.flash>0)e.flash-=dt;
    if(e.dead){ e.dt-=dt; if(e.dt<=0)enemies.splice(i,1); continue; }
    const dx=player.x-e.x,dy=player.y-e.y; const d=Math.hypot(dx,dy)||.001; const los=losClear(e.x,e.y,player.x,player.y);
    let vx=0,vy=0; const t=ETYPES[e.type];
    if(e.type==='gunner'){ if(d>3.4||!los){ vx=dx/d*e.speed; vy=dy/d*e.speed; } else { vx=-dy/d*e.strafe*.8; vy=dx/d*e.strafe*.8; if(Math.random()<.004)e.strafe*=-1; } e.fireT-=dt; if(e.fireT<=0&&los){ spawnProj(e); e.fireT=sr(1.8,2.8); tone(240,.1,'sawtooth',.08,-80); } }
    else if(e.type==='boss'){ if(d>2.2||!los){ vx=dx/d*e.speed; vy=dy/d*e.speed; } else { vx=-dy/d*e.strafe*.5; vy=dx/d*e.strafe*.5; } e.fireT-=dt; if(e.fireT<=0&&los){ for(let k=0;k<3;k++){ const a=Math.atan2(dy,dx)+(k-1)*.16; projs.push({x:e.x+Math.cos(a)*.6,y:e.y+Math.sin(a)*.6,vx:Math.cos(a)*2.4,vy:Math.sin(a)*2.4,dmg:16,t:0}); } e.fireT=sr(2.2,3.2); tone(120,.2,'sawtooth',.14,-40); } }
    else { /* drone */ if(d>.5){ vx=dx/d*e.speed; vy=dy/d*e.speed; } if(d<.62){ e.meleeT-=dt; if(e.meleeT<=0){ damagePlayer(t.melee); e.meleeT=.8; } } }
    /* сепарация */
    for(const o of enemies){ if(o===e||o.dead)continue; const ox=e.x-o.x,oy=e.y-o.y; const od=Math.hypot(ox,oy); if(od<e.r+o.r&&od>.001){ vx+=ox/od*.9; vy+=oy/od*.9; } }
    if(vx){ const tx=e.x+vx*dt; if(!cell(tx+Math.sign(vx)*e.r,e.y))e.x=tx; }
    if(vy){ const ty=e.y+vy*dt; if(!cell(e.x,ty+Math.sign(vy)*e.r))e.y=ty; }
  }
  /* снаряды врагов */
  for(let i=projs.length-1;i>=0;i--){ const p=projs[i]; p.t+=dt; const nx=p.x+p.vx*dt,ny=p.y+p.vy*dt; if(cell(nx,ny)){ parts.push({x:p.x,y:p.y,life:.25,color:'#FF8A8A'}); projs.splice(i,1); continue; } p.x=nx; p.y=ny; const d=Math.hypot(p.x-player.x,p.y-player.y); if(d<.42){ damagePlayer(p.dmg); projs.splice(i,1); continue; } if(p.t>4)projs.splice(i,1); }
  /* дропы */
  for(let i=drops.length-1;i>=0;i--){ const d=drops[i]; d.t+=dt; if(Math.hypot(d.x-player.x,d.y-player.y)<.55){ drops.splice(i,1); sfx.pickup(); if(d.kind==='med'){ player.hp=Math.min(100,player.hp+30); el.hull.style.width=player.hp+'%'; missionTick('meds',1); toast('🩹 Аптечка: <b>+30 HP</b>'); } else if(d.kind==='sgammo'){ gun.reserve[1]+=6; toast('🟠 Патроны к дробовику <b>+6</b>'); } else { gun.reserve[0]+=24; toast('🟡 Патроны <b>+24</b>'); } } }
}
/* ═══ РЕНДЕР ═══ */
function render(){ const w=cv.width/dpr,h=cv.height/dpr;
  const s=SECTORS[Math.min(sector,2)];
  /* потолок/пол с туманом */
  const cg=ctx.createLinearGradient(0,0,0,h*.5); cg.addColorStop(0,s.ceil); cg.addColorStop(1,'rgba(0,0,0,.9)'); ctx.fillStyle=cg; ctx.fillRect(0,0,w,h*.5);
  const fg=ctx.createLinearGradient(0,h*.5,0,h); fg.addColorStop(0,'rgba(0,0,0,.9)'); fg.addColorStop(1,s.floor); ctx.fillStyle=fg; ctx.fillRect(0,h*.5,w,h*.5);
  const shakeX=shake>0?rand(-shake,shake)*.4:0,shakeY=shake>0?rand(-shake,shake)*.3:0;
  ctx.save(); ctx.translate(shakeX,shakeY);
  /* стены: DDA на колонку */
  const nRays=Math.ceil(w/COL_W); const fov=1.05; const planeLen=Math.tan(fov/2);
  const dirX=Math.cos(player.a),dirY=Math.sin(player.a); const plX=-dirY*planeLen,plY=dirX*planeLen;
  if(zbuf.length<nRays)zbuf=new Float32Array(nRays);
  const flash=player.flash>0;
  for(let i=0;i<nRays;i++){ const cx=2*i/w-1; const rdx=dirX+plX*cx,rdy=dirY+plY*cx; const ang=Math.atan2(rdy,rdx); const ray=castRay(player.x,player.y,ang); const pd=ray.dist*Math.cos(ang-player.a); zbuf[i]=pd;
    const lh=h/pd*.9; const y0=(h-lh)/2; ctx.fillStyle=wallShade(pd,ray.side,flash);
    /* панельные швы: тёмная кромка по краю колонны */
    ctx.fillRect(i*COL_W,y0,COL_W,lh);
    if(ray.side===0){ ctx.fillStyle='rgba(0,0,0,.18)'; ctx.fillRect(i*COL_W,y0,1,lh); }
    /* горизонтальный пояс панели */
    if(pd<5){ ctx.fillStyle='rgba(0,0,0,.25)'; ctx.fillRect(i*COL_W,y0+lh*.42,COL_W,Math.max(1,lh*.02)); ctx.fillStyle='rgba(255,255,255,.05)'; ctx.fillRect(i*COL_W,y0+lh*.44,COL_W,Math.max(1,lh*.012)); } }
  /* спрайты: сортировка по дальности */
  const sprites=[]; enemies.forEach(e=>sprites.push({x:e.x,y:e.y,kind:e.type,ref:e})); projs.forEach(p=>sprites.push({x:p.x,y:p.y,kind:'proj',ref:p})); drops.forEach(d=>sprites.push({x:d.x,y:d.y,kind:d.kind,ref:d})); parts.forEach(p=>sprites.push({x:p.x,y:p.y,kind:'part',ref:p}));
  sprites.forEach(sp=>{ sp.d=(sp.x-player.x)*(sp.x-player.x)+(sp.y-player.y)*(sp.y-player.y); }); sprites.sort((a,b)=>b.d-a.d);
  const invDet=1/(plX*dirY-plY*dirX);
  for(const sp of sprites){ const rx=sp.x-player.x,ry=sp.y-player.y; const tX=invDet*(dirY*rx-plY*ry); const tY=invDet*(-dirX*ry+plX*rx); if(tY<=.1)continue; const scrX=(w/2)+(tX/tY)*(w/2)/planeLen; const size=(h/tY);
    const col0=Math.floor((scrX-size/2)/COL_W),col1=Math.ceil((scrX+size/2)/COL_W); let vis=false; for(let c=Math.max(0,col0);c<Math.min(nRays,col1);c++){ if(tY<zbuf[c]){vis=true;break;} } if(!vis)continue;
    drawSprite(sp.kind,sp.ref,scrX,h/2+shakeY*.5,size,tY); }
  ctx.restore();
  /* оружие + прицел + HUD на канве */
  drawGun(w,h); drawCrosshair(w,h); drawHudCanvas(w,h); drawMinimap(w,h);
  if(player.hurtT>0){ const g=ctx.createRadialGradient(w/2,h/2,h*.25,w/2,h/2,h*.7); g.addColorStop(0,'rgba(228,84,95,0)'); g.addColorStop(1,`rgba(228,84,95,${player.hurtT*.5})`); ctx.fillStyle=g; ctx.fillRect(0,0,w,h); } }
function drawSprite(kind,e,sx,sy,size,dist){ const s=size; ctx.save(); ctx.translate(sx,sy);
  if(kind==='drone'){ const die=e.dead?e.dt/.28:1; ctx.globalAlpha=die; const sc=e.dead?die:1; ctx.scale(sc,sc);
    ctx.shadowColor='rgba(228,84,95,.9)'; ctx.shadowBlur=14; ctx.fillStyle=e.flash>0?'#FFFFFF':'#E4545F'; ctx.beginPath(); ctx.arc(0,0,s*.13,0,TAU); ctx.fill(); ctx.shadowBlur=0; ctx.strokeStyle='rgba(255,255,255,.7)'; ctx.lineWidth=Math.max(1,s*.008); ctx.stroke();
    ctx.fillStyle='#1A0A0C'; ctx.beginPath(); ctx.arc(0,0,s*.07,0,TAU); ctx.fill();
    ctx.fillStyle='#FFFFFF'; ctx.shadowColor='#FFF'; ctx.shadowBlur=6; ctx.beginPath(); ctx.arc(-s*.04,-s*.01,s*.018,0,TAU); ctx.arc(s*.04,-s*.01,s*.018,0,TAU); ctx.fill(); ctx.shadowBlur=0; }
  else if(kind==='gunner'){ const die=e.dead?e.dt/.28:1; ctx.globalAlpha=die; ctx.scale(e.dead?die:1,e.dead?die:1);
    ctx.shadowColor='rgba(176,106,228,.9)'; ctx.shadowBlur=14; ctx.fillStyle=e.flash>0?'#FFFFFF':'#B06AE4'; ctx.beginPath(); ctx.moveTo(0,-s*.16); ctx.lineTo(s*.12,0); ctx.lineTo(0,s*.16); ctx.lineTo(-s*.12,0); ctx.closePath(); ctx.fill(); ctx.shadowBlur=0; ctx.strokeStyle='rgba(255,255,255,.75)'; ctx.lineWidth=Math.max(1,s*.008); ctx.stroke();
    ctx.fillStyle='#7EC8E3'; ctx.shadowColor='#7EC8E3'; ctx.shadowBlur=8; ctx.fillRect(-s*.07,-s*.02,s*.14,s*.035); ctx.shadowBlur=0; }
  else if(kind==='boss'){ const die=e.dead?e.dt/.28:1; ctx.globalAlpha=die; ctx.scale(e.dead?die:1,e.dead?die:1);
    ctx.shadowColor='rgba(232,176,75,.95)'; ctx.shadowBlur=22; ctx.fillStyle=e.flash>0?'#FFFFFF':'#E8B04B'; ctx.beginPath(); for(let k=0;k<8;k++){ const a=k/8*TAU+Math.PI/8; const rr=s*(k%2?0.22:0.27); const px=Math.cos(a)*rr,py=Math.sin(a)*rr-s*.02; k===0?ctx.moveTo(px,py):ctx.lineTo(px,py); } ctx.closePath(); ctx.fill(); ctx.shadowBlur=0; ctx.strokeStyle='rgba(255,255,255,.8)'; ctx.lineWidth=Math.max(1.5,s*.012); ctx.stroke();
    ctx.fillStyle='#14100B'; ctx.beginPath(); ctx.arc(-s*.07,-s*.03,s*.045,0,TAU); ctx.arc(s*.07,-s*.03,s*.045,0,TAU); ctx.fill(); ctx.fillStyle='#E4545F'; ctx.shadowColor='#E4545F'; ctx.shadowBlur=10; ctx.beginPath(); ctx.arc(-s*.07,-s*.03,s*.02,0,TAU); ctx.arc(s*.07,-s*.03,s*.02,0,TAU); ctx.fill(); ctx.shadowBlur=0;
    /* hp бар босса */
    ctx.fillStyle='rgba(0,0,0,.6)'; ctx.fillRect(-s*.24,-s*.32,s*.48,s*.035); ctx.fillStyle='#E4545F'; ctx.fillRect(-s*.24,-s*.32,s*.48*clamp(e.hp/e.maxHp,0,1),s*.035); }
  else if(kind==='proj'){ ctx.shadowColor='rgba(255,120,120,.95)'; ctx.shadowBlur=12; ctx.fillStyle='#FF8A8A'; ctx.beginPath(); ctx.arc(0,0,Math.max(2,s*.035),0,TAU); ctx.fill(); ctx.shadowBlur=0; ctx.fillStyle='#FFF'; ctx.beginPath(); ctx.arc(0,0,Math.max(1,s*.015),0,TAU); ctx.fill(); }
  else if(kind==='med'||kind==='ammo'||kind==='sgammo'){ const bob=Math.sin(e.t*4)*size*.02; ctx.translate(0,bob); const col=kind==='med'?'#8B9D83':'#D4A574'; ctx.shadowColor=col; ctx.shadowBlur=12; ctx.fillStyle=col; ctx.beginPath(); ctx.roundRect(-s*.07,-s*.05,s*.14,s*.1,s*.015); ctx.fill(); ctx.shadowBlur=0; ctx.strokeStyle='rgba(255,255,255,.8)'; ctx.lineWidth=Math.max(1,s*.006); ctx.stroke(); ctx.fillStyle='#0A0A0F'; if(kind==='med'){ ctx.fillRect(-s*.012,-s*.03,s*.024,s*.06); ctx.fillRect(-s*.03,-s*.012,s*.06,s*.024); } else { ctx.font=`700 ${Math.max(6,s*.05)}px Inter,sans-serif`; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText(kind==='sgammo'?'Д':'П',0,0); } }
  else if(kind==='part'){ ctx.globalAlpha=clamp(e.life*4,0,1); ctx.fillStyle=e.color; ctx.beginPath(); ctx.arc(0,0,Math.max(1.2,s*.02),0,TAU); ctx.fill(); }
  ctx.restore(); ctx.globalAlpha=1; }
function drawGun(w,h){ const wIdx=player.weapon; const bobA=player.moving?Math.sin(player.bob*10)*6:Math.sin(player.bob*2.4)*2; const kick=player.kick; const swp=player.swapT>0?player.swapT/.4:0; const rel=player.reload>0?(1-player.reload/player.reloadMax):0;
  ctx.save(); ctx.translate(w/2+bobA*.5,h+26+kick+swp*90-rel*26); ctx.rotate(bobA*.004-kick*.006);
  if(wIdx===0){ /* пистолет */ ctx.fillStyle='#1C1C26'; ctx.beginPath(); ctx.roundRect(-13,-64,26,70,5); ctx.fill(); ctx.fillStyle='#2A2A38'; ctx.beginPath(); ctx.roundRect(-9,-86,18,30,4); ctx.fill(); ctx.fillStyle='#D4A574'; ctx.fillRect(-2,-80,4,18); ctx.fillStyle='rgba(255,255,255,.12)'; ctx.fillRect(-9,-86,18,4); }
  else { /* дробовик */ ctx.fillStyle='#1C1C26'; ctx.beginPath(); ctx.roundRect(-22,-60,44,66,6); ctx.fill(); ctx.fillStyle='#2E2E3C'; ctx.beginPath(); ctx.roundRect(-16,-98,13,44,4); ctx.fill(); ctx.beginPath(); ctx.roundRect(3,-98,13,44,4); ctx.fill(); ctx.fillStyle='#D4A574'; ctx.fillRect(-16,-98,13,3); ctx.fillRect(3,-98,13,3); ctx.fillStyle='rgba(228,84,95,.85)'; ctx.fillRect(-22,-30,44,3); }
  ctx.restore();
  if(player.flash>0){ ctx.save(); ctx.translate(w/2,h-92+kick*2); ctx.fillStyle='rgba(255,224,160,.9)'; ctx.shadowColor='rgba(255,200,90,.95)'; ctx.shadowBlur=26; ctx.beginPath(); const fr=10+player.flash*160; for(let k=0;k<6;k++){ const a=k/6*TAU+.5; const rr=k%2?fr*.5:fr; ctx.lineTo(Math.cos(a)*rr,Math.sin(a)*rr-.5); } ctx.closePath(); ctx.fill(); ctx.restore(); } }
function drawCrosshair(w,h){ const cx=w/2,cy=h/2; const spread=4+(player.kick*1.2)+(player.moving?3:0); ctx.strokeStyle=aimT>0?'#D4A574':'rgba(255,255,255,.85)'; ctx.lineWidth=2; ctx.beginPath(); ctx.arc(cx,cy,2,0,TAU); ctx.stroke(); ctx.beginPath(); [[0,-1],[0,1],[-1,0],[1,0]].forEach(v=>{ ctx.moveTo(cx+v[0]*spread,cy+v[1]*spread); ctx.lineTo(cx+v[0]*(spread+6),cy+v[1]*(spread+6)); }); ctx.stroke(); }
function drawHudCanvas(w,h){ const wIdx=player.weapon; const mag=gun.mag[wIdx],res=gun.reserve[wIdx]; const txt=`${wIdx===0?'ПИСТОЛЕТ':'ДРОБОВИК'}  ${mag}/${res}`; ctx.font='700 13px Inter,sans-serif'; ctx.textAlign='center'; const low=mag===0; ctx.fillStyle='rgba(10,10,15,.65)'; const tw=ctx.measureText(txt).width+22; ctx.beginPath(); ctx.roundRect(w/2-tw/2,h-40,tw,24,8); ctx.fill(); ctx.fillStyle=low?'#E4545F':'#FFD9A8'; ctx.fillText(txt,w/2,h-23);
  if(player.reload>0){ ctx.fillStyle='#D4A574'; ctx.font='600 11px Inter,sans-serif'; ctx.fillText('ПЕРЕЗАРЯДКА',w/2,h-48); }
  /* прогресс волны */
  const total=spawnQueue.length+enemies.filter(e=>!e.dead).length; if(waveState==='run'&&total>0){ ctx.fillStyle='rgba(255,255,255,.75)'; ctx.font='600 10px Inter,sans-serif'; ctx.textAlign='right'; ctx.fillText('ВРАГОВ: '+total,w-8,16); } }
function drawMinimap(w,h){ const ms=68,mx=w-ms-8,my=8,scl=ms/Math.max(MW,MH); ctx.save(); ctx.globalAlpha=.88; ctx.fillStyle='rgba(8,8,12,.8)'; ctx.beginPath(); ctx.roundRect(mx-4,my-4,ms+8,ms+8,6); ctx.fill(); ctx.strokeStyle='rgba(255,255,255,.15)'; ctx.stroke();
  for(let y=0;y<MH;y++)for(let x=0;x<MW;x++){ ctx.fillStyle=MAP[y][x]?'#3A3A4A':'#14141E'; ctx.fillRect(mx+x*scl,my+y*scl,scl,scl); }
  enemies.forEach(e=>{ if(e.dead)return; ctx.fillStyle=e.type==='boss'?'#E8B04B':'#E4545F'; ctx.beginPath(); ctx.arc(mx+e.x*scl,my+e.y*scl,e.type==='boss'?3:2,0,TAU); ctx.fill(); });
  drops.forEach(d=>{ ctx.fillStyle=d.kind==='med'?'#8B9D83':'#D4A574'; ctx.fillRect(mx+d.x*scl-1,my+d.y*scl-1,2,2); });
  ctx.translate(mx+player.x*scl,my+player.y*scl); ctx.rotate(player.a); ctx.fillStyle='#D4A574'; ctx.beginPath(); ctx.moveTo(5,0); ctx.lineTo(-3,-3.4); ctx.lineTo(-3,3.4); ctx.closePath(); ctx.fill(); ctx.restore(); }
/* ─── Цикл ─── */
let last=0,acc=0,rafId=0; const STEP=1/60;
function loop(ts){ rafId=requestAnimationFrame(loop); if(!running)return; if(!last)last=ts; let dtms=ts-last; last=ts; if(dtms>200)dtms=200; acc+=dtms; let guard=0; while(acc>=STEP*1000&&guard++<6){ handleInput(STEP); update(STEP); acc-=STEP*1000; } el.score.textContent=fmt(score); render(); }
/* ─── Ввод ─── */
let firing=false;
const keys={};
window.addEventListener('keydown',e=>{ keys[e.key.toLowerCase()]=true; if(['arrowleft','arrowright','arrowup','arrowdown',' '].includes(e.key.toLowerCase()))e.preventDefault(); if(e.key.toLowerCase()==='r')startReload(); if(e.key==='1')swapTo(0); if(e.key==='2')swapTo(1); });
window.addEventListener('keyup',e=>{ keys[e.key.toLowerCase()]=false; });
function swapTo(i){ if(player.weapon!==i)swapWeapon(); }
function handleInput(dt){
  /* клавиатура */
  const sp=2.6*dt,rot=2.4*dt; let moved=0;
  if(keys['w']||keys['arrowup']){ tryMove(Math.cos(player.a)*sp,Math.sin(player.a)*sp); moved=1; }
  if(keys['s']||keys['arrowdown']){ tryMove(-Math.cos(player.a)*sp*.8,-Math.sin(player.a)*sp*.8); moved=1; }
  if(keys['a']){ tryMove(Math.cos(player.a-Math.PI/2)*sp*.8,Math.sin(player.a-Math.PI/2)*sp*.8); moved=1; }
  if(keys['d']){ tryMove(Math.cos(player.a+Math.PI/2)*sp*.8,Math.sin(player.a+Math.PI/2)*sp*.8); moved=1; }
  if(keys['arrowleft'])player.a-=rot; if(keys['arrowright'])player.a+=rot;
  /* стик */
  if(stick.active){ const vx=stick.dx,vy=stick.dy; const mag=Math.hypot(vx,vy); if(mag>.15){ const nx=vx/mag*Math.min(mag/40,1)*sp*1.15,ny=vy/mag*Math.min(mag/40,1)*sp*1.15; tryMove(Math.cos(player.a)*ny+Math.cos(player.a+Math.PI/2)*nx,Math.sin(player.a)*ny+Math.sin(player.a+Math.PI/2)*nx); moved=1; } }
  player.moving=moved; if(moved)player.bob+=dt*1.6;
}
/* стик */
const stick={active:false,dx:0,dy:0};
(function initStick(){ const st=$('stick'),knob=$('stick-knob'); function upd(e){ const r=st.getBoundingClientRect(); const cx=r.left+r.width/2,cy=r.top+r.height/2; let dx=e.clientX-cx,dy=e.clientY-cy; const mag=Math.hypot(dx,dy); if(mag>34){ dx=dx/mag*34; dy=dy/mag*34; } stick.dx=dx; stick.dy=dy; knob.style.transform=`translate(calc(-50% + ${dx}px),calc(-50% + ${dy}px))`; } st.addEventListener('pointerdown',e=>{ stick.active=true; st.classList.add('active'); st.setPointerCapture(e.pointerId); upd(e); audioInit(); }); st.addEventListener('pointermove',e=>{ if(stick.active)upd(e); }); function end(){ stick.active=false; stick.dx=stick.dy=0; st.classList.remove('active'); knob.style.transform='translate(-50%,-50%)'; } st.addEventListener('pointerup',end); st.addEventListener('pointercancel',end); })();
/* обзор свайпом + тап-огонь */
(function initLook(){ let down=false,lx=0,ly=0,moved=0,t0=0; cv.addEventListener('pointerdown',e=>{ down=true; moved=0; lx=e.clientX; ly=e.clientY; t0=performance.now(); audioInit(); }); cv.addEventListener('pointermove',e=>{ if(!down)return; const dx=e.clientX-lx,dy=e.clientY-ly; moved+=Math.abs(dx)+Math.abs(dy); player.a+=dx*.0042; lx=e.clientX; ly=e.clientY; }); window.addEventListener('pointerup',e=>{ if(!down)return; down=false; if(performance.now()-t0<260&&moved<12)tryShoot(); }); })();
/* кнопки управления */
(function initCtl(){ const f=$('fire-btn'); f.addEventListener('pointerdown',e=>{ e.preventDefault(); firing=true; f.classList.add('firing'); audioInit(); }); const off=()=>{ firing=false; f.classList.remove('firing'); }; f.addEventListener('pointerup',off); f.addEventListener('pointercancel',off); f.addEventListener('pointerleave',off);
  $('swap-btn').addEventListener('click',()=>{ audioInit(); swapWeapon(); });
  $('reload-btn').addEventListener('click',()=>{ audioInit(); startReload(); }); })();
/* ─── Поток ─── */
function resetGame(){ score=0;wave=0;sector=0;kills=0;combo=0;comboT=0; enemies=[];projs=[];drops=[];parts=[];spawnQueue=[]; waveState='idle'; shake=0; Object.assign(player,{x:1.5,y:5.5,a:0,hp:100,weapon:0,bob:0,kick:0,flash:0,hurtT:0,reload:0,swapT:0,moving:0}); gun.mag=[12,6]; gun.reserve=[96,14]; gun.cool=[0,0]; el.hull.style.width='100%'; el.score.textContent='0'; el.wave.textContent='1'; }
function startGame(){ touchStreak(); if(mode==='daily')dailyRng=mulberry32(xmur3('fps3d-'+today)()); else dailyRng=Math.random; resetGame(); running=true; over=false; last=0; acc=0; $('welcome').classList.add('hidden'); $('modal').classList.add('hidden'); $('game').classList.remove('hidden'); fitCanvas(); refreshHud(); startWave(1); if(!rafId)rafId=requestAnimationFrame(loop); }
function refreshHud(){ el.daily.textContent=fmt(dailyBest); el.best.textContent=fmt(best); el.streakN.textContent=effStreak(); el.multN.textContent='×'+mult.toFixed(2); refreshMissionsUI(); }
function refreshWelcome(){ el.wDaily.textContent=fmt(dailyBest); el.wBest.textContent=fmt(best); el.wStreak.textContent='🔥 '+effStreak(); $('daily-date').textContent='Вызов дня · '+today.slice(5).replace('-','.'); }
function gameOver(){ over=true; running=false; sfx.over(); missionTick('score',Math.floor(score),true); let isRec=false,isRecDay=false; if(score>best){ best=Math.floor(score); lsSet(K_BEST,best); isRec=true; } if(score>dailyBest){ dailyBest=Math.floor(score); lsSet(K_DAILY,dailyBest); isRecDay=true; } setTimeout(()=>{ $('modal-badge').textContent=isRec||isRecDay?'Новый рекорд':'Игра окончена'; $('modal-badge').classList.toggle('record',isRec||isRecDay); $('modal-title').textContent=isRecDay&&!isRec?'Рекорд дня!':(isRec?'Абсолютный рекорд!':'Бойца вынесли'); $('modal-score').innerHTML=`Очки <b>${fmt(score)}</b> · Волна <b>${wave}</b> · Убийств <b>${kills}</b><br>Рекорд <b>${fmt(best)}</b> · за день <b>${fmt(dailyBest)}</b>`; $('modal').classList.remove('hidden'); },900); }
function toMenu(){ running=false; over=false; $('game').classList.add('hidden'); $('modal').classList.add('hidden'); $('welcome').classList.remove('hidden'); refreshWelcome(); }
$('btn-play').addEventListener('click',()=>{ audioInit(); startGame(); });
$('mode-daily').addEventListener('click',()=>{ mode='daily'; $('mode-daily').classList.add('active'); $('mode-free').classList.remove('active'); });
$('mode-free').addEventListener('click',()=>{ mode='free'; $('mode-free').classList.add('active'); $('mode-daily').classList.remove('active'); });
$('btn-restart').addEventListener('click',()=>{ audioInit(); startGame(); });
$('btn-menu').addEventListener('click',toMenu);
$('modal-btn').addEventListener('click',()=>{ audioInit(); startGame(); });
$('modal-btn2').addEventListener('click',toMenu);
$('btn-missions').addEventListener('click',()=>{ renderMissionsModal(); $('mmodal').classList.remove('hidden'); });
$('missions-chip').addEventListener('click',()=>{ renderMissionsModal(); $('mmodal').classList.remove('hidden'); });
$('mmodal-btn').addEventListener('click',()=>$('mmodal').classList.add('hidden'));
function syncSoundBtn(){ $('btn-sound').textContent=muted?'🔇':'🔊'; }
$('btn-sound').addEventListener('click',()=>{ muted=!muted; lsSet(K_MUTE,muted); if(master)master.gain.value=muted?0:0.5; syncSoundBtn(); if(!muted){ audioInit(); sfx.pickup(); } });
window.addEventListener('resize',()=>{ if(running)fitCanvas(); });
refreshWelcome(); refreshHud(); syncSoundBtn();
/* ─── Debug-хук ─── */
window.__f3={
  start:startGame, over:()=>{ running=true; gameOver(); },
  state(){ return {score:Math.floor(score),wave,enemies:enemies.filter(e=>!e.dead).length,hp:player.hp,weapon:player.weapon,mag:gun.mag[player.weapon],reserve:gun.reserve[player.weapon],sector,running,over,mode}; },
  addScore:n=>{ score+=n; }, killAll:()=>{ [...enemies].forEach(e=>{ if(!e.dead)killEnemy(e,enemies.indexOf(e)); }); },
  spawn:t=>spawnEnemy(t||'drone'), hurt:()=>damagePlayer(20), drop:k=>drops.push({x:player.x+Math.cos(player.a)*.8,y:player.y+Math.sin(player.a)*.8,kind:k||'med',t:0}),
  wave:n=>startWave(n), reload:startReload, swap:swapWeapon, missions:()=>missionData, records:()=>({best:lsGet(K_BEST,0),daily:lsGet(K_DAILY,0),streak:lsGet(K_STREAK,0),today}), aim:()=>{ let bd=1e9,bx=0,by=0; enemies.forEach(e=>{ if(e.dead)return; const d=Math.hypot(e.x-player.x,e.y-player.y); if(d<bd){bd=d;bx=e.x;by=e.y;} }); if(bd<1e9){ player.a=Math.atan2(by-player.y,bx-player.x); return Math.round(bd*10)/10; } return -1; }
};
