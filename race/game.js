'use strict';
/* Гонка — ночная трасса в стиле AXIIOM. canvas + vanilla JS, без зависимостей.
   Мета: вызов дня (seed от даты МСК), стрик-множитель, ежедневные миссии, рекорды в localStorage.
   Пересборка: fixed timestep, корректные интервалы спавна (секунды, не кадры), миссии, стрик. */

// ---------- утилиты ----------
const $ = id => document.getElementById(id);
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
function xmur3(str){let h=1779033703^str.length;for(let i=0;i<str.length;i++){h=Math.imul(h^str.charCodeAt(i),3432918353);h=h<<13|h>>>19;}return function(){h=Math.imul(h^h>>>16,2246822507);h=Math.imul(h^h>>>13,3266489909);return (h^=h>>>16)>>>0;};}
function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return ((t^t>>>14)>>>0)/4294967296;};}
function lsGet(k, d){ try{ const v = localStorage.getItem(k); return v===null? d : JSON.parse(v); }catch(e){ return d; } }
function lsSet(k, v){ try{ localStorage.setItem(k, JSON.stringify(v)); }catch(e){} }

// ---------- даты (Europe/Moscow) ----------
const dateFmt = new Intl.DateTimeFormat('sv-SE', {timeZone:'Europe/Moscow', year:'numeric', month:'2-digit', day:'2-digit'});
const moscowDate = off => dateFmt.format(new Date(Date.now() + off*864e5));

// ---------- фиксированный шаг ----------
const STEP_MS = 1000/60;
const STEP_S  = 1/60;

// ---------- DOM ----------
const canvas=$('gc'), ctx=canvas.getContext('2d');
const el={
  welcome:$('welcome'), game:$('game'),
  score:$('score-val'), daily:$('daily-val'), best:$('best-val'), livesV:$('lives-val'),
  streakN:$('streak-n'), multN:$('mult-n'), missionsN:$('missions-n'), speedN:$('speed-n'),
  wDaily:$('w-daily-best'), wBest:$('w-best'), wStreak:$('w-streak'),
  modal:$('modal'), modalCard:$('modal-card'), modalBadge:$('modal-badge'), modalTitle:$('modal-title'), modalScore:$('modal-score'),
  mmodal:$('mmodal'), mlist:$('mmodal-list'), toasts:$('toasts'), dailyDate:$('daily-date'),
  decoRow:$('deco-row')
};

// ---------- звук ----------
let AC=null;
let muted=lsGet('race.muted', false);
function audio(){ if(!AC){ try{ AC=new (window.AudioContext||window.webkitAudioContext)(); }catch(e){} } if(AC&&AC.state==='suspended') AC.resume(); return AC; }
function tone(f0, f1, dur, type, vol, when){
  if(muted) return; const ac=audio(); if(!ac) return;
  const t=ac.currentTime+(when||0);
  const o=ac.createOscillator(), g=ac.createGain();
  o.type=type||'sine'; o.frequency.setValueAtTime(f0, t);
  if(f1&&f1!==f0) o.frequency.exponentialRampToValueAtTime(Math.max(f1,1), t+dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol||0.1, t+0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t+dur);
  o.connect(g).connect(ac.destination); o.start(t); o.stop(t+dur+0.02);
}
const snd={
  crash(){ tone(160, 50, 0.35, 'sawtooth', 0.09); tone(70, 40, 0.4, 'square', 0.06); },
  star(){ tone(980, 980, 0.08, 'sine', 0.05); tone(1470, 1470, 0.1, 'sine', 0.045, 0.05); },
  mission(){ tone(880, 880, 0.1, 'sine', 0.1); tone(1174, 1174, 0.16, 'sine', 0.1, 0.1); },
  record(){ [523,659,784,1047].forEach((f,i)=>tone(f, f, 0.14, 'triangle', 0.1, i*0.11)); },
  over(){ [392,330,262].forEach((f,i)=>tone(f, f, 0.2, 'triangle', 0.09, i*0.16)); },
  click(){ tone(440, 440, 0.04, 'sine', 0.05); }
};
// непрерывный гул двигателя
let engOsc=null, engGain=null;
function engineStart(){
  if(muted || engOsc) return;
  const ac=audio(); if(!ac) return;
  engOsc=ac.createOscillator(); engGain=ac.createGain();
  engOsc.type='sawtooth'; engOsc.frequency.value=55;
  engGain.gain.value=0.015;
  const f=ac.createBiquadFilter(); f.type='lowpass'; f.frequency.value=240;
  engOsc.connect(f); f.connect(engGain); engGain.connect(ac.destination);
  engOsc.start();
}
function engineStop(){ if(engOsc){ try{engOsc.stop();}catch(e){} engOsc=null; engGain=null; } }

// ---------- стрик и множитель ----------
const getMult = s => 1 + Math.min(Math.max(s-1,0),10)*0.05;
const today=moscowDate(0), yesterday=moscowDate(-1);
let streak = lsGet('race.streak', 0), lastDay = lsGet('race.lastDay', '');
function effStreak(){ return (lastDay===today || lastDay===yesterday) ? streak : 0; }
function refreshMult(){ mult = effStreak()>0 ? getMult(streak) : 1; }
function markDay(){
  if(lastDay===today){ mult=getMult(streak); return; }
  streak = (lastDay===yesterday) ? (streak||0)+1 : 1;
  lastDay = today;
  lsSet('race.streak', streak); lsSet('race.lastDay', lastDay);
  mult = getMult(streak);
  if(streak>1) toast(`🔥 Стрик <b>${streak}</b> · очки ×<b>${mult.toFixed(2)}</b>`);
}
let mult=1; refreshMult();

// ---------- тосты ----------
function toast(html){
  const d=document.createElement('div'); d.className='toast'; d.innerHTML=html;
  el.toasts.appendChild(d);
  requestAnimationFrame(()=>d.classList.add('show'));
  setTimeout(()=>{ d.classList.remove('show'); setTimeout(()=>d.remove(), 300); }, 2600);
}

// ---------- миссии дня ----------
const MISSIONS=[
  {id:'score500',  t:()=>'Набери 500 очков за один забег',      n:500},
  {id:'score1000', t:()=>'Набери 1000 очков за один забег',     n:1000},
  {id:'stars3',    t:()=>'Собери 3 звезды за один забег',       n:3},
  {id:'stars10',   t:()=>'Собери 10 звёзд (суммарно за день)',  n:10, cum:true},
  {id:'dodge25',   t:()=>'Уклонись от 25 машин (за день)',      n:25, cum:true},
  {id:'survive45', t:()=>'Продержись 45 секунд без аварий',     n:45},
  {id:'insane',    t:()=>'Разгонись до скорости INSANE',        n:1},
  {id:'clean',     t:()=>'Набери 300 очков без единой аварии',  n:1}
];
let missions=[], mState=lsGet('race.missions.'+today, {});
function pickMissions(){
  const seed = xmur3('race-missions-'+today)();
  const rng = mulberry32(seed);
  const pool = MISSIONS.slice(); missions=[];
  for(let k=0;k<3;k++){
    const i = Math.floor(rng()*pool.length) % pool.length;
    missions.push(pool.splice(i,1)[0]);
  }
}
let mDirty=false, missionsDoneCount=0;
function flushMissions(){ if(!mDirty) return; mDirty=false; lsSet('race.missions.'+today, mState); }
function missionProgress(id, val){
  const def = missions.find(m=>m.id===id); if(!def) return;
  const st = mState[id] || {p:0, done:false};
  if(st.done) return;
  const before=st.p;
  st.p = def.cum ? st.p + val : Math.max(st.p, val);
  if(st.p!==before) mDirty=true;
  mState[id]=st;
  if(st.p >= def.n){
    st.done = true; st.p = def.n; mDirty=true; missionsDoneCount++;
    const reward = Math.round(25*mult);
    score += reward;
    toast(`🎯 Миссия: <b>${def.t()}</b> · +<b>${reward}</b>`);
    snd.mission();
  }
  renderMissionsChip();
}
function renderMissionsChip(){
  const done = missions.filter(m=>(mState[m.id]||{}).done).length;
  el.missionsN.textContent = done+'/3';
}
function renderMissionsModal(){
  el.mlist.innerHTML = missions.map(m=>{
    const st = mState[m.id] || {p:0, done:false};
    const pct = Math.min(100, Math.round(st.p/m.n*100));
    return `<div class="mission-item ${st.done?'done':''}">
      <div class="mission-top"><span>${m.t()}</span><span class="m-state">${st.done?'✓':Math.min(st.p,m.n)+'/'+m.n}</span></div>
      <div class="mission-bar"><i style="width:${pct}%"></i></div>
    </div>`;
  }).join('');
}

// ---------- трасса ----------
const ROAD_F = 0.78, LANES = 4;
let cw=0, ch=0, dpr=1;
let roadL=0, roadW=0, laneW=0, carW=0, carH=0;
function calcLayout(){ roadL=(cw-cw*ROAD_F)/2; roadW=cw*ROAD_F; laneW=roadW/LANES; carW=laneW*0.62; carH=carW*1.7; }

const CAR_COLORS=['#C96A6A','#8B9D83','#7A6A8F','#A8763E','#5F7E8A','#B0563F','#4F6B5C'];

// ---------- состояние ----------
let mode='daily';
let running=false, over=false, paused=false;
let score=0, lives=3, gameTime=0;
let player={x:0,y:0}, touchX=null;
let enemies=[], stars=[], particles=[];
let spawnTimer=0, starTimer=0, roadOffset=0;
let pendingSpawn=null, invuln=0, shake=0, frameId=0;
let crashes=0, starCount=0, dodged=0, insaneHit=false, crashedThisRun=false;
let animId=null, acc=0, lastT=0;
let rng=Math.random;               // в daily — seeded
let dailyBest=lsGet('race.daily.'+today, 0), best=lsGet('race.best', 0);
let recordBeaten=false;

// ---------- canvas ----------
function fitCanvas(){
  const rect=canvas.parentElement.getBoundingClientRect();
  dpr=Math.min(window.devicePixelRatio||1, 2);
  cw=Math.floor(rect.width); ch=Math.floor(rect.height);
  canvas.width=cw*dpr; canvas.height=ch*dpr;
  canvas.style.width=cw+'px'; canvas.style.height=ch+'px';
  ctx.setTransform(dpr,0,0,dpr,0,0);
  calcLayout();
  player.y=ch-carH-10;
}

// ---------- отрисовка машин ----------
function roundRect(c,x,y,w,h,r){ r=Math.min(r,w/2,h/2); c.beginPath(); c.moveTo(x+r,y); c.arcTo(x+w,y,x+w,y+h,r); c.arcTo(x+w,y+h,x,y+h,r); c.arcTo(x,y+h,x,y,r); c.arcTo(x,y,x+w,y,r); c.closePath(); }
function drawCar(x,y,w,h,color,isPlayer){
  const r=w*0.16;
  ctx.save();
  if(isPlayer && invuln>0 && Math.floor(invuln/8)%2===0) ctx.globalAlpha=0.35;
  ctx.fillStyle='rgba(0,0,0,.45)';
  roundRect(ctx,x-w/2+2,y-h/2+3,w,h,r); ctx.fill();
  ctx.fillStyle=color;
  roundRect(ctx,x-w/2,y-h/2,w,h,r); ctx.fill();
  // крыша-стекло
  ctx.fillStyle=isPlayer?'rgba(20,16,11,.55)':'rgba(10,12,16,.55)';
  roundRect(ctx,x-w*0.32,y-h*0.22,w*0.64,h*0.34,3); ctx.fill();
  ctx.fillStyle=isPlayer?'rgba(212,165,116,.25)':'rgba(200,230,255,.14)';
  roundRect(ctx,x-w*0.26,y+h*0.16,w*0.52,h*0.14,2); ctx.fill();
  // колёса
  ctx.fillStyle='#08080C';
  const wx=w/2-1.5;
  for(const side of[-1,1]){
    ctx.fillRect(x+side*wx-2, y-h*0.26, 4, h*0.16);
    ctx.fillRect(x+side*wx-2, y+h*0.10, 4, h*0.16);
  }
  // фары/стопы
  const lr=w*0.07;
  ctx.fillStyle=isPlayer?'#E8B04B':'#E4545F';
  for(const side of[-1,1]){
    ctx.beginPath(); ctx.arc(x+side*w*0.3, y+(isPlayer?-h/2+2:h/2-2), lr, 0, Math.PI*2); ctx.fill();
  }
  ctx.restore();
}
function drawStarShape(cx,cy,spikes,outerR,innerR){
  let rot=-Math.PI/2; const step=Math.PI/spikes;
  ctx.moveTo(cx+Math.cos(rot)*outerR, cy+Math.sin(rot)*outerR);
  for(let i=0;i<spikes;i++){
    ctx.lineTo(cx+Math.cos(rot)*outerR, cy+Math.sin(rot)*outerR); rot+=step;
    ctx.lineTo(cx+Math.cos(rot)*innerR, cy+Math.sin(rot)*innerR); rot+=step;
  }
  ctx.closePath();
}

// ---------- забег ----------
function resetRun(){
  fitCanvas();
  player.x=cw/2;
  enemies=[]; stars=[]; particles=[];
  score=0; lives=3; gameTime=0;
  spawnTimer=0; starTimer=30; roadOffset=0;
  pendingSpawn=null; invuln=0; shake=0; frameId=0;
  crashes=0; starCount=0; dodged=0; insaneHit=false; crashedThisRun=false;
  recordBeaten=false; touchX=null;
  rng = (mode==='daily') ? mulberry32(xmur3('race-daily-'+today)()) : Math.random;
  updateHUD();
}

function baseSpeed(){ return Math.min(2.5 + gameTime*0.28, 9.2); }
function speedLabel(){ const s=baseSpeed(); return s<4?'NORMAL':s<6?'FAST':s<8.6?'VERY FAST':'INSANE!'; }

function spawnEnemy(){
  enemies.push({
    x: roadL+carW/2+rng()*(roadW-carW), y: -carH,
    w: carW, h: carH,
    speed: 1.4+rng()*0.7 + gameTime*0.01,
    color: CAR_COLORS[(rng()*CAR_COLORS.length)|0],
  });
}

function update(dtSteps){
  for(let step=0; step<dtSteps; step++){
    frameId++;
    gameTime += STEP_S;
    if(frameId%3===0) score++;
    if(score>0 && score%50===0){ /* noop: score добавляется без мультипликатора в рантайме, начисление ×mult в конце */ }
    roadOffset=(roadOffset + 2.5 + gameTime*6)%80;

    // рекорд-тост
    if(!recordBeaten && best>0 && score>best){
      recordBeaten=true;
      toast('🏆 Рекорд побит: <b>'+score+'</b>!');
      snd.record();
    }

    // выхлоп
    if(frameId%5===0) particles.push({x:player.x+(rng()-.5)*carW*.4, y:player.y+carH/2, vx:(rng()-.5)*.3, vy:1.2+rng()*.8, life:16, max:16, r:2+rng()*2, c:'rgba(180,180,190,.35)', grav:0});
    // скоростные линии
    if(baseSpeed()>8.6 && frameId%3===0){
      if(!insaneHit){ insaneHit=true; missionProgress('insane',1); }
      particles.push({x:roadL+rng()*roadW, y:-8, vx:0, vy:9+rng()*4, life:14, max:14, r:1, c:'rgba(212,165,116,.4)', grav:0, line:true});
    }

    if(invuln>0) invuln--;

    // игрок следует за пальцем
    if(touchX!==null){
      const target=clamp(touchX, roadL+carW/2, roadL+roadW-carW/2);
      player.x+=(target-player.x)*0.18;
    }

    // предупреждение → спавн (интервалы в ШАГАХ: 1.0с → 0.38с)
    if(pendingSpawn){
      pendingSpawn.delay--;
      if(pendingSpawn.delay<=0){ spawnEnemy(); pendingSpawn=null; }
    }
    const interval=Math.round(clamp(60-gameTime*0.55, 24, 60));
    spawnTimer++;
    if(spawnTimer>=interval && !pendingSpawn){
      if(rng()<0.75+gameTime*0.002){
        pendingSpawn={ x: roadL+carW/2+rng()*(roadW-carW), delay: Math.round(clamp(38-gameTime*0.35, 16, 38)) };
      }
      spawnTimer=0;
    }

    // звёзды (каждые ~1.5-2.5с)
    starTimer++;
    if(starTimer > 90+rng()*60){
      starTimer=0;
      stars.push({x:roadL+10+rng()*(roadW-20), y:-12, r:10});
    }
    for(let i=stars.length-1;i>=0;i--){
      const s=stars[i];
      s.y+=baseSpeed()*0.7;
      if(s.y>ch+20){ stars.splice(i,1); continue; }
      if(Math.abs(player.x-s.x)<carW/2+s.r && Math.abs(player.y-s.y)<carH/2+s.r){
        score+=15; starCount++;
        sfxStar();
        for(let k=0;k<10;k++){
          const a=rng()*Math.PI*2, v=1+rng()*2;
          particles.push({x:s.x,y:s.y,vx:Math.cos(a)*v,vy:Math.sin(a)*v,life:24,max:24,r:1.5+rng()*1.5,c:'#E8B04B',grav:.05});
        }
        stars.splice(i,1);
      }
    }

    // встречные машины
    const bs=baseSpeed();
    for(let i=enemies.length-1;i>=0;i--){
      const e=enemies[i];
      e.y+=e.speed+bs*0.3;
      if(e.y-e.h/2>ch+50){
        enemies.splice(i,1);
        dodged++;
        continue;
      }
      if(invuln<=0){
        const pw=carW*0.6, ph=carH*0.6;
        if(Math.abs(player.x-e.x)<(pw+e.w)/2 && Math.abs(player.y-e.y)<(ph+e.h)/2){
          lives--; crashes++; crashedThisRun=true; invuln=90; shake=9;
          snd.crash();
          for(let k=0;k<16;k++){
            const a=rng()*Math.PI*2, v=1.5+rng()*3;
            particles.push({x:player.x,y:player.y-carH*.3,vx:Math.cos(a)*v,vy:Math.sin(a)*v-1,life:30,max:30,r:1.5+rng()*2.5,c:['#C96A6A','#E8B04B','#8E8E93'][(rng()*3)|0],grav:.1});
          }
          enemies.splice(i,1);
          if(lives<=0){ gameOver(); return; }
          continue;
        }
      }
    }

    // миссии процесса
    missionProgress('survive45', Math.floor(gameTime));
    if(!crashedThisRun) missionProgress('clean', score>=300?1:0);
    if(score>0) missionProgress('score500', score);
    if(score>0) missionProgress('score1000', score);
    if(starCount>0){ missionProgress('stars3', starCount); }
    if(dodged>0 && frameId%30===0) missionProgress('dodge25', dodged);
    if(starCount>0 && frameId%20===0) missionProgress('stars10', starCount);

    // частицы
    for(let i=particles.length-1;i>=0;i--){
      const p=particles[i];
      p.x+=p.vx; p.y+=p.vy;
      if(p.grav) p.vy+=p.grav;
      if(--p.life<=0) particles.splice(i,1);
    }
    if(shake>0) shake*=0.86;

    // гул двигателя следует за скоростью
    if(engOsc && !muted) engOsc.frequency.value=50+bs*9;
  }
}
function sfxStar(){ snd.star(); }

// ---------- отрисовка ----------
function draw(){
  ctx.clearRect(0,0,cw,ch);
  const sx=shake>0.3?(Math.random()-.5)*shake*2:0;
  const sy=shake>0.3?(Math.random()-.5)*shake*2:0;
  ctx.save();
  ctx.translate(sx,sy);

  // трава
  ctx.fillStyle='#0C1014';
  ctx.fillRect(0,0,cw,ch);
  ctx.fillStyle='rgba(139,157,131,.14)';
  const gy0=(frameId*2.5)%46-46;
  for(let gy=gy0; gy<ch; gy+=46)
    for(let gx=6; gx<roadL; gx+=34){
      ctx.fillRect(gx,gy,2,5);
      ctx.fillRect(roadL+roadW+(gx%27)+8, gy+20, 2, 5);
    }

  // полотно
  ctx.fillStyle='#16161E';
  ctx.fillRect(roadL,0,roadW,ch);
  ctx.fillStyle='rgba(212,165,116,.45)';
  ctx.fillRect(roadL-2,0,3,ch);
  ctx.fillRect(roadL+roadW-1,0,3,ch);
  ctx.fillStyle='rgba(212,165,116,.22)';
  const dashH=30,gapH=30,totalH=dashH+gapH;
  for(let lane=1;lane<LANES;lane++){
    const lx=roadL+lane*laneW-1;
    for(let y=-gapH+roadOffset%totalH; y<ch+dashH; y+=totalH) ctx.fillRect(lx,y,2,dashH);
  }

  // предупреждение о спавне
  if(pendingSpawn){
    const warnW=carW*1.5, warnH=carH*0.4;
    const alpha=0.3+0.5*Math.sin(pendingSpawn.delay*0.25);
    ctx.fillStyle=`rgba(228,84,95,${alpha})`;
    roundRect(ctx,pendingSpawn.x-warnW/2,4,warnW,warnH,5); ctx.fill();
    ctx.fillStyle=`rgba(232,176,75,${alpha*0.6})`;
    roundRect(ctx,pendingSpawn.x-warnW/2+3,7,warnW-6,warnH*0.4,3); ctx.fill();
    ctx.fillStyle=`rgba(228,84,95,${alpha*0.7})`;
    ctx.beginPath();
    ctx.moveTo(pendingSpawn.x,4+warnH+8);
    ctx.lineTo(pendingSpawn.x-6,4+warnH+1);
    ctx.lineTo(pendingSpawn.x+6,4+warnH+1);
    ctx.closePath(); ctx.fill();
  }

  // звёзды
  for(const s of stars){
    const pulse=0.8+0.2*Math.sin(frameId*0.1+s.x);
    ctx.fillStyle='#E8B04B';
    ctx.beginPath(); drawStarShape(s.x,s.y,5,s.r*pulse,s.r*0.45*pulse); ctx.fill();
    ctx.fillStyle='rgba(232,176,75,.3)';
    ctx.beginPath(); ctx.arc(s.x,s.y,s.r*1.3*pulse,0,Math.PI*2); ctx.fill();
  }

  for(const e of enemies) drawCar(e.x,e.y,e.w,e.h,e.color,false);
  drawCar(player.x,player.y,carW,carH,'#D4A574',true);

  for(const p of particles){
    ctx.globalAlpha=Math.max(0,p.life/p.max);
    ctx.fillStyle=p.c;
    if(p.line) ctx.fillRect(p.x,p.y,1.5,14);
    else { ctx.beginPath(); ctx.arc(p.x,p.y,p.r,0,Math.PI*2); ctx.fill(); }
  }
  ctx.globalAlpha=1;
  ctx.restore();
}

// ---------- HUD/модалки ----------
function updateHUD(){
  el.score.textContent=score;
  el.daily.textContent=dailyBest;
  el.best.textContent=best;
  el.livesV.textContent=lives;
  el.speedN.textContent=speedLabel();
}
function showWelcomeRecords(){
  el.wDaily.textContent=dailyBest;
  el.wBest.textContent=best;
  el.wStreak.textContent='🔥 '+effStreak();
}
function gameOver(){
  over=true; running=false;
  engineStop();
  draw();
  const final=Math.round(score*mult);
  markDay();
  const isDailyRec = final>dailyBest;
  if(isDailyRec){ dailyBest=final; lsSet('race.daily.'+today, dailyBest); }
  const isRec = final>best;
  if(isRec){ best=final; lsSet('race.best', best); }
  snd[isRec?'record':'over']();
  el.modalBadge.textContent = isRec?'Новый рекорд':'Забег окончен';
  el.modalBadge.classList.toggle('record', isRec);
  el.modalCard.classList.toggle('modal-record', isRec);
  el.modalTitle.textContent = isRec?'Трасса покорена':'Авария';
  el.modalScore.innerHTML = `Очки: <b>${score}</b>${mult>1?` ×<b>${mult.toFixed(2)}</b> = <b>${final}</b>`:''} · Звёзды: <b>${starCount}</b> · Время: <b>${Math.floor(gameTime)}с</b><br>Рекорд: <b>${best}</b>`;
  el.modal.classList.remove('hidden');
  flushMissions();
  showWelcomeRecords(); updateHUD();
}

// ---------- цикл (fixed timestep) ----------
function loop(now){
  animId=requestAnimationFrame(loop);
  if(!lastT) lastT=now;
  let delta=now-lastT; lastT=now;
  if(paused||!running) { draw(); return; }
  delta=Math.min(delta,100);
  acc+=delta;
  let steps=0;
  while(acc>=STEP_MS && steps<4){ update(1); acc-=STEP_MS; steps++; }
  if(steps===4) acc=0;
  flushMissions();
  updateHUD();
  draw();
}

// ---------- ввод ----------
function onPointer(clientX){
  const rect=canvas.getBoundingClientRect();
  touchX=clientX-rect.left;
}
canvas.addEventListener('touchstart',e=>{ e.preventDefault(); onPointer(e.touches[0].clientX); },{passive:false});
canvas.addEventListener('touchmove', e=>{ e.preventDefault(); onPointer(e.touches[0].clientX); },{passive:false});
canvas.addEventListener('touchend',  ()=>{ touchX=null; });
canvas.addEventListener('touchcancel',()=>{ touchX=null; });
canvas.addEventListener('mousedown', e=>onPointer(e.clientX));
canvas.addEventListener('mousemove', e=>{ if(e.buttons&1) onPointer(e.clientX); });
canvas.addEventListener('mouseup',   ()=>{ touchX=null; });
canvas.addEventListener('mouseleave',()=>{ touchX=null; });

// ---------- экраны ----------
function startGame(){
  el.welcome.classList.add('hidden');
  el.modal.classList.add('hidden');
  el.game.classList.remove('hidden');
  resetRun();
  running=true; over=false; paused=false;
  lastT=0; acc=0;
  engineStart();
  if(!animId) animId=requestAnimationFrame(loop);
}
function toMenu(){
  running=false; over=false;
  engineStop();
  el.game.classList.add('hidden');
  el.modal.classList.add('hidden');
  el.welcome.classList.remove('hidden');
  showWelcomeRecords();
}

// кнопки
$('btn-play').addEventListener('click', ()=>{ snd.click(); startGame(); });
$('btn-new').addEventListener('click', ()=>{ snd.click(); startGame(); });
$('btn-menu').addEventListener('click', ()=>{ snd.click(); toMenu(); });
$('modal-btn').addEventListener('click', ()=>{ snd.click(); startGame(); });
$('btn-missions').addEventListener('click', openMissions);
$('missions-chip').addEventListener('click', openMissions);
$('mmodal-btn').addEventListener('click', ()=>{ snd.click(); el.mmodal.classList.add('hidden'); });
function openMissions(){ snd.click(); renderMissionsModal(); el.mmodal.classList.remove('hidden'); }

// звук
function updateSoundBtn(){ $('btn-sound').textContent = muted?'🔇':'🔊'; }
$('btn-sound').addEventListener('click', ()=>{
  muted=!muted; lsSet('race.muted', muted);
  updateSoundBtn();
  if(muted) engineStop(); else { engineStart(); snd.click(); }
});
updateSoundBtn();

// режим
function setMode(m){
  mode=m;
  $('mode-daily').classList.toggle('active', m==='daily');
  $('mode-free').classList.toggle('active', m==='free');
}
$('mode-daily').addEventListener('click', ()=>{ snd.click(); setMode('daily'); });
$('mode-free').addEventListener('click',  ()=>{ snd.click(); setMode('free'); });

// пауза при скрытии вкладки
document.addEventListener('visibilitychange', ()=>{
  if(document.hidden){ paused=true; engineStop(); }
  else { paused=false; lastT=0; if(running&&!muted) engineStart(); }
});

// ресайз
function onResize(){
  if(el.game.classList.contains('hidden')) return;
  const oldW=cw;
  fitCanvas();
  player.x=clamp(player.x*(cw/oldW), roadL+carW/2, roadL+roadW-carW/2);
}
window.addEventListener('resize', onResize);
if(window.visualViewport) window.visualViewport.addEventListener('resize', onResize);

// ---------- init ----------
(function init(){
  // декоративный ряд
  for(let i=0;i<7;i++) el.decoRow.appendChild(document.createElement('i'));
  el.dailyDate.textContent='Вызов дня · '+today;
  pickMissions();
  renderMissionsChip();
  showWelcomeRecords();
  updateHUD();
  fitCanvas();
  animId=requestAnimationFrame(loop);
})();

// ---------- debug hooks ----------
window.__rc={
  get state(){ return running&&!over ? 'play' : (over?'over':'ui'); },
  get score(){ return score; },
  get lives(){ return lives; },
  get best(){ return best; },
  get dailyBest(){ return dailyBest; },
  get enemies(){ return enemies.length; },
  get stars(){ return stars.length; },
  get mode(){ return mode; },
  get missionsDone(){ return missions.filter(m=>(mState[m.id]||{}).done).length; },
  flush(){ flushMissions(); },
  crash(){ if(!enemies.length) spawnEnemy(); enemies[0].x=player.x; enemies[0].y=player.y; lives=1; invuln=0; },
  setScore(v){ score=v; },
  start(){ startGame(); },
};
