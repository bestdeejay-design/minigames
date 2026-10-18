'use strict';
/* ═══════════════ ЗОЛОТАЯ ЖИЛА v2.0 · реакция-аркада · AXIIOM canon ═══════════════ */
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
function noiseB(dur,vol,fc){ if(!AC||muted)return; const n=Math.floor(AC.sampleRate*dur); const buf=AC.createBuffer(1,n,AC.sampleRate); const d=buf.getChannelData(0); for(let i=0;i<n;i++)d[i]=(Math.random()*2-1)*(1-i/n); const src=AC.createBufferSource(); src.buffer=buf; const f=AC.createBiquadFilter(); f.type='lowpass'; f.frequency.value=fc||800; const g=AC.createGain(); g.gain.value=vol; src.connect(f);f.connect(g);g.connect(master); src.start(); }
const sfx={
  coin(c){ const p=1+Math.min(c,20)*.04; tone(880*p,.09,'triangle',.14); tone(1320*p,.11,'triangle',.1,0,.05); },
  big(){ [660,880,1100,1320,1760].forEach((f,i)=>tone(f,.1,'triangle',.13,0,i*.05)); },
  bomb(){ noiseB(.5,.5,600); tone(70,.4,'sawtooth',.3,-30); },
  magnet(){ tone(220,.4,'sine',.12,300); tone(440,.5,'sine',.08,500,.1); },
  miss(){ tone(240,.14,'triangle',.1,-80); },
  life(){ tone(200,.3,'sawtooth',.2,-100); },
  win(){ [523,659,784,1046].forEach((f,i)=>tone(f,.14,'triangle',.14,0,i*.08)); },
  over(){ tone(300,.5,'sawtooth',.2,-220); noiseB(.6,.4,700); },
  click(){ tone(700,.05,'square',.07); },
};
/* ─── Хранилище/мета ─── */
const K_BEST='ct.best',K_DAILY='ct.daily.'+today,K_STREAK='ct.streak',K_LASTDAY='ct.lastDay',K_MUTE='ct.muted',K_MISS='ct.missions.'+today;
const el={ score:$('score-val'),daily:$('daily-val'),best:$('best-val'),lives:$('lives-val'),combo:$('combo-n'),goal:$('goal-n'),streakN:$('streak-n'),multN:$('mult-n'),missionsN:$('missions-n'),wDaily:$('w-daily-best'),wBest:$('w-best'),wStreak:$('w-streak'),gc:$('gc') };
const W=400,H=580,STEP=1/60;
const cv=el.gc,ctx=cv.getContext('2d');
let dpr=1;
function fitCanvas(){ dpr=Math.min(window.devicePixelRatio||1,2); cv.width=W*dpr; cv.height=H*dpr; cv.style.width=W+'px'; cv.style.height=H+'px'; ctx.setTransform(dpr,0,0,dpr,0,0); }
fitCanvas(); window.addEventListener('resize',fitCanvas);
/* ─── Состояние ─── */
let muted=lsGet(K_MUTE,false),mode='daily';
let running=false,over=false;
let score=0,mult=1,best=lsGet(K_BEST,0),dailyBest=lsGet(K_DAILY,0);
let streak=lsGet(K_STREAK,0),lastDay=lsGet(K_LASTDAY,'');
let dailyRng=Math.random;
const sr=(a,b)=>a+(mode==='daily'?dailyRng():Math.random())*(b-a);
const spick=arr=>arr[(mode==='daily'?dailyRng():Math.random())*arr.length|0];
let objs=[],parts=[],texts=[],rings=[];
let lives=3,combo=0,comboMult=1,level=1,goal=10,goalScore=0,magnetT=0;
let spawnT=.5,shake=0,glitterT=0;
/* ─── Мета ─── */
function effStreak(){ return (lastDay===today||lastDay===yesterday)?streak:0; }
function getMult(s){ return 1+Math.min(Math.max(s-1,0),10)*0.05; }
function touchStreak(){ if(lastDay===today){ mult=getMult(streak); return; } streak=(lastDay===yesterday)?(streak||0)+1:1; lastDay=today; lsSet(K_STREAK,streak); lsSet(K_LASTDAY,lastDay); mult=getMult(streak); if(streak>1)toast(`🔥 Стрик <b>${streak}</b> · очки ×<b>${mult.toFixed(2)}</b>`); }
const MISSIONS=[
  {id:'tap50',    name:'Поймать 50 монет',            target:50, track:'taps'},
  {id:'combo10',  name:'Серия ×2.0 и выше',           target:10, track:'hotcombo'},
  {id:'big5',     name:'Поймать 5 больших монет',     target:5,  track:'bigs'},
  {id:'dodge10',  name:'Пропустить 10 бомб мимо',     target:10, track:'dodges'},
  {id:'magnet3',  name:'Активировать 3 магнита',      target:3,  track:'magnets'},
  {id:'level10',  name:'Достичь 10-го уровня',        target:10, track:'level'},
  {id:'score300', name:'Набрать 300 очков за игру',   target:300,track:'score'},
  {id:'perfect1', name:'Уровень без потери жизни',    target:1,  track:'perfect'},
];
let missionData=lsGet(K_MISS,{p:{},done:{}});
if(!missionData.p)missionData={p:{},done:{}};
function saveMissions(){ lsSet(K_MISS,missionData); }
function missionAward(mid){ if(missionData.done[mid])return; missionData.done[mid]=1; saveMissions(); const bonus=Math.round(25*mult); if(running&&!over){ score+=bonus; goalScore+=bonus; } toast(`🎯 Миссия выполнена: <b>+${bonus}</b>`); sfx.win(); refreshMissionsUI(); }
function missionTick(track,val,absolute){ MISSIONS.forEach(m=>{ if(m.track!==track||missionData.done[m.id])return; if(absolute){ if(val>(missionData.p[m.id]||0))missionData.p[m.id]=val; } else missionData.p[m.id]=(missionData.p[m.id]||0)+val; if(missionData.p[m.id]>=m.target)missionAward(m.id); }); saveMissions(); refreshMissionsUI(); }
function refreshMissionsUI(){ const done=MISSIONS.filter(m=>missionData.done[m.id]).length; el.missionsN.textContent=done+'/3'; }
function renderMissionsModal(){ const list=$('mmodal-list'); list.innerHTML=''; MISSIONS.forEach(m=>{ const p=Math.min(missionData.p[m.id]||0,m.target); const done=!!missionData.done[m.id]; const d=document.createElement('div'); d.className='mm-item'+(done?' done':''); d.innerHTML=`<span class="mm-check">✓</span><span class="mm-body"><span class="mm-name">${m.name}</span><span class="mm-prog"><b>${fmt(p)}</b> / ${fmt(m.target)}</span></span>`; list.appendChild(d); }); }
function toast(html){ const t=document.createElement('span'); t.className='toast'; t.innerHTML=html; $('toasts').appendChild(t); setTimeout(()=>t.classList.add('out'),2600); setTimeout(()=>t.remove(),3000); }
function announce(big,sub){ const a=document.getElementById('announce'); a.innerHTML=`<span class="an-big">${big}</span>${sub?`<span class="an-sub">${sub}</span>`:''}`; a.classList.remove('hidden'); clearTimeout(annT); annT=setTimeout(()=>a.classList.add('hidden'),1600); }
function part(x,y,vx,vy,life,color,size){ parts.push({x,y,vx,vy,life,maxLife:life,color,size}); }
function glitter(x,y,n,color){ for(let i=0;i<n;i++){ const a=Math.random()*TAU,v=rand(40,170); part(x,y,Math.cos(a)*v,Math.sin(a)*v,rand(.35,.8),color,rand(1.5,3.4)); } }
function floatTxt(x,y,txt,color,size){ texts.push({x,y,txt,color,size:size||13,life:.9,maxLife:.9}); }
/* ─── Объекты ─── */
function spawnObj(){ const roll=sr(0,1); let type='coin'; if(roll<.10)type='big'; else if(roll<.24)type='bomb'; else if(roll<.31)type='magnet';
  const pad=44; const x=sr(pad,W-pad),y=sr(70,H-90);
  if(objs.some(o=>Math.hypot(o.x-x,o.y-y)<70))return;
  const life=type==='big'?1.9:(type==='bomb'?2.6:(type==='magnet'?2.2:2.1+Math.min(level*.02,.5)));
  const r=type==='big'?24:(type==='bomb'?20:(type==='magnet'?20:16));
  objs.push({type,x,y,r,life,maxLife:life,t:Math.random()*TAU,flip:Math.random()*TAU,dying:0}); }
function levelGoal(n){ return 8+n*3+(n>10?(n-10)*6:0); }
function loadLevel(n){ level=n; goal=levelGoal(n); goalScore=0; objs=[]; parts=[];texts=[];rings=[]; spawnT=.4; el.goal.textContent='0/'+goal; announce('УРОВЕНЬ '+n,'цель: '+goal); }
function comboHit(){ combo++; comboMult=1+Math.min(combo*.1,2); if(comboMult>=2)missionTick('hotcombo',1); el.combo.textContent='×'+comboMult.toFixed(1); }
function comboBreak(){ if(combo>=3)floatTxt(W/2,120,'серия прервана','#8E8E93',12); combo=0; comboMult=1; el.combo.textContent='×1.0'; }
function tapObj(o){ if(o.dying)return;
  if(o.type==='bomb'){ o.dying=.01; sfx.bomb(); lives--; el.lives.textContent=lives; shake=16; glitter(o.x,o.y,30,'#E4545F'); floatTxt(o.x,o.y-24,'−1 ЖИЗНЬ','#E4545F',15); comboBreak(); if(lives<=0)gameOver(); return; }
  o.dying=.01; comboHit();
  if(o.type==='coin'){ const pts=Math.round(1*comboMult*mult*10); score+=pts; goalScore+=pts; missionTick('taps',1); sfx.coin(combo); glitter(o.x,o.y,12,'#FFD9A8'); floatTxt(o.x,o.y-22,'+'+pts,'#FFD9A8',13); }
  else if(o.type==='big'){ const pts=Math.round(5*comboMult*mult*10); score+=pts; goalScore+=pts; missionTick('bigs',1); sfx.big(); glitter(o.x,o.y,26,'#E8B04B'); floatTxt(o.x,o.y-26,'+'+pts+' ×5','#E8B04B',16); }
  else if(o.type==='magnet'){ missionTick('magnets',1); magnetT=3; sfx.magnet(); glitter(o.x,o.y,16,'#7EC8E3'); floatTxt(o.x,o.y-24,'МАГНИТ!','#7EC8E3',15); }
  el.score.textContent=fmt(score); el.goal.textContent=Math.min(goalScore,goal)+'/'+goal;
  if(goalScore>=goal){ missionTick('level',level,true); if(lives===3&&level>1)missionTick('perfect',1); sfx.win(); announce('ЦЕЛЬ ДОСТИГНУТА','+'+Math.round(30*mult)+' бонус'); score+=Math.round(30*mult); el.score.textContent=fmt(score); setTimeout(()=>{ if(running&&!over)loadLevel(level+1); },1300); } }
function update(dt){
  if(over)return;
  spawnT-=dt*(1+level*.05); if(spawnT<=0){ spawnObj(); spawnT=Math.max(.45,sr(.7,1.3)-level*.02); }
  if(magnetT>0){ magnetT-=dt; magnetCollect(dt); }
  glitterT-=dt; if(glitterT<=0){ glitterT=.4; part(sr(20,W-20),sr(60,H-60),rand(-8,8),rand(-14,-4),rand(1,2),'rgba(212,165,116,.5)',1.6); }
  for(let i=objs.length-1;i>=0;i--){ const o=objs[i]; o.t+=dt; o.flip+=dt*(o.type==='bomb'?2:3.4);
    if(o.type==='coin'||o.type==='big'){ o.y+=Math.sin(o.t*2.4)*.18; }
    if(o.dying>0){ o.dying+=dt*4; if(o.dying>=1){ objs.splice(i,1); } continue; }
    o.life-=dt; if(o.life<=0){ objs.splice(i,1); if(o.type==='coin'||o.type==='big')comboBreak(); else if(o.type==='bomb'){ missionTick('dodges',1); } } }
  parts=parts.filter(p=>{ p.life-=dt; p.x+=p.vx*dt; p.y+=p.vy*dt; p.vy+=160*dt; return p.life>0; });
  texts=texts.filter(t=>{ t.life-=dt; t.y-=30*dt; return t.life>0; });
  rings=rings.filter(r=>{ r.life-=dt; r.r+=180*dt; return r.life>0; });
  if(shake>0)shake=Math.max(0,shake-dt*40);
}
function magnetCollect(dt){ window.__mcT=(window.__mcT||0)-dt; if(window.__mcT>0)return; window.__mcT=.4; const coins=objs.filter(o=>(o.type==='coin'||o.type==='big')&&!o.dying); if(coins.length){ const c=coins[0]; tapObj(c); } }
/* ═══ РЕНДЕР ═══ */
function render(){ ctx.clearRect(0,0,W,H);
  ctx.fillStyle='#07070B'; ctx.fillRect(0,0,W,H);
  /* жила: золотые прожилки на фоне */
  ctx.strokeStyle='rgba(212,165,116,.07)'; ctx.lineWidth=2;
  for(let i=0;i<5;i++){ ctx.beginPath(); const bx=(i*97)%W; ctx.moveTo(bx,0); ctx.quadraticCurveTo(bx+60,H*.4,bx-40,H); ctx.stroke(); }
  ctx.save();
  if(shake>0)ctx.translate(rand(-shake,shake)*.5,rand(-shake,shake)*.4);
  /* фоновые блёстки */
  parts.forEach(p=>{ ctx.globalAlpha=clamp(p.life/p.maxLife,0,1); ctx.fillStyle=p.color; ctx.beginPath(); ctx.arc(p.x,p.y,p.size,0,TAU); ctx.fill(); }); ctx.globalAlpha=1;
  /* объекты */
  objs.forEach(o=>drawObj(o));
  /* поле магнита */
  if(magnetT>0){ const a=.25+Math.sin(performance.now()*.012)*.12; ctx.strokeStyle=`rgba(126,200,227,${a})`; ctx.lineWidth=3; ctx.beginPath(); ctx.arc(W/2,H-40,60+Math.sin(performance.now()*.006)*8,0,TAU); ctx.stroke(); ctx.fillStyle=`rgba(126,200,227,${a*.4})`; ctx.beginPath(); ctx.arc(W/2,H-40,46,0,TAU); ctx.fill(); }
  /* кольца */
  rings.forEach(r=>{ ctx.globalAlpha=clamp(r.life/r.maxLife,0,1); ctx.strokeStyle=r.color; ctx.lineWidth=3; ctx.beginPath(); ctx.arc(r.x,r.y,r.r,0,TAU); ctx.stroke(); }); ctx.globalAlpha=1;
  /* тексты */
  texts.forEach(t=>{ ctx.globalAlpha=clamp(t.life/t.maxLife,0,1); ctx.font=`700 ${t.size}px Inter,sans-serif`; ctx.textAlign='center'; ctx.fillStyle=t.color; ctx.fillText(t.txt,t.x,t.y); }); ctx.globalAlpha=1;
  ctx.restore();
  /* доктайл: подсказка */
  ctx.fillStyle='rgba(200,200,210,.35)'; ctx.font='600 10px Inter,sans-serif'; ctx.textAlign='center'; ctx.fillText('тапай монеты · не трогай бомбы',W/2,H-14);
  /* прогресс уровня */
  const pw=goal>0?clamp(goalScore/goal,0,1):0; ctx.fillStyle='rgba(10,10,15,.7)'; ctx.beginPath(); ctx.roundRect(W/2-70,16,140,10,5); ctx.fill(); ctx.fillStyle='#D4A574'; ctx.beginPath(); ctx.roundRect(W/2-68,18,136*pw,6,3); ctx.fill(); }
function drawObj(o){ const die=o.dying>0?1-o.dying:1; const sc=die*(o.dying>0?1+.4*o.dying:1);
  ctx.save(); ctx.translate(o.x,o.y); ctx.scale(sc,sc);
  const breathe=1+Math.sin(o.t*4)*.03; ctx.scale(breathe,breathe);
  if(o.type==='coin'||o.type==='big'){ const R=o.r; const fw=Math.abs(Math.cos(o.flip)); const w=R*Math.max(.18,fw);
    ctx.shadowColor='rgba(232,176,75,.75)'; ctx.shadowBlur=16;
    const g=ctx.createLinearGradient(-w,0,w,0); g.addColorStop(0,'#B8863C'); g.addColorStop(.5,'#EFC878'); g.addColorStop(1,'#B8863C'); ctx.fillStyle=g;
    ctx.beginPath(); ctx.ellipse(0,0,w,R,0,0,TAU); ctx.fill(); ctx.shadowBlur=0;
    ctx.strokeStyle='rgba(120,80,20,.7)'; ctx.lineWidth=1.5; ctx.stroke();
    if(fw>.55){ ctx.fillStyle='rgba(120,80,20,.55)'; starPath(0,0,R*.44,R*.2,Math.PI/2+(o.type==='big'?Math.PI/5:0)); ctx.fill(); if(o.type==='big'){ ctx.fillStyle='rgba(90,60,10,.8)'; ctx.font=`700 ${R*.5}px Inter,sans-serif`; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText('5',0,1); } }
    /* кольцо-таймер */
    const k=clamp(o.life/o.maxLife,0,1); ctx.strokeStyle=k>.4?'rgba(255,255,255,.6)':'rgba(228,84,95,.9)'; ctx.lineWidth=3; ctx.beginPath(); ctx.arc(0,0,R+6,-Math.PI/2,-Math.PI/2+TAU*k); ctx.stroke(); }
  else if(o.type==='bomb'){ ctx.shadowColor='rgba(228,84,95,.8)'; ctx.shadowBlur=14; ctx.fillStyle='#1A1A22'; ctx.beginPath(); ctx.arc(0,2,o.r,0,TAU); ctx.fill(); ctx.shadowBlur=0; ctx.strokeStyle='rgba(228,84,95,.8)'; ctx.lineWidth=2; ctx.stroke();
    ctx.fillStyle='rgba(255,255,255,.1)'; ctx.beginPath(); ctx.arc(-o.r*.3,-o.r*.25,o.r*.28,0,TAU); ctx.fill();
    /* фитиль + искры */
    ctx.strokeStyle='#B08968'; ctx.lineWidth=2.5; ctx.beginPath(); ctx.moveTo(o.r*.2,-o.r*.85); ctx.quadraticCurveTo(o.r*.55,-o.r*1.35,o.r*.85,-o.r*1.15); ctx.stroke();
    const sp=1+Math.sin(o.t*14)*.5; ctx.fillStyle='#FFD9A8'; ctx.shadowColor='#FFB84B'; ctx.shadowBlur=10; ctx.beginPath(); ctx.arc(o.r*.85,-o.r*1.15,3*sp,0,TAU); ctx.fill(); ctx.shadowBlur=0;
    ctx.fillStyle='#E4545F'; ctx.font=`700 ${o.r*.62}px Inter,sans-serif`; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText('!',0,4); }
  else if(o.type==='magnet'){ ctx.shadowColor='rgba(126,200,227,.8)'; ctx.shadowBlur=14;
    ctx.strokeStyle='#7EC8E3'; ctx.lineWidth=7; ctx.beginPath(); ctx.arc(0,2,o.r*.62,Math.PI,0); ctx.stroke(); ctx.shadowBlur=0;
    ctx.fillStyle='#C7CCE0'; ctx.fillRect(-o.r*.62-3.5,2,7,o.r*.5); ctx.fillRect(o.r*.62-3.5,2,7,o.r*.5);
    ctx.fillStyle='#E4545F'; ctx.fillRect(-o.r*.62-3.5,2+o.r*.5,7,4); ctx.fillRect(o.r*.62-3.5,2+o.r*.5,7,4);
    const k=clamp(o.life/o.maxLife,0,1); ctx.strokeStyle='rgba(126,200,227,.7)'; ctx.lineWidth=3; ctx.beginPath(); ctx.arc(0,0,o.r+6,-Math.PI/2,-Math.PI/2+TAU*k); ctx.stroke(); }
  ctx.restore(); }
function starPath(cx,cy,ro,ri,rot){ ctx.beginPath(); for(let i=0;i<10;i++){ const a=-Math.PI/2+(rot||0)+i*Math.PI/5; const r=i%2?ri:ro; ctx.lineTo(cx+Math.cos(a)*r,cy+Math.sin(a)*r); } ctx.closePath(); }
/* ─── Цикл ─── */
let last=0,acc=0,rafId=0,annT=0;
function loop(ts){ rafId=requestAnimationFrame(loop); if(!running)return; if(!last)last=ts; let dtms=ts-last; last=ts; if(dtms>200)dtms=200; acc+=dtms; let guard=0; while(acc>=STEP*1000&&guard++<6){ update(STEP); acc-=STEP*1000; } render(); }
/* ─── Ввод: тапы ─── */
function pt(e){ const r=cv.getBoundingClientRect(); return {x:(e.clientX-r.left)*(W/r.width),y:(e.clientY-r.top)*(H/r.height)}; }
cv.addEventListener('pointerdown',e=>{ if(!running||over)return; audioInit(); const p=pt(e);
  let hit=null,bd=1e9; objs.forEach(o=>{ if(o.dying)return; const d=Math.hypot(o.x-p.x,o.y-p.y); if(d<o.r+14&&d<bd){ bd=d; hit=o; } });
  if(hit){ tapObj(hit); } else { comboBreak(); part(p.x,p.y,0,0,.25,'rgba(255,255,255,.4)',2); } });
/* ─── Поток ─── */
function resetGame(){ score=0; lives=3; combo=0; comboMult=1; magnetT=0; el.score.textContent='0'; el.lives.textContent='3'; el.combo.textContent='×1.0'; loadLevel(1); }
function startGame(){ touchStreak(); audioInit(); if(mode==='daily')dailyRng=mulberry32(xmur3('cointap-'+today)()); else dailyRng=Math.random; resetGame(); running=true; over=false; last=0; acc=0; $('welcome').classList.add('hidden'); $('modal').classList.add('hidden'); $('game').classList.remove('hidden'); refreshHud(); if(!rafId)rafId=requestAnimationFrame(loop); }
function refreshHud(){ el.daily.textContent=fmt(dailyBest); el.best.textContent=fmt(best); el.streakN.textContent=effStreak(); el.multN.textContent='×'+mult.toFixed(2); refreshMissionsUI(); }
function refreshWelcome(){ el.wDaily.textContent=fmt(dailyBest); el.wBest.textContent=fmt(best); el.wStreak.textContent='🔥 '+effStreak(); $('daily-date').textContent='Вызов дня · '+today.slice(5).replace('-','.'); }
function gameOver(){ over=true; running=false; sfx.over(); missionTick('score',Math.floor(score),true); let isRec=false,isRecDay=false; if(score>best){ best=Math.floor(score); lsSet(K_BEST,best); isRec=true; } if(score>dailyBest){ dailyBest=Math.floor(score); lsSet(K_DAILY,dailyBest); isRecDay=true; } setTimeout(()=>{ $('modal-badge').textContent=isRec||isRecDay?'Новый рекорд':'Игра окончена'; $('modal-badge').classList.toggle('record',isRec||isRecDay); $('modal-title').textContent=isRecDay&&!isRec?'Рекорд дня!':(isRec?'Абсолютный рекорд!':'Жила обвалилась'); $('modal-score').innerHTML=`Очки <b>${fmt(score)}</b> · Уровень <b>${level}</b><br>Рекорд <b>${fmt(best)}</b> · за день <b>${fmt(dailyBest)}</b>`; $('modal').classList.remove('hidden'); },800); }
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
window.__ct={
  start:startGame, over:()=>{ running=true; gameOver(); },
  state(){ return {score:Math.floor(score),lives,level,goalScore,goal,combo:comboMult,objs:objs.map(o=>o.type),magnet:Math.round(magnetT*10)/10,running,over,mode}; },
  tap:i=>{ const o=objs.filter(x=>!x.dying)[i]; if(o)tapObj(o); },
  spawn:type=>{ const roll=type==='big'?.05:(type==='bomb'?.15:(type==='magnet'?.25:0)); const save=dailyRng; if(type){ dailyRng=()=>roll/1; spawnObj(); dailyRng=save; } else spawnObj(); },
  addScore:n=>{ score+=n; goalScore+=n; }, missions:()=>missionData, records:()=>({best:lsGet(K_BEST,0),daily:lsGet(K_DAILY,0),streak:lsGet(K_STREAK,0),today}),
};
