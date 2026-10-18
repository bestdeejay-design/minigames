'use strict';
/* ═══════════════ ИМПУЛЬС v2.0 · космический шутер · AXIIOM canon ═══════════════ */
const $=id=>document.getElementById(id);
const clamp=(v,a,b)=>v<a?a:v>b?b:v;
const rand=(a,b)=>a+Math.random()*(b-a);
const TAU=Math.PI*2;
function xmur3(str){let h=1779033703^str.length;for(let i=0;i<str.length;i++){h=Math.imul(h^str.charCodeAt(i),3432918353);h=h<<13|h>>>19;}return function(){h=Math.imul(h^h>>>16,2246822507);h=Math.imul(h^h>>>13,3266489909);return (h^=h>>>16)>>>0;};}
function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return ((t^t>>>14)>>>0)/4294967296;};}
function lsGet(k,d){try{const v=localStorage.getItem(k);return v===null?d:JSON.parse(v);}catch(e){return d;}}
function lsSet(k,v){try{localStorage.setItem(k,JSON.stringify(v));}catch(e){}}
const fmt=n=>Math.floor(n).toLocaleString('ru-RU');
if(window.CanvasRenderingContext2D&&!CanvasRenderingContext2D.prototype.roundRect){CanvasRenderingContext2D.prototype.roundRect=function(x,y,w,h,r){r=Math.min(r||0,w/2,h/2);this.moveTo(x+r,y);this.arcTo(x+w,y,x+w,y+h,r);this.arcTo(x+w,y+h,x,y+h,r);this.arcTo(x,y+h,x,y,r);this.arcTo(x,y,x+w,y,r);this.closePath();return this;};}
/* Дата (Europe/Moscow) */
const now=new Date();
const today=new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Moscow'}).format(now);
const yDate=new Date(now.getTime()-86400000);
const yesterday=new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Moscow'}).format(yDate);
/* ─── Аудио: WebAudio-синтез, без файлов ─── */
let AC=null,master=null;
function audioInit(){ if(AC) return; try{ AC=new (window.AudioContext||window.webkitAudioContext)(); master=AC.createGain(); master.gain.value=muted?0:0.5; master.connect(AC.destination); }catch(e){} }
function sGain(){ return muted?0:0.5; }
function tone(freq,dur,type,vol,slide,delay){ if(!AC||muted)return; const t0=AC.currentTime+(delay||0); const o=AC.createOscillator(),g=AC.createGain(); o.type=type||'square'; o.frequency.setValueAtTime(freq,t0); if(slide) o.frequency.exponentialRampToValueAtTime(Math.max(30,freq+slide),t0+dur); g.gain.setValueAtTime(vol||.15,t0); g.gain.exponentialRampToValueAtTime(.001,t0+dur); o.connect(g);g.connect(master); o.start(t0);o.stop(t0+dur+.02); }
function noise(dur,vol,fc,delay){ if(!AC||muted)return; const t0=AC.currentTime+(delay||0); const n=Math.floor(AC.sampleRate*dur); const buf=AC.createBuffer(1,n,AC.sampleRate); const d=buf.getChannelData(0); for(let i=0;i<n;i++) d[i]=(Math.random()*2-1)*(1-i/n); const src=AC.createBufferSource(); src.buffer=buf; const f=AC.createBiquadFilter(); f.type='lowpass'; f.frequency.setValueAtTime(fc||900,t0); f.frequency.exponentialRampToValueAtTime(120,t0+dur); const g=AC.createGain(); g.gain.setValueAtTime(vol||.3,t0); g.gain.exponentialRampToValueAtTime(.001,t0+dur); src.connect(f);f.connect(g);g.connect(master); src.start(t0); }
const sfx={
  shoot(){ tone(880,.07,'square',.045,-500); },
  hit(){ tone(220,.05,'sawtooth',.07,-80); },
  boom(big){ noise(big?.5:.25,big?.5:.3,big?1400:900); tone(90,big?.4:.2,'triangle',big?.3:.2,-50); },
  pickup(){ tone(660,.09,'sine',.14); tone(880,.09,'sine',.14,0,.07); tone(1320,.12,'sine',.12,0,.14); },
  shield(){ tone(440,.3,'sine',.12,300); tone(660,.3,'sine',.1,400,.05); },
  alarm(){ tone(180,.22,'sawtooth',.16,60); tone(180,.22,'sawtooth',.16,60,.3); },
  clear(){ tone(523,.1,'triangle',.14); tone(659,.1,'triangle',.14,0,.09); tone(784,.16,'triangle',.16,0,.18); },
  dmg(){ noise(.2,.35,600); tone(140,.18,'sawtooth',.2,-70); },
  over(){ tone(300,.5,'sawtooth',.2,-220); noise(.6,.4,700,.1); },
};
/* ─── Хранилище ─── */
const K_BEST='sh.best',K_DAILY='sh.daily.'+today,K_STREAK='sh.streak',K_LASTDAY='sh.lastDay',K_MUTE='sh.muted',K_MISS='sh.missions.'+today;
/* ─── DOM ─── */
const el={
  score:$('score-val'),daily:$('daily-val'),best:$('best-val'),wave:$('wave-val'),
  hull:$('hull-fill'),shield:$('hull-shield'),
  streakN:$('streak-n'),multN:$('mult-n'),missionsN:$('missions-n'),
  wDaily:$('w-daily-best'),wBest:$('w-best'),wStreak:$('w-streak'),
  announce:$('announce'),gc:$('gc'),
};
const W=400,H=580,STEP=1/60;
const cv=el.gc; const ctx=cv.getContext('2d');
let dpr=Math.min(window.devicePixelRatio||1,2);
function fitCanvas(){ dpr=Math.min(window.devicePixelRatio||1,2); cv.width=W*dpr; cv.height=H*dpr; cv.style.width=W+'px'; cv.style.height=H+'px'; ctx.setTransform(dpr,0,0,dpr,0,0); }
fitCanvas(); window.addEventListener('resize',fitCanvas);
/* ─── Состояние ─── */
let muted=lsGet(K_MUTE,false);
let mode='daily';
let running=false,over=false,paused=false;
let score=0,mult=1;
let wave=0,waveState='idle',waveT=0,spawnQueue=[],escortT=0;
let best=lsGet(K_BEST,0),dailyBest=lsGet(K_DAILY,0);
let streak=lsGet(K_STREAK,0),lastDay=lsGet(K_LASTDAY,'');
let dailyRng=Math.random;
/* игрок */
const player={x:W/2,y:H-70,tx:W/2,ty:H-70,hp:4,hpMax:4,shield:0,wlevel:1,fireT:0,inv:0,calm:0,alive:true,tilt:0};
let bullets=[],ebullets=[],enemies=[],drops=[],parts=[],rings=[],texts=[];
let shake=0,dmgFlash=0,sector=0;
let boss=null,bossMaxHp=0;
let waveKills=0,dmgThisWave=0,combo=0,comboT=0;
let stars=[];
(function makeStars(){ const r=mulberry32(42); for(let i=0;i<110;i++){ const l=r()<.6?0:(r()<.7?1:2); stars.push({x:r()*W,y:r()*H,l,sp:l===0?12:(l===1?26:48),s:l===0?1:(l===1?1.6:2.2),tw:r()*TAU}); } })();
/* ─── Мета: стрик / миссии / тосты ─── */
function effStreak(){ return (lastDay===today||lastDay===yesterday)?streak:0; }
function getMult(s){ return 1+Math.min(Math.max(s-1,0),10)*0.05; }
function touchStreak(){ if(lastDay===today){ mult=getMult(streak); return; } streak=(lastDay===yesterday)?(streak||0)+1:1; lastDay=today; lsSet(K_STREAK,streak); lsSet(K_LASTDAY,lastDay); mult=getMult(streak); if(streak>1) toast(`🔥 Стрик <b>${streak}</b> · очки ×<b>${mult.toFixed(2)}</b>`); }
const MISSIONS=[
  {id:'kills40',   name:'Уничтожить 40 врагов',        target:40,  track:'kills'},
  {id:'flawless2', name:'Пройти 2 волны без урона',    target:2,   track:'flawless'},
  {id:'drops5',    name:'Собрать 5 дропов',            target:5,   track:'drops'},
  {id:'tanks3',    name:'Уничтожить 3 танка',          target:3,   track:'tanks'},
  {id:'score1500', name:'Набрать 1500 очков за игру',  target:1500,track:'score'},
  {id:'wave6',     name:'Достичь 6-й волны',           target:6,   track:'wave'},
  {id:'shoot10',   name:'Уничтожить 10 стрелков',      target:10,  track:'shooters'},
  {id:'boss1',     name:'Победить босса',              target:1,   track:'bosses'},
];
let missionData=lsGet(K_MISS,{p:{},done:{}});
if(!missionData.p) missionData={p:{},done:{}};
function saveMissions(){ lsSet(K_MISS,missionData); }
function missionAward(mid){ if(missionData.done[mid])return; missionData.done[mid]=1; saveMissions(); const bonus=Math.round(25*mult); if(running&&!over){ score+=bonus; floatTxt(player.x,player.y-40,`+${bonus} миссия`,'#D4A574',15); } toast(`🎯 Миссия выполнена: <b>+${bonus}</b>`); sfx.clear(); refreshMissionsUI(); }
function missionTick(track,val,absolute){ MISSIONS.forEach(m=>{ if(m.track!==track||missionData.done[m.id])return; if(absolute){ if(val>(missionData.p[m.id]||0)) missionData.p[m.id]=val; } else missionData.p[m.id]=(missionData.p[m.id]||0)+val; if(missionData.p[m.id]>=m.target) missionAward(m.id); }); saveMissions(); refreshMissionsUI(); }
function refreshMissionsUI(){ const done=MISSIONS.filter(m=>missionData.done[m.id]).length; el.missionsN.textContent=done+'/3'; }
function renderMissionsModal(){ const list=$('mmodal-list'); list.innerHTML=''; MISSIONS.forEach(m=>{ const p=Math.min(missionData.p[m.id]||0,m.target); const done=!!missionData.done[m.id]; const d=document.createElement('div'); d.className='mm-item'+(done?' done':''); d.innerHTML=`<span class="mm-check">✓</span><span class="mm-body"><span class="mm-name">${m.name}</span><span class="mm-prog"><b>${fmt(p)}</b> / ${fmt(m.target)}</span></span>`; list.appendChild(d); }); }
/* тосты */
function toast(html){ const t=document.createElement('span'); t.className='toast'; t.innerHTML=html; $('toasts').appendChild(t); setTimeout(()=>t.classList.add('out'),2600); setTimeout(()=>t.remove(),3000); }
/* анонс волны */
let annT=null;
function announce(big,sub){ el.announce.innerHTML=`<span class="an-big">${big}</span>${sub?`<span class="an-sub">${sub}</span>`:''}`; el.announce.classList.remove('hidden'); clearTimeout(annT); annT=setTimeout(()=>el.announce.classList.add('hidden'),1700); }
/* частицы / кольца / текст */
function part(x,y,vx,vy,life,color,size,drag,grav){ parts.push({x,y,vx,vy,life,maxLife:life,color,size,drag:drag||0.98,grav:grav||0}); }
function burst(x,y,n,color,spd,size){ for(let i=0;i<n;i++){ const a=Math.random()*TAU,v=rand(spd*.3,spd); part(x,y,Math.cos(a)*v,Math.sin(a)*v,rand(.3,.7),color,rand(size*.5,size),.96); } }
function ring(x,y,color,vr,w){ rings.push({x,y,r:4,vr:vr||260,life:.45,maxLife:.45,color,w:w||3}); }
function floatTxt(x,y,txt,color,size){ texts.push({x,y,txt,color,size:size||13,life:.9,maxLife:.9}); }
/* seeded-позиции: daily-режим полностью детерминирован */
const sr=(a,b)=>a+(mode==='daily'?dailyRng():Math.random())*(b-a);
/* ─── Враги ─── */
const ETYPE={
  grunt:  {r:13,hp:1, pts:100, color:'#E4545F', glow:'rgba(228,84,95,.55)'},
  shooter:{r:14,hp:2, pts:200, color:'#B06AE4', glow:'rgba(176,106,228,.55)'},
  tank:   {r:20,hp:6, pts:400, color:'#4ED8C8', glow:'rgba(78,216,200,.55)'},
  boss:   {r:34,hp:0, pts:2500,color:'#E8B04B', glow:'rgba(232,176,75,.6)'},
};
function spawnEnemy(type,x,y,opts){ const t=ETYPE[type]; const e={type,x,y,r:t.r,hp:t.hp,pts:t.pts,color:t.color,glow:t.glow,t:0,fireT:sr(1,2.4),dead:false,flash:0,baseX:x,amp:opts&&opts.amp!==undefined?opts.amp:36,ph:Math.random()*TAU,vy:opts&&opts.vy||0,vx:0,targetY:y,leave:false}; if(type==='grunt'){ e.vy=1.9+Math.min(wave*0.06,1.6); if(opts&&opts.home)e.home=true; } if(type==='shooter'){ e.vy=2.2; e.targetY=clamp(y,70,190); e.life=11; } if(type==='tank'){ e.vy=0.75; e.fireT=1.6; } if(type==='boss'){ const cyc=Math.floor(wave/10); e.hp=40+cyc*22+wave*2; bossMaxHp=e.hp; e.phase=0; e.atkT=2; e.atk=0; boss=e; } enemies.push(e); return e; }
function enemyFire(e,n,spread,spd){ const a0=Math.atan2(player.y-e.y,player.x-e.x); for(let i=0;i<n;i++){ const a=a0+(n>1?(i-(n-1)/2)*spread:0); ebullets.push({x:e.x,y:e.y+e.r*.6,vx:Math.cos(a)*spd,vy:Math.sin(a)*spd,r:4.5,t:0}); } }
function updateEnemy(e,dt){ e.t+=dt; if(e.flash>0)e.flash-=dt;
  if(e.type==='grunt'){ e.y+=e.vy; e.x=e.baseX+Math.sin(e.t*2.2+e.ph)*e.amp; if(e.home){ e.baseX+=clamp(player.x-e.baseX,-0.8,0.8); } if(e.y>H+40)e.dead=true; }
  else if(e.type==='shooter'){ if(!e.leave&&e.y<e.targetY){ e.y+=e.vy; } else if(e.life<=0){ e.y+=2.6; if(e.y>H+40)e.dead=true; } else { e.x=e.baseX+Math.sin(e.t*1.4+e.ph)*30; e.life-=dt; e.fireT-=dt; if(e.fireT<=0&&e.y>40){ enemyFire(e,1,0,2.4); e.fireT=sr(1.8,2.6); } } }
  else if(e.type==='tank'){ e.y+=e.vy; e.x=e.baseX+Math.sin(e.t*.8+e.ph)*18; e.fireT-=dt; if(e.fireT<=0){ enemyFire(e,3,0.3,2.0); e.fireT=2.8; } if(e.y>H+40)e.dead=true; }
  else if(e.type==='boss'){ if(e.y<90){ e.y+=1.4; } else { e.x=W/2+Math.sin(e.t*.7)*(W/2-70); e.atkT-=dt; if(e.atkT<=0){ e.atk=(e.atk+1)%3; if(e.atk===0){ for(let i=0;i<5;i++){ const a=Math.PI/2+(i-2)*0.32; ebullets.push({x:e.x,y:e.y+e.r*.6,vx:Math.cos(a)*2.1,vy:Math.sin(a)*2.1,r:5,t:0}); } e.atkT=1.6; } else if(e.atk===1){ enemyFire(e,3,0.22,2.8); e.atkT=1.4; } else { if(enemies.length<10){ spawnEnemy('grunt',clamp(e.x-60,40,W-40),e.y+20,{vy:2.2,home:true}); spawnEnemy('grunt',clamp(e.x+60,40,W-40),e.y+20,{vy:2.2,home:true}); } e.atkT=2.2; } tone(140,.12,'sawtooth',.08,-40); } } }
}
function killEnemy(e,i){ e.dead=true; const comboMult=1+0.15*Math.min(combo,10); const pts=Math.round(e.pts*comboMult*mult); score+=pts; floatTxt(e.x,e.y,'+'+fmt(pts),e.color,14); burst(e.x,e.y,e.type==='boss'?60:(e.type==='tank'?34:18),e.color,e.type==='boss'?260:170,e.type==='boss'?4:3); ring(e.x,e.y,e.color,e.type==='boss'?420:300,e.type==='boss'?4:3); sfx.boom(e.type==='boss'||e.type==='tank'); shake=Math.min(shake+(e.type==='boss'?14:(e.type==='tank'?7:3.5)),18); waveKills++; combo++; comboT=2;
  missionTick('kills',1);
  if(e.type==='tank')missionTick('tanks',1);
  if(e.type==='shooter')missionTick('shooters',1);
  if(e.type==='boss'){ missionTick('bosses',1); boss=null; announce('БОСС ПАЛ','сектор зачищен'); }
  /* дропы */
  let dr=0; if(e.type==='grunt')dr=0.09; else if(e.type==='shooter')dr=0.16; else if(e.type==='tank')dr=1; else if(e.type==='boss')dr=3;
  for(let d=0;d<dr;d++){ if(d>0||dailyRng()<dr||dr===1){ const roll=dailyRng(); const kind=roll<0.42?'repair':(roll<0.78?'weapon':'shield'); drops.push({x:e.x+rand(-14,14),y:e.y,vy:1.6,kind,t:0}); } }
}
/* ─── Директор волн ─── */
function buildWave(n){ const q=[]; let t=0.6; const isBoss=n%5===0; if(isBoss){ q.push({t,type:'boss',x:W/2,y:-60}); t=1.4; const esc=Math.min(2+Math.floor(n/5),5); for(let i=0;i<esc;i++){ q.push({t:t+i*.7,type:'grunt',x:sr(50,W-50),y:-30,opts:{home:true}}); } } else { const budget=Math.min(5+Math.round(n*1.7),26); let spawned=0,k=0; while(spawned<budget){ const roll=dailyRng(); if(n>=3&&roll<0.14&&k>2){ q.push({t,type:'tank',x:sr(70,W-70),y:-40}); spawned+=3; t+=1.1; } else if(n>=2&&roll<0.36&&k>1){ q.push({t,type:'shooter',x:sr(60,W-60),y:sr(90,180)}); q.push({t:t+.15,type:'shooter',x:sr(60,W-60),y:sr(90,180)}); spawned+=2; t+=1.2; } else { const col=Math.min(2+Math.floor(dailyRng()*3),budget-spawned); const cx=sr(50,W-50); for(let i=0;i<col;i++)q.push({t:t+i*.34,type:'grunt',x:cx,y:-30,opts:{amp:dailyRng()<.4?46:18}}); spawned+=col; t+=col*.34+.5; } k++; } } spawnQueue=q; waveT=0; }
function startWave(n){ wave=n; waveState='run'; waveKills=0; dmgThisWave=0; buildWave(n); const isBoss=n%5===0; el.wave.textContent=n; if(isBoss){ sfx.alarm(); announce('Волна '+n,'⚠ БОСС'); } else announce('Волна '+n,sectorName(n)); missionTick('wave',n,true); }
function sectorName(n){ const s=Math.floor((n-1)/10); return ['глубина I','глубина II','глубина III','глубина IV','бездна'][Math.min(s,4)]; }
function waveCleared(){ waveState='clear'; waveT=0; const bonus=Math.round(50*mult+wave*15); score+=bonus; if(dmgThisWave===0){ missionTick('flawless',1); floatTxt(W/2,H/2+40,'БЕЗ УРОНА +'+fmt(bonus+50),'#7EC8E3',16); score+=50; } else floatTxt(W/2,H/2+40,'Волна пройдена +'+fmt(bonus),'#D4A574',15); sfx.clear(); }
/* ─── Урон игроку ─── */
function damagePlayer(){ if(player.inv>0||over)return; dmgThisWave++; combo=0; player.calm=0; player.inv=1.1; shake=Math.min(shake+9,20); dmgFlash=1; sfx.dmg(); burst(player.x,player.y,20,'#E4545F',190,3); if(player.shield>0){ player.shield=Math.max(0,player.shield-34); sfx.shield(); } else { player.hp--; updateHullUI(); if(player.hp<=0) gameOver(); } }
function updateHullUI(){ el.hull.style.width=(player.hp/player.hpMax*100)+'%'; el.shield.style.width=player.shield+'%'; }
/* ─── Апдейт ─── */
function update(dt){
  if(over)return;
  /* звёзды */
  const wSpd=waveState==='run'?1:0.5;
  stars.forEach(s=>{ s.y+=s.sp*wSpd*dt*(1+sector*.15); s.tw+=dt*3; if(s.y>H+2){ s.y=-2; s.x=Math.random()*W; } });
  /* частицы и пр. */
  parts=parts.filter(p=>{ p.life-=dt; p.x+=p.vx*dt*60; p.y+=p.vy*dt*60; p.vx*=p.drag; p.vy*=p.drag; p.vy+=p.grav*dt*60; return p.life>0; });
  rings=rings.filter(r=>{ r.life-=dt; r.r+=r.vr*dt; return r.life>0; });
  texts=texts.filter(t=>{ t.life-=dt; t.y-=28*dt; return t.life>0; });
  if(shake>0)shake=Math.max(0,shake-dt*40);
  if(dmgFlash>0)dmgFlash=Math.max(0,dmgFlash-dt*2.4);
  if(comboT>0){ comboT-=dt; if(comboT<=0)combo=0; }
  if(!player.alive)return;
  /* игрок: плавное движение к цели */
  const k=1-Math.exp(-dt*11); player.x+=(player.tx-player.x)*k; player.y+=(player.ty-player.y)*k; player.x=clamp(player.x,16,W-16); player.y=clamp(player.y,50,H-24); player.tilt=clamp((player.tx-player.x)*0.045,-0.5,0.5);
  if(player.inv>0)player.inv-=dt;
  player.calm+=dt; if(player.calm>5&&player.shield<60)player.shield=Math.min(60,player.shield+14*dt),updateHullUI();
  /* автоогонь */
  player.fireT-=dt; if(player.fireT<=0){ const lv=player.wlevel; const rate=lv>=5?0.16:(lv>=4?0.2:(lv>=2?0.26:0.32)); player.fireT=rate; const nose=player.y-16; if(lv>=3){ bullets.push({x:player.x-9,y:nose,vx:0,vy:-9.5,r:3.5}); bullets.push({x:player.x+9,y:nose,vx:0,vy:-9.5,r:3.5}); bullets.push({x:player.x,y:nose-6,vx:0,vy:-10,r:3.5}); } else if(lv>=2){ bullets.push({x:player.x-7,y:nose,vx:0,vy:-9.5,r:3.5}); bullets.push({x:player.x+7,y:nose,vx:0,vy:-9.5,r:3.5}); } else bullets.push({x:player.x,y:nose,vx:0,vy:-10,r:3.5}); if(lv>=5){ bullets.push({x:player.x-13,y:nose+6,vx:-1.4,vy:-9,r:3}); bullets.push({x:player.x+13,y:nose+6,vx:1.4,vy:-9,r:3}); } sfx.shoot(); part(player.x,player.y+14,rand(-.3,.3),rand(1.2,2.2),.25,'#E8B04B',2.4,.92); }
  /* волна */
  if(waveState==='run'){ waveT+=dt; while(spawnQueue.length&&spawnQueue[0].t<=waveT){ const s=spawnQueue.shift(); spawnEnemy(s.type,s.x,s.y,s.opts); } escortT+=dt; if(boss&&escortT>6){ escortT=0; if(enemies.length<7) spawnEnemy('grunt',sr(50,W-50),-30,{home:true}); } if(!spawnQueue.length&&!enemies.length&&!boss) waveCleared(); }
  else if(waveState==='clear'){ waveT+=dt; if(waveT>1.9){ if(wave%10===0)sector=Math.floor(wave/10); startWave(wave+1); } }
  /* враги */
  for(let i=enemies.length-1;i>=0;i--){ const e=enemies[i]; updateEnemy(e,dt); if(e.dead){ enemies.splice(i,1); continue; } /* столкновение с игроком */ const dx=e.x-player.x,dy=e.y-player.y; if(dx*dx+dy*dy<(e.r+11)*(e.r+11)){ if(e.type!=='boss'&&e.type!=='tank'){ killEnemy(e,i); } damagePlayer(); } }
  enemies=enemies.filter(e=>!e.dead);
  /* пули игрока */
  for(let i=bullets.length-1;i>=0;i--){ const b=bullets[i]; b.x+=b.vx*dt*60; b.y+=b.vy*dt*60; if(b.y<-12||b.x<-10||b.x>W+10){ bullets.splice(i,1); continue; } let hit=false; for(let j=enemies.length-1;j>=0;j--){ const e=enemies[j]; const dx=e.x-b.x,dy=e.y-b.y; if(dx*dx+dy*dy<(e.r+b.r)*(e.r+b.r)){ e.hp--; e.flash=.08; sfx.hit(); part(b.x,b.y,rand(-1,1),rand(-.5,.5),.2,'#FFE9C9',2,.94); if(e.hp<=0)killEnemy(e,j); hit=true; break; } } if(hit)bullets.splice(i,1); }
  /* пули врагов */
  for(let i=ebullets.length-1;i>=0;i--){ const b=ebullets[i]; b.t+=dt; b.x+=b.vx*dt*60; b.y+=b.vy*dt*60; if(b.y>H+10||b.y<-10||b.x<-10||b.x>W+10){ ebullets.splice(i,1); continue; } const dx=b.x-player.x,dy=b.y-player.y; if(dx*dx+dy*dy<(b.r+9)*(b.r+9)){ ebullets.splice(i,1); damagePlayer(); } }
  /* дропы */
  for(let i=drops.length-1;i>=0;i--){ const d=drops[i]; d.t+=dt; d.y+=d.vy*dt*60; d.x+=Math.sin(d.t*3)*.4; if(d.y>H+16){ drops.splice(i,1); continue; } const dx=d.x-player.x,dy=d.y-player.y; if(dx*dx+dy*dy<30*30){ drops.splice(i,1); sfx.pickup(); missionTick('drops',1); if(d.kind==='repair'){ if(player.hp<player.hpMax){ player.hp++; floatTxt(player.x,player.y-26,'+1 КОРПУС','#8B9D83',13); } else { score+=Math.round(100*mult); floatTxt(player.x,player.y-26,'+100','#8B9D83',13); } } else if(d.kind==='weapon'){ if(player.wlevel<5){ player.wlevel++; floatTxt(player.x,player.y-26,'ОРУЖИЕ Ур.'+player.wlevel,'#D4A574',14); } else { score+=Math.round(150*mult); floatTxt(player.x,player.y-26,'+150','#D4A574',13); } } else { player.shield=100; sfx.shield(); floatTxt(player.x,player.y-26,'ЩИТ ПОЛНЫЙ','#7EC8E3',13); ring(player.x,player.y,'#7EC8E3',320,2.5); } updateHullUI(); } }
}
/* ─── Рендер ─── */
const SECTOR_TINT=['rgba(20,24,40,','rgba(14,34,36,','rgba(40,18,22,','rgba(28,16,42,','rgba(40,26,10,'];
function drawShip(){ const p=player; if(p.inv>0&&Math.floor(p.inv*14)%2===0)return; ctx.save(); ctx.translate(p.x,p.y); ctx.rotate(p.tilt);
  /* пламя двигателя */
  const fl=6+Math.sin(performance.now()*.02)*2+Math.min(6,player.wlevel); const grd=ctx.createLinearGradient(0,10,0,10+fl+8); grd.addColorStop(0,'rgba(232,176,75,.95)'); grd.addColorStop(.5,'rgba(228,120,60,.5)'); grd.addColorStop(1,'rgba(228,84,95,0)'); ctx.fillStyle=grd; ctx.beginPath(); ctx.moveTo(-4.5,10); ctx.lineTo(0,10+fl+8); ctx.lineTo(4.5,10); ctx.closePath(); ctx.fill();
  /* корпус — золотой клин */
  ctx.shadowColor='rgba(212,165,116,.8)'; ctx.shadowBlur=14; ctx.fillStyle='#E8C89A'; ctx.beginPath(); ctx.moveTo(0,-18); ctx.lineTo(13,10); ctx.lineTo(6,7); ctx.lineTo(0,12); ctx.lineTo(-6,7); ctx.lineTo(-13,10); ctx.closePath(); ctx.fill(); ctx.shadowBlur=0;
  /* кокпит */
  ctx.fillStyle='#14100B'; ctx.beginPath(); ctx.ellipse(0,-4,3.4,5.5,0,0,TAU); ctx.fill(); ctx.fillStyle='rgba(255,255,255,.85)'; ctx.beginPath(); ctx.ellipse(0,-5.5,2,2.6,0,0,TAU); ctx.fill();
  /* крылья-обводка */
  ctx.strokeStyle='rgba(20,16,11,.9)'; ctx.lineWidth=1.5; ctx.beginPath(); ctx.moveTo(0,-18); ctx.lineTo(13,10); ctx.lineTo(6,7); ctx.lineTo(0,12); ctx.lineTo(-6,7); ctx.lineTo(-13,10); ctx.closePath(); ctx.stroke();
  /* щит */
  if(p.shield>0){ ctx.strokeStyle=`rgba(126,200,227,${.35+Math.sin(performance.now()*.008)*.15})`; ctx.lineWidth=2; ctx.beginPath(); ctx.arc(0,-2,22,0,TAU); ctx.stroke(); ctx.fillStyle='rgba(126,200,227,.07)'; ctx.fill(); }
  ctx.restore(); }
function drawEnemy(e){ ctx.save(); ctx.translate(e.x,e.y); const wob=1+Math.sin(e.t*6)*.04; ctx.scale(wob,wob);
  const fill=e.flash>0?'#FFFFFF':e.color; ctx.shadowColor=e.glow; ctx.shadowBlur=16;
  if(e.type==='grunt'){ ctx.fillStyle=fill; ctx.beginPath(); ctx.moveTo(0,e.r); ctx.lineTo(e.r*.85,-e.r*.6); ctx.lineTo(0,-e.r*.15); ctx.lineTo(-e.r*.85,-e.r*.6); ctx.closePath(); ctx.fill(); ctx.shadowBlur=0; ctx.strokeStyle='rgba(255,255,255,.75)'; ctx.lineWidth=1.6; ctx.stroke(); ctx.fillStyle='rgba(20,10,12,.9)'; ctx.beginPath(); ctx.arc(-4,-1,2.1,0,TAU); ctx.arc(4,-1,2.1,0,TAU); ctx.fill(); }
  else if(e.type==='shooter'){ ctx.fillStyle=fill; ctx.beginPath(); ctx.moveTo(0,e.r); ctx.lineTo(e.r*.7,0); ctx.lineTo(0,-e.r); ctx.lineTo(-e.r*.7,0); ctx.closePath(); ctx.fill(); ctx.shadowBlur=0; ctx.strokeStyle='rgba(255,255,255,.75)'; ctx.lineWidth=1.6; ctx.stroke(); ctx.fillStyle='rgba(255,255,255,.9)'; ctx.beginPath(); ctx.arc(0,0,3,0,TAU); ctx.fill(); ctx.fillStyle='rgba(30,10,40,.95)'; ctx.beginPath(); ctx.arc(0,0,1.4,0,TAU); ctx.fill(); }
  else if(e.type==='tank'){ ctx.fillStyle=fill; ctx.beginPath(); for(let i=0;i<6;i++){ const a=Math.PI/6+i*Math.PI/3; const px=Math.cos(a)*e.r,py=Math.sin(a)*e.r; i===0?ctx.moveTo(px,py):ctx.lineTo(px,py); } ctx.closePath(); ctx.fill(); ctx.shadowBlur=0; ctx.strokeStyle='rgba(255,255,255,.8)'; ctx.lineWidth=2; ctx.stroke(); ctx.fillStyle='rgba(8,30,32,.9)'; ctx.beginPath(); ctx.arc(0,0,e.r*.42,0,TAU); ctx.fill(); ctx.strokeStyle='rgba(255,255,255,.5)'; ctx.beginPath(); ctx.arc(0,0,e.r*.42,0,TAU); ctx.stroke(); ctx.fillStyle='#E4545F'; ctx.beginPath(); ctx.arc(0,0,3,0,TAU); ctx.fill(); }
  else if(e.type==='boss'){ const s=e.r/34; ctx.scale(s,s); ctx.fillStyle=fill; ctx.beginPath(); ctx.moveTo(0,26); ctx.lineTo(30,6); ctx.lineTo(38,-14); ctx.lineTo(14,-22); ctx.lineTo(0,-30); ctx.lineTo(-14,-22); ctx.lineTo(-38,-14); ctx.lineTo(-30,6); ctx.closePath(); ctx.fill(); ctx.shadowBlur=0; ctx.strokeStyle='rgba(255,255,255,.85)'; ctx.lineWidth=2.5; ctx.stroke(); ctx.fillStyle='#14100B'; ctx.beginPath(); ctx.arc(-10,-6,5,0,TAU); ctx.arc(10,-6,5,0,TAU); ctx.fill(); ctx.fillStyle='#E4545F'; ctx.beginPath(); ctx.arc(-10,-6,2.4,0,TAU); ctx.arc(10,-6,2.4,0,TAU); ctx.fill(); }
  ctx.restore();
  /* хп танка */
  if(e.type==='tank'&&e.hp<ETYPE.tank.hp){ ctx.fillStyle='rgba(0,0,0,.5)'; ctx.fillRect(e.x-16,e.y-e.r-9,32,3.5); ctx.fillStyle='#4ED8C8'; ctx.fillRect(e.x-16,e.y-e.r-9,32*(e.hp/ETYPE.tank.hp),3.5); } }
function render(){ ctx.clearRect(0,0,W,H);
  /* фон: тинт сектора */
  ctx.fillStyle='#07070C'; ctx.fillRect(0,0,W,H); ctx.fillStyle=SECTOR_TINT[Math.min(sector,4)]+'0.5)'; ctx.fillRect(0,0,W,H);
  ctx.save();
  if(shake>0)ctx.translate(rand(-shake,shake)*.5,rand(-shake,shake)*.5);
  /* звёзды */
  stars.forEach(s=>{ const a=s.l===0?.35:(s.l===1?.6:.95); ctx.globalAlpha=a*(.7+Math.sin(s.tw)*.3); ctx.fillStyle=s.l===2?'#EAD9BC':'#C7C7CC'; ctx.fillRect(s.x,s.y,s.s,s.s); }); ctx.globalAlpha=1;
  /* дропы */
  drops.forEach(d=>{ ctx.save(); ctx.translate(d.x,d.y); const col=d.kind==='repair'?'#8B9D83':(d.kind==='weapon'?'#D4A574':'#7EC8E3'); ctx.shadowColor=col; ctx.shadowBlur=12; ctx.rotate(Math.sin(d.t*2)*.3); ctx.fillStyle=col; ctx.beginPath(); ctx.roundRect(-8,-8,16,16,4); ctx.fill(); ctx.shadowBlur=0; ctx.strokeStyle='rgba(255,255,255,.8)'; ctx.lineWidth=1.4; ctx.stroke(); ctx.fillStyle='#0A0A0F'; ctx.font='bold 10px Inter,sans-serif'; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText(d.kind==='repair'?'+':(d.kind==='weapon'?'W':'S'),0,.5); ctx.restore(); });
  /* враги */
  enemies.forEach(drawEnemy);
  /* пули врагов */
  ebullets.forEach(b=>{ ctx.shadowColor='rgba(255,110,110,.9)'; ctx.shadowBlur=10; ctx.fillStyle='#FF8A8A'; ctx.beginPath(); ctx.arc(b.x,b.y,b.r,0,TAU); ctx.fill(); ctx.shadowBlur=0; ctx.fillStyle='#FFF'; ctx.beginPath(); ctx.arc(b.x,b.y,b.r*.45,0,TAU); ctx.fill(); });
  /* пули игрока */
  bullets.forEach(b=>{ ctx.shadowColor='rgba(232,176,75,.9)'; ctx.shadowBlur=9; ctx.fillStyle='#FFDFA8'; ctx.beginPath(); ctx.roundRect(b.x-b.r/2,b.y-8,b.r,14,b.r); ctx.fill(); ctx.shadowBlur=0; });
  /* игрок */
  if(player.alive&&running)drawShip();
  /* кольца */
  rings.forEach(r=>{ ctx.globalAlpha=Math.max(0,r.life/r.maxLife); ctx.strokeStyle=r.color; ctx.lineWidth=r.w; ctx.beginPath(); ctx.arc(r.x,r.y,r.r,0,TAU); ctx.stroke(); }); ctx.globalAlpha=1;
  /* частицы */
  parts.forEach(p=>{ ctx.globalAlpha=Math.max(0,p.life/p.maxLife); ctx.fillStyle=p.color; ctx.beginPath(); ctx.arc(p.x,p.y,p.size,0,TAU); ctx.fill(); }); ctx.globalAlpha=1;
  /* хп босса */
  if(boss){ ctx.fillStyle='rgba(0,0,0,.55)'; ctx.fillRect(30,18,W-60,7); ctx.fillStyle='#E4545F'; ctx.fillRect(30,18,(W-60)*clamp(boss.hp/bossMaxHp,0,1),7); ctx.strokeStyle='rgba(255,255,255,.4)'; ctx.lineWidth=1; ctx.strokeRect(30,18,W-60,7); ctx.fillStyle='#C7C7CC'; ctx.font='600 8px Inter,sans-serif'; ctx.textAlign='center'; ctx.fillText('БОСС',W/2,14); }
  /* плавающие тексты */
  texts.forEach(t=>{ ctx.globalAlpha=Math.max(0,t.life/t.maxLife); ctx.font=`700 ${t.size}px Inter,sans-serif`; ctx.textAlign='center'; ctx.fillStyle=t.color; ctx.shadowColor='rgba(0,0,0,.8)'; ctx.shadowBlur=4; ctx.fillText(t.txt,t.x,t.y); ctx.shadowBlur=0; }); ctx.globalAlpha=1;
  ctx.restore();
  /* виньетка урона */
  if(dmgFlash>0){ const g=ctx.createRadialGradient(W/2,H/2,H*.3,W/2,H/2,H*.72); g.addColorStop(0,'rgba(228,84,95,0)'); g.addColorStop(1,`rgba(228,84,95,${dmgFlash*.4})`); ctx.fillStyle=g; ctx.fillRect(0,0,W,H); } }
/* ─── Главный цикл: fixed timestep ─── */
let last=0,acc=0,rafId=0;
function loop(ts){ rafId=requestAnimationFrame(loop); if(!running)return; if(!last)last=ts; let dtms=ts-last; last=ts; if(dtms>200)dtms=200; acc+=dtms; let guard=0; while(acc>=STEP*1000&&guard++<6){ update(STEP); acc-=STEP*1000; } el.score.textContent=fmt(score); render(); }
/* ─── Ввод: перетаскивание + клавиатура ─── */
function ptr(e){ const r=cv.getBoundingClientRect(); const cx=(e.touches?e.touches[0].clientX:e.clientX)-r.left; const cy=(e.touches?e.touches[0].clientY:e.clientY)-r.top; return {x:cx*(W/r.width),y:cy*(H/r.height)}; }
let dragging=false;
function onDown(e){ if(!running)return; e.preventDefault(); audioInit(); dragging=true; const p=ptr(e); player.tx=p.x; player.ty=p.y-46; }
function onMove(e){ if(!running||!dragging)return; e.preventDefault(); const p=ptr(e); player.tx=p.x; player.ty=p.y-46; }
function onUp(){ dragging=false; }
cv.addEventListener('pointerdown',onDown); cv.addEventListener('pointermove',onMove); window.addEventListener('pointerup',onUp);
const keys={};
window.addEventListener('keydown',e=>{ keys[e.key]=true; if(running&&['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key))e.preventDefault(); });
window.addEventListener('keyup',e=>{ keys[e.key]=false; });
function keyMove(dt){ const sp=340*dt; let dx=0,dy=0; if(keys.ArrowLeft||keys.a)dx-=1; if(keys.ArrowRight||keys.d)dx+=1; if(keys.ArrowUp||keys.w)dy-=1; if(keys.ArrowDown||keys.s)dy+=1; if(dx||dy){ player.tx=clamp(player.tx+dx*sp,16,W-16); player.ty=clamp(player.ty+dy*sp,50,H-24); } }
const _update=update; update=function(dt){ keyMove(dt); _update(dt); };
/* ─── Поток: меню/игра/конец ─── */
function resetGame(){ score=0; wave=0; sector=0; bullets=[];ebullets=[];enemies=[];drops=[];parts=[];rings=[];texts=[]; boss=null; shake=0; dmgFlash=0; combo=0; comboT=0; waveState='idle'; Object.assign(player,{x:W/2,y:H-70,tx:W/2,ty:H-70,hp:4,hpMax:4,shield:0,wlevel:1,fireT:.3,inv:1.2,calm:0,alive:true,tilt:0}); updateHullUI(); el.score.textContent='0'; el.wave.textContent='1'; }
function startGame(){ touchStreak(); if(mode==='daily') dailyRng=mulberry32(xmur3('shooter-'+today)()); else dailyRng=Math.random; resetGame(); running=true; over=false; last=0; acc=0; $('welcome').classList.add('hidden'); $('modal').classList.add('hidden'); $('game').classList.remove('hidden'); refreshHud(); startWave(1); if(!rafId)rafId=requestAnimationFrame(loop); }
function refreshHud(){ el.daily.textContent=fmt(dailyBest); el.best.textContent=fmt(best); el.streakN.textContent=effStreak(); el.multN.textContent='×'+mult.toFixed(2); refreshMissionsUI(); }
function refreshWelcome(){ el.wDaily.textContent=fmt(dailyBest); el.wBest.textContent=fmt(best); el.wStreak.textContent='🔥 '+effStreak(); $('daily-date').textContent='Вызов дня · '+today.slice(5).replace('-','.'); }
function gameOver(){ over=true; running=false; player.alive=false; sfx.over(); burst(player.x,player.y,70,'#E8B04B',280,4); ring(player.x,player.y,'#E4545F',460,5); shake=22; missionTick('score',Math.floor(score),true); let isRec=false,isRecDay=false; if(score>best){ best=Math.floor(score); lsSet(K_BEST,best); isRec=true; } if(score>dailyBest){ dailyBest=Math.floor(score); lsSet(K_DAILY,dailyBest); isRecDay=true; } setTimeout(()=>{ $('modal-badge').textContent=isRec||isRecDay?'Новый рекорд':'Игра окончена'; $('modal-badge').classList.toggle('record',isRec||isRecDay); $('modal-title').textContent=isRecDay&&!isRec?'Рекорд дня!':(isRec?'Абсолютный рекорд!':'Корабль потерян'); $('modal-score').innerHTML=`Очки <b>${fmt(score)}</b> · Волна <b>${wave}</b><br>Рекорд <b>${fmt(best)}</b> · за день <b>${fmt(dailyBest)}</b>`; $('modal').classList.remove('hidden'); },900); }
function toMenu(){ running=false; over=false; $('game').classList.add('hidden'); $('modal').classList.add('hidden'); $('welcome').classList.remove('hidden'); refreshWelcome(); }
/* ─── Кнопки ─── */
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
/* ─── Старт ─── */
refreshWelcome(); refreshHud(); syncSoundBtn(); updateHullUI();
/* ─── Debug-хук для headless-тестов ─── */
window.__sh={
  start:startGame, over:()=>{ running=true; gameOver(); },
  state(){ return {score:Math.floor(score),wave,enemies:enemies.length,eb:ebullets.length,bullets:bullets.length,hp:player.hp,shield:Math.round(player.shield),wl:player.wlevel,boss:!!boss,running,over,mode,mult}; },
  addScore:n=>{ score+=n; }, killAll:()=>{ [...enemies].forEach(e=>{ const i=enemies.indexOf(e); if(i>=0)killEnemy(e,i); }); },
  spawn:t=>spawnEnemy(t||'grunt',W/2,100,{}), hurt:damagePlayer, drop:k=>drops.push({x:player.x,y:player.y-12,vy:0,kind:k||'weapon',t:0}),
  wave:n=>startWave(n), god:()=>{ player.inv=9999; }, missions:()=>missionData, mult:()=>mult, queue:()=>spawnQueue.map(q=>q.type+'@'+Math.round(q.x)),
  records:()=>({best:lsGet(K_BEST,0),daily:lsGet(K_DAILY,0),streak:lsGet(K_STREAK,0),lastDay,today}),
};
