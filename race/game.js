'use strict';
/* ═══════════════ НОЧНОЙ ПОТОК v2.0 · ночная гонка · AXIIOM canon ═══════════════ */
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
/* ─── Аудио ─── */
let AC=null,master=null,engine=null,engineGain=null;
function audioInit(){ if(AC)return; try{ AC=new (window.AudioContext||window.webkitAudioContext)(); master=AC.createGain(); master.gain.value=muted?0:0.5; master.connect(AC.destination);}catch(e){} }
function tone(freq,dur,type,vol,slide,delay){ if(!AC||muted)return; const t0=AC.currentTime+(delay||0); const o=AC.createOscillator(),g=AC.createGain(); o.type=type||'square'; o.frequency.setValueAtTime(freq,t0); if(slide)o.frequency.exponentialRampToValueAtTime(Math.max(30,freq+slide),t0+dur); g.gain.setValueAtTime(vol||.15,t0); g.gain.exponentialRampToValueAtTime(.001,t0+dur); o.connect(g);g.connect(master); o.start(t0);o.stop(t0+dur+.02); }
function noise(dur,vol,fc,delay){ if(!AC||muted)return; const t0=AC.currentTime+(delay||0); const n=Math.floor(AC.sampleRate*dur); const buf=AC.createBuffer(1,n,AC.sampleRate); const d=buf.getChannelData(0); for(let i=0;i<n;i++)d[i]=(Math.random()*2-1)*(1-i/n); const src=AC.createBufferSource(); src.buffer=buf; const f=AC.createBiquadFilter(); f.type='lowpass'; f.frequency.setValueAtTime(fc||900,t0); f.frequency.exponentialRampToValueAtTime(120,t0+dur); const g=AC.createGain(); g.gain.setValueAtTime(vol||.3,t0); g.gain.exponentialRampToValueAtTime(.001,t0+dur); src.connect(f);f.connect(g);g.connect(master); src.start(t0); }
function engineStart(){ if(!AC||engine)return; engine=AC.createOscillator(); engine.type='sawtooth'; engine.frequency.value=70; const f=AC.createBiquadFilter(); f.type='lowpass'; f.frequency.value=340; engineGain=AC.createGain(); engineGain.gain.value=muted?0:.045; engine.connect(f);f.connect(engineGain);engineGain.connect(master); engine.start(); }
function engineStop(){ if(engine){ try{engine.stop();}catch(e){} engine=null; } }
function enginePitch(sp,nitro){ if(engine)engine.frequency.value=52+sp*.16+(nitro?46:0); }
const sfx={
  star(){ tone(880,.08,'sine',.12); tone(1320,.1,'sine',.1,0,.06); },
  nitro(){ tone(200,.4,'sawtooth',.2,600); noise(.4,.2,1400); },
  crash(){ noise(.5,.5,800); tone(80,.4,'sawtooth',.3,-40); },
  warn(){ tone(520,.07,'square',.05); },
  near(){ tone(1400,.06,'sine',.09,-300); },
  over(){ tone(300,.5,'sawtooth',.2,-220); noise(.6,.4,700,.1); },
  clear(){ tone(523,.1,'triangle',.13); tone(659,.1,'triangle',.13,0,.09); tone(784,.16,'triangle',.15,0,.18); },
};
/* ─── Хранилище/мета ─── */
const K_BEST='rc.best',K_DAILY='rc.daily.'+today,K_STREAK='rc.streak',K_LASTDAY='rc.lastDay',K_MUTE='rc.muted',K_MISS='rc.missions.'+today;
const el={ score:$('score-val'),daily:$('daily-val'),best:$('best-val'),dist:$('dist-val'),nitro:$('hull-fill'),streakN:$('streak-n'),multN:$('mult-n'),missionsN:$('missions-n'),wDaily:$('w-daily-best'),wBest:$('w-best'),wStreak:$('w-streak'),announce:$('announce'),gc:$('gc') };
const W=400,H=580,STEP=1/60;
const cv=el.gc,ctx=cv.getContext('2d');
let dpr=1;
function fitCanvas(){ dpr=Math.min(window.devicePixelRatio||1,2); cv.width=W*dpr; cv.height=H*dpr; cv.style.width=W+'px'; cv.style.height=H+'px'; ctx.setTransform(dpr,0,0,dpr,0,0); }
fitCanvas(); window.addEventListener('resize',fitCanvas);
/* ─── Состояние ─── */
const ROAD_L=40,ROAD_R=360,LANES=[105,200,295];
let muted=lsGet(K_MUTE,false),mode='daily';
let running=false,over=false;
let score=0,mult=1,best=lsGet(K_BEST,0),dailyBest=lsGet(K_DAILY,0);
let streak=lsGet(K_STREAK,0),lastDay=lsGet(K_LASTDAY,'');
let dailyRng=Math.random;
const sr=(a,b)=>a+(mode==='daily'?dailyRng():Math.random())*(b-a);
const pick=arr=>arr[(mode==='daily'?dailyRng():Math.random())*arr.length|0];
const car={x:200,tx:200,y:468,tilt:0,lives:3,inv:0,nitro:0};
let speed=250,dist=0,sector=0,sectorAnnounced=-1;
let cars=[],pickups=[],warns=[],parts=[],texts=[];
let spawnT=1,starT=1.4,scroll=0,shake=0,noCrashT=0,overtakes=0;
/* ─── Мета ─── */
function effStreak(){ return (lastDay===today||lastDay===yesterday)?streak:0; }
function getMult(s){ return 1+Math.min(Math.max(s-1,0),10)*0.05; }
function touchStreak(){ if(lastDay===today){ mult=getMult(streak); return; } streak=(lastDay===yesterday)?(streak||0)+1:1; lastDay=today; lsSet(K_STREAK,streak); lsSet(K_LASTDAY,lastDay); mult=getMult(streak); if(streak>1)toast(`🔥 Стрик <b>${streak}</b> · очки ×<b>${mult.toFixed(2)}</b>`); }
const MISSIONS=[
  {id:'near10',  name:'10 проездов вплотную',      target:10, track:'near'},
  {id:'stars15', name:'Собрать 15 звёзд',          target:15, track:'stars'},
  {id:'dist2k',  name:'Проехать 2000 м за игру',   target:2000,track:'dist'},
  {id:'sector2', name:'Достичь 2-го сектора',      target:2,  track:'sector'},
  {id:'nitro5',  name:'Собрать 5 нитро',           target:5,  track:'nitros'},
  {id:'flaw60',  name:'60 с без аварий',           target:60, track:'flaw'},
  {id:'score2k', name:'Набрать 2000 очков за игру',target:2000,track:'score'},
  {id:'over30',  name:'Обогнать 30 машин',         target:30, track:'overtakes'},
];
let missionData=lsGet(K_MISS,{p:{},done:{}});
if(!missionData.p)missionData={p:{},done:{}};
function saveMissions(){ lsSet(K_MISS,missionData); }
function missionAward(mid){ if(missionData.done[mid])return; missionData.done[mid]=1; saveMissions(); const bonus=Math.round(25*mult); if(running&&!over){ score+=bonus; floatTxt(car.x,car.y-70,`+${bonus}`,'#D4A574',15); } toast(`🎯 Миссия выполнена: <b>+${bonus}</b>`); sfx.clear(); refreshMissionsUI(); }
function missionTick(track,val,absolute){ MISSIONS.forEach(m=>{ if(m.track!==track||missionData.done[m.id])return; if(absolute){ if(val>(missionData.p[m.id]||0))missionData.p[m.id]=val; } else missionData.p[m.id]=(missionData.p[m.id]||0)+val; if(missionData.p[m.id]>=m.target)missionAward(m.id); }); saveMissions(); refreshMissionsUI(); }
function refreshMissionsUI(){ const done=MISSIONS.filter(m=>missionData.done[m.id]).length; el.missionsN.textContent=done+'/3'; }
function renderMissionsModal(){ const list=$('mmodal-list'); list.innerHTML=''; MISSIONS.forEach(m=>{ const p=Math.min(missionData.p[m.id]||0,m.target); const done=!!missionData.done[m.id]; const d=document.createElement('div'); d.className='mm-item'+(done?' done':''); d.innerHTML=`<span class="mm-check">✓</span><span class="mm-body"><span class="mm-name">${m.name}</span><span class="mm-prog"><b>${fmt(p)}</b> / ${fmt(m.target)}</span></span>`; list.appendChild(d); }); }
function toast(html){ const t=document.createElement('span'); t.className='toast'; t.innerHTML=html; $('toasts').appendChild(t); setTimeout(()=>t.classList.add('out'),2600); setTimeout(()=>t.remove(),3000); }
function announce(big,sub){ el.announce.innerHTML=`<span class="an-big">${big}</span>${sub?`<span class="an-sub">${sub}</span>`:''}`; el.announce.classList.remove('hidden'); clearTimeout(annT); annT=setTimeout(()=>el.announce.classList.add('hidden'),1700); }
function part(x,y,vx,vy,life,color,size){ parts.push({x,y,vx,vy,life,maxLife:life,color,size}); }
function burst(x,y,n,color,spd){ for(let i=0;i<n;i++){ const a=Math.random()*TAU,v=rand(spd*.3,spd); part(x,y,Math.cos(a)*v,Math.sin(a)*v,rand(.3,.7),color,rand(1.5,3)); } }
function floatTxt(x,y,txt,color,size){ texts.push({x,y,txt,color,size:size||13,life:.9,maxLife:.9}); }
/* ─── Трафик ─── */
const CAR_COLORS=['#8FA3B8','#B87A6A','#7A9E8F','#9E8F7A','#8B7AB8','#B8B07A'];
function queueCar(){ const lane=(mode==='daily'?dailyRng():Math.random())*3|0; warns.push({lane,t:.55}); sfx.warn(); }
function spawnCar(lane){ const truck=(mode==='daily'?dailyRng():Math.random())<.12; const rel=truck?sr(40,80):sr(70,140); cars.push({lane,x:LANES[lane],y:-140-truck*60,w:truck?58:54,h:truck?150:94,color:pick(CAR_COLORS),truck,rel,passed:false,nearChecked:false}); }
function spawnPickup(){ const isNitro=(mode==='daily'?dailyRng():Math.random())<.14; const lane=(mode==='daily'?dailyRng():Math.random())*3|0; const x=LANES[lane]+sr(-26,26); if(cars.some(c=>Math.abs(c.x-x)<60&&c.y<0))return; pickups.push({x,y:-40,isNitro,t:Math.random()*TAU}); }
/* ─── Авария ─── */
function crash(c){ if(over||car.inv>0)return; car.lives--; car.inv=1.8; noCrashT=0; speed=Math.max(240,speed*.6); shake=16; sfx.crash(); burst(car.x,car.y-20,40,'#E8B04B',220); burst(car.x,car.y-20,26,'#E4545F',180); floatTxt(car.x,car.y-80,'АВАРИЯ','#E4545F',16); if(c){ const i=cars.indexOf(c); if(i>=0){ burst(c.x,c.y,30,c.color,200); cars.splice(i,1); } } if(car.lives<=0)gameOver(); }
function update(dt){
  if(over)return;
  /* скорость и дистанция */
  const nitroOn=car.nitro>0;
  if(nitroOn){ car.nitro-=dt; el.nitro.style.width=(car.nitro/2.2*100)+'%'; if(car.nitro<=0)el.nitro.style.width='0%'; }
  speed=Math.min(640,speed+7*dt*(nitroOn?2.2:1));
  if(!nitroOn&&speed>250&&Math.random()<dt*.02)speed=Math.max(250,speed-40*dt);
  const eff=nitroOn?speed+260:speed;
  dist+=eff*dt/8;
  scroll+=eff*dt;
  enginePitch(eff,nitroOn);
  missionTick('dist',Math.floor(dist),true);
  el.dist.textContent=fmt(dist)+'м';
  score+=eff*dt*.05*mult;
  noCrashT+=dt; if(noCrashT>=60)missionTick('flaw',60);
  /* сектора */
  const ns=Math.floor(dist/800)%3;
  if(ns!==sector){ sector=ns; }
  if(Math.floor(dist/800)>sectorAnnounced){ sectorAnnounced=Math.floor(dist/800); announce(['СЕКТОР: ГОРОД','СЕКТОР: ТУННЕЛЬ','СЕКТОР: МОСТ'][sector],'дистанция '+fmt(dist)+'м'); }
  /* игрок */
  const k=1-Math.exp(-dt*10); car.x+=(car.tx-car.x)*k; car.x=clamp(car.x,ROAD_L+30,ROAD_R-30); car.tilt=clamp((car.tx-car.x)*.02,-.34,.34);
  if(car.inv>0)car.inv-=dt;
  /* спавн трафика */
  spawnT-=dt; if(spawnT<=0){ queueCar(); spawnT=clamp(sr(.42,1.05)*(280/speed)*1.4,.34,1.5); }
  starT-=dt; if(starT<=0){ spawnPickup(); starT=sr(.8,1.5); }
  /* предупреждения */
  warns=warns.filter(w=>{ w.t-=dt; if(w.t<=0){ spawnCar(w.lane); return false; } return true; });
  /* машины */
  const py0=car.y-40,py1=car.y+40;
  for(let i=cars.length-1;i>=0;i--){ const c=cars[i]; c.y+=((nitroOn?speed+260:speed)+c.rel)*dt;
    if(!c.passed&&c.y>H+60){ c.passed=true; overtakes++; missionTick('overtakes',1); score+=10*mult; cars.splice(i,1); continue; }
    if(!c.nearChecked&&c.y>py0&&c.y<py1+70){ c.nearChecked=true; const dx=Math.abs(c.x-car.x); if(dx<64&&dx>30&&c.y<py1){ missionTick('near',1); score+=50*mult; sfx.near(); floatTxt((c.x+car.x)/2,car.y-50,'РИСК ×2','#D4A574',13); burst((c.x+car.x)/2,car.y,10,'#FFD9A8',120); } }
    if(c.y>py0&&c.y<py1&&Math.abs(c.x-car.x)<((c.w+52)/2-6)){ if(nitroOn){ c.hp=(c.hp||2)-1; if(c.hp<=0){ burst(c.x,c.y,30,c.color,200); cars.splice(i,1); score+=25*mult; floatTxt(c.x,c.y-40,'+25','#E8B04B',13); sfx.crash(); shake=8; continue; } } else crash(c); }
  }
  /* пикапы */
  for(let i=pickups.length-1;i>=0;i--){ const p=pickups[i]; p.y+=eff*dt; p.t+=dt; if(p.y>H+40){ pickups.splice(i,1); continue; } if(Math.hypot(p.x-car.x,p.y-(car.y-8))<38){ pickups.splice(i,1); if(p.isNitro){ car.nitro=2.2; missionTick('nitros',1); sfx.nitro(); floatTxt(car.x,car.y-70,'НИТРО!','#E4545F',16); } else { missionTick('stars',1); score+=25*mult; sfx.star(); floatTxt(p.x,p.y-24,'+25','#FFD9A8',13); burst(p.x,p.y,12,'#FFD9A8',130); } } }
  /* частицы/тексты/тряска */
  parts=parts.filter(p=>{ p.life-=dt; p.x+=p.vx*dt*60; p.y+=p.vy*dt*60+eff*dt*.6; p.vx*=.97; return p.life>0; });
  texts=texts.filter(t=>{ t.life-=dt; t.y-=30*dt; return t.life>0; });
  if(shake>0)shake=Math.max(0,shake-dt*40);
  /* выхлоп */
  if(Math.random()<dt*30)part(car.x+rand(-14,14),car.y+44,rand(-.4,.4),rand(1,2),.3,'rgba(200,200,210,.4)',2);
  if(nitroOn&&Math.random()<dt*60){ part(car.x+rand(-10,10),car.y+48,rand(-.5,.5),rand(2,4),.35,Math.random()<.5?'#E8B04B':'#E4545F',3); }
}/* ═══ РЕНДЕР ═══ */
const SECTORS_V=[
  {road:'#14141B',edge:'#23232E',name:'город'},
  {road:'#101016',edge:'#1C1C26',name:'туннель'},
  {road:'#0E1116',edge:'#191E28',name:'мост'},
];
function drawCar(x,y,w,h,color,opts){ ctx.save(); ctx.translate(x,y);
  /* тень/отражение на мокром асфальте */
  const grd=ctx.createLinearGradient(0,h/2,0,h/2+46); grd.addColorStop(0,opts.isPlayer?'rgba(232,176,75,.22)':hexA(color,.2)); grd.addColorStop(1,'rgba(0,0,0,0)'); ctx.fillStyle=grd; ctx.fillRect(-w/2-4,h/2-6,w+8,46);
  /* корпус */
  const r=10; ctx.beginPath(); ctx.roundRect(-w/2,-h/2,w,h,r); ctx.fillStyle=color; ctx.fill();
  /* капот-блик */
  ctx.fillStyle='rgba(255,255,255,.14)'; ctx.beginPath(); ctx.roundRect(-w/2+5,-h/2+6,w-10,h*.22,6); ctx.fill();
  /* стекло */
  ctx.fillStyle=opts.isPlayer?'#14100B':'rgba(12,14,20,.85)'; ctx.beginPath(); ctx.roundRect(-w/2+8,-h*.16,w-16,h*.3,5); ctx.fill();
  if(opts.isPlayer){ ctx.fillStyle='rgba(255,255,255,.5)'; ctx.beginPath(); ctx.roundRect(-w/2+11,-h*.13,w-22,h*.1,3); ctx.fill(); }
  ctx.restore(); }
function hexA(hex,a){ const n=parseInt(hex.slice(1),16); return `rgba(${n>>16},${(n>>8)&255},${n&255},${a})`; }
function render(){ ctx.clearRect(0,0,W,H);
  const s=SECTORS_V[sector];
  ctx.save();
  if(shake>0)ctx.translate(rand(-shake,shake)*.5,rand(-shake,shake)*.4);
  /* фон сектора */
  ctx.fillStyle='#07070B'; ctx.fillRect(0,0,W,H);
  if(sector===0){ /* город: силуэты */ ctx.fillStyle='#0D0D13'; for(let i=0;i<8;i++){ const bh=60+((i*73)%90); const bx=(i*55+(scroll*.4)%55); ctx.fillRect(bx%W-30,H-140-bh,44,bh+40); } }
  if(sector===1){ /* туннель: стены */ ctx.fillStyle='#15151E'; ctx.fillRect(0,0,ROAD_L,H); ctx.fillRect(ROAD_R,0,W-ROAD_R,H); ctx.fillStyle='#1D1D29'; for(let y=-(scroll%160);y<H;y+=160){ ctx.fillRect(0,y,ROAD_L,10); ctx.fillRect(ROAD_R,y,W-ROAD_R,10); } }
  if(sector===2){ /* мост: перила + река */ ctx.fillStyle='rgba(80,120,160,.08)'; for(let y=-(scroll*1.2%90);y<H;y+=90){ ctx.fillRect(0,y,W,2); } ctx.fillStyle='#181820'; ctx.fillRect(0,0,ROAD_L,H); ctx.fillRect(ROAD_R,0,W-ROAD_R,H); ctx.fillStyle='rgba(212,165,116,.14)'; for(let y=-(scroll%70);y<H;y+=70){ ctx.fillRect(ROAD_L-6,y,4,16); ctx.fillRect(ROAD_R+2,y,4,16); } }
  /* дорога */
  ctx.fillStyle=s.road; ctx.fillRect(ROAD_L,0,ROAD_R-ROAD_L,H);
  ctx.fillStyle=s.edge; ctx.fillRect(ROAD_L-4,0,4,H); ctx.fillRect(ROAD_R,0,4,H);
  /* разметка */
  ctx.fillStyle='rgba(210,190,150,.35)';
  for(let y=-(scroll%90);y<H;y+=90){ ctx.fillRect(153,y,4,46); ctx.fillRect(247,y,4,46); }
  ctx.fillStyle='rgba(220,200,160,.5)'; ctx.fillRect(ROAD_L+2,0,2,H); ctx.fillRect(ROAD_R-4,0,2,H);
  /* предупреждения-стрелки */
  warns.forEach(w=>{ const y=64+Math.sin(performance.now()*.02)*4; ctx.fillStyle=`rgba(232,176,75,${.5+Math.sin(performance.now()*.03)*.4})`; ctx.beginPath(); ctx.moveTo(LANES[w.lane],y+14); ctx.lineTo(LANES[w.lane]-13,y-10); ctx.lineTo(LANES[w.lane]+13,y-10); ctx.closePath(); ctx.fill(); });
  /* машины */
  cars.forEach(c=>{ drawCar(c.x,c.y,c.w,c.h,c.color,{});
    /* фары встречных (конус вниз к игроку) */
    const hg=ctx.createLinearGradient(0,c.y+c.h/2,0,c.y+c.h/2+90); hg.addColorStop(0,'rgba(255,240,200,.3)'); hg.addColorStop(1,'rgba(255,240,200,0)'); ctx.fillStyle=hg; ctx.beginPath(); ctx.moveTo(c.x-c.w/2+8,c.y+c.h/2); ctx.lineTo(c.x-c.w/2-14,c.y+c.h/2+90); ctx.lineTo(c.x+c.w/2+14,c.y+c.h/2+90); ctx.lineTo(c.x+c.w/2-8,c.y+c.h/2); ctx.closePath(); ctx.fill();
    ctx.fillStyle='#FFF6D8'; ctx.shadowColor='#FFE9B0'; ctx.shadowBlur=10; ctx.beginPath(); ctx.arc(c.x-c.w/2+10,c.y+c.h/2-4,4,0,TAU); ctx.arc(c.x+c.w/2-10,c.y+c.h/2-4,4,0,TAU); ctx.fill(); ctx.shadowBlur=0; });
  /* пикапы */
  pickups.forEach(p=>{ if(p.isNitro){ ctx.save(); ctx.translate(p.x,p.y); ctx.rotate(p.t); ctx.shadowColor='#E4545F'; ctx.shadowBlur=14; ctx.fillStyle='#E4545F'; ctx.beginPath(); ctx.roundRect(-9,-13,18,26,5); ctx.fill(); ctx.shadowBlur=0; ctx.fillStyle='#FFD9DC'; ctx.font='700 11px Inter,sans-serif'; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText('N',0,0); ctx.restore(); } else { ctx.save(); ctx.translate(p.x,p.y+Math.sin(p.t*3)*3); ctx.shadowColor='#FFD9A8'; ctx.shadowBlur=12; ctx.fillStyle='#E8B04B'; star5(0,0,11,5.2); ctx.fill(); ctx.shadowBlur=0; ctx.fillStyle='rgba(255,255,255,.55)'; star5(0,-1,5,2.4); ctx.fill(); ctx.restore(); } });
  /* игрок */
  if(!(car.inv>0&&Math.floor(car.inv*12)%2===0)||over){ drawCar(car.x,car.y,52,92,'#E8B04B',{isPlayer:true});
    /* конусы фар игрока */
    const hg=ctx.createLinearGradient(0,car.y-46,0,car.y-180); hg.addColorStop(0,'rgba(255,244,210,.22)'); hg.addColorStop(1,'rgba(255,244,210,0)'); ctx.fillStyle=hg; ctx.beginPath(); ctx.moveTo(car.x-20,car.y-46); ctx.lineTo(car.x-52,car.y-190); ctx.lineTo(car.x+52,car.y-190); ctx.lineTo(car.x+20,car.y-46); ctx.closePath(); ctx.fill(); }
  /* частицы */
  parts.forEach(p=>{ ctx.globalAlpha=clamp(p.life/p.maxLife,0,1); ctx.fillStyle=p.color; ctx.beginPath(); ctx.arc(p.x,p.y,p.size,0,TAU); ctx.fill(); }); ctx.globalAlpha=1;
  /* плавающие тексты */
  texts.forEach(t=>{ ctx.globalAlpha=clamp(t.life/t.maxLife,0,1); ctx.font=`700 ${t.size}px Inter,sans-serif`; ctx.textAlign='center'; ctx.fillStyle=t.color; ctx.fillText(t.txt,t.x,t.y); }); ctx.globalAlpha=1;
  /* скоростные линии */
  if(speed>420||car.nitro>0){ const a=clamp((speed-420)/220,0,1)*.5+(car.nitro>0?.3:0); ctx.strokeStyle=`rgba(255,255,255,${a})`; ctx.lineWidth=1.5; for(let i=0;i<7;i++){ const x=ROAD_L+((i*67+scroll*.8)%(ROAD_R-ROAD_L)); const y=(scroll*2+i*131)%H; ctx.beginPath(); ctx.moveTo(x,y); ctx.lineTo(x,y+40); ctx.stroke(); } }
  ctx.restore();
  /* спидометр */
  const kmh=Math.round((car.nitro>0?speed+260:speed)*.6); ctx.fillStyle='rgba(10,10,15,.6)'; ctx.beginPath(); ctx.roundRect(W-92,H-40,84,26,8); ctx.fill(); ctx.fillStyle=car.nitro>0?'#E4545F':'#FFD9A8'; ctx.font='700 12px Inter,sans-serif'; ctx.textAlign='center'; ctx.fillText(kmh+' км/ч',W-50,H-23);
  /* жизни */
  for(let i=0;i<car.lives;i++){ ctx.fillStyle='#E4545F'; ctx.shadowColor='#E4545F'; ctx.shadowBlur=6; ctx.beginPath(); ctx.arc(24+i*20,H-27,5,0,TAU); ctx.fill(); ctx.shadowBlur=0; } }
function star5(cx,cy,ro,ri){ ctx.beginPath(); for(let i=0;i<10;i++){ const a=-Math.PI/2+i*Math.PI/5; const r=i%2?ri:ro; ctx.lineTo(cx+Math.cos(a)*r,cy+Math.sin(a)*r); } ctx.closePath(); }
/* ─── Цикл ─── */
let last=0,acc=0,rafId=0,annT=0;
function loop(ts){ rafId=requestAnimationFrame(loop); if(!running)return; if(!last)last=ts; let dtms=ts-last; last=ts; if(dtms>200)dtms=200; acc+=dtms; let guard=0; while(acc>=STEP*1000&&guard++<6){ handleInput(STEP); update(STEP); acc-=STEP*1000; } el.score.textContent=fmt(score); render(); }
/* ─── Ввод ─── */
const keys={};
window.addEventListener('keydown',e=>{ keys[e.key]=true; if(['ArrowLeft','ArrowRight'].includes(e.key))e.preventDefault(); });
window.addEventListener('keyup',e=>{ keys[e.key]=false; });
function handleInput(dt){ const sp=430*dt; if(keys.ArrowLeft||keys.a)car.tx-=sp; if(keys.ArrowRight||keys.d)car.tx+=sp; }
let dragging=false;
cv.addEventListener('pointerdown',e=>{ dragging=true; audioInit(); const r=cv.getBoundingClientRect(); car.tx=clamp((e.clientX-r.left)*(W/r.width),ROAD_L+30,ROAD_R-30); });
cv.addEventListener('pointermove',e=>{ if(!dragging)return; const r=cv.getBoundingClientRect(); car.tx=clamp((e.clientX-r.left)*(W/r.width),ROAD_L+30,ROAD_R-30); });
window.addEventListener('pointerup',()=>dragging=false);
/* ─── Поток ─── */
function resetGame(){ score=0;dist=0;sector=0;sectorAnnounced=-1;speed=250;overtakes=0;noCrashT=0; cars=[];pickups=[];warns=[];parts=[];texts=[]; Object.assign(car,{x:200,tx:200,tilt:0,lives:3,inv:1.2,nitro:0}); el.nitro.style.width='0%'; el.score.textContent='0'; el.dist.textContent='0м'; }
function startGame(){ touchStreak(); audioInit(); if(mode==='daily')dailyRng=mulberry32(xmur3('race-'+today)()); else dailyRng=Math.random; resetGame(); running=true; over=false; last=0; acc=0; spawnT=.9; starT=1.2; $('welcome').classList.add('hidden'); $('modal').classList.add('hidden'); $('game').classList.remove('hidden'); refreshHud(); announce('СТАРТ','газ в пол'); engineStart(); if(!rafId)rafId=requestAnimationFrame(loop); }
function refreshHud(){ el.daily.textContent=fmt(dailyBest); el.best.textContent=fmt(best); el.streakN.textContent=effStreak(); el.multN.textContent='×'+mult.toFixed(2); refreshMissionsUI(); }
function refreshWelcome(){ el.wDaily.textContent=fmt(dailyBest); el.wBest.textContent=fmt(best); el.wStreak.textContent='🔥 '+effStreak(); $('daily-date').textContent='Вызов дня · '+today.slice(5).replace('-','.'); }
function gameOver(){ over=true; running=false; engineStop(); sfx.over(); missionTick('score',Math.floor(score),true); let isRec=false,isRecDay=false; if(score>best){ best=Math.floor(score); lsSet(K_BEST,best); isRec=true; } if(score>dailyBest){ dailyBest=Math.floor(score); lsSet(K_DAILY,dailyBest); isRecDay=true; } setTimeout(()=>{ $('modal-badge').textContent=isRec||isRecDay?'Новый рекорд':'Игра окончена'; $('modal-badge').classList.toggle('record',isRec||isRecDay); $('modal-title').textContent=isRecDay&&!isRec?'Рекорд дня!':(isRec?'Абсолютный рекорд!':'Машина разбита'); $('modal-score').innerHTML=`Очки <b>${fmt(score)}</b> · Дистанция <b>${fmt(dist)}м</b><br>Рекорд <b>${fmt(best)}</b> · за день <b>${fmt(dailyBest)}</b>`; $('modal').classList.remove('hidden'); },900); }
function toMenu(){ running=false; over=false; engineStop(); $('game').classList.add('hidden'); $('modal').classList.add('hidden'); $('welcome').classList.remove('hidden'); refreshWelcome(); }
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
$('btn-sound').addEventListener('click',()=>{ muted=!muted; lsSet(K_MUTE,muted); if(master)master.gain.value=muted?0:0.5; if(engineGain)engineGain.gain.value=muted?0:.045; syncSoundBtn(); if(!muted){ audioInit(); sfx.star(); } });
refreshWelcome(); refreshHud(); syncSoundBtn();
/* ─── Debug-хук ─── */
window.__rc={
  start:startGame, over:()=>{ running=true; gameOver(); },
  state(){ return {score:Math.floor(score),dist:Math.floor(dist),lives:car.lives,speed:Math.round(speed),cars:cars.length,warns:warns.length,sector,running,over,mode,mult}; },
  spawnCar:()=>spawnCar(1), star:()=>pickups.push({x:car.x,y:car.y-60,isNitro:false,t:0}), nitro:()=>pickups.push({x:car.x,y:car.y-60,isNitro:true,t:0}),
  crash:()=>{ car.inv=0; crash(null); }, god:()=>{ car.inv=9999; }, addDist:n=>{ dist+=n; }, missions:()=>missionData,
  records:()=>({best:lsGet(K_BEST,0),daily:lsGet(K_DAILY,0),streak:lsGet(K_STREAK,0),today}),
};
