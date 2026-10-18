'use strict';
/* ═══════════════ РУИНЫ v2.0 · платформер · AXIIOM canon ═══════════════ */
const $=id=>document.getElementById(id);
const clamp=(v,a,b)=>v<a?a:v>b?b:v;
const rand=(a,b)=>a+Math.random()*(b-a);
const TAU=Math.PI*2;
function lsGet(k,d){try{const v=localStorage.getItem(k);return v===null?d:JSON.parse(v);}catch(e){return d;}}
function lsSet(k,v){try{localStorage.setItem(k,JSON.stringify(v));}catch(e){}}
const fmt=n=>Math.floor(n).toLocaleString('ru-RU');
const now=new Date();
const today=new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Moscow'}).format(now);
const yDate=new Date(now.getTime()-86400000);
const yesterday=new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Moscow'}).format(yDate);
/* ─── Аудио ─── */
let AC=null,master=null;
function audioInit(){ if(AC)return; try{ AC=new (window.AudioContext||window.webkitAudioContext)(); master=AC.createGain(); master.gain.value=muted?0:0.5; master.connect(AC.destination);}catch(e){} }
function tone(freq,dur,type,vol,slide,delay){ if(!AC||muted)return; const t0=AC.currentTime+(delay||0); const o=AC.createOscillator(),g=AC.createGain(); o.type=type||'square'; o.frequency.setValueAtTime(freq,t0); if(slide)o.frequency.exponentialRampToValueAtTime(Math.max(30,freq+slide),t0+dur); g.gain.setValueAtTime(vol||.15,t0); g.gain.exponentialRampToValueAtTime(.001,t0+dur); o.connect(g);g.connect(master); o.start(t0);o.stop(t0+dur+.02); }
const sfx={
  jump(){ tone(300,.12,'square',.09,240); },
  land(){ tone(140,.06,'sine',.08,-40); },
  coin(c){ const p=1+Math.min(c,12)*.03; tone(990*p,.08,'triangle',.12); tone(1480*p,.1,'triangle',.09,0,.05); },
  stomp(){ tone(200,.1,'square',.14,-80); },
  hurt(){ tone(220,.2,'sawtooth',.16,-100); },
  key(){ [660,880,1100].forEach((f,i)=>tone(f,.1,'triangle',.13,0,i*.06)); },
  door(){ [523,659,784,1046].forEach((f,i)=>tone(f,.14,'triangle',.14,0,i*.08)); },
  death(){ tone(300,.35,'sawtooth',.2,-220); },
  click(){ tone(700,.05,'square',.07); },
};
/* ─── Хранилище/мета ─── */
const K_BEST='pf.best',K_DAILY='pf.daily.'+today,K_STREAK='pf.streak',K_LASTDAY='pf.lastDay',K_MUTE='pf.muted',K_MISS='pf.missions.'+today;
const el={ score:$('score-val'),daily:$('daily-val'),best:$('best-val'),level:$('level-val'),coins:$('coins-n'),hearts:$('hearts-n'),streakN:$('streak-n'),multN:$('mult-n'),missionsN:$('missions-n'),wDaily:$('w-daily-best'),wBest:$('w-best'),wStreak:$('w-streak'),gc:$('gc') };
const W=400,H=580,STEP=1/60,TS=32;
const cv=el.gc,ctx=cv.getContext('2d');
let dpr=1;
function fitCanvas(){ dpr=Math.min(window.devicePixelRatio||1,2); cv.width=W*dpr; cv.height=H*dpr; cv.style.width=W+'px'; cv.style.height=H+'px'; ctx.setTransform(dpr,0,0,dpr,0,0); }
fitCanvas(); window.addEventListener('resize',fitCanvas);
/* ─── Уровни: 32×14, # стена . пусто o монета ^ шип K ключ D дверь s слизень P старт M платформа ─── */
const LEVELS=[
["################################","#..............................#","#..o.o.........................#","#......####......####.....o....#","#..............................#","#...P..........s...........o...#","#..#####........................#","#..............#####....####...#","#..o........o...................#","#.......####..........s....K..D#","#...........................####","#..s....o....####..o...........#","#..............................#","################################"],
["################################","#..............................#","#...P....o...o....o.....o......#","#..#####.......####...####.....#","#...........................o..#","#..........s...................#","#...o..........................#","#....####....o.....####........#","#..............................#","#.s......o.......o......K...D..#","#...####......####....####.####","#........o.....................#","#..............................#","################################"],
["################################","#..............................#","#..P...o....^^....o....^^......#","#.####......................o..#","#..........####................#","#...................s..........#","#..o....s..............####....#","#.####......o.o................#","#..........####....o.......^^..#","#...o...............o.....####.#","#.......K..o....o..............#","#..####...####..####...o....D..#","#..........................####","################################"],
["################################","#.....o.....o.....o............#","#..P...........................#","#.####...####...####...####....#","#.....................s.......o#","#.......s......................#","#..o...................o.......#","#......####....K...####........#","#............................o.#","#..s.......####....s......####.#","#..o................o.........##","#.####..o........o..o....o...D.#","#...........................####","################################"],
["################################","#..............................#","#..P......o....o.....o.........#","#.####..........................#","#.........M..........M.........#","#........####......####........#","#..o....................o..o...#","#....................s.........#","#.....s..........o.......o.....#","#..####....####....####....K.D.#","#..........................####","#..o....o....o....o....o.......#","#..............................#","################################"],
["################################","#..............................#","#..P...o....s.....o....s....o..#","#.####..####...####...####.....#","#..........................o...#","#....o.....................####.#","#.......^^.......^^............#","#..o........................o..#","#.####....o....o....o....o.....#","#........####..####...####..K.D#","#..s..........................##","#..o....o......o......o....o...#","#...........................####","################################"],
["################################","#...o.....o.....o.....o........#","#..............................#","#..P...####..M....####...M.....#","#..........................o...#","#......s.........s.............#","#..o....................o..o...#","#.####......####....####.......#","#..................o.......o...#","#...o...^^.....o....s.....K.D..#","#..####....####....####...####.#","#..............................#","#..o.....o......o.....o........#","################################"],
["################################","#..............................#","#..P..o.....K....o....o...o....#","#.####..####...####...####.....#","#.......................o......#","#....s......^^...........s.....#","#..o................o..........#","#....####....o....####.........#","#.o........................o...#","#...o...M.....M......o.....K.D#","#..####..####...####..####.####","#..............................#","#..o....s......o....s.....o....#","################################"],
["################################","#...o....o....o....o....o......#","#..............................#","#..P....####....s....####......#","#.........................o....#","#....o.......^^.....o..........#","#..####....................####.#","#..........................o...#","#....M....o.....M.....o........#","#........####.......####...K.D#","#..o.......................####","#.s....o....o....s....o........#","#..............................#","################################"],
["################################","#..o...o....o....o....o....o..#","#..............................#","#..P.....s......s......s.......#","#.####.####...####...####......#","#......................o...o...#","#...^^.......^^.......^^.......#","#.o........................o...#","#....####..o....####..o........#","#.o............................#","#...M....M....M....M....K..D..#","#.####..####..####..####..####.#","#..............................#","################################"],
["################################","#.....o....o.....o....o........#","#..............................#","#..P...s....^^.....s.....o.....#","#.####..............o....o.....#","#......o..####..M..............#","#..o......................o....#","#.####....s......s....####.....#","#.................o........o...#","#..o...o....o....o...o....K.D..#","#.####..####..####..####..####.#","#..............................#","#...^^.....^^......^^..........#","################################"],
["################################","#..o...s....o...s....o...s.....#","#..............................#","#..P....####....####....####...#","#..........................o...#","#...o......^^.......^^.....o...#","#.####........M................#","#...................o......o...#","#..o...o...s.....o....s....o...#","#....####...####...####...K.D.#","#.o........................####","#..o...o....o....o....o...o....#","#..............................#","################################"],
];
/* ─── Состояние ─── */
let muted=lsGet(K_MUTE,false),mode='daily';
let running=false,over=false;
let score=0,mult=1,best=lsGet(K_BEST,0),dailyBest=lsGet(K_DAILY,0);
let streak=lsGet(K_STREAK,0),lastDay=lsGet(K_LASTDAY,'');
let mult2=0;
let level=1,grid=[],coins=[],slimes=[],spikes=[],movers=[],door=null,keyObj=null,start={x:64,y:64};
let hero,hearts=3,camX=0,tGlobal=0,deaths=0,levelCoins=0,levelDeaths=0,hasKey=false,inv=0;
let parts=[],texts=[];
const keys={};
/* ─── Мета ─── */
function effStreak(){ return (lastDay===today||lastDay===yesterday)?streak:0; }
function getMult(s){ return 1+Math.min(Math.max(s-1,0),10)*0.05; }
function touchStreak(){ if(lastDay===today){ mult=getMult(streak); return; } streak=(lastDay===yesterday)?(streak||0)+1:1; lastDay=today; lsSet(K_STREAK,streak); lsSet(K_LASTDAY,lastDay); mult=getMult(streak); if(streak>1)toast(`🔥 Стрик <b>${streak}</b> · очки ×<b>${mult.toFixed(2)}</b>`); }
const MISSIONS=[
  {id:'coins50',  name:'Собрать 50 монет',           target:50, track:'coins'},
  {id:'slime10',  name:'Победить 10 слизней',        target:10, track:'slimes'},
  {id:'levels6',  name:'Пройти 6 уровней',           target:6,  track:'levels'},
  {id:'stars15',  name:'Собрать 15 звёзд',           target:15, track:'stars'},
  {id:'keys8',    name:'Найти 8 ключей',             target:8,  track:'keys'},
  {id:'clean2',   name:'2 уровня без смертей',       target:2,  track:'clean'},
  {id:'score2k',  name:'Набрать 2000 очков за игру', target:2000,track:'score'},
  {id:'fast1',    name:'Уровень быстрее 30 секунд',  target:1,  track:'fast'},
];
let missionData=lsGet(K_MISS,{p:{},done:{}});
if(!missionData.p)missionData={p:{},done:{}};
function saveMissions(){ lsSet(K_MISS,missionData); }
function missionAward(mid){ if(missionData.done[mid])return; missionData.done[mid]=1; saveMissions(); const bonus=Math.round(25*mult); if(running&&!over){ score+=bonus; } toast(`🎯 Миссия выполнена: <b>+${bonus}</b>`); sfx.door(); refreshMissionsUI(); }
function missionTick(track,val,absolute){ MISSIONS.forEach(m=>{ if(m.track!==track||missionData.done[m.id])return; if(absolute){ if(val>(missionData.p[m.id]||0))missionData.p[m.id]=val; } else missionData.p[m.id]=(missionData.p[m.id]||0)+val; if(missionData.p[m.id]>=m.target)missionAward(m.id); }); saveMissions(); refreshMissionsUI(); }
function refreshMissionsUI(){ const done=MISSIONS.filter(m=>missionData.done[m.id]).length; el.missionsN.textContent=done+'/3'; }
function renderMissionsModal(){ const list=$('mmodal-list'); list.innerHTML=''; MISSIONS.forEach(m=>{ const p=Math.min(missionData.p[m.id]||0,m.target); const done=!!missionData.done[m.id]; const d=document.createElement('div'); d.className='mm-item'+(done?' done':''); d.innerHTML=`<span class="mm-check">✓</span><span class="mm-body"><span class="mm-name">${m.name}</span><span class="mm-prog"><b>${fmt(p)}</b> / ${fmt(m.target)}</span></span>`; list.appendChild(d); }); }
function toast(html){ const t=document.createElement('span'); t.className='toast'; t.innerHTML=html; $('toasts').appendChild(t); setTimeout(()=>t.classList.add('out'),2600); setTimeout(()=>t.remove(),3000); }
function announce(big,sub){ const a=document.getElementById('announce'); a.innerHTML=`<span class="an-big">${big}</span>${sub?`<span class="an-sub">${sub}</span>`:''}`; a.classList.remove('hidden'); clearTimeout(annT); annT=setTimeout(()=>a.classList.add('hidden'),1600); }
function floatTxt(x,y,txt,color,size){ texts.push({x,y,txt,color,size:size||13,life:1,maxLife:1}); }
function part(x,y,vx,vy,life,color,size){ parts.push({x,y,vx,vy,life,maxLife:life,color,size}); }
/* ─── Загрузка уровня ─── */
function loadLevel(n){ level=Math.min(n,LEVELS.length); const rows=LEVELS[level-1]; grid=[];coins=[];slimes=[];spikes=[];movers=[];door=null;keyObj=null;hasKey=false;levelCoins=0;levelDeaths=0; levelT=0;
  rows.forEach((row,y)=>{ const arr=[]; for(let x=0;x<row.length;x++){ const ch=row[x]; arr.push(ch==='#'?1:0);
    const px=x*TS+TS/2,py=y*TS+TS/2;
    if(ch==='o')coins.push({x:px,y:py,t:Math.random()*TAU,got:false});
    if(ch==='^')spikes.push({x:x*TS,y:y*TS});
    if(ch==='K')keyObj={x:px,y:py,t:0,got:false};
    if(ch==='D')door={x:x*TS,y:y*TS,open:false};
    if(ch==='s')slimes.push({x:px,y:py-8,vx:34,dead:0,t:Math.random()*TAU});
    if(ch==='M')movers.push({x0:x*TS-64,x1:x*TS+64,x:x*TS,y:y*TS,vx:46,w:3*TS});
    if(ch==='P')start={x:px,y:py-6}; } grid.push(arr); });
  hero={x:start.x,y:start.y,vx:0,vy:0,w:20,h:24,ground:false,coyote:0,buffer:0,face:1,sx:1,sy:1,jumps:0};
  el.level.textContent=level; el.coins.textContent=levelCoins; updateHearts(); announce('УРОВЕНЬ '+level+(level===LEVELS.length?' · финал':''),coins.length+' монет'); }
let levelT=0;
function updateHearts(){ el.hearts.textContent=hearts; }
/* ─── Физика ─── */
function solid(px,py){ const tx=Math.floor(px/TS),ty=Math.floor(py/TS); if(ty<0||ty>=grid.length||tx<0||tx>=grid[0].length)return true; return grid[ty][tx]===1; }
function rectHits(x,y,w,h){ return solid(x-w/2,y-h/2)||solid(x+w/2,y-h/2)||solid(x-w/2,y+h/2)||solid(x+w/2,y+h/2)||solid(x,y-h/2)||solid(x,y+h/2)||solid(x-w/2,y)||solid(x+w/2,y); }
function die(){ if(inv>0)return; deaths++; levelDeaths++; hearts--; updateHearts(); sfx.death(); inv=1.2; part(hero.x,hero.y,0,0,.3,'#E4545F',6);
  if(hearts<=0){ gameOver(); return; } hero.x=start.x; hero.y=start.y; hero.vx=hero.vy=0; hasKey=false; if(keyObj)keyObj.got=false; toast('💀 Возвращение к старту · ключ потерян'); }
function update(dt){ tGlobal+=dt; levelT+=dt;
  if(over)return;
  if(inv>0)inv-=dt;
  /* ввод */
  const L=keys.ArrowLeft||keys.a||btn.left, R=keys.ArrowRight||keys.d||btn.right;
  const acc=hero.ground?1500:1100, maxV=210;
  if(L){ hero.vx=Math.max(hero.vx-acc*dt,-maxV); hero.face=-1; }
  else if(R){ hero.vx=Math.min(hero.vx+acc*dt,maxV); hero.face=1; }
  else hero.vx*=Math.pow(hero.ground?.0001:.3,dt);
  /* coyote + buffer */
  hero.coyote-=dt; hero.buffer-=dt;
  const J=keys[' ']||keys.ArrowUp||keys.w||btn.jump;
  if(J&&!hero.jHeld){ hero.buffer=.12; hero.jHeld=true; } if(!J)hero.jHeld=false;
  if(hero.buffer>0&&hero.coyote>0){ hero.vy=-540; hero.buffer=0; hero.coyote=0; hero.ground=false; hero.sx=1.25; hero.sy=.75; sfx.jump(); part(hero.x,hero.y+12,0,20,.3,'rgba(200,200,210,.5)',2.4); }
  hero.vy=Math.min(hero.vy+1500*dt,640);
  /* движение с коллизией по осям */
  let nx=hero.x+hero.vx*dt; if(!rectHits(nx,hero.y,hero.w,hero.h))hero.x=nx; else { /* шаг по стенке */ hero.vx=0; }
  let ny=hero.y+hero.vy*dt;
  if(!rectHits(hero.x,ny,hero.w,hero.h)){ hero.y=ny; if(hero.vy>0)hero.ground=false; }
  else { if(hero.vy>0){ if(!hero.ground){ sfx.land(); hero.sx=1.35; hero.sy=.68; part(hero.x,hero.y+12,rand(-20,20),-30,.3,'rgba(200,200,210,.5)',2.2); } hero.ground=true; hero.coyote=.09; } hero.vy=0; }
  hero.sx+=(1-hero.sx)*Math.min(1,dt*10); hero.sy+=(1-hero.sy)*Math.min(1,dt*10);
  /* движущиеся платформы */
  movers.forEach(m=>{ m.x+=m.vx*dt; if(m.x<m.x0||m.x>m.x1)m.vx*=-1; const top=m.y-TS/2; if(hero.vy>=0&&Math.abs(hero.x-m.x)<m.w/2+10&&hero.y+hero.h/2>=top-2&&hero.y+hero.h/2<=top+12){ hero.y=top-hero.h/2; hero.vy=0; if(!hero.ground){ hero.ground=true; hero.coyote=.09; } hero.x+=m.vx*dt; } });
  /* монеты */
  coins.forEach(c=>{ if(c.got)return; c.t+=dt; if(Math.hypot(c.x-hero.x,c.y-hero.y)<20){ c.got=true; levelCoins++; const pts=Math.round(10*mult); score+=pts; el.coins.textContent=levelCoins; el.score.textContent=fmt(score); sfx.coin(levelCoins); missionTick('coins',1); floatTxt(c.x,c.y-14,'+'+pts,'#FFD9A8',12); for(let i=0;i<6;i++)part(c.x,c.y,rand(-60,60),rand(-90,-20),.4,'#FFD9A8',2); } });
  /* ключ */
  if(keyObj&&!keyObj.got){ keyObj.t+=dt; if(Math.hypot(keyObj.x-hero.x,keyObj.y-hero.y)<22){ keyObj.got=true; hasKey=true; sfx.key(); floatTxt(keyObj.x,keyObj.y-16,'КЛЮЧ!','#B06AE4',14); if(door){ door.open=true; } missionTick('keys',1); } }
  /* дверь */
  if(door&&Math.hypot(door.x-hero.x,door.y-hero.y)<26&&hasKey){ levelComplete(); return; }
  /* слизни */
  slimes.forEach(s=>{ if(s.dead>0){ s.dead+=dt; return; } s.t+=dt; s.x+=s.vx*dt;
    if(solid(s.x+Math.sign(s.vx)*12,s.y)||solid(s.x,s.y+14)){ s.vx*=-1; }
    if(Math.random()<dt*8)part(s.x,s.y+8,rand(-10,10),-14,.4,'rgba(139,157,131,.5)',2);
    const dx=hero.x-s.x,dy=hero.y-s.y;
    if(Math.abs(dx)<18&&Math.abs(dy)<20){ if(hero.vy>60&&dy<0){ s.dead=.01; hero.vy=-330; hero.sx=1.3; hero.sy=.7; score+=Math.round(25*mult); missionTick('slimes',1); sfx.stomp(); floatTxt(s.x,s.y-16,'+25','#8B9D83',13); part(s.x,s.y,0,0,.3,'#8B9D83',5); } else die(); } });
  slimes=slimes.filter(s=>s.dead<0.5);
  /* шипы */
  spikes.forEach(sp=>{ if(Math.abs(hero.x-(sp.x+TS/2))<14&&Math.abs(hero.y-(sp.y+TS/2))<16)die(); });
  /* падение */
  if(hero.y>LEVELS[0].length*TS+80)die();
  /* камера */
  const lvlW=grid[0].length*TS;
  camX=clamp(hero.x-W/2,0,Math.max(0,lvlW-W));
  /* частицы */
  parts=parts.filter(p=>{ p.life-=dt; p.x+=p.vx*dt; p.y+=p.vy*dt; p.vy+=300*dt; return p.life>0; });
  texts=texts.filter(t=>{ t.life-=dt; t.y-=26*dt; return t.life>0; });
}
function levelComplete(){ sfx.door(); const earned=levelDeaths===0?3:(levelCoins>=coins.length?2:1); starsTotal+=earned; missionTick('stars',earned); missionTick('levels',level,true); if(levelDeaths===0)missionTick('clean',1); if(levelT<30)missionTick('fast',1); const bonus=Math.round((60+level*20)*mult); score+=bonus; announce('УРОВЕНЬ ПРОЙДЕН '+'⭐'.repeat(earned),'+'+fmt(bonus)+' бонус'); setTimeout(()=>{ if(running&&!over){ if(level>=LEVELS.length){ gameOver(true); } else { loadLevel(level+1); } } },1400); }
let starsTotal=0;
/* ═══ РЕНДЕР ═══ */
function render(){ ctx.clearRect(0,0,W,H);
  /* фон: руины параллакс */
  const g=ctx.createLinearGradient(0,0,0,H); g.addColorStop(0,'#0C0E18'); g.addColorStop(1,'#12101A'); ctx.fillStyle=g; ctx.fillRect(0,0,W,H);
  for(let l=0;l<3;l++){ const sp=.2+l*.25, a=.05+l*.05; ctx.fillStyle=`rgba(200,200,220,${a})`;
    for(let i=-1;i<9;i++){ const bx=((i*90-camX*sp)%(W+120))-60, bh=120+l*60+((i*53)%60); ctx.fillRect(bx,H-140-bh,34+l*14,bh); } }
  ctx.save(); ctx.translate(-camX,0);
  const yOff=(H-grid.length*TS)/2+camYFix();
  ctx.translate(0,yOff);
  /* тайлы: кирпичи */
  for(let y=0;y<grid.length;y++)for(let x=0;x<grid[0].length;x++){ if(grid[y][x]===1){ const px=x*TS,py=y*TS;
    ctx.fillStyle='#1D1D28'; ctx.fillRect(px,py,TS,TS);
    ctx.strokeStyle='rgba(255,255,255,.06)'; ctx.strokeRect(px+.5,py+.5,TS-1,TS-1);
    ctx.fillStyle='rgba(0,0,0,.25)'; ctx.fillRect(px,py+TS-3,TS,3);
    if((x+y)%2===0){ ctx.fillStyle='rgba(255,255,255,.03)'; ctx.fillRect(px+2,py+2,TS-4,TS/2-2); } } }
  /* шипы */
  spikes.forEach(sp=>{ ctx.fillStyle='#8E8E93'; ctx.beginPath(); for(let i=0;i<4;i++){ ctx.moveTo(sp.x+i*8+4,sp.y+TS); ctx.lineTo(sp.x+i*8+8,sp.y+TS-12); ctx.lineTo(sp.x+i*8+12,sp.y+TS); } ctx.fill(); ctx.strokeStyle='rgba(255,255,255,.3)'; ctx.lineWidth=1; ctx.stroke(); });
  /* движущиеся платформы */
  movers.forEach(m=>{ ctx.fillStyle='#2A2A38'; ctx.beginPath(); ctx.roundRect(m.x-m.w/2,m.y-TS/2+6,m.w,12,4); ctx.fill(); ctx.strokeStyle='rgba(212,165,116,.5)'; ctx.stroke(); ctx.fillStyle='rgba(212,165,116,.35)'; ctx.fillRect(m.x-m.w/2+4,m.y-TS/2+10,m.w-8,2); });
  /* монеты */
  coins.forEach(c=>{ if(c.got)return; const w=Math.abs(Math.cos(c.t*3))*8+2; ctx.fillStyle='#E8B04B'; ctx.shadowColor='#E8B04B'; ctx.shadowBlur=8; ctx.beginPath(); ctx.ellipse(c.x,c.y+Math.sin(c.t*2.4)*3,Math.max(2.4,w*.6),9,0,0,TAU); ctx.fill(); ctx.shadowBlur=0; ctx.fillStyle='rgba(255,255,255,.5)'; ctx.beginPath(); ctx.ellipse(c.x-1,c.y-2+Math.sin(c.t*2.4)*3,Math.max(1,w*.2),3,0,0,TAU); ctx.fill(); });
  /* ключ */
  if(keyObj&&!keyObj.got){ const fy=Math.sin(keyObj.t*3)*5; ctx.save(); ctx.translate(keyObj.x,keyObj.y+fy); ctx.rotate(Math.sin(keyObj.t*2)*.3); ctx.shadowColor='rgba(176,106,228,.9)'; ctx.shadowBlur=14; ctx.fillStyle='#B06AE4'; ctx.beginPath(); ctx.moveTo(0,-11); ctx.lineTo(8,0); ctx.lineTo(0,11); ctx.lineTo(-8,0); ctx.closePath(); ctx.fill(); ctx.shadowBlur=0; ctx.strokeStyle='rgba(255,255,255,.7)'; ctx.stroke(); ctx.fillStyle='#14100B'; ctx.beginPath(); ctx.arc(0,-2,2,0,TAU); ctx.fill(); ctx.restore(); }
  /* дверь */
  if(door){ ctx.save(); ctx.translate(door.x,door.y); ctx.fillStyle=hasKey?'rgba(212,165,116,.25)':'rgba(60,60,70,.4)'; ctx.beginPath(); ctx.roundRect(-15,-20,30,40,5); ctx.fill(); ctx.strokeStyle=hasKey?'#D4A574':'#3A3A46'; ctx.lineWidth=2.5; ctx.stroke(); if(hasKey){ const p=.5+Math.sin(performance.now()*.005)*.3; ctx.strokeStyle=`rgba(212,165,116,${p})`; ctx.beginPath(); ctx.roundRect(-19,-24,38,48,7); ctx.stroke(); ctx.fillStyle='#D4A574'; ctx.font='700 8px Inter,sans-serif'; ctx.textAlign='center'; ctx.fillText('ВЫХОД',0,-26); } ctx.restore(); }
  /* слизни */
  slimes.forEach(s=>{ const sq=1+Math.sin(s.t*8)*.12; ctx.fillStyle='#8B9D83'; ctx.beginPath(); ctx.ellipse(s.x,s.y+6,13/sq*.9,10*sq,0,0,TAU); ctx.fill(); ctx.strokeStyle='rgba(255,255,255,.35)'; ctx.lineWidth=1.4; ctx.stroke(); ctx.fillStyle='#14100B'; ctx.beginPath(); ctx.arc(s.x+Math.sign(s.vx)*4-2,s.y+3,2,0,TAU); ctx.arc(s.x+Math.sign(s.vx)*4+3,s.y+3,2,0,TAU); ctx.fill(); });
  /* частицы */
  parts.forEach(p=>{ ctx.globalAlpha=clamp(p.life/p.maxLife,0,1); ctx.fillStyle=p.color; ctx.beginPath(); ctx.arc(p.x,p.y,p.size,0,TAU); ctx.fill(); }); ctx.globalAlpha=1;
  /* герой: золотой квадрат с глазами + squash&stretch */
  if(!(inv>0&&Math.floor(inv*12)%2===0)){ const hx=hero.x,hy=hero.y;
    ctx.save(); ctx.translate(hx,hy); ctx.scale(hero.sx,hero.sy);
    ctx.fillStyle='#E8B04B'; ctx.shadowColor='rgba(232,176,75,.7)'; ctx.shadowBlur=10; ctx.beginPath(); ctx.roundRect(-hero.w/2,-hero.h/2,hero.w,hero.h,5); ctx.fill(); ctx.shadowBlur=0; ctx.strokeStyle='rgba(120,80,20,.8)'; ctx.lineWidth=1.6; ctx.stroke();
    ctx.fillStyle='#14100B'; const eo=hero.face*2.4; ctx.beginPath(); ctx.arc(-4+eo,-3,2.6,0,TAU); ctx.arc(4+eo,-3,2.6,0,TAU); ctx.fill(); ctx.fillStyle='rgba(255,255,255,.9)'; ctx.beginPath(); ctx.arc(-4.6+eo,-3.8,1,0,TAU); ctx.arc(3.4+eo,-3.8,1,0,TAU); ctx.fill();
    ctx.fillStyle='#14100B'; ctx.fillRect(-3+eo,3,6,1.6);
    ctx.restore(); }
  /* тексты */
  texts.forEach(t=>{ ctx.globalAlpha=clamp(t.life/t.maxLife,0,1); ctx.font=`700 ${t.size}px Inter,sans-serif`; ctx.textAlign='center'; ctx.fillStyle=t.color; ctx.fillText(t.txt,t.x,t.y); }); ctx.globalAlpha=1;
  ctx.restore(); }
function camYFix(){ const lvlH=grid.length*TS; return Math.max(0,(H-lvlH)/2)>0?0:0; }
/* ─── Цикл ─── */
let last=0,acc=0,rafId=0,annT=0;
function loop(ts){ rafId=requestAnimationFrame(loop); if(!running)return; if(!last)last=ts; let dtms=ts-last; last=ts; if(dtms>200)dtms=200; acc+=dtms; let guard=0; while(acc>=STEP*1000&&guard++<6){ update(STEP); acc-=STEP*1000; } render(); }
/* ─── Ввод ─── */
const btn={left:false,right:false,jump:false};
[['pf-left','left'],['pf-right','right'],['pf-jump','jump']].forEach(([id,k])=>{ const b=$(id); b.addEventListener('pointerdown',e=>{ e.preventDefault(); audioInit(); btn[k]=true; }); const off=()=>btn[k]=false; b.addEventListener('pointerup',off); b.addEventListener('pointercancel',off); b.addEventListener('pointerleave',off); });
window.addEventListener('keydown',e=>{ keys[e.key]=true; keys[e.key.toLowerCase()]=true; if(['ArrowLeft','ArrowRight','ArrowUp',' '].includes(e.key))e.preventDefault(); });
window.addEventListener('keyup',e=>{ keys[e.key]=false; keys[e.key.toLowerCase()]=false; });
/* ─── Поток ─── */
function resetGame(){ score=0;hearts=3;starsTotal=0;deaths=0; el.score.textContent='0'; loadLevel(1); }
function startGame(){ touchStreak(); audioInit(); resetGame(); running=true; over=false; last=0; acc=0; $('welcome').classList.add('hidden'); $('modal').classList.add('hidden'); $('game').classList.remove('hidden'); refreshHud(); if(!rafId)rafId=requestAnimationFrame(loop); }
function refreshHud(){ el.daily.textContent=fmt(dailyBest); el.best.textContent=fmt(best); el.streakN.textContent=effStreak(); el.multN.textContent='×'+mult.toFixed(2); refreshMissionsUI(); updateHearts(); }
function refreshWelcome(){ el.wDaily.textContent=fmt(dailyBest); el.wBest.textContent=fmt(best); el.wStreak.textContent='🔥 '+effStreak(); $('daily-date').textContent='Вызов дня · '+today.slice(5).replace('-','.'); }
function gameOver(win){ over=true; running=false; missionTick('score',Math.floor(score),true); let isRec=false,isRecDay=false; if(score>best){ best=Math.floor(score); lsSet(K_BEST,best); isRec=true; } if(score>dailyBest){ dailyBest=Math.floor(score); lsSet(K_DAILY,dailyBest); isRecDay=true; } (win?sfx.door:sfx.death)(); setTimeout(()=>{ $('modal-badge').textContent=isRec||isRecDay?'Новый рекорд':(win?'Руины пройдены!':'Игра окончена'); $('modal-badge').classList.toggle('record',isRec||isRecDay); $('modal-title').textContent=win?'Все 12 уровней покорены!':(isRecDay?'Рекорд дня!':(isRec?'Абсолютный рекорд!':'Герой пал')); $('modal-score').innerHTML=`Очки <b>${fmt(score)}</b> · Уровень <b>${level}</b> · Звёзды <b>${starsTotal}⭐</b><br>Рекорд <b>${fmt(best)}</b> · за день <b>${fmt(dailyBest)}</b>`; $('modal').classList.remove('hidden'); },700); }
function toMenu(){ running=false; over=false; $('game').classList.add('hidden'); $('modal').classList.add('hidden'); $('welcome').classList.remove('hidden'); refreshWelcome(); }
$('btn-play').addEventListener('click',()=>{ audioInit(); startGame(); });
$('btn-restart').addEventListener('click',()=>{ audioInit(); startGame(); });
$('btn-menu').addEventListener('click',toMenu);
$('modal-btn').addEventListener('click',()=>{ audioInit(); startGame(); });
$('modal-btn2').addEventListener('click',toMenu);
$('btn-missions').addEventListener('click',()=>{ renderMissionsModal(); $('mmodal').classList.remove('hidden'); });
$('missions-chip').addEventListener('click',()=>{ renderMissionsModal(); $('mmodal').classList.remove('hidden'); });
$('mmodal-btn').addEventListener('click',()=>$('mmodal').classList.add('hidden'));
function syncSoundBtn(){ $('btn-sound').textContent=muted?'🔇':'🔊'; }
$('btn-sound').addEventListener('click',()=>{ muted=!muted; lsSet(K_MUTE,muted); if(master)master.gain.value=muted?0:0.5; syncSoundBtn(); if(!muted){ audioInit(); sfx.click(); } });
refreshWelcome(); refreshHud(); syncSoundBtn();
/* ─── Debug-хук ─── */
window.__pf={
  start:startGame, over:w=>{ running=true; gameOver(w===true); },
  state(){ return {score:Math.floor(score),level,hearts,coins:levelCoins,slimes:slimes.filter(s=>!s.dead).length,hasKey,x:Math.round(hero.x),y:Math.round(hero.y),ground:hero.ground,running,over}; },
  jump:()=>{ hero.buffer=.12; }, right:()=>{ hero.vx=200; }, kill:()=>{ hero.vy=-540; },
  addScore:n=>{ score+=n; }, missions:()=>missionData, records:()=>({best:lsGet(K_BEST,0),daily:lsGet(K_DAILY,0),streak:lsGet(K_STREAK,0),today}),
};
