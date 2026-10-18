'use strict';
/* ═══════════════ КЛАДЕЗЬ v2.0 · бильярд-головоломка · AXIIOM canon ═══════════════ */
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
function noiseHit(vol,fc){ if(!AC||muted)return; const n=Math.floor(AC.sampleRate*.06); const buf=AC.createBuffer(1,n,AC.sampleRate); const d=buf.getChannelData(0); for(let i=0;i<n;i++)d[i]=(Math.random()*2-1)*(1-i/n); const src=AC.createBufferSource(); src.buffer=buf; const f=AC.createBiquadFilter(); f.type='bandpass'; f.frequency.value=fc||2200; const g=AC.createGain(); g.gain.value=vol; src.connect(f);f.connect(g);g.connect(master); src.start(); }
const sfx={
  clack(v){ noiseHit(clamp(v,.05,.5),2400); tone(1800,.03,'triangle',clamp(v*.5,.02,.2)); },
  cushion(v){ noiseHit(clamp(v*.6,.04,.25),700); },
  pot(){ tone(520,.12,'sine',.16,-140); noiseHit(.2,900); setTimeout(()=>tone(300,.14,'sine',.14,-80),60); },
  combo(n){ [660,880,1100,1320].slice(0,Math.min(n,4)).forEach((f,i)=>tone(f,.12,'sine',.13,0,i*.07)); },
  scratch(){ tone(200,.3,'sawtooth',.16,-100); },
  win(){ [523,659,784,1046].forEach((f,i)=>tone(f,.16,'triangle',.15,0,i*.09)); },
  fail(){ tone(300,.4,'sawtooth',.18,-160); },
  click(){ tone(700,.05,'square',.07); },
};
/* ─── Хранилище/мета ─── */
const K_BEST='bl.best',K_DAILY='bl.daily.'+today,K_STREAK='bl.streak',K_LASTDAY='bl.lastDay',K_MUTE='bl.muted',K_MISS='bl.missions.'+today;
const el={ score:$('score-val'),daily:$('daily-val'),best:$('best-val'),level:$('level-val'),shots:$('shots-n'),streakN:$('streak-n'),multN:$('mult-n'),missionsN:$('missions-n'),wDaily:$('w-daily-best'),wBest:$('w-best'),wStreak:$('w-streak'),gc:$('gc') };
const W=400,H=580,STEP=1/60;
const cv=el.gc,ctx=cv.getContext('2d');
let dpr=1;
function fitCanvas(){ dpr=Math.min(window.devicePixelRatio||1,2); cv.width=W*dpr; cv.height=H*dpr; cv.style.width=W+'px'; cv.style.height=H+'px'; ctx.setTransform(dpr,0,0,dpr,0,0); }
fitCanvas(); window.addEventListener('resize',fitCanvas);
/* стол: игровое поле */
const T={x:52,y:96,w:296,h:400}; /* внутренний борт к борту */
const BR=11; /* радиус шара */
const POCKETS=[{x:T.x-4,y:T.y-4,r:19},{x:T.x+T.w/2,y:T.y-2,r:19},{x:T.x+T.w+4,y:T.y-4,r:19},{x:T.x-4,y:T.y+T.h+4,r:19},{x:T.x+T.w/2,y:T.y+T.h+2,r:19},{x:T.x+T.w+4,y:T.y+T.h+4,r:19}];
/* ─── Состояние ─── */
let muted=lsGet(K_MUTE,false),mode='daily';
let running=false,over=false,paused=false;
let score=0,mult=1,best=lsGet(K_BEST,0),dailyBest=lsGet(K_DAILY,0);
let streak=lsGet(K_STREAK,0),lastDay=lsGet(K_LASTDAY,'');
let dailyRng=Math.random;
const sr=(a,b)=>a+(mode==='daily'?dailyRng():Math.random())*(b-a);
let level=1,shots=4,balls=[],sinking=[],cuest={x:T.x+T.w/2,y:T.y+T.h*.78,active:false,dx:0,dy:0,pull:0},aim=null;
let moving=false,shaken=0,trails=[],rings=[],texts=[],bankBounces=0,shotPots=0,bestCombo=0;
const BALL_COLORS=['#E4545F','#B06AE4','#4ED8C8','#E8B04B','#8B9D83','#7EC8E3','#C97A9E','#9E8F7A'];
/* ─── Мета ─── */
function effStreak(){ return (lastDay===today||lastDay===yesterday)?streak:0; }
function getMult(s){ return 1+Math.min(Math.max(s-1,0),10)*0.05; }
function touchStreak(){ if(lastDay===today){ mult=getMult(streak); return; } streak=(lastDay===yesterday)?(streak||0)+1:1; lastDay=today; lsSet(K_STREAK,streak); lsSet(K_LASTDAY,lastDay); mult=getMult(streak); if(streak>1)toast(`🔥 Стрик <b>${streak}</b> · очки ×<b>${mult.toFixed(2)}</b>`); }
const MISSIONS=[
  {id:'pot10',   name:'Забить 10 шаров',            target:10, track:'pots'},
  {id:'combo2',  name:'Комбо ×2 (2 шара за удар)',  target:2,  track:'combos'},
  {id:'bank1',   name:'Забить с рикошетом',         target:1,  track:'bankpots'},
  {id:'levels5', name:'Пройти 5 уровней',           target:5,  track:'levels'},
  {id:'score1k5',name:'Набрать 1500 очков за игру', target:1500,track:'score'},
  {id:'clean2',  name:'2 уровня без промахов',      target:2,  track:'clean'},
  {id:'banks5',  name:'5 рикошетов за игру',        target:5,  track:'bounces'},
  {id:'pot25',   name:'Забить 25 шаров за игру',    target:25, track:'potsGame'},
];
let missionData=lsGet(K_MISS,{p:{},done:{}});
if(!missionData.p)missionData={p:{},done:{}};
function saveMissions(){ lsSet(K_MISS,missionData); }
function missionAward(mid){ if(missionData.done[mid])return; missionData.done[mid]=1; saveMissions(); const bonus=Math.round(25*mult); if(running&&!over){ score+=bonus; floatTxt(cuest.x,cuest.y-30,`+${bonus}`,'#D4A574',15); } toast(`🎯 Миссия выполнена: <b>+${bonus}</b>`); sfx.win(); refreshMissionsUI(); }
function missionTick(track,val,absolute){ MISSIONS.forEach(m=>{ if(m.track!==track||missionData.done[m.id])return; if(absolute){ if(val>(missionData.p[m.id]||0))missionData.p[m.id]=val; } else missionData.p[m.id]=(missionData.p[m.id]||0)+val; if(missionData.p[m.id]>=m.target)missionAward(m.id); }); saveMissions(); refreshMissionsUI(); }
function refreshMissionsUI(){ const done=MISSIONS.filter(m=>missionData.done[m.id]).length; el.missionsN.textContent=done+'/3'; }
function renderMissionsModal(){ const list=$('mmodal-list'); list.innerHTML=''; MISSIONS.forEach(m=>{ const p=Math.min(missionData.p[m.id]||0,m.target); const done=!!missionData.done[m.id]; const d=document.createElement('div'); d.className='mm-item'+(done?' done':''); d.innerHTML=`<span class="mm-check">✓</span><span class="mm-body"><span class="mm-name">${m.name}</span><span class="mm-prog"><b>${fmt(p)}</b> / ${fmt(m.target)}</span></span>`; list.appendChild(d); }); }
function toast(html){ const t=document.createElement('span'); t.className='toast'; t.innerHTML=html; $('toasts').appendChild(t); setTimeout(()=>t.classList.add('out'),2600); setTimeout(()=>t.remove(),3000); }
let annT=0;
function announce(big,sub){ const a=document.getElementById('announce'); a.innerHTML=`<span class="an-big">${big}</span>${sub?`<span class="an-sub">${sub}</span>`:''}`; a.classList.remove('hidden'); clearTimeout(annT); annT=setTimeout(()=>a.classList.add('hidden'),1700); }
function ring(x,y,color){ rings.push({x,y,r:6,life:.4,maxLife:.4,color}); }
function floatTxt(x,y,txt,color,size){ texts.push({x,y,txt,color,size:size||13,life:1,maxLife:1}); }
/* ─── Уровни ─── */
function levelBalls(n){ const count=Math.min(2+Math.ceil(n*.7),9); const arr=[]; const rng=mode==='daily'?dailyRng:Math.random; let tries=0; while(arr.length<count&&tries++<200){ const x=sr(T.x+30,T.x+T.w-30),y=sr(T.y+30,T.y+T.h*.62); if(Math.hypot(x-cuest.x,y-cuest.y)<70)continue; if(arr.some(b=>Math.hypot(b.x-x,b.y-y)<BR*2.6))continue; arr.push({x,y,num:arr.length+1,color:BALL_COLORS[arr.length%BALL_COLORS.length]}); } return arr; }
function loadLevel(n){ level=n; shots=Math.min(2+Math.ceil(n*.7),9)+1; cuest={x:T.x+T.w/2,y:T.y+T.h*.82,active:false,dx:0,dy:0,pull:0}; balls=[{x:cuest.x,y:cuest.y,cue:true,num:null,color:'#F2EADC'}]; balls.push(...levelBalls(n)); sinking=[]; moving=false; bankBounces=0; shotPots=0; el.level.textContent=n; el.shots.textContent=shots; }
/* ─── Физика ─── */
function anyMoving(){ return balls.some(b=>b.vx||b.vy)||sinking.length>0; }
function shoot(){ const p=clamp(cuest.pull,0,120); if(p<6){ cuest.active=false; aim=null; return; } const nx=cuest.dx,ny=cuest.dy; const pow=p*.155; cueBall().vx=nx*pow*60; cueBall().vy=ny*pow*60; shots--; el.shots.textContent=shots; sfx.clack(p/120); cuest.active=false; cuest.pull=0; aim=null; moving=true; shotPots=0; bankBounces=0; }
function cueBall(){ return balls[0]; }
function setupBalls(){ /* balls[0] — кий */ }
function stepBall(b,dt){
  const SUB=4; const sdt=dt/SUB;
  for(let s=0;s<SUB;s++){
    b.x+=b.vx*sdt; b.y+=b.vy*sdt;
    /* лузы */
    for(const p of POCKETS){ if(Math.hypot(b.x-p.x,b.y-p.y)<p.r-2){ if(b.cue){ /* скретч */ sfx.scratch(); floatTxt(p.x,p.y-24,'СКИШ! −1 ход','#E4545F',14); shots=Math.max(0,shots-1); el.shots.textContent=shots; b.x=T.x+T.w/2; b.y=T.y+T.h*.82; b.vx=b.vy=0; } else { sinkBall(b,p); } return; } }
    /* борта */
    let bounced=false;
    if(b.x<T.x+BR){ b.x=T.x+BR; b.vx=Math.abs(b.vx)*.82; bounced=true; }
    if(b.x>T.x+T.w-BR){ b.x=T.x+T.w-BR; b.vx=-Math.abs(b.vx)*.82; bounced=true; }
    if(b.y<T.y+BR){ b.y=T.y+BR; b.vy=Math.abs(b.vy)*.82; bounced=true; }
    if(b.y>T.y+T.h-BR){ b.y=T.y+T.h-BR; b.vy=-Math.abs(b.vy)*.82; bounced=true; }
    if(bounced&&Math.hypot(b.vx,b.vy)>40){ sfx.cushion(Math.hypot(b.vx,b.vy)/900); if(!b.cue){ bankBounces++; missionTick('bounces',1); } ring(b.x,b.y,'rgba(212,165,116,.5)'); }
    /* столкновения шар-шар */
    for(const o of balls){ if(o===b)continue; const dx=o.x-b.x,dy=o.y-b.y; const d=Math.hypot(dx,dy); if(d<BR*2&&d>0){ const nx=dx/d,ny=dy/d; const overlap=BR*2-d; b.x-=nx*overlap/2; b.y-=ny*overlap/2; o.x+=nx*overlap/2; o.y+=ny*overlap/2;
      const rvx=o.vx-b.vx,rvy=o.vy-b.vy; const vn=rvx*nx+rvy*ny; if(vn<0){ const imp=-vn*.92; b.vx-=nx*imp; b.vy-=ny*imp; o.vx+=nx*imp; o.vy+=ny*imp; const spd=Math.abs(vn); if(spd>25)sfx.clack(clamp(spd/700,.05,.45)); } } }
  }
  /* трение */
  const fr=Math.exp(-dt*1.05); b.vx*=fr; b.vy*=fr; if(Math.hypot(b.vx,b.vy)<5){ b.vx=0; b.vy=0; }
  /* следы */
  if(Math.hypot(b.vx,b.vy)>140&&Math.random()<.5)trails.push({x:b.x,y:b.y,life:.35,maxLife:.35,color:b.cue?'#E8C89A':b.color});
}
function sinkBall(b,p){ balls.splice(balls.indexOf(b),1); sinking.push({x:b.x,y:b.y,color:b.color,num:b.num,t:0}); sfx.pot(); shotPots++; missionTick('pots',1); missionTick('potsGame',1); let pts=Math.round(100*mult); if(shotPots>=2)pts=Math.round(pts*2); score+=pts; floatTxt(p.x,p.y-20,'+'+fmt(pts),shotPots>=2?'#D4A574':'#C7C7CC',shotPots>=2?16:13); ring(p.x,p.y,'#D4A574'); if(shotPots===2){ missionTick('combos',1); bestCombo=Math.max(bestCombo,2); sfx.combo(2); toast('🎱 Комбо ×2: <b>оба в лузе!</b>'); } if(bankBounces>0){ missionTick('bankpots',1); floatTxt(p.x,p.y-42,'РИКОШЕТ!','#7EC8E3',12); } checkLevelEnd(); }
function checkLevelEnd(){ if(balls.filter(b=>!b.cue).length===0){ const bonus=Math.round((50+shots*60)*mult); score+=bonus; if(shots>=2){ missionTick('clean',1); } missionTick('levels',level,true); sfx.win(); announce('УРОВЕНЬ '+level,'+'+fmt(bonus)+' · ходов осталось: '+shots); setTimeout(()=>{ if(running&&!over)loadLevel(level+1); },1400); } else if(shots<=0&&!anyMoving()&&!sinking.length){ setTimeout(()=>{ if(running&&!over&&!anyMoving()){ sfx.fail(); gameOver(false); } },800); } }
/* ─── Прицеливание ─── */
function computeAim(){ const b=cueBall(); if(!b)return null; const dx=cuest.dx,dy=cuest.dy; /* луч от шара по (dx,dy) */ let t=1e9,hitBall=null;
  for(const o of balls){ if(o===b)continue; const rx=o.x-b.x,ry=o.y-b.y; const proj=rx*dx+ry*dy; if(proj<=0)continue; const perp2=(rx*rx+ry*ry)-proj*proj; const R=(BR*2)*(BR*2); if(perp2<R){ const t2=proj-Math.sqrt(R-perp2); if(t2<t&&t2>0){ t=t2; hitBall=o; } } }
  /* борта */
  let wallT=1e9,wallN=[0,0];
  if(dx<0){ const tw=(T.x+BR-b.x)/dx; if(tw<wallT){ wallT=tw; wallN=[1,0]; } } if(dx>0){ const tw=(T.x+T.w-BR-b.x)/dx; if(tw<wallT){ wallT=tw; wallN=[-1,0]; } }
  if(dy<0){ const tw=(T.y+BR-b.y)/dy; if(tw<wallT){ wallT=tw; wallN=[0,1]; } } if(dy>0){ const tw=(T.y+T.h-BR-b.y)/dy; if(tw<wallT){ wallT=tw; wallN=[0,-1]; } }
  const ballT=hitBall?t:1e9;
  if(ballT<wallT){ return {ex:b.x+dx*ballT,ey:b.y+dy*ballT,hit:'ball',ref:hitBall,nx:dx,ny:dy}; }
  return {ex:b.x+dx*wallT,ey:b.y+dy*wallT,hit:'wall',nx:wallN[0],ny:wallN[1],dx,dy}; }
/* ─── Апдейт ─── */
function update(dt){
  if(over)return;
  trails=trails.filter(t=>{ t.life-=dt; return t.life>0; });
  rings=rings.filter(r=>{ r.life-=dt; r.r+=140*dt; return r.life>0; });
  texts=texts.filter(t=>{ t.life-=dt; t.y-=26*dt; return t.life>0; });
  sinking=sinking.filter(s=>{ s.t+=dt; return s.t<.4; });
  if(shaken>0)shaken=Math.max(0,shaken-dt*30);
  if(!moving&&!anyMoving()){ moving=false; }
  if(moving){ for(const b of balls)stepBall(b,dt); if(!anyMoving()){ moving=false; if(running&&!over)checkLevelEnd(); } }
}
/* ═══ РЕНДЕР ═══ */
function render(){ ctx.clearRect(0,0,W,H);
  ctx.fillStyle='#07070B'; ctx.fillRect(0,0,W,H);
  if(shaken>0)ctx.translate(rand(-shaken,shaken)*.5,rand(-shaken,shaken)*.4);
  /* рама стола */
  const fx=T.x-26,fy=T.y-26,fw=T.w+52,fh=T.h+52;
  ctx.fillStyle='#241A10'; ctx.beginPath(); ctx.roundRect(fx,fy,fw,fh,22); ctx.fill();
  ctx.strokeStyle='rgba(212,165,116,.5)'; ctx.lineWidth=2; ctx.stroke();
  /* сукно */
  const fg=ctx.createRadialGradient(T.x+T.w/2,T.y+T.h/2,40,T.x+T.w/2,T.y+T.h/2,T.w*.75); fg.addColorStop(0,'#16412C'); fg.addColorStop(1,'#0E2A1C'); ctx.fillStyle=fg; ctx.beginPath(); ctx.roundRect(T.x-14,T.y-14,T.w+28,T.h+28,14); ctx.fill();
  /* алмазные вставки */
  ctx.fillStyle='rgba(232,200,154,.85)';
  for(let i=1;i<=3;i++){ const dx=T.x+T.w*i/4; diamond(dx,T.y-20); diamond(dx,T.y+T.h+20); }
  for(let i=1;i<=2;i++){ const dy=T.y+T.h*i/3; diamond(T.x-20,dy); diamond(T.x+T.w+20,dy); }
  /* лузы */
  POCKETS.forEach(p=>{ ctx.fillStyle='#050507'; ctx.beginPath(); ctx.arc(p.x,p.y,p.r,0,TAU); ctx.fill(); ctx.strokeStyle='rgba(212,165,116,.65)'; ctx.lineWidth=2.5; ctx.stroke(); const pulse=.5+Math.sin(performance.now()*.003+p.x)*.2; ctx.strokeStyle=`rgba(212,165,116,${pulse*.25})`; ctx.beginPath(); ctx.arc(p.x,p.y,p.r+4,0,TAU); ctx.stroke(); });
  /* прицельная линия */
  const b=cueBall();
  if(aim&&b&&!moving){ ctx.setLineDash([5,7]); ctx.strokeStyle='rgba(255,255,255,.55)'; ctx.lineWidth=1.6; ctx.beginPath(); ctx.moveTo(b.x,b.y); ctx.lineTo(aim.ex,aim.ey); ctx.stroke(); ctx.setLineDash([]);
    /* призрачный шар */
    ctx.strokeStyle='rgba(255,255,255,.4)'; ctx.beginPath(); ctx.arc(aim.ex,aim.ey,BR,0,TAU); ctx.stroke();
    if(aim.hit==='ball'&&aim.ref){ const nx=aim.ref.x-aim.ex,ny=aim.ref.y-aim.ey; const d=Math.hypot(nx,ny)||1; ctx.strokeStyle='rgba(228,84,95,.6)'; ctx.beginPath(); ctx.moveTo(aim.ex,aim.ey); ctx.lineTo(aim.ex+nx/d*34,aim.ey+ny/d*34); ctx.stroke(); }
    if(aim.hit==='wall'){ const rdx=aim.dx-2*(aim.dx*aim.nx+aim.dy*aim.ny)*aim.nx,rdy=aim.dy-2*(aim.dx*aim.nx+aim.dy*aim.ny)*aim.ny; ctx.strokeStyle='rgba(126,200,227,.55)'; ctx.beginPath(); ctx.moveTo(aim.ex,aim.ey); ctx.lineTo(aim.ex+rdx*60,aim.ey+rdy*60); ctx.stroke(); } }
  /* следы */
  trails.forEach(t=>{ ctx.globalAlpha=clamp(t.life/t.maxLife,0,1)*.35; ctx.fillStyle=t.color; ctx.beginPath(); ctx.arc(t.x,t.y,BR*.6,0,TAU); ctx.fill(); }); ctx.globalAlpha=1;
  /* кольца */
  rings.forEach(r=>{ ctx.globalAlpha=clamp(r.life/r.maxLife,0,1); ctx.strokeStyle=r.color; ctx.lineWidth=2.5; ctx.beginPath(); ctx.arc(r.x,r.y,r.r,0,TAU); ctx.stroke(); }); ctx.globalAlpha=1;
  /* шары */
  for(const ball of balls){ drawBall(ball.x,ball.y,BR,ball.cue?'#F2EADC':ball.color,ball.cue?null:ball.num); }
  /* тонущие */
  sinking.forEach(s=>{ const k=1-s.t/.4; drawBall(s.x,s.y,BR*k,s.color,s.num); });
  /* тексты */
  texts.forEach(t=>{ ctx.globalAlpha=clamp(t.life/t.maxLife,0,1); ctx.font=`700 ${t.size}px Inter,sans-serif`; ctx.textAlign='center'; ctx.fillStyle=t.color; ctx.fillText(t.txt,t.x,t.y); }); ctx.globalAlpha=1;
  /* кий */
  if(b&&!moving&&shots>0&&(cuest.active||cuest.pull>4)){ const dirx=cuest.dx,diry=cuest.dy; const pull=cuest.pull; const bx=b.x-dirx*(24+pull),by=b.y-diry*(24+pull);
    ctx.strokeStyle='#B08968'; ctx.lineWidth=5; ctx.lineCap='round'; ctx.beginPath(); ctx.moveTo(bx-dirx*150,by-diry*150); ctx.lineTo(bx,by); ctx.stroke();
    ctx.strokeStyle='#E8C89A'; ctx.lineWidth=5; ctx.beginPath(); ctx.moveTo(bx-dirx*18,by-diry*18); ctx.lineTo(bx,by); ctx.stroke(); ctx.lineCap='butt';
    /* индикатор силы */
    if(pull>6){ ctx.fillStyle='rgba(10,10,15,.7)'; ctx.beginPath(); ctx.roundRect(W/2-52,H-38,104,18,9); ctx.fill(); ctx.fillStyle='#D4A574'; ctx.beginPath(); ctx.roundRect(W/2-50,H-36,100*(pull/120),14,7); ctx.fill(); } }
  ctx.setTransform(dpr,0,0,dpr,0,0); }
function diamond(x,y){ ctx.save(); ctx.translate(x,y); ctx.rotate(Math.PI/4); ctx.fillRect(-3.2,-3.2,6.4,6.4); ctx.restore(); }
function drawBall(x,y,r,color,num){ ctx.save(); ctx.translate(x,y);
  ctx.fillStyle='rgba(0,0,0,.35)'; ctx.beginPath(); ctx.ellipse(2,3,r,r*.8,0,0,TAU); ctx.fill();
  ctx.fillStyle=color; ctx.beginPath(); ctx.arc(0,0,r,0,TAU); ctx.fill();
  ctx.strokeStyle='rgba(255,255,255,.5)'; ctx.lineWidth=1.2; ctx.stroke();
  const g=ctx.createRadialGradient(-r*.35,-r*.4,1,0,0,r); g.addColorStop(0,'rgba(255,255,255,.85)'); g.addColorStop(.25,'rgba(255,255,255,.2)'); g.addColorStop(1,'rgba(255,255,255,0)'); ctx.fillStyle=g; ctx.beginPath(); ctx.arc(0,0,r,0,TAU); ctx.fill();
  if(num!==null&&num!==undefined){ ctx.fillStyle='rgba(255,255,255,.95)'; ctx.beginPath(); ctx.arc(0,1,r*.52,0,TAU); ctx.fill(); ctx.fillStyle='#14100B'; ctx.font=`700 ${Math.max(7,r*.75)}px Inter,sans-serif`; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText(num,0,1.5); }
  ctx.restore(); }
/* ─── Цикл ─── */
let last=0,acc=0,rafId=0;
function loop(ts){ rafId=requestAnimationFrame(loop); if(!running)return; if(!last)last=ts; let dtms=ts-last; last=ts; if(dtms>200)dtms=200; acc+=dtms; let guard=0; while(acc>=STEP*1000&&guard++<6){ update(STEP); acc-=STEP*1000; } el.score.textContent=fmt(score); render(); }
/* ─── Ввод ─── */
function pt(e){ const r=cv.getBoundingClientRect(); return {x:(e.clientX-r.left)*(W/r.width),y:(e.clientY-r.top)*(H/r.height)}; }
cv.addEventListener('pointerdown',e=>{ audioInit(); const p=pt(e); const b=cueBall(); if(!b||moving||over)return; if(Math.hypot(p.x-b.x,p.y-b.y)<40){ cuest.active=true; } });
cv.addEventListener('pointermove',e=>{ if(!cuest.active)return; const p=pt(e); const b=cueBall(); if(!b)return; let dx=b.x-p.x,dy=b.y-p.y; const d=Math.hypot(dx,dy); if(d>1){ cuest.dx=dx/d; cuest.dy=dy/d; cuest.pull=clamp(d-14,0,120); aim=computeAim(); } });
window.addEventListener('pointerup',()=>{ if(cuest.active){ shoot(); } });
/* ─── Поток ─── */
function makeBalls(){ const arr=[{x:cuest.x,y:cuest.y,cue:true,num:null,color:'#F2EADC'}]; levelBalls(level).forEach(b=>arr.push({...b})); /* раскладка не должна пересекаться с кием */ return arr.filter((b,i)=>i===0||Math.hypot(b.x-cuest.x,b.y-cuest.y)>BR*3); }
function resetGame(){ score=0;bestCombo=0; loadLevel(1); texts=[];trails=[];rings=[];sinking=[]; el.score.textContent='0'; }
function startGame(){ touchStreak(); audioInit(); if(mode==='daily')dailyRng=mulberry32(xmur3('billiards-'+today)()); else dailyRng=Math.random; resetGame(); running=true; over=false; last=0; acc=0; $('welcome').classList.add('hidden'); $('modal').classList.add('hidden'); $('game').classList.remove('hidden'); refreshHud(); announce('УРОВЕНЬ 1','забей все шары'); if(!rafId)rafId=requestAnimationFrame(loop); }
function refreshHud(){ el.daily.textContent=fmt(dailyBest); el.best.textContent=fmt(best); el.streakN.textContent=effStreak(); el.multN.textContent='×'+mult.toFixed(2); refreshMissionsUI(); }
function refreshWelcome(){ el.wDaily.textContent=fmt(dailyBest); el.wBest.textContent=fmt(best); el.wStreak.textContent='🔥 '+effStreak(); $('daily-date').textContent='Вызов дня · '+today.slice(5).replace('-','.'); }
function gameOver(win){ over=true; running=false; missionTick('score',Math.floor(score),true); let isRec=false,isRecDay=false; if(score>best){ best=Math.floor(score); lsSet(K_BEST,best); isRec=true; } if(score>dailyBest){ dailyBest=Math.floor(score); lsSet(K_DAILY,dailyBest); isRecDay=true; } setTimeout(()=>{ $('modal-badge').textContent=isRec||isRecDay?'Новый рекорд':(win?'Победа':'Игра окончена'); $('modal-badge').classList.toggle('record',isRec||isRecDay); $('modal-title').textContent=win?'Стол зачищен!':(isRecDay?'Рекорд дня!':(isRec?'Абсолютный рекорд!':'Ходы кончились')); $('modal-score').innerHTML=`Очки <b>${fmt(score)}</b> · Уровень <b>${level}</b>${bestCombo?` · Лучшее комбо <b>×${bestCombo}</b>`:''}<br>Рекорд <b>${fmt(best)}</b> · за день <b>${fmt(dailyBest)}</b>`; $('modal').classList.remove('hidden'); },700); }
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
window.__bl={
  start:startGame, over:w=>{ running=true; gameOver(w===true); },
  state(){ return {score:Math.floor(score),level,shots,balls:balls.filter(b=>!b.cue).length,moving,running,over,mode}; },
  aim:(dx,dy,pull)=>{ cuest.dx=dx;cuest.dy=dy;cuest.pull=pull; aim=computeAim(); return aim; },
  fire:(dx,dy,pull)=>{ cuest.dx=dx;cuest.dy=dy;cuest.pull=pull; shoot(); },
  cue:()=>cueBall(), balls:()=>balls, sink:i=>{ const b=balls.filter(x=>!x.cue)[i]; if(b)sinkBall(b,POCKETS[0]); },
  addScore:n=>{ score+=n; }, missions:()=>missionData, records:()=>({best:lsGet(K_BEST,0),daily:lsGet(K_DAILY,0),streak:lsGet(K_STREAK,0),today}),
};
