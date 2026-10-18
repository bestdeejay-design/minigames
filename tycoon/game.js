'use strict';
/* ═══════════════ МЕГАПОЛИС v2.0 · тайкун-небоскрёб · AXIIOM canon ═══════════════ */
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
function tone(freq,dur,type,vol,slide,delay){ if(!AC||muted)return; const t0=AC.currentTime+(delay||0); const o=AC.createOscillator(),g=AC.createGain(); o.type=type||'sine'; o.frequency.setValueAtTime(freq,t0); if(slide)o.frequency.exponentialRampToValueAtTime(Math.max(30,freq+slide),t0+dur); g.gain.setValueAtTime(vol||.15,t0); g.gain.exponentialRampToValueAtTime(.001,t0+dur); o.connect(g);g.connect(master); o.start(t0);o.stop(t0+dur+.02); }
function noiseB(dur,vol,fc){ if(!AC||muted)return; const n=Math.floor(AC.sampleRate*dur); const buf=AC.createBuffer(1,n,AC.sampleRate); const d=buf.getChannelData(0); for(let i=0;i<n;i++)d[i]=(Math.random()*2-1)*(1-i/n); const src=AC.createBufferSource(); src.buffer=buf; const f=AC.createBiquadFilter(); f.type='lowpass'; f.frequency.value=fc||800; const g=AC.createGain(); g.gain.value=vol; src.connect(f);f.connect(g);g.connect(master); src.start(); }
const sfx={
  build(){ noiseB(.25,.3,500); tone(180,.2,'square',.1,-60); tone(240,.15,'square',.08,40,.12); },
  ding(){ tone(880,.12,'sine',.15); tone(1320,.14,'sine',.12,0,.09); },
  coin(){ tone(990,.07,'square',.09); tone(1480,.1,'square',.07,0,.05); },
  angry(){ tone(220,.25,'sawtooth',.14,-80); },
  elev(){ tone(160,.3,'sine',.06,60); },
  up(){ [523,659,784].forEach((f,i)=>tone(f,.1,'triangle',.13,0,i*.07)); },
  click(){ tone(700,.05,'square',.07); },
};
/* ─── Хранилище/мета ─── */
const K_BEST='tc.best',K_DAILY='tc.daily.'+today,K_STREAK='tc.streak',K_LASTDAY='tc.lastDay',K_MUTE='tc.muted',K_MISS='tc.missions.'+today,K_CITY='tc.city';
const el={ bank:$('bank-val'),floors:$('floors-val'),guests:$('guests-val'),rep:$('rep-val'),streakN:$('streak-n'),multN:$('mult-n'),missionsN:$('missions-n'),elevN:$('elev-n'),elevCost:$('elev-cost'),wDaily:$('w-daily-best'),wBest:$('w-best'),wStreak:$('w-streak'),gc:$('gc') };
const W=400,H=580,STEP=1/60;
const cv=el.gc,ctx=cv.getContext('2d');
let dpr=1;
function fitCanvas(){ dpr=Math.min(window.devicePixelRatio||1,2); cv.width=W*dpr; cv.height=H*dpr; cv.style.width=W+'px'; cv.style.height=H+'px'; ctx.setTransform(dpr,0,0,dpr,0,0); }
fitCanvas(); window.addEventListener('resize',fitCanvas);
/* ─── Типы этажей ─── */
const FTYPES={
  office:{name:'Офис',cost:80, pay:14,color:'#7EC8E3',glow:'rgba(126,200,227,',unlock:0},
  cafe:  {name:'Кафе',cost:150,pay:27,color:'#E8B04B',glow:'rgba(232,176,75,',unlock:5},
  lux:   {name:'Люкс',cost:280,pay:50,color:'#B06AE4',glow:'rgba(176,106,228,',unlock:10},
};
const FTYPES_OR=['office','cafe','lux'];
/* ─── Город (сохраняемый) ─── */
let city=lsGet(K_CITY,null)||{bank:120,floors:['office'],rep:50,elev:1,guestsServed:0,earned:0};
function saveCity(){ lsSet(K_CITY,city); }
let muted=lsGet(K_MUTE,false);
let running=false,over=false;
let best=lsGet(K_BEST,0),dailyBest=lsGet(K_DAILY,0);
let streak=lsGet(K_STREAK,0),lastDay=lsGet(K_LASTDAY,'');
let mult=1;
/* живое состояние */
let guests=[],cabin={y:0,ty:0,rider:null,speed:.9},spawnT=2,dayT=0,camY=0,parts=[],texts=[],emo=[];
const FLOOR_H=44,TOWER_W=150,TOWER_X=(W-TOWER_W)/2+30;
const GROUND=H-96;
function floorY(i){ return GROUND-(i+1)*FLOOR_H; } /* y верха этажа i */
/* ─── Мета ─── */
function effStreak(){ return (lastDay===today||lastDay===yesterday)?streak:0; }
function getMult(s){ return 1+Math.min(Math.max(s-1,0),10)*0.05; }
function touchStreak(){ if(lastDay===today){ mult=getMult(streak); return; } streak=(lastDay===yesterday)?(streak||0)+1:1; lastDay=today; lsSet(K_STREAK,streak); lsSet(K_LASTDAY,lastDay); mult=getMult(streak); if(streak>1)toast(`🔥 Стрик <b>${streak}</b> · доход ×<b>${mult.toFixed(2)}</b>`); }
const MISSIONS=[
  {id:'build10', name:'Построить 10 этажей',        target:10, track:'floors'},
  {id:'earn2k',  name:'Заработать $2000 всего',     target:2000,track:'earned'},
  {id:'guests50',name:'Обслужить 50 гостей',        target:50, track:'served'},
  {id:'rep90',   name:'Поднять репутацию до 90',    target:90, track:'rep'},
  {id:'lux5',    name:'Построить 5 люксов',         target:5,  track:'lux'},
  {id:'elev3',   name:'Лифт 3-го уровня',           target:3,  track:'elev'},
  {id:'night10', name:'Обслужить 10 гостей ночью',  target:10, track:'night'},
  {id:'tower15', name:'Башня в 15 этажей',          target:15, track:'height'},
];
let missionData=lsGet(K_MISS,{p:{},done:{}});
if(!missionData.p)missionData={p:{},done:{}};
function saveMissions(){ lsSet(K_MISS,missionData); }
function missionAward(mid){ if(missionData.done[mid])return; missionData.done[mid]=1; saveMissions(); const bonus=Math.round(50*mult); city.bank+=bonus; saveCity(); toast(`🎯 Миссия выполнена: <b>+$${bonus}</b>`); sfx.up(); refreshMissionsUI(); refreshStats(); }
function missionTick(track,val,absolute){ MISSIONS.forEach(m=>{ if(m.track!==track||missionData.done[m.id])return; if(absolute){ if(val>(missionData.p[m.id]||0))missionData.p[m.id]=val; } else missionData.p[m.id]=(missionData.p[m.id]||0)+val; if(missionData.p[m.id]>=m.target)missionAward(m.id); }); saveMissions(); refreshMissionsUI(); }
function refreshMissionsUI(){ const done=MISSIONS.filter(m=>missionData.done[m.id]).length; el.missionsN.textContent=done+'/3'; }
function renderMissionsModal(){ const list=$('mmodal-list'); list.innerHTML=''; MISSIONS.forEach(m=>{ const p=Math.min(missionData.p[m.id]||0,m.target); const done=!!missionData.done[m.id]; const d=document.createElement('div'); d.className='mm-item'+(done?' done':''); d.innerHTML=`<span class="mm-check">✓</span><span class="mm-body"><span class="mm-name">${m.name}</span><span class="mm-prog"><b>${fmt(p)}</b> / ${fmt(m.target)}</span></span>`; list.appendChild(d); }); }
function toast(html){ const t=document.createElement('span'); t.className='toast'; t.innerHTML=html; $('toasts').appendChild(t); setTimeout(()=>t.classList.add('out'),2600); setTimeout(()=>t.remove(),3000); }
function floatTxt(x,y,txt,color,size){ texts.push({x,y,txt,color,size:size||13,life:1,maxLife:1}); }
function emoPop(x,y,kind){ emo.push({x,y,kind,t:0}); }
/* ─── Экономика ─── */
function dayPhase(){ return (dayT%70)/70; } /* 0..1 */
function isNight(){ const p=dayPhase(); return p>.5; }
function guestPay(ft){ const t=FTYPES[ft]; let pay=t.pay; if(ft==='office'&&!isNight())pay*=1.3; if(ft==='lux'&&isNight())pay*=1.35; return Math.round(pay*(1+city.elev*.08)*mult); }
function buildFloor(type){ const t=FTYPES[type]; if(city.floors.length<t.unlock){ toast(`🔒 «${t.name}» откроется на ${t.unlock} этажах`); return; } if(city.bank<t.cost){ toast(`Не хватает $${fmt(t.cost-city.bank)}`); return; } city.bank-=t.cost; city.floors.push(type); saveCity(); sfx.build(); floatTxt(TOWER_X+TOWER_W/2,floorY(city.floors.length-1)+10,t.name+'!','#D4A574',14); missionTick('floors',1); if(type==='lux')missionTick('lux',1); missionTick('height',city.floors.length,true); refreshStats(); camY=Math.max(0,(city.floors.length)*FLOOR_H-H*.55); }
function elevCost(){ return Math.round(190*Math.pow(1.75,city.elev-1)); }
function upgradeElev(){ const c=elevCost(); if(city.bank<c){ toast(`Не хватает $${fmt(c-city.bank)}`); return; } city.bank-=c; city.elev++; saveCity(); sfx.up(); toast(`🛗 Лифт ур.<b>${city.elev}</b>`); missionTick('elev',city.elev,true); refreshStats(); }
/* ─── Гости ─── */
function spawnGuest(){ if(!city.floors.length)return; const want=city.floors[(Math.random()*city.floors.length)|0]; guests.push({x:W+16,state:'walk',want,pat:1,patMax:12,emo:0,fx:rand(30,110),floor:-1,t:0}); }
function update(dt){
  if(over)return;
  dayT+=dt;
  spawnT-=dt*(1+city.rep*.006); if(spawnT<=0){ spawnGuest(); spawnT=6.5-city.rep*.04+rand(-.6,.6); }
  /* гости */
  for(let i=guests.length-1;i>=0;i--){ const g=guests[i]; g.t+=dt;
    if(g.state==='walk'){ const door=TOWER_X+TOWER_W-14; g.x+=(door-g.x)*dt*1.4; if(Math.abs(g.x-door)<3){ g.state='wait'; g.pat=1; } }
    else if(g.state==='wait'){ g.pat-=dt/g.patMax*(cabin.rider?1.6:1); if(g.pat<=0){ /* злой уходит */ city.rep=clamp(city.rep-6,0,100); saveCity(); g.state='angry'; g.emo=1; sfx.angry(); emoPop(g.x,floorY(-1)+8,'angry'); missionTick('rep',city.rep,true); } }
    else if(g.state==='ride'){ /* в кабине */ }
    else if(g.state==='leave'){ g.x+=dt*90; if(g.x>W+20)guests.splice(i,1); }
    else if(g.state==='angry'){ g.x+=dt*130; if(g.x>W+20){ guests.splice(i,1); refreshStats(); } } }
  /* лифт: берёт ждущего с минимальным терпением */
  if(!cabin.rider&&!cabin.moving){ let best=null; guests.forEach(g=>{ if(g.state==='wait'&&(!best||g.pat<best.pat))best=g; }); if(best){ best.state='ride'; cabin.rider=best; cabin.ty=floorY(city.floors.findIndex((f,ix)=>f===best.want&&ix>=0)||0); /* первый этаж нужного типа */ const idx=city.floors.indexOf(best.want); cabin.ty=floorY(idx<0?0:idx); cabin.moving=true; sfx.elev(); } }
  if(cabin.moving){ cabin.speed=.9+city.elev*.45; const dy=cabin.ty-cabin.y; const step=Math.sign(dy)*Math.min(Math.abs(dy),cabin.speed*dt*60*.16); cabin.y+=step; if(Math.abs(cabin.ty-cabin.y)<2){ cabin.y=cabin.ty; /* прибытие */ const g=cabin.rider; if(g){ const pay=guestPay(g.want); city.bank+=pay; city.earned+=pay; city.guestsServed++; city.rep=clamp(city.rep+2,0,100); saveCity(); sfx.coin(); floatTxt(TOWER_X+TOWER_W+18,cabin.y+18,'+$'+pay,'#D4A574',13); emoPop(TOWER_X+TOWER_W+34,cabin.y+14,'happy'); missionTick('earned',city.earned,true); missionTick('served',1); missionTick('rep',city.rep,true); if(isNight())missionTick('night',1); g.state='leave'; g.emo=0; cabin.rider=null; refreshStats(); } cabin.moving=false; } }
  /* частицы/тексты/эмоции */
  parts=parts.filter(p=>{ p.life-=dt; return p.life>0; });
  texts=texts.filter(t=>{ t.life-=dt; t.y-=24*dt; return t.life>0; });
  emo=emo.filter(e=>{ e.t+=dt; return e.t<1.4; });
}
function refreshStats(){ el.bank.textContent='$'+fmt(city.bank); el.floors.textContent=city.floors.length; el.guests.textContent=city.guestsServed; el.rep.textContent=Math.round(city.rep); el.elevN.textContent=city.elev; el.elevCost.textContent='$'+fmt(elevCost()); }
/* ═══ РЕНДЕР ═══ */
function skyColors(){ const p=dayPhase(); /* день → закат → ночь → рассвет */ const key=[['#1A2438','#324A6B'],['#2A1E38','#6B4A3A'],['#0B0D16','#141A2C'],['#1A1E30','#3A3A5C']]; const seg=p*4, i=seg|0, f=seg-i; const a=key[i%4],b=key[(i+1)%4]; const mix=(c1,c2)=>{ const h=x=>parseInt(x,16); const r1=h(c1.slice(1,3)),g1=h(c1.slice(3,5)),b1=h(c1.slice(5,7)); const r2=h(c2.slice(1,3)),g2=h(c2.slice(3,5)),b2=h(c2.slice(5,7)); return `rgb(${r1+(r2-r1)*f|0},${g1+(g2-g1)*f|0},${b1+(b2-b1)*f|0})`; }; return [mix(a[0],b[0]),mix(a[1],b[1])]; }
function render(){
  const [c1,c2]=skyColors();
  const g=ctx.createLinearGradient(0,0,0,H); g.addColorStop(0,c1); g.addColorStop(1,c2); ctx.fillStyle=g; ctx.fillRect(0,0,W,H);
  /* звёзды ночью */
  const night=isNight(); const nAlpha=night?clamp((dayPhase()-.5)*6,0,1):clamp((.5-dayPhase())*6,0,1);
  if(nAlpha>0){ ctx.fillStyle=`rgba(240,240,255,${nAlpha*.8})`; for(let i=0;i<40;i++){ const x=(i*97)%W,y=(i*61)%240; const tw=.5+Math.sin(performance.now()*.002+i)*.4; ctx.globalAlpha=nAlpha*tw; ctx.fillRect(x,y,1.5,1.5); } ctx.globalAlpha=1; }
  /* солнце/луна */
  const p=dayPhase(); const ang=p*TAU-Math.PI/2; const sx=W/2+Math.cos(ang)*150,sy=210-Math.sin(ang)*150;
  if(!night){ ctx.fillStyle='#E8B04B'; ctx.shadowColor='#E8B04B'; ctx.shadowBlur=30; ctx.beginPath(); ctx.arc(sx,sy,20,0,TAU); ctx.fill(); ctx.shadowBlur=0; }
  else { ctx.fillStyle='#C7CCE0'; ctx.shadowColor='#AAB2D0'; ctx.shadowBlur=24; ctx.beginPath(); ctx.arc(sx,sy,16,0,TAU); ctx.fill(); ctx.shadowBlur=0; ctx.fillStyle='rgba(160,168,190,.35)'; ctx.beginPath(); ctx.arc(sx-5,sy-4,4,0,TAU); ctx.arc(sx+6,sy+3,3,0,TAU); ctx.fill(); }
  /* облака */
  ctx.fillStyle=`rgba(255,255,255,${night?.06:.1})`;
  for(let i=0;i<5;i++){ const cx=((i*137+dayT*(6+i*2))%(W+120))-60, cy=70+i*38; ctx.beginPath(); ctx.ellipse(cx,cy,34,10,0,0,TAU); ctx.ellipse(cx+20,cy-6,22,9,0,0,TAU); ctx.fill(); }
  /* земля/улица */
  ctx.fillStyle='#101018'; ctx.fillRect(0,GROUND+2,W,H-GROUND);
  ctx.fillStyle='rgba(212,165,116,.25)'; ctx.fillRect(0,GROUND,W,2);
  for(let x=8;x<W;x+=34){ ctx.fillStyle='rgba(255,255,255,.06)'; ctx.fillRect(x,GROUND+((x/34)%2?26:44),16,3); }
  /* башня: подложка-шахта лифта */
  ctx.fillStyle='#0D0D14'; ctx.fillRect(TOWER_X-26,floorY(city.floors.length)-10,30,city.floors.length*FLOOR_H+12);
  /* крыша */
  const topY=floorY(city.floors.length-1);
  ctx.fillStyle='#1A1A24'; ctx.beginPath(); ctx.roundRect(TOWER_X-6,topY-12,TOWER_W+12,14,4); ctx.fill();
  ctx.strokeStyle='rgba(228,84,95,.8)'; ctx.lineWidth=2; ctx.beginPath(); ctx.moveTo(TOWER_X+TOWER_W-14,topY-12); ctx.lineTo(TOWER_X+TOWER_W-14,topY-26); ctx.stroke(); const blink=Math.sin(performance.now()*.006)>0; if(blink){ ctx.fillStyle='#E4545F'; ctx.shadowColor='#E4545F'; ctx.shadowBlur=8; ctx.beginPath(); ctx.arc(TOWER_X+TOWER_W-14,topY-28,3,0,TAU); ctx.fill(); ctx.shadowBlur=0; }
  /* этажи */
  city.floors.forEach((ft,i)=>{ drawFloor(ft,TOWER_X,floorY(i),i); });
  /* вход */
  ctx.fillStyle='#14141E'; ctx.beginPath(); ctx.roundRect(TOWER_X+TOWER_W-34,GROUND-30,34,30,4); ctx.fill(); ctx.fillStyle='rgba(232,176,75,.7)'; ctx.font='700 9px Inter,sans-serif'; ctx.textAlign='center'; ctx.fillText('ВХОД',TOWER_X+TOWER_W-17,GROUND-36);
  /* шахта лифта: кабина */
  const cabY=cabin.y;
  ctx.fillStyle='#2A2A38'; ctx.beginPath(); ctx.roundRect(TOWER_X-24,cabY+6,22,FLOOR_H-12,3); ctx.fill(); ctx.strokeStyle='rgba(212,165,116,.5)'; ctx.strokeRect(TOWER_X-24,cabY+6,22,FLOOR_H-12);
  ctx.strokeStyle='rgba(255,255,255,.15)'; ctx.beginPath(); ctx.moveTo(TOWER_X-13,0); ctx.lineTo(TOWER_X-13,cabY+6); ctx.stroke();
  if(cabin.rider){ drawPerson(TOWER_X-13,cabY+FLOOR_H-12,1,'#E8C89A'); }
  /* гости на улице */
  guests.forEach(gt=>{ if(gt.state==='ride')return; const y=GROUND+34; drawPerson(gt.x,y,1,gt.state==='angry'?'#E4545F':'#C7C7CC');
    if(gt.state==='wait'){ /* терпение */ const w=26; ctx.fillStyle='rgba(0,0,0,.5)'; ctx.fillRect(gt.x-w/2,y-30,w,4); ctx.fillStyle=gt.pat>.4?'#8B9D83':(gt.pat>.2?'#E8B04B':'#E4545F'); ctx.fillRect(gt.x-w/2,y-30,w*clamp(gt.pat,0,1),4);
      /* иконка желания */ ctx.fillStyle='rgba(255,255,255,.85)'; ctx.font='700 9px Inter,sans-serif'; ctx.textAlign='center'; ctx.fillText(FTYPES[gt.want].name.toUpperCase(),gt.x,y-36); } });
  /* эмоции */
  emo.forEach(e=>{ ctx.globalAlpha=1-e.t/1.4; drawFace(e.x,e.y-e.t*26,e.kind); ctx.globalAlpha=1; });
  /* тексты */
  texts.forEach(t=>{ ctx.globalAlpha=clamp(t.life/t.maxLife,0,1); ctx.font=`700 ${t.size}px Inter,sans-serif`; ctx.textAlign='center'; ctx.fillStyle=t.color; ctx.fillText(t.txt,t.x,t.y); }); ctx.globalAlpha=1;
  /* индикатор дня/ночи */
  ctx.fillStyle='rgba(10,10,15,.6)'; ctx.beginPath(); ctx.roundRect(10,10,84,24,8); ctx.fill(); ctx.fillStyle=night?'#AAB2D0':'#E8B04B'; ctx.font='600 11px Inter,sans-serif'; ctx.textAlign='center'; ctx.fillText(night?'🌙 Ночь · люкс ×1.35':'☀ День · офис ×1.3',52,26); }
function drawFloor(ft,x,y,i){ const t=FTYPES[ft]; const night=isNight();
  /* корпус этажа */
  ctx.fillStyle='#15151E'; ctx.fillRect(x,y,TOWER_W,FLOOR_H-2);
  ctx.strokeStyle='rgba(255,255,255,.07)'; ctx.strokeRect(x+.5,y+.5,TOWER_W-1,FLOOR_H-3);
  /* витрина: окна светятся ночью */
  const glow=night?.95:.55; ctx.fillStyle=t.glow+(glow*.5)+')';
  ctx.beginPath(); ctx.roundRect(x+10,y+8,34,FLOOR_H-18,3); ctx.fill();
  ctx.beginPath(); ctx.roundRect(x+TOWER_W-58,y+8,34,FLOOR_H-18,3); ctx.fill();
  ctx.fillStyle='rgba(255,255,255,.1)'; ctx.fillRect(x+10,y+8,34,6); ctx.fillRect(x+TOWER_W-58,y+8,34,6);
  /* дверь по центру */
  ctx.fillStyle='rgba(10,10,15,.8)'; ctx.beginPath(); ctx.roundRect(x+TOWER_W/2-9,y+12,18,FLOOR_H-14,3); ctx.fill();
  ctx.fillStyle=t.glow+'.9)'; ctx.beginPath(); ctx.arc(x+TOWER_W/2+5,y+12+FLOOR_H/2-6,1.6,0,TAU); ctx.fill();
  /* табличка типа слева */
  ctx.fillStyle=t.glow+'.9)'; ctx.beginPath(); ctx.arc(x+TOWER_W/2-24,y+10,0,0,TAU); ctx.fill();
  ctx.fillStyle='rgba(255,255,255,.75)'; ctx.font='600 8px Inter,sans-serif'; ctx.textAlign='left'; ctx.fillText(t.name.toUpperCase(),x+46,y+FLOOR_H/2+14);
  /* номер этажа */
  ctx.fillStyle='rgba(255,255,255,.3)'; ctx.font='600 8px Inter,sans-serif'; ctx.textAlign='right'; ctx.fillText((i+1)+'F',x+TOWER_W-4,y+11); }
function drawPerson(x,y,s,color){ ctx.save(); ctx.translate(x,y); ctx.scale(s,s);
  ctx.fillStyle=color; ctx.beginPath(); ctx.arc(0,-10,3.2,0,TAU); ctx.fill(); ctx.fillRect(-2.4,-7.4,4.8,9); ctx.fillStyle='rgba(20,20,28,.9)'; ctx.fillRect(-2.6,1.4,2,5); ctx.fillRect(.6,1.4,2,5); ctx.restore(); }
function drawFace(x,y,kind){ ctx.save(); ctx.translate(x,y); ctx.fillStyle='rgba(255,255,255,.92)'; ctx.beginPath(); ctx.arc(0,0,9,0,TAU); ctx.fill(); ctx.strokeStyle='rgba(0,0,0,.1)'; ctx.stroke();
  ctx.fillStyle='#14100B'; if(kind==='happy'){ ctx.beginPath(); ctx.arc(-3,-2,1.2,0,TAU); ctx.arc(3,-2,1.2,0,TAU); ctx.fill(); ctx.strokeStyle='#14100B'; ctx.lineWidth=1.4; ctx.beginPath(); ctx.arc(0,1,3.6,.15*Math.PI,.85*Math.PI); ctx.stroke(); } else { ctx.lineWidth=1.4; ctx.strokeStyle='#14100B'; ctx.beginPath(); ctx.moveTo(-4.5,-4); ctx.lineTo(-1.5,-1.5); ctx.moveTo(4.5,-4); ctx.lineTo(1.5,-1.5); ctx.stroke(); ctx.beginPath(); ctx.arc(0,-3,1.2,0,TAU); ctx.arc(0,2,1.2,0,TAU); ctx.fill(); ctx.beginPath(); ctx.arc(0,5,3.6,1.15*Math.PI,1.85*Math.PI); ctx.stroke(); } ctx.restore(); }
/* ─── Цикл ─── */
let last=0,acc=0,rafId=0;
function loop(ts){ rafId=requestAnimationFrame(loop); if(!running)return; if(!last)last=ts; let dtms=ts-last; last=ts; if(dtms>200)dtms=200; acc+=dtms; let guard=0; while(acc>=STEP*1000&&guard++<6){ update(STEP); acc-=STEP*1000; } refreshStats(); render(); }
/* ─── Поток ─── */
function startGame(){ touchStreak(); audioInit(); running=true; over=false; last=0; acc=0; dayT=14; guests=[]; cabin={y:floorY(0),ty:floorY(0),rider:null,speed:.9,moving:false}; spawnT=1.6; $('welcome').classList.add('hidden'); $('modal').classList.add('hidden'); $('game').classList.remove('hidden'); refreshStats(); refreshHud(); renderBuildModal(); if(!rafId)rafId=requestAnimationFrame(loop); }
function refreshHud(){ el.wDaily.textContent=fmt(dailyBest); el.wBest.textContent=fmt(best); el.streakN.textContent=effStreak(); el.multN.textContent='×'+mult.toFixed(2); refreshStats(); refreshMissionsUI(); }
function refreshWelcome(){ el.wDaily.textContent=fmt(dailyBest); el.wBest.textContent=fmt(best); el.wStreak.textContent='🔥 '+effStreak(); $('daily-date').textContent='Город живёт · '+today.slice(5).replace('-','.'); }
function gameOver(win){ over=true; running=false; missionTick('height',city.floors.length,true); let isRec=false,isRecDay=false; const val=city.floors.length; if(val>best){ best=val; lsSet(K_BEST,best); isRec=true; } if(val>dailyBest){ dailyBest=val; lsSet(K_DAILY,dailyBest); isRecDay=true; } sfx.up(); setTimeout(()=>{ $('modal-badge').textContent=isRec||isRecDay?'Новый рекорд':'Город сохранён'; $('modal-badge').classList.toggle('record',isRec||isRecDay); $('modal-title').textContent=isRec?'Небоскрёб года!':(isRecDay?'Рекорд дня!':'Мегаполис ждёт'); $('modal-score').innerHTML=`Этажей <b>${city.floors.length}</b> · Гостей <b>${fmt(city.guestsServed)}</b> · Заработано <b>$${fmt(city.earned)}</b><br>Рекорд высоты <b>${best}</b> · за день <b>${dailyBest}</b>`; $('modal').classList.remove('hidden'); },600); }
function toMenu(){ running=false; over=false; saveCity(); $('game').classList.add('hidden'); $('modal').classList.add('hidden'); $('welcome').classList.remove('hidden'); refreshWelcome(); }
/* ─── Билд-модал ─── */
function renderBuildModal(){ const list=$('bmodal-list'); list.innerHTML=''; FTYPES_OR.forEach(k=>{ const t=FTYPES[k]; const locked=city.floors.length<t.unlock; const d=document.createElement('button'); d.className='bt-card bt-'+k+(locked?' locked':''); d.innerHTML=`<span class="bt-icon">${k==='office'?'💼':(k==='cafe'?'☕':'💎')}</span><span class="bt-body"><span class="bt-name">${t.name}</span><span class="bt-sub">+$${t.pay}/гость${k==='office'?' · день ×1.3':''}${k==='lux'?' · ночь ×1.35':''}${locked?' · открыть на '+t.unlock+' этажах':''}</span></span><span class="bt-cost">$${t.cost}</span>`; d.addEventListener('click',()=>{ if(locked)return; buildFloor(k); $('bmodal').classList.add('hidden'); }); list.appendChild(d); }); }
$('btn-build').addEventListener('click',()=>{ audioInit(); sfx.click(); renderBuildModal(); $('bmodal').classList.remove('hidden'); });
$('bmodal-btn').addEventListener('click',()=>$('bmodal').classList.add('hidden'));
$('elev-chip').addEventListener('click',()=>{ audioInit(); upgradeElev(); });
/* ─── Кнопки ─── */
$('btn-play').addEventListener('click',()=>{ audioInit(); startGame(); });
$('btn-menu').addEventListener('click',toMenu);
$('btn-missions').addEventListener('click',()=>{ renderMissionsModal(); $('mmodal').classList.remove('hidden'); });
$('missions-chip').addEventListener('click',()=>{ renderMissionsModal(); $('mmodal').classList.remove('hidden'); });
$('mmodal-btn').addEventListener('click',()=>$('mmodal').classList.add('hidden'));
function syncSoundBtn(){ $('btn-sound').textContent=muted?'🔇':'🔊'; }
$('btn-sound').addEventListener('click',()=>{ muted=!muted; lsSet(K_MUTE,muted); if(master)master.gain.value=muted?0:0.5; syncSoundBtn(); if(!muted){ audioInit(); sfx.coin(); } });
/* сброс города на welcome-экране: длинный тап по рекорду? Нет — кнопка в модалке game over нет. Сделаем кнопку «Новый город» в welcome если город существует */
(function(){ const w=$('welcome'); const btn=document.createElement('button'); btn.id='btn-reset-city'; btn.className='w-hint'; btn.style.cssText='margin-top:2px;background:none;border:1px solid var(--clr-border);color:var(--clr-faint);padding:7px 14px;border-radius:10px;font-family:inherit;font-size:.68rem;cursor:pointer;letter-spacing:.4px'; btn.textContent='🏗 Начать новый город (сброс)'; btn.addEventListener('click',()=>{ if(confirm('Снести город и начать заново? Прогресс будет удалён.')){ city={bank:120,floors:['office'],rep:50,elev:1,guestsServed:0,earned:0}; saveCity(); toast('🏗 Новый город основан'); refreshHud(); } }); w.appendChild(btn); })();
refreshWelcome(); refreshHud(); syncSoundBtn();
/* ─── Debug-хук ─── */
window.__tc={
  start:startGame, over:()=>{ running=true; gameOver(true); },
  state(){ return {bank:Math.round(city.bank),floors:city.floors.length,rep:Math.round(city.rep),guests:guests.length,served:city.guestsServed,elev:city.elev,night:isNight(),running,over}; },
  addBank:n=>{ city.bank+=n; saveCity(); }, build:type=>buildFloor(type||'office'), elev:upgradeElev,
  guest:()=>spawnGuest(), serve:()=>{ const g=guests.find(x=>x.state==='wait'); if(g){ g.pat=0; } },
  city:()=>city, missions:()=>missionData, records:()=>({best:lsGet(K_BEST,0),daily:lsGet(K_DAILY,0),streak:lsGet(K_STREAK,0),today}),
};
