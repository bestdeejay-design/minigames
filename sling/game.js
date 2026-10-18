'use strict';
/* ═══════════════ ХРУСТАЛЬНЫЙ ТИР v2.0 · физический тир · AXIIOM canon ═══════════════ */
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
let AC=null,master=null;
function audioInit(){ if(AC)return; try{ AC=new (window.AudioContext||window.webkitAudioContext)(); master=AC.createGain(); master.gain.value=muted?0:0.5; master.connect(AC.destination);}catch(e){} }
function tone(freq,dur,type,vol,slide,delay){ if(!AC||muted)return; const t0=AC.currentTime+(delay||0); const o=AC.createOscillator(),g=AC.createGain(); o.type=type||'sine'; o.frequency.setValueAtTime(freq,t0); if(slide)o.frequency.exponentialRampToValueAtTime(Math.max(30,freq+slide),t0+dur); g.gain.setValueAtTime(vol||.15,t0); g.gain.exponentialRampToValueAtTime(.001,t0+dur); o.connect(g);g.connect(master); o.start(t0);o.stop(t0+dur+.02); }
function noiseB(dur,vol,fc){ if(!AC||muted)return; const n=Math.floor(AC.sampleRate*dur); const buf=AC.createBuffer(1,n,AC.sampleRate); const d=buf.getChannelData(0); for(let i=0;i<n;i++)d[i]=(Math.random()*2-1)*(1-i/n); const src=AC.createBufferSource(); src.buffer=buf; const f=AC.createBiquadFilter(); f.type='highpass'; f.frequency.value=fc||1400; const g=AC.createGain(); g.gain.value=vol; src.connect(f);f.connect(g);g.connect(master); src.start(); }
const sfx={
  stretch(){ tone(160,.1,'sine',.05,60); },
  shot(){ tone(340,.1,'square',.14,-140); noiseB(.06,.14,2000); },
  crack(){ noiseB(.18,.34,2600); tone(1900,.08,'triangle',.14,-500); },
  gold(){ [880,1100,1320].forEach((f,i)=>tone(f,.1,'triangle',.13,0,i*.05)); },
  bounce(){ tone(200,.05,'sine',.08,-60); },
  pierce(){ tone(1300,.06,'sine',.1,-300); },
  win(){ [523,659,784].forEach((f,i)=>tone(f,.13,'triangle',.14,0,i*.08)); },
  fail(){ tone(300,.4,'sawtooth',.18,-160); },
  click(){ tone(700,.05,'square',.07); },
};
/* ─── Хранилище/мета ─── */
const K_BEST='st.best',K_DAILY='st.daily.'+today,K_STREAK='st.streak',K_LASTDAY='st.lastDay',K_MUTE='st.muted',K_MISS='st.missions.'+today;
const el={ score:$('score-val'),daily:$('daily-val'),best:$('best-val'),level:$('level-val'),shots:$('shots-n'),targets:$('targets-n'),streakN:$('streak-n'),multN:$('mult-n'),missionsN:$('missions-n'),wDaily:$('w-daily-best'),wBest:$('w-best'),wStreak:$('w-streak'),gc:$('gc') };
const W=400,H=580,STEP=1/60;
const cv=el.gc,ctx=cv.getContext('2d');
let dpr=1;
function fitCanvas(){ dpr=Math.min(window.devicePixelRatio||1,2); cv.width=W*dpr; cv.height=H*dpr; cv.style.width=W+'px'; cv.style.height=H+'px'; ctx.setTransform(dpr,0,0,dpr,0,0); }
fitCanvas(); window.addEventListener('resize',fitCanvas);
/* ─── Состояние ─── */
const SLING={x:200,y:462}; const GROUND=H-72;
let muted=lsGet(K_MUTE,false),mode='daily';
let running=false,over=false;
let score=0,mult=1,best=lsGet(K_BEST,0),dailyBest=lsGet(K_DAILY,0);
let streak=lsGet(K_STREAK,0),lastDay=lsGet(K_LASTDAY,'');
let dailyRng=Math.random;
const sr=(a,b)=>a+(mode==='daily'?dailyRng():Math.random())*(b-a);
let level=1,shots=4,targets=[],projs=[],shards=[],rings=[],texts=[],stars=0;
let aiming=false,aimPt={x:SLING.x,y:SLING.y},tGlobal=0;
/* ─── Мета ─── */
function effStreak(){ return (lastDay===today||lastDay===yesterday)?streak:0; }
function getMult(s){ return 1+Math.min(Math.max(s-1,0),10)*0.05; }
function touchStreak(){ if(lastDay===today){ mult=getMult(streak); return; } streak=(lastDay===yesterday)?(streak||0)+1:1; lastDay=today; lsSet(K_STREAK,streak); lsSet(K_LASTDAY,lastDay); mult=getMult(streak); if(streak>1)toast(`🔥 Стрик <b>${streak}</b> · очки ×<b>${mult.toFixed(2)}</b>`); }
const MISSIONS=[
  {id:'break30', name:'Разбить 30 кристаллов',     target:30, track:'breaks'},
  {id:'gold5',   name:'Разбить 5 золотых',         target:5,  track:'golds'},
  {id:'swing8',  name:'Сбить 8 качающихся',        target:8,  track:'swings'},
  {id:'levels10',name:'Пройти 10 уровней',         target:10, track:'levels'},
  {id:'pierce2', name:'2 сквозных попадания',      target:2,  track:'pierces'},
  {id:'score1k5',name:'Набрать 1500 очков за игру',target:1500,track:'score'},
  {id:'bounce20',name:'20 отскоков от земли',      target:20, track:'bounces'},
  {id:'star15',  name:'Собрать 15 звёзд',          target:15, track:'stars'},
];
let missionData=lsGet(K_MISS,{p:{},done:{}});
if(!missionData.p)missionData={p:{},done:{}};
function saveMissions(){ lsSet(K_MISS,missionData); }
function missionAward(mid){ if(missionData.done[mid])return; missionData.done[mid]=1; saveMissions(); const bonus=Math.round(25*mult); if(running&&!over){ score+=bonus; } toast(`🎯 Миссия выполнена: <b>+${bonus}</b>`); sfx.win(); refreshMissionsUI(); }
function missionTick(track,val,absolute){ MISSIONS.forEach(m=>{ if(m.track!==track||missionData.done[m.id])return; if(absolute){ if(val>(missionData.p[m.id]||0))missionData.p[m.id]=val; } else missionData.p[m.id]=(missionData.p[m.id]||0)+val; if(missionData.p[m.id]>=m.target)missionAward(m.id); }); saveMissions(); refreshMissionsUI(); }
function refreshMissionsUI(){ const done=MISSIONS.filter(m=>missionData.done[m.id]).length; el.missionsN.textContent=done+'/3'; }
function renderMissionsModal(){ const list=$('mmodal-list'); list.innerHTML=''; MISSIONS.forEach(m=>{ const p=Math.min(missionData.p[m.id]||0,m.target); const done=!!missionData.done[m.id]; const d=document.createElement('div'); d.className='mm-item'+(done?' done':''); d.innerHTML=`<span class="mm-check">✓</span><span class="mm-body"><span class="mm-name">${m.name}</span><span class="mm-prog"><b>${fmt(p)}</b> / ${fmt(m.target)}</span></span>`; list.appendChild(d); }); }
function toast(html){ const t=document.createElement('span'); t.className='toast'; t.innerHTML=html; $('toasts').appendChild(t); setTimeout(()=>t.classList.add('out'),2600); setTimeout(()=>t.remove(),3000); }
function announce(htmlBig,sub){ const a=document.getElementById('announce'); a.innerHTML=`<span class="an-big">${htmlBig}</span>${sub?`<span class="an-sub">${sub}</span>`:''}`; a.classList.remove('hidden'); clearTimeout(annT); annT=setTimeout(()=>a.classList.add('hidden'),1700); }
function ring(x,y,color){ rings.push({x,y,r:6,life:.4,maxLife:.4,color}); }
function floatTxt(x,y,txt,color,size){ texts.push({x,y,txt,color,size:size||13,life:1,maxLife:1}); }
function makeShards(x,y,color,n){ for(let i=0;i<n;i++){ const a=Math.random()*TAU,v=rand(60,220); shards.push({x,y,vx:Math.cos(a)*v,vy:Math.sin(a)*v-60,rot:Math.random()*TAU,vr:rand(-9,9),s:rand(3,7),color,life:.85,maxLife:.85}); } }
/* ─── Уровни ─── */
function levelTargets(n){ const count=Math.min(2+Math.ceil(n*.55),8); const arr=[]; let tries=0;
  while(arr.length<count&&tries++<300){ const roll=sr(0,1); let t;
    if(n>=3&&roll<.3) t={kind:'swing',px:sr(70,W-70),py:sr(56,120),L:sr(70,130),amp:sr(.5,1.1),spd:sr(1.2,2),ph:sr(0,TAU)};
    else if(n>=2&&roll<.55) t={kind:'move',cx:sr(110,W-110),cy:sr(90,300),range:sr(40,90),spd:sr(.8,1.6),ph:sr(0,TAU)};
    else t={kind:'static',x:sr(60,W-60),y:sr(80,300)};
    const gold=sr(0,1)<.16; t.gold=gold;
    const pos=targetPos(t,0); if(arr.some(o=>{ const p=targetPos(o,0); return Math.hypot(p.x-pos.x,p.y-pos.y)<52; }))continue;
    arr.push(t); }
  return arr; }
function targetPos(t,dt){ if(t.kind==='static')return {x:t.x,y:t.y};
  if(t.kind==='move'){ t.ph2=(t.ph2||0); return {x:t.cx+Math.sin(tGlobal*t.spd+t.ph)*t.range,y:t.cy}; }
  if(t.kind==='swing'){ const a=Math.sin(tGlobal*t.spd+t.ph)*t.amp; return {x:t.px+Math.sin(a)*t.L,y:t.py+Math.cos(a)*t.L,ang:a}; } }
function loadLevel(n){ level=n; const count=Math.min(2+Math.ceil(n*.55),8); shots=count+1; targets=levelTargets(n); projs=[];shards=[];rings=[];texts=[]; el.level.textContent=n; el.shots.textContent=shots; el.targets.textContent=targets.length; }
/* ─── Стрельба ─── */
function shoot(){ const dx=SLING.x-aimPt.x,dy=SLING.y-aimPt.y; const pull=Math.hypot(dx,dy); if(pull<10){ aiming=false; return; } const pw=clamp(pull,0,95)/95; const v=140+pw*260; const nx=dx/pull,ny=dy/pull; projs.push({x:SLING.x,y:SLING.y-14,vx:nx*v,vy:ny*v,r:7,bounces:0,pierce:1,trail:[]}); shots--; el.shots.textContent=shots; sfx.shot(); aiming=false; }
function breakTarget(t,pos,idx){ targets.splice(idx,1); makeShards(pos.x,pos.y,t.gold?'#EFC878':'#9BD8E8',t.gold?14:9); ring(pos.x,pos.y,t.gold?'rgba(232,176,75,.8)':'rgba(126,200,227,.7)'); missionTick('breaks',1); if(t.gold){ missionTick('golds',1); sfx.gold(); } else sfx.crack(); if(t.kind==='swing')missionTick('swings',1); const pts=Math.round((t.gold?300:100)*mult); score+=pts; floatTxt(pos.x,pos.y-18,'+'+pts,t.gold?'#EFC878':'#9BD8E8',t.gold?16:13); el.score.textContent=fmt(score);
  if(targets.length===0){ const left=shots; const earned=Math.min(3,Math.max(1,left)); stars+=earned; missionTick('stars',earned); const bonus=Math.round((40+left*35)*mult); score+=bonus; missionTick('levels',level,true); sfx.win(); announce('УРОВЕНЬ '+level+' '+'⭐'.repeat(earned),'+'+fmt(bonus)+' · звёзд: '+stars); setTimeout(()=>{ if(running&&!over)loadLevel(level+1); },1500); } }
/* ─── Апдейт ─── */
function update(dt){ tGlobal+=dt;
  shards=shards.filter(s=>{ s.life-=dt; s.x+=s.vx*dt; s.y+=s.vy*dt; s.vy+=560*dt; s.rot+=s.vr*dt; if(s.y>GROUND){ s.y=GROUND; s.vy*=-.4; s.vx*=.7; } return s.life>0; });
  rings=rings.filter(r=>{ r.life-=dt; r.r+=200*dt; return r.life>0; });
  texts=texts.filter(t=>{ t.life-=dt; t.y-=28*dt; return t.life>0; });
  for(let i=projs.length-1;i>=0;i--){ const p=projs[i]; p.vy+=620*dt; p.x+=p.vx*dt; p.y+=p.vy*dt;
    p.trail.push({x:p.x,y:p.y,life:.3}); p.trail=p.trail.filter(t=>(t.life-=dt)>0);
    /* мишени */
    let hit=false;
    for(let j=targets.length-1;j>=0;j--){ const t=targets[j]; const pos=targetPos(t,dt); if(Math.hypot(pos.x-p.x,pos.y-p.y)<19){ breakTarget(t,pos,j); hit=true;
        if(p.pierce>0){ p.pierce--; p.vx*=.72; p.vy*=.72; missionTick('pierces',1); sfx.pierce(); floatTxt(p.x,p.y-30,'СКВОЗНОЙ!','#D4A574',14); continue; } break; } }
    if(hit&&p.pierce<=0){ projs.splice(i,1); continue; }
    /* земля */
    if(p.y>GROUND-p.r){ p.y=GROUND-p.r; p.vy*=-.45; p.vx*=.72; p.bounces++; missionTick('bounces',1); sfx.bounce(); if(p.bounces>2||Math.hypot(p.vx,p.vy)<40){ projs.splice(i,1); continue; } }
    /* борта */
    if(p.x<p.r){ p.x=p.r; p.vx*=-.6; } if(p.x>W-p.r){ p.x=W-p.r; p.vx*=-.6; }
    if(p.y>H+40||p.x<-40||p.x>W+40)projs.splice(i,1); }
  /* конец уровня: нет выстрелов, снарядов и мишеней */
  if(running&&!over&&targets.length>0&&shots<=0&&projs.length===0&&!shards.length){ setTimeout(()=>{ if(running&&!over&&targets.length>0&&shots<=0&&!projs.length){ sfx.fail(); gameOver(); } },700); } }
/* ═══ РЕНДЕР ═══ */
function render(){ ctx.clearRect(0,0,W,H);
  /* ночное небо тира */
  const g=ctx.createLinearGradient(0,0,0,H); g.addColorStop(0,'#0A0C16'); g.addColorStop(.6,'#10121E'); g.addColorStop(1,'#0B0B12'); ctx.fillStyle=g; ctx.fillRect(0,0,W,H);
  for(let i=0;i<50;i++){ const x=(i*83)%W,y=(i*47)%320; ctx.globalAlpha=.25+((i*37)%10)/22; ctx.fillStyle='#C7C7CC'; ctx.fillRect(x,y,1.4,1.4); } ctx.globalAlpha=1;
  /* прожекторы */
  const sw=Math.sin(performance.now()*.0008)*.4; [[80,-.3+sw],[320,.3-sw]].forEach(([lx,a])=>{ ctx.save(); ctx.translate(lx,0); ctx.rotate(a); const lg=ctx.createLinearGradient(0,0,0,460); lg.addColorStop(0,'rgba(232,200,154,.16)'); lg.addColorStop(1,'rgba(232,200,154,0)'); ctx.fillStyle=lg; ctx.beginPath(); ctx.moveTo(-10,0); ctx.lineTo(-70,460); ctx.lineTo(70,460); ctx.lineTo(10,0); ctx.closePath(); ctx.fill(); ctx.restore(); });
  /* земля тира */
  ctx.fillStyle='#12121A'; ctx.fillRect(0,GROUND,W,H-GROUND); ctx.fillStyle='rgba(212,165,116,.3)'; ctx.fillRect(0,GROUND,W,2);
  /* мишени */
  targets.forEach(t=>{ const pos=targetPos(t,0); if(t.kind==='swing'){ ctx.strokeStyle='rgba(200,200,210,.35)'; ctx.lineWidth=1.5; ctx.beginPath(); ctx.moveTo(t.px,t.py); ctx.lineTo(pos.x,pos.y); ctx.stroke(); ctx.fillStyle='#2A2A38'; ctx.beginPath(); ctx.arc(t.px,t.py,5,0,TAU); ctx.fill(); }
    drawCrystal(pos.x,pos.y,t.gold,Math.sin(tGlobal*2+pos.x*.05)*.12); });
  /* следы снарядов */
  projs.forEach(p=>{ p.trail.forEach(t=>{ ctx.globalAlpha=clamp(t.life/.3,0,1)*.4; ctx.fillStyle='#E8C89A'; ctx.beginPath(); ctx.arc(t.x,t.y,3.4,0,TAU); ctx.fill(); }); ctx.globalAlpha=1; });
  /* снаряды */
  projs.forEach(p=>{ ctx.shadowColor='rgba(232,176,75,.9)'; ctx.shadowBlur=12; ctx.fillStyle='#EFC878'; ctx.beginPath(); ctx.arc(p.x,p.y,p.r,0,TAU); ctx.fill(); ctx.shadowBlur=0; ctx.fillStyle='rgba(255,255,255,.7)'; ctx.beginPath(); ctx.arc(p.x-2,p.y-2,2.4,0,TAU); ctx.fill(); });
  /* осколки */
  shards.forEach(s=>{ ctx.globalAlpha=clamp(s.life/s.maxLife,0,1); ctx.save(); ctx.translate(s.x,s.y); ctx.rotate(s.rot); ctx.fillStyle=s.color; ctx.beginPath(); ctx.moveTo(0,-s.s); ctx.lineTo(s.s*.7,0); ctx.lineTo(0,s.s); ctx.lineTo(-s.s*.7,0); ctx.closePath(); ctx.fill(); ctx.restore(); }); ctx.globalAlpha=1;
  /* кольца */
  rings.forEach(r=>{ ctx.globalAlpha=clamp(r.life/r.maxLife,0,1); ctx.strokeStyle=r.color; ctx.lineWidth=2.5; ctx.beginPath(); ctx.arc(r.x,r.y,r.r,0,TAU); ctx.stroke(); }); ctx.globalAlpha=1;
  /* рогатка */
  drawSling();
  /* траектория предпросмотр */
  if(aiming){ const dx=SLING.x-aimPt.x,dy=SLING.y-aimPt.y; const pull=Math.hypot(dx,dy); if(pull>10){ const pw=clamp(pull,0,95)/95; const v=140+pw*260; let vx=dx/pull*v,vy=dy/pull*v,x=SLING.x,y=SLING.y-14; ctx.fillStyle='rgba(255,255,255,.5)'; for(let i=0;i<16;i++){ vy+=620*.05; x+=vx*.05; y+=vy*.05; if(y>GROUND||x<0||x>W)break; if(i%2===0){ ctx.beginPath(); ctx.arc(x,y,2.2,0,TAU); ctx.fill(); } } } }
  /* тексты */
  texts.forEach(t=>{ ctx.globalAlpha=clamp(t.life/t.maxLife,0,1); ctx.font=`700 ${t.size}px Inter,sans-serif`; ctx.textAlign='center'; ctx.fillStyle=t.color; ctx.fillText(t.txt,t.x,t.y); }); ctx.globalAlpha=1; }
function drawCrystal(x,y,gold,tilt){ const R=15; ctx.save(); ctx.translate(x,y); ctx.rotate(tilt||0);
  const c1=gold?'#EFC878':'#9BD8E8', c2=gold?'#B8863C':'#4EA8C8';
  ctx.shadowColor=gold?'rgba(232,176,75,.9)':'rgba(126,200,227,.85)'; ctx.shadowBlur=16;
  const g=ctx.createLinearGradient(-R,-R,R,R); g.addColorStop(0,c1); g.addColorStop(1,c2); ctx.fillStyle=g;
  ctx.beginPath(); ctx.moveTo(0,-R*1.2); ctx.lineTo(R*.78,0); ctx.lineTo(0,R*1.2); ctx.lineTo(-R*.78,0); ctx.closePath(); ctx.fill(); ctx.shadowBlur=0;
  ctx.strokeStyle='rgba(255,255,255,.75)'; ctx.lineWidth=1.4; ctx.stroke();
  ctx.strokeStyle='rgba(255,255,255,.4)'; ctx.beginPath(); ctx.moveTo(0,-R*1.2); ctx.lineTo(0,R*1.2); ctx.moveTo(-R*.78,0); ctx.lineTo(R*.78,0); ctx.stroke();
  const sp=.5+Math.sin(performance.now()*.004+x)*.3; ctx.fillStyle=`rgba(255,255,255,${sp})`; ctx.beginPath(); ctx.arc(-R*.25,-R*.35,2.2,0,TAU); ctx.fill();
  if(gold){ ctx.fillStyle='rgba(120,80,20,.85)'; ctx.font='700 10px Inter,sans-serif'; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText('3',0,1); }
  ctx.restore(); }
function drawSling(){ const bx=SLING.x,by=SLING.y;
  ctx.strokeStyle='#6B5138'; ctx.lineWidth=7; ctx.lineCap='round';
  ctx.beginPath(); ctx.moveTo(bx-4,by+34); ctx.lineTo(bx,by-6); ctx.stroke();
  ctx.lineWidth=5; ctx.beginPath(); ctx.moveTo(bx-4,by-6); ctx.lineTo(bx-16,by-26); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(bx-4,by-6); ctx.lineTo(bx+12,by-24); ctx.stroke(); ctx.lineCap='butt';
  /* резинка */
  if(aiming){ ctx.strokeStyle='#3A2E20'; ctx.lineWidth=3.4; ctx.beginPath(); ctx.moveTo(bx-16,by-26); ctx.lineTo(aimPt.x,aimPt.y); ctx.lineTo(bx+12,by-24); ctx.stroke();
    ctx.fillStyle='#EFC878'; ctx.shadowColor='#E8B04B'; ctx.shadowBlur=10; ctx.beginPath(); ctx.arc(aimPt.x,aimPt.y,6.5,0,TAU); ctx.fill(); ctx.shadowBlur=0; }
  else { ctx.strokeStyle='rgba(58,46,32,.6)'; ctx.lineWidth=3; ctx.beginPath(); ctx.moveTo(bx-16,by-26); ctx.quadraticCurveTo(bx,by-14,bx+12,by-24); ctx.stroke(); } }
/* ─── Цикл ─── */
let last=0,acc=0,rafId=0,annT=0;
function loop(ts){ rafId=requestAnimationFrame(loop); if(!running)return; if(!last)last=ts; let dtms=ts-last; last=ts; if(dtms>200)dtms=200; acc+=dtms; let guard=0; while(acc>=STEP*1000&&guard++<6){ update(STEP); acc-=STEP*1000; } render(); }
/* ─── Ввод ─── */
function pt(e){ const r=cv.getBoundingClientRect(); return {x:(e.clientX-r.left)*(W/r.width),y:(e.clientY-r.top)*(H/r.height)}; }
cv.addEventListener('pointerdown',e=>{ if(!running||over)return; audioInit(); const p=pt(e); if(Math.hypot(p.x-SLING.x,p.y-SLING.y)<70){ aiming=true; aimPt=p; sfx.stretch(); } });
cv.addEventListener('pointermove',e=>{ if(!aiming)return; aimPt=pt(e); const dx=aimPt.x-SLING.x,dy=aimPt.y-SLING.y; const d=Math.hypot(dx,dy); if(d>95){ aimPt={x:SLING.x+dx/d*95,y:SLING.y+dy/d*95}; } });
window.addEventListener('pointerup',()=>{ if(aiming)shoot(); });
/* ─── Поток ─── */
function resetGame(){ score=0;stars=0; loadLevel(1); el.score.textContent='0'; }
function startGame(){ touchStreak(); audioInit(); if(mode==='daily')dailyRng=mulberry32(xmur3('sling-'+today)()); else dailyRng=Math.random; resetGame(); running=true; over=false; last=0; acc=0; tGlobal=0; $('welcome').classList.add('hidden'); $('modal').classList.add('hidden'); $('game').classList.remove('hidden'); refreshHud(); announce('УРОВЕНЬ 1','натяни и отпусти'); if(!rafId)rafId=requestAnimationFrame(loop); }
function refreshHud(){ el.daily.textContent=fmt(dailyBest); el.best.textContent=fmt(best); el.streakN.textContent=effStreak(); el.multN.textContent='×'+mult.toFixed(2); refreshMissionsUI(); }
function refreshWelcome(){ el.wDaily.textContent=fmt(dailyBest); el.wBest.textContent=fmt(best); el.wStreak.textContent='🔥 '+effStreak(); $('daily-date').textContent='Вызов дня · '+today.slice(5).replace('-','.'); }
function gameOver(){ over=true; running=false; missionTick('score',Math.floor(score),true); let isRec=false,isRecDay=false; if(score>best){ best=Math.floor(score); lsSet(K_BEST,best); isRec=true; } if(score>dailyBest){ dailyBest=Math.floor(score); lsSet(K_DAILY,dailyBest); isRecDay=true; } setTimeout(()=>{ $('modal-badge').textContent=isRec||isRecDay?'Новый рекорд':'Игра окончена'; $('modal-badge').classList.toggle('record',isRec||isRecDay); $('modal-title').textContent=isRecDay&&!isRec?'Рекорд дня!':(isRec?'Абсолютный рекорд!':'Выстрелы кончились'); $('modal-score').innerHTML=`Очки <b>${fmt(score)}</b> · Уровень <b>${level}</b> · Звёзды <b>${stars}⭐</b><br>Рекорд <b>${fmt(best)}</b> · за день <b>${fmt(dailyBest)}</b>`; $('modal').classList.remove('hidden'); },700); }
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
$('btn-sound').addEventListener('click',()=>{ muted=!muted; lsSet(K_MUTE,muted); if(master)master.gain.value=muted?0:0.5; syncSoundBtn(); if(!muted){ audioInit(); sfx.click(); } });
refreshWelcome(); refreshHud(); syncSoundBtn();
/* ─── Debug-хук ─── */
window.__st={
  start:startGame, over:()=>{ running=true; gameOver(); },
  state(){ return {score:Math.floor(score),level,shots,targets:targets.length,stars,projs:projs.length,running,over,mode}; },
  fire:(dx,dy)=>{ aimPt={x:SLING.x-dx*40,y:SLING.y-dy*40}; shoot(); return projs.length; },
  breakAll:()=>{ [...targets].forEach((t,i)=>{ const pos=targetPos(t,0); breakTarget(t,pos,targets.indexOf(t)); }); },
  addScore:n=>{ score+=n; }, missions:()=>missionData, records:()=>({best:lsGet(K_BEST,0),daily:lsGet(K_DAILY,0),streak:lsGet(K_STREAK,0),today}),
};
