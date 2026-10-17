'use strict';
/* Разлом — Ballz-брейкер в стиле AXIIOM. canvas + vanilla JS, без зависимостей.
   Мета: вызов дня (seed от даты МСК), стрик-множитель, ежедневные миссии, рекорды в localStorage. */

// ---------- утилиты ----------
const $ = id => document.getElementById(id);
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
function xmur3(str){let h=1779033703^str.length;for(let i=0;i<str.length;i++){h=Math.imul(h^str.charCodeAt(i),3432918353);h=h<<13|h>>>19;}return function(){h=Math.imul(h^h>>>16,2246822507);h=Math.imul(h^h>>>13,3266489909);return (h^=h>>>16)>>>0;};}
function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return ((t^t>>>14)>>>0)/4294967296;};}
function lsGet(k, d){ try{ const v = localStorage.getItem(k); return v===null? d : JSON.parse(v); }catch(e){ return d; } }
function lsSet(k, v){ try{ localStorage.setItem(k, JSON.stringify(v)); }catch(e){} }

// ---------- даты (Europe/Moscow, формат YYYY-MM-DD) ----------
const dateFmt = new Intl.DateTimeFormat('sv-SE', {timeZone:'Europe/Moscow', year:'numeric', month:'2-digit', day:'2-digit'});
const moscowDate = off => dateFmt.format(new Date(Date.now() + off*864e5));

// ---------- константы поля ----------
const W=400, H=580;
const COLS=7, CELL_W=50, GRID_X=(W-COLS*CELL_W)/2;      // 25
const BLOCK_W=46, BLOCK_H=24, CELL_H=30, ROW0_Y=56;
const BOTTOM_Y=H-52;                                     // линия поражения: 528
const ORIGIN_Y=H-24;                                     // точка запуска шаров
const BALL_R=5.5, SPEED=7.4, SUB=3;
const STEP_MS=16.6, LAUNCH_GAP=42, MAX_BALLS=60, VOLLEY_TIMEOUT=90000;
const START_BALLS=3;

// цвета блоков по прочности (тёплая рампа AXIIOM)
function hpColor(hp){
  if(hp<=4)  return '#6B5D48';
  if(hp<=8)  return '#8A7350';
  if(hp<=13) return '#B08D57';
  if(hp<=20) return '#D4A574';
  if(hp<=30) return '#E8B04B';
  return '#E4545F';
}
function hpTextColor(hp){ return hp>13 ? '#14100B' : '#EDEDF0'; }

// ---------- состояние ----------
let mode='daily';              // 'daily' | 'free'
let running=false, over=false;
let score=0, shots=0, arsenal=START_BALLS, topRow=0, mult=1;
let blocks=[], balls=[], particles=[], popups=[], beams=[];
let shakeT=0, muted=lsGet('brk.muted', false);
const volley={active:false, total:0, launched:0, finished:0, startAt:0, dirx:0, diry:-1, originX:W/2, lastX:W/2, hits:0, destroyed:0, raw:0};
const aim={active:false, dx:0, dy:-1};
let dailyRng=Math.random;
let rowFill=0.55, rowHpBase=1;

// LS-ключи
const today=moscowDate(0), yesterday=moscowDate(-1);
const K_BEST='brk.best', K_DAILY='brk.daily.'+today, K_STREAK='brk.streak', K_LASTDAY='brk.lastDay', K_MUTE='brk.muted', K_MISS='brk.missions.'+today;

// ---------- DOM ----------
const canvas=$('gc'), ctx=canvas.getContext('2d');
const el={
  score:$('score-val'), daily:$('daily-val'), best:$('best-val'), ballsV:$('balls-val'),
  streakN:$('streak-n'), multN:$('mult-n'), missionsN:$('missions-n'),
  danger:$('danger-fill'), welcome:$('welcome'), game:$('game'),
  wDaily:$('w-daily-best'), wBest:$('w-best'), wStreak:$('w-streak'),
  modal:$('modal'), modalCard:$('modal-card'), modalBadge:$('modal-badge'), modalTitle:$('modal-title'), modalScore:$('modal-score'),
  mmodal:$('mmodal'), mlist:$('mmodal-list'),
  toasts:$('toasts'), dailyDate:$('daily-date')
};

// ---------- звук (WebAudio, unlock по первому жесту) ----------
let AC=null;
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
  hit(){ const n=performance.now(); if(n-lastHitSnd<35) return; lastHitSnd=n; tone(520+Math.random()*60, 480, 0.05, 'triangle', 0.05); },
  destroy(){ tone(660, 660, 0.07, 'triangle', 0.09); tone(880, 880, 0.09, 'sine', 0.07, 0.05); },
  plus(){ tone(523, 523, 0.09, 'sine', 0.1); tone(784, 784, 0.12, 'sine', 0.1, 0.08); },
  multi(){ tone(660, 660, 0.07, 'sine', 0.09); tone(880, 880, 0.07, 'sine', 0.09, 0.07); tone(1174, 1174, 0.1, 'sine', 0.09, 0.14); },
  laser(){ tone(1400, 180, 0.14, 'sawtooth', 0.08); },
  launch(){ tone(240, 420, 0.08, 'sine', 0.05); },
  mission(){ tone(880, 880, 0.1, 'sine', 0.1); tone(1174, 1174, 0.16, 'sine', 0.1, 0.1); },
  record(){ [523,659,784].forEach((f,i)=>tone(f, f, 0.14, 'triangle', 0.1, i*0.11)); },
  over(){ [392,330,262].forEach((f,i)=>tone(f, f, 0.2, 'triangle', 0.09, i*0.16)); },
  click(){ tone(440, 440, 0.04, 'sine', 0.05); }
};
let lastHitSnd=0;

// ---------- стрик и множитель ----------
const getMult = s => 1 + Math.min(Math.max(s-1,0),10)*0.05;
let streak = lsGet(K_STREAK, 0), lastDay = lsGet(K_LASTDAY, '');
function effStreak(){ return (lastDay===today || lastDay===yesterday) ? streak : 0; }
function refreshMult(){
  mult = (lastDay===today || lastDay===yesterday) ? getMult(streak) : 1;
}
function markDay(){
  if(lastDay===today){ mult=getMult(streak); return; }
  streak = (lastDay===yesterday) ? (streak||0)+1 : 1;
  lastDay = today;
  lsSet(K_STREAK, streak); lsSet(K_LASTDAY, lastDay);
  mult = getMult(streak);
  updateChips();
  if(streak>1) toast(`🔥 Стрик <b>${streak}</b> · очки ×<b>${mult.toFixed(2)}</b>`);
}
refreshMult();

// ---------- тосты ----------
function toast(html){
  const d=document.createElement('div'); d.className='toast'; d.innerHTML=html;
  el.toasts.appendChild(d);
  requestAnimationFrame(()=>d.classList.add('show'));
  setTimeout(()=>{ d.classList.remove('show'); setTimeout(()=>d.remove(), 300); }, 2600);
}

// ---------- миссии дня ----------
const MISSIONS=[
  {id:'hits20',   t:()=>'Сделай 20 попаданий за один бросок', n:20},
  {id:'destroy5', t:()=>'Разбей 5 блоков одним броском',     n:5},
  {id:'plus2',    t:()=>'Собери 2 бонуса «+шар»',            n:2, cum:true},
  {id:'row10',    t:()=>'Дойди до 10-го ряда',               n:10},
  {id:'laser2',   t:()=>'Собери 2 лазера',                   n:2, cum:true},
  {id:'multi1',   t:()=>'Собери мультиишар ×2',              n:1, cum:true},
  {id:'raw25',    t:()=>'Набери 25 попаданий-очков за бросок', n:25},
  {id:'arsenal15',t:()=>'Собери арсенал из 15 шаров',        n:15}
];
let missions=[], mState=lsGet(K_MISS, {});
function pickMissions(){
  const seed = xmur3('breaker-missions-'+today)();
  const rng = mulberry32(seed);
  const pool = MISSIONS.slice(); missions=[];
  for(let k=0;k<3;k++){
    const i = Math.floor(rng()*pool.length) % pool.length;
    missions.push(pool.splice(i,1)[0]);
  }
}
function missionProgress(id, val){
  const def = missions.find(m=>m.id===id); if(!def) return;
  const st = mState[id] || {p:0, done:false};
  if(st.done) return;
  st.p = def.cum ? st.p + val : Math.max(st.p, val);
  if(st.p >= def.n){
    st.done = true; st.p = def.n;
    const reward = Math.round(25*mult);
    score += reward;
    toast(`🎯 Миссия: <b>${def.t()}</b> · +<b>${reward}</b>`);
    snd.mission();
  }
  mState[id]=st; lsSet(K_MISS, mState);
  updateChips(); renderMissions();
}
function missionsDone(){ return missions.filter(m=>(mState[m.id]||{}).done).length; }
function renderMissions(){
  if(!el.mlist) return;
  el.mlist.innerHTML = missions.map(m=>{
    const st = mState[m.id]||{p:0,done:false};
    const pct = clamp(Math.round(st.p/m.n*100), 0, 100);
    return `<div class="mission-item${st.done?' done':''}">
      <div class="mission-top"><span>${st.done?'✓ ':''}${m.t()}</span><span class="m-state">${Math.min(st.p,m.n)}/${m.n}</span></div>
      <div class="mission-bar"><i style="width:${pct}%"></i></div>
    </div>`;
  }).join('');
}

// ---------- генерация рядов (детерминизм вызова дня) ----------
function rowParams(n){ rowFill = Math.min(0.55 + n*0.005, 0.75); rowHpBase = 1 + Math.floor(n/4); }
// фиксированное число обращений к rng на ряд — 17 — независимо от исходов
function genRow(n){
  rowParams(n);
  const R = (mode==='daily') ? dailyRng : Math.random;
  const fills=[], hps=[];
  for(let c=0;c<COLS;c++){ fills.push(R()<rowFill); hps.push(rowHpBase + (R()<0.35?1:0)); }
  const rb=R(), rtype=R(), rcol=R();
  const hasBonus = rb<0.38;
  const bType = hasBonus ? (rtype<0.5?'plus':(rtype<0.78?'laser':'multi')) : null;
  const bCol = Math.floor(rcol*COLS)%COLS;
  const out=[], y=ROW0_Y;
  for(let c=0;c<COLS;c++){
    const cx = GRID_X + c*CELL_W + CELL_W/2;
    if(hasBonus && c===bCol){
      out.push({type:bType, x:cx-BLOCK_W/2, y, w:BLOCK_W, h:BLOCK_H, cx, cy:y+BLOCK_H/2, r:13, born:performance.now()});
      continue;
    }
    if(!fills[c]) continue;
    out.push({type:'block', x:cx-BLOCK_W/2, y, w:BLOCK_W, h:BLOCK_H, hp:hps[c], maxHp:hps[c], flash:0, cd:0, born:performance.now()});
  }
  return out;
}
function spawnRow(n, y){
  const row = genRow(n);
  if(y!==ROW0_Y) row.forEach(b=>{ b.y+= (y-ROW0_Y); if(b.cy!==undefined) b.cy+=(y-ROW0_Y); });
  blocks.push(...row);
  const rowsSpawned = n+1;
  missionProgress('row10', rowsSpawned);
}

// ---------- спуск рядов / поражение ----------
function shiftRows(){
  for(const b of blocks){ b.y += CELL_H; if(b.cy!==undefined) b.cy += CELL_H; }
  spawnRow(topRow, ROW0_Y); topRow++;
  for(const b of blocks){
    if(b.type==='block' && b.y + b.h >= BOTTOM_Y){ endRun(); return; }
  }
}

// ---------- залп ----------
function launch(dx, dy){
  if(volley.active || over || !running) return;
  const len=Math.hypot(dx,dy)||1; dx/=len; dy/=len;
  volley.active=true; volley.total=Math.min(arsenal, MAX_BALLS);
  volley.launched=0; volley.finished=0; volley.hits=0; volley.destroyed=0; volley.raw=0;
  volley.startAt=performance.now(); volley.dirx=dx; volley.diry=dy;
  volley.originX=clamp(volley.originX, BALL_R+4, W-BALL_R-4);
  shots++; markDay(); snd.launch(); updateStats();
}
function stepVolley(now){
  if(!volley.active) return;
  while(volley.launched < volley.total && now - volley.startAt >= volley.launched*LAUNCH_GAP){
    balls.push({x:volley.originX, y:ORIGIN_Y, vx:volley.dirx*SPEED, vy:volley.diry*SPEED});
    volley.launched++;
  }
  if(now - volley.startAt > VOLLEY_TIMEOUT && balls.length===0){ endVolley(); }
}
function endVolley(){
  volley.active=false;
  volley.originX = clamp(volley.lastX, BALL_R+4, W-BALL_R-4);
  balls.length=0;
  if(!over){
    missionProgress('raw25', volley.raw);
    shiftRows();
  }
  updateStats();
}

// ---------- урон и блоки ----------
function damage(b, n){
  if(b.type!=='block' || b.hp<=0) return;
  b.hp-=n; b.flash=1;
  volley.hits+=n; volley.raw+=n;
  score += n*mult;
  snd.hit();
  missionProgress('hits20', volley.hits);
  if(b.hp<=0){
    score += 5*mult;
    volley.destroyed++;
    burst(b.x+b.w/2, b.y+b.h/2, hpColor(b.maxHp));
    popup(b.x+b.w/2, b.y, '+'+Math.round(5*mult), '#E8B04B');
    snd.destroy();
    missionProgress('destroy5', volley.destroyed);
  }
  updateStats();
}
function collectBonus(b){
  const i=blocks.indexOf(b); if(i<0) return;
  blocks.splice(i,1);
  if(b.type==='plus'){
    arsenal=Math.min(arsenal+1, 99);
    if(volley.active) volley.total=Math.min(volley.total+1, MAX_BALLS);
    popup(b.cx, b.cy, '+1 шар', '#D4A574'); snd.plus();
    missionProgress('plus2', 1); missionProgress('arsenal15', arsenal);
  } else if(b.type==='multi'){
    if(volley.active) volley.total=Math.min(volley.total*2, MAX_BALLS);
    popup(b.cx, b.cy, '×2', '#E8B04B'); snd.multi();
    missionProgress('multi1', 1);
  } else if(b.type==='laser'){
    fireLaser(b.cx); popup(b.cx, b.cy, 'Лазер', '#E4545F'); snd.laser();
    missionProgress('laser2', 1);
  }
  updateStats();
}
function fireLaser(cx){
  beams.push({x:cx, born:performance.now()});
  shakeT=4;
  for(const b of blocks.slice()){
    if(b.type==='block' && b.hp>0 && Math.abs((b.x+b.w/2)-cx)<2){
      damage(b, 3);
    }
  }
  blocks=blocks.filter(b=>b.type!=='block'||b.hp>0);
}

// ---------- частицы и попапы ----------
function burst(x, y, color){
  for(let i=0;i<9;i++){
    const a=Math.random()*Math.PI*2, sp=1+Math.random()*2.4;
    particles.push({x, y, vx:Math.cos(a)*sp, vy:Math.sin(a)*sp-0.6, life:1, color, size:2+Math.random()*2.5, rot:Math.random()*Math.PI, vr:(Math.random()-0.5)*0.3});
  }
}
function popup(x, y, txt, color){ popups.push({x, y, txt, color, born:performance.now()}); }

// ---------- физика шага ----------
function collideBlock(b, bl){
  const cx=clamp(b.x, bl.x, bl.x+bl.w), cy=clamp(b.y, bl.y, bl.y+bl.h);
  const dx=b.x-cx, dy=b.y-cy, d2=dx*dx+dy*dy;
  if(d2 > BALL_R*BALL_R) return;
  if(d2===0){ b.y=bl.y-BALL_R-0.1; b.vy=-Math.abs(b.vy); damage(bl,1); return; }
  const bcx=bl.x+bl.w/2, bcy=bl.y+bl.h/2;
  const penX=(bl.w/2+BALL_R)-Math.abs(b.x-bcx);
  const penY=(bl.h/2+BALL_R)-Math.abs(b.y-bcy);
  if(penX<penY){
    const s=dx>=0?1:-1;
    b.vx=Math.abs(b.vx)*s; b.x=cx+s*(BALL_R+0.05);
  } else {
    const s=dy>=0?1:-1;
    b.vy=Math.abs(b.vy)*s; b.y=cy+s*(BALL_R+0.05);
  }
  damage(bl,1);
}
function physicsStep(now){
  stepVolley(now);
  if(!volley.active) return;
  for(let s=0;s<SUB;s++){
    for(let i=balls.length-1;i>=0;i--){
      const b=balls[i];
      b.x+=b.vx/SUB; b.y+=b.vy/SUB;
      if(b.x<BALL_R){ b.x=BALL_R; b.vx=Math.abs(b.vx); }
      else if(b.x>W-BALL_R){ b.x=W-BALL_R; b.vx=-Math.abs(b.vx); }
      if(b.y<BALL_R){ b.y=BALL_R; b.vy=Math.abs(b.vy); }
      for(const bl of blocks){
        if(bl.type==='block'){ if(bl.hp>0) collideBlock(b, bl); }
        else {
          const ddx=b.x-bl.cx, ddy=b.y-bl.cy, rr=BALL_R+bl.r;
          if(ddx*ddx+ddy*ddy < rr*rr) collectBonus(bl);
        }
      }
      if(b.y-BALL_R>H){ volley.finished++; volley.lastX=b.x; balls.splice(i,1); }
    }
  }
  if(blocks.some(b=>b.type==='block'&&b.hp<=0)) blocks=blocks.filter(b=>b.type!=='block'||b.hp>0);
  if(volley.launched>=volley.total && balls.length===0) endVolley();
}

// ---------- ввод ----------
function ptrPos(e){ const r=canvas.getBoundingClientRect(); return {x:(e.clientX-r.left)/r.width*W, y:(e.clientY-r.top)/r.height*H}; }
function aimUpdate(p){
  let dx=p.x-volley.originX, dy=p.y-ORIGIN_Y;
  const len=Math.hypot(dx,dy);
  if(len<6){ aim.dx=0; aim.dy=-1; return; }
  dx/=len; dy/=len;
  const minUp=0.18;
  if(dy>-minUp){ dy=-minUp; const s=dx>=0?1:-1; dx=s*Math.sqrt(Math.max(1-dy*dy,0)); }
  aim.dx=dx; aim.dy=dy;
}
function aimBy(dA){
  let a=Math.atan2(aim.dx, -aim.dy)+dA;
  a=clamp(a, -1.35, 1.35);
  aim.dx=Math.sin(a); aim.dy=-Math.cos(a);
}
let pointerDown=false;
canvas.addEventListener('pointerdown', e=>{
  audio();
  if(over||!running||volley.active) return;
  pointerDown=true; aim.active=true;
  try{ canvas.setPointerCapture(e.pointerId); }catch(err){}
  aimUpdate(ptrPos(e)); e.preventDefault();
});
canvas.addEventListener('pointermove', e=>{ if(pointerDown) aimUpdate(ptrPos(e)); });
function pointerEnd(){
  if(!pointerDown) return;
  pointerDown=false; aim.active=false;
  if(!volley.active && running && !over) launch(aim.dx, aim.dy);
}
canvas.addEventListener('pointerup', pointerEnd);
canvas.addEventListener('pointercancel', ()=>{ pointerDown=false; aim.active=false; });
canvas.addEventListener('contextmenu', e=>e.preventDefault());
window.addEventListener('keydown', e=>{
  if(!running || over) return;
  if(e.code==='ArrowLeft'){ aimBy(-0.06); e.preventDefault(); }
  else if(e.code==='ArrowRight'){ aimBy(0.06); e.preventDefault(); }
  else if(e.code==='Space'||e.code==='Enter'){ audio(); if(!volley.active) launch(aim.dx, aim.dy); e.preventDefault(); }
});

// ---------- рендер ----------
function roundRect(x,y,w,h,r){
  ctx.beginPath();
  ctx.moveTo(x+r,y); ctx.lineTo(x+w-r,y); ctx.arcTo(x+w,y,x+w,y+r,r);
  ctx.lineTo(x+w,y+h-r); ctx.arcTo(x+w,y+h,x+w-r,y+h,r);
  ctx.lineTo(x+r,y+h); ctx.arcTo(x,y+h,x,y+h-r,r);
  ctx.lineTo(x,y+r); ctx.arcTo(x,y,x+r,y,r); ctx.closePath();
}
function drawBlock(b){
  roundRect(b.x, b.y, b.w, b.h, 6);
  ctx.fillStyle=hpColor(b.hp); ctx.fill();
  ctx.strokeStyle='rgba(0,0,0,.28)'; ctx.lineWidth=1; ctx.stroke();
  ctx.fillStyle='rgba(255,255,255,.09)';
  roundRect(b.x+2, b.y+2, b.w-4, 5, 3); ctx.fill();
  if(b.flash>0){
    ctx.fillStyle=`rgba(255,255,255,${(b.flash*0.55).toFixed(3)})`;
    roundRect(b.x, b.y, b.w, b.h, 6); ctx.fill();
    b.flash*=0.82; if(b.flash<0.05) b.flash=0;
  }
  ctx.fillStyle=hpTextColor(b.hp);
  ctx.font='700 11px Inter, system-ui, sans-serif';
  ctx.textAlign='center'; ctx.textBaseline='middle';
  ctx.fillText(b.hp, b.x+b.w/2, b.y+b.h/2+0.5);
  ctx.textBaseline='alphabetic';
}
function drawBonus(b, now){
  const pulse=1+Math.sin(now/240+b.born)*0.06;
  ctx.save(); ctx.translate(b.cx, b.cy); ctx.scale(pulse, pulse);
  if(b.type==='plus'){
    ctx.strokeStyle='#D4A574'; ctx.lineWidth=2;
    ctx.beginPath(); ctx.arc(0,0,12,0,6.3); ctx.stroke();
    ctx.fillStyle='#D4A574';
    ctx.fillRect(-1.5,-6,3,12); ctx.fillRect(-6,-1.5,12,3);
  } else if(b.type==='multi'){
    ctx.fillStyle='#E8B04B';
    ctx.beginPath(); ctx.arc(0,0,12,0,6.3); ctx.fill();
    ctx.fillStyle='#14100B'; ctx.font='800 10px Inter, system-ui, sans-serif';
    ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillText('×2',0,0.5); ctx.textBaseline='alphabetic';
  } else {
    ctx.strokeStyle='#E4545F'; ctx.lineWidth=2;
    ctx.beginPath(); ctx.arc(0,0,12,0,6.3); ctx.stroke();
    ctx.fillStyle='#E4545F';
    ctx.beginPath();
    ctx.moveTo(1.5,-8); ctx.lineTo(-4.5,1); ctx.lineTo(-0.5,1);
    ctx.lineTo(-1.5,8); ctx.lineTo(4.5,-1); ctx.lineTo(0.5,-1);
    ctx.closePath(); ctx.fill();
  }
  ctx.restore();
}
function drawCluster(ox, oy, n){
  ctx.fillStyle='#E8C08A';
  for(let i=0;i<n;i++){
    const dx=(i%9-4)*3.4, dy=-Math.floor(i/9)*3.6;
    ctx.beginPath(); ctx.arc(ox+dx, oy+dy, BALL_R*0.9, 0, 6.3); ctx.fill();
  }
}
function trajPoints(){
  const pts=[];
  let x=volley.originX, y=ORIGIN_Y, vx=aim.dx*4, vy=aim.dy*4;
  for(let i=0;i<220;i++){
    x+=vx; y+=vy;
    if(x<BALL_R){ x=BALL_R; vx=Math.abs(vx); }
    else if(x>W-BALL_R){ x=W-BALL_R; vx=-Math.abs(vx); }
    if(y<BALL_R){ y=BALL_R; vy=Math.abs(vy); }
    if(i%5===0) pts.push({x,y});
    if(pts.length>=40) break;
  }
  return pts;
}
function maxBlockBottom(){ let m=0; for(const b of blocks){ const bot=b.y+b.h; if(bot>m) m=bot; } return m; }
function draw(now){
  ctx.clearRect(0,0,W,H);
  ctx.save();
  if(shakeT>0){
    shakeT*=0.86; if(shakeT<0.3) shakeT=0;
    ctx.translate((Math.random()-0.5)*shakeT, (Math.random()-0.5)*shakeT);
  }
  // направляющие колонн
  ctx.strokeStyle='rgba(255,255,255,.035)'; ctx.lineWidth=1;
  for(let c=1;c<COLS;c++){
    const gx=GRID_X+c*CELL_W+0.5;
    ctx.beginPath(); ctx.moveTo(gx, ROW0_Y-8); ctx.lineTo(gx, BOTTOM_Y); ctx.stroke();
  }
  // линия поражения
  const prox=clamp(1-(BOTTOM_Y-maxBlockBottom())/240, 0, 1);
  ctx.setLineDash([7,7]);
  ctx.strokeStyle=`rgba(228,84,95,${(0.22+prox*0.5).toFixed(3)})`;
  ctx.lineWidth=1.5;
  ctx.beginPath(); ctx.moveTo(6, BOTTOM_Y+0.5); ctx.lineTo(W-6, BOTTOM_Y+0.5); ctx.stroke();
  ctx.setLineDash([]);
  // блоки и бонусы
  for(const b of blocks){
    if(b.type!=='block') drawBonus(b, now);
    else if(b.hp>0) drawBlock(b);
  }
  // лазерные лучи
  for(let i=beams.length-1;i>=0;i--){
    const bm=beams[i], t=(now-bm.born)/260;
    if(t>=1){ beams.splice(i,1); continue; }
    ctx.globalAlpha=1-t;
    const g=ctx.createLinearGradient(0,ROW0_Y-16,0,BOTTOM_Y);
    g.addColorStop(0,'rgba(228,84,95,0)'); g.addColorStop(0.25,'#E4545F'); g.addColorStop(1,'rgba(228,84,95,.4)');
    ctx.fillStyle=g; ctx.fillRect(bm.x-2.5, ROW0_Y-16, 5, BOTTOM_Y-ROW0_Y+16);
    ctx.globalAlpha=1;
  }
  // частицы
  for(const p of particles){
    ctx.save(); ctx.globalAlpha=Math.max(p.life,0);
    ctx.translate(p.x,p.y); ctx.rotate(p.rot);
    ctx.fillStyle=p.color; ctx.fillRect(-p.size/2,-p.size/2,p.size,p.size*0.7);
    ctx.restore();
  }
  // шары в полёте
  ctx.fillStyle='#E8C08A';
  for(const b of balls){
    ctx.beginPath(); ctx.arc(b.x, b.y, BALL_R, 0, 6.3); ctx.fill();
  }
  // ждущий роёк и прицел
  if(running && !over){
    const remaining = volley.active ? Math.max(volley.total-volley.launched, 0) : arsenal;
    drawCluster(volley.originX, ORIGIN_Y, Math.min(remaining, 24));
    if(aim.active && !volley.active){
      const pts=trajPoints();
      ctx.fillStyle='rgba(212,165,116,.8)';
      for(const p of pts){ ctx.beginPath(); ctx.arc(p.x, p.y, 1.7, 0, 6.3); ctx.fill(); }
      ctx.strokeStyle='rgba(212,165,116,.9)'; ctx.lineWidth=1.5;
      ctx.beginPath(); ctx.arc(volley.originX, ORIGIN_Y, 10+Math.sin(now/180)*2, 0, 6.3); ctx.stroke();
    } else if(!volley.active && shots===0){
      ctx.fillStyle='rgba(142,142,147,.5)';
      ctx.font='500 12px Inter, system-ui, sans-serif'; ctx.textAlign='center';
      ctx.fillText('Тяни от роёв и отпусти — или ← → и пробел', W/2, H-64);
    }
  }
  // попапы
  for(let i=popups.length-1;i>=0;i--){
    const p=popups[i], t=(now-p.born)/900;
    if(t>=1){ popups.splice(i,1); continue; }
    ctx.globalAlpha=1-t;
    ctx.fillStyle=p.color;
    ctx.font='600 13px Inter, system-ui, sans-serif'; ctx.textAlign='center';
    ctx.fillText(p.txt, p.x, p.y-16-t*22);
    ctx.globalAlpha=1;
  }
  ctx.restore();
}

// ---------- статистика/DOM ----------
let statsDirty=false, lastFlush=0;
function updateStats(){ statsDirty=true; }
function flushStats(){
  if(!statsDirty) return; statsDirty=false;
  const s=Math.floor(score);
  el.score.textContent=s;
  const best=lsGet(K_BEST,0), dailyRec=lsGet(K_DAILY,0);
  el.best.textContent=Math.max(best, s);
  el.daily.textContent=(mode==='daily')?Math.max(dailyRec, s):dailyRec;
  el.ballsV.textContent=arsenal;
}
function updateChips(){
  el.streakN.textContent=effStreak();
  el.multN.textContent='×'+mult.toFixed(2);
  el.missionsN.textContent=missionsDone()+'/3';
}
let lastDanger=0;
function updateDanger(now){
  if(now-lastDanger<120) return; lastDanger=now;
  const prox=clamp(1-(BOTTOM_Y-maxBlockBottom())/240, 0, 1);
  el.danger.style.width=(prox*100).toFixed(1)+'%';
}
function saveRecords(){
  const s=Math.floor(score);
  if(s>lsGet(K_BEST,0)) lsSet(K_BEST, s);
  if(mode==='daily' && s>lsGet(K_DAILY,0)) lsSet(K_DAILY, s);
}
function endRun(){
  if(over) return;
  over=true; running=false; volley.active=false; balls.length=0;
  const s=Math.floor(score);
  const prevBest=lsGet(K_BEST,0), prevDaily=lsGet(K_DAILY,0);
  saveRecords();
  const newRecord = s>prevBest || (mode==='daily' && s>prevDaily);
  el.modalBadge.textContent=newRecord?'Новый рекорд!':'Забег окончен';
  el.modalBadge.classList.toggle('record', newRecord);
  el.modalTitle.textContent=newRecord?'Разлом покорён':'Ряд дошёл до линии';
  el.modalScore.innerHTML=`Очки <b>${s}</b> · Ряд <b>${topRow}</b> · Шары <b>${arsenal}</b>${mode==='daily'?`<br>Рекорд дня: <b>${Math.max(prevDaily,s)}</b>`:''}`;
  el.modal.classList.toggle('modal-record', newRecord);
  el.modal.classList.remove('hidden');
  if(newRecord) snd.record(); else snd.over();
  updateStats(); flushStats();
}

// ---------- цикл ----------
let last=performance.now(), acc=0;
function frame(now){
  requestAnimationFrame(frame);
  const inGame=!el.game.classList.contains('hidden');
  let dt=now-last; last=now;
  if(!inGame) return;
  if(dt>100) dt=100;
  if(running && !over){
    acc+=dt;
    while(acc>=STEP_MS){ acc-=STEP_MS; physicsStep(now); }
  }
  for(let i=particles.length-1;i>=0;i--){
    const p=particles[i];
    p.x+=p.vx; p.y+=p.vy; p.vy+=0.05; p.rot+=p.vr; p.life-=0.035;
    if(p.life<=0) particles.splice(i,1);
  }
  draw(now);
  updateDanger(now);
  if(now-lastFlush>90){ lastFlush=now; flushStats(); }
}

// ---------- размеры canvas ----------
function fit(){
  const dpr=Math.min(window.devicePixelRatio||1, 2);
  const wrap=canvas.parentElement;
  const availW=wrap.clientWidth, availH=wrap.clientHeight;
  const cssW=Math.max(Math.min(W, availW, availH*W/H), 200);
  canvas.style.width=cssW+'px';
  canvas.style.height=(cssW*H/W)+'px';
  canvas.width=Math.round(W*dpr); canvas.height=Math.round(H*dpr);
  ctx.setTransform(dpr,0,0,dpr,0,0);
}
window.addEventListener('resize', fit);

// ---------- запуск/сброс ----------
function resetRun(){
  blocks.length=0; balls.length=0; particles.length=0; popups.length=0; beams.length=0;
  score=0; shots=0; arsenal=START_BALLS; topRow=0; over=false;
  volley.active=false; volley.total=0; volley.launched=0; volley.finished=0;
  volley.originX=W/2; volley.lastX=W/2; volley.raw=0; volley.hits=0; volley.destroyed=0;
  aim.active=false; aim.dx=0; aim.dy=-1; acc=0;
  dailyRng=(mode==='daily')?mulberry32(xmur3('breaker-'+today)()):Math.random;
  spawnRow(0, ROW0_Y); topRow=1;
  spawnRow(1, ROW0_Y+CELL_H); topRow=2;
  running=true;
  el.modal.classList.add('hidden'); el.mmodal.classList.add('hidden');
  updateStats(); flushStats(); updateChips();
}
function refreshWelcome(){
  el.wDaily.textContent=lsGet(K_DAILY,0);
  el.wBest.textContent=lsGet(K_BEST,0);
  el.wStreak.textContent='🔥 '+effStreak();
  el.dailyDate.textContent='Вызов дня · '+today;
}
function setMode(m){
  mode=m;
  $('mode-daily').classList.toggle('active', m==='daily');
  $('mode-free').classList.toggle('active', m==='free');
  refreshWelcome();
}
$('btn-play').addEventListener('click', ()=>{ audio(); snd.click(); el.welcome.classList.add('hidden'); el.game.classList.remove('hidden'); fit(); resetRun(); });
$('mode-daily').addEventListener('click', ()=>{ snd.click(); setMode('daily'); });
$('mode-free').addEventListener('click', ()=>{ snd.click(); setMode('free'); });
$('btn-new').addEventListener('click', ()=>{ snd.click(); resetRun(); });
$('btn-menu').addEventListener('click', ()=>{ snd.click(); running=false; el.game.classList.add('hidden'); el.welcome.classList.remove('hidden'); refreshWelcome(); });
$('btn-sound').addEventListener('click', function(){ muted=!muted; lsSet(K_MUTE, muted); this.textContent=muted?'🔇':'🔊'; if(!muted){ audio(); snd.click(); } });
function openMissions(){ renderMissions(); el.mmodal.classList.remove('hidden'); snd.click(); }
$('btn-missions').addEventListener('click', openMissions);
$('missions-chip').addEventListener('click', openMissions);
$('mmodal-btn').addEventListener('click', ()=>{ snd.click(); el.mmodal.classList.add('hidden'); });
$('modal-btn').addEventListener('click', ()=>{ snd.click(); resetRun(); });

// ---------- инициализация ----------
(function init(){
  pickMissions();
  refreshMult();
  refreshWelcome();
  updateChips();
  renderMissions();
  $('btn-sound').textContent=muted?'🔇':'🔊';
  const row=$('ball-row');
  ['#9AA0AA','#6B5D48','#8A7350','#B08D57','#D4A574','#E8B04B','#F2C94C','#8B9D83','#E4545F','#D4A574','#F5F5F7'].forEach(c=>{
    const i=document.createElement('i'); i.style.background=c; row.appendChild(i);
  });
  fit();
  requestAnimationFrame(frame);
})();

// ---------- отладочные хуки (тесты) ----------
window.__brk={
  launch(a){
    const r=((a===undefined)?(Math.random()*70-35):a)*Math.PI/180;
    const dx=Math.sin(r), dy=-Math.cos(r);
    aim.dx=dx; aim.dy=dy; launch(dx, dy);
    return this.state();
  },
  state(){ return {score:Math.floor(score), shots, arsenal, topRow, blocks:blocks.length, balls:balls.length, volley:volley.active, over, running, mode, mult, streak, hits:volley.hits, raw:volley.raw}; },
  fast(steps){
    const t0=performance.now();
    for(let i=0;i<(steps||1);i++) physicsStep(t0+i*STEP_MS);
    return this.state();
  },
  waitEnd(maxSteps){
    let steps=0; const t0=performance.now();
    while(volley.active && steps<(maxSteps||60000)){
      for(let k=0;k<3;k++) physicsStep(t0+steps*STEP_MS);
      steps++;
    }
    return this.state();
  },
  setArsenal(n){ arsenal=n; updateStats(); flushStats(); },
  gameOver(){ blocks.push({type:'block', x:W/2-BLOCK_W/2, y:BOTTOM_Y-BLOCK_H+1, w:BLOCK_W, h:BLOCK_H, hp:99, maxHp:99, flash:0, cd:0, born:0}); },
  missions(){ return {missions:missions.map(m=>m.id), state:mState, done:missionsDone()}; },
  records(){ return {best:lsGet(K_BEST,0), daily:lsGet(K_DAILY,0), streak:lsGet(K_STREAK,0), lastDay:lsGet(K_LASTDAY,''), today}; },
  screen(){ return {welcome:!el.welcome.classList.contains('hidden'), game:!el.game.classList.contains('hidden'), modal:!el.modal.classList.contains('hidden'), mmodal:!el.mmodal.classList.contains('hidden')}; }
};

