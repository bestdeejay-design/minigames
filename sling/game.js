'use strict';
/* Рогатка — баллистика в стиле AXIIOM. canvas + vanilla JS, без зависимостей.
   Мета: стрик-множитель, ежедневные миссии, рекорды.
   Пересборка: кристаллы-мишени с эффектами разрушения, fixed timestep, честный бонус за выстрелы. */

// ---------- утилиты ----------
const $ = id => document.getElementById(id);
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
function xmur3(str){let h=1779033703^str.length;for(let i=0;i<str.length;i++){h=Math.imul(h^str.charCodeAt(i),3432918353);h=h<<13|h>>>19;}return function(){h=Math.imul(h^h>>>16,2246822507);h=Math.imul(h^h>>>13,3266489909);return (h^=h>>>16)>>>0;};}
function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return ((t^t>>>14)>>>0)/4294967296;};}
function lsGet(k, d){ try{ const v = localStorage.getItem(k); return v===null? d : JSON.parse(v); }catch(e){ return d; } }
function lsSet(k, v){ try{ localStorage.setItem(k, JSON.stringify(v)); }catch(e){} }

const dateFmt = new Intl.DateTimeFormat('sv-SE', {timeZone:'Europe/Moscow', year:'numeric', month:'2-digit', day:'2-digit'});
const moscowDate = off => dateFmt.format(new Date(Date.now() + off*864e5));
const today=moscowDate(0), yesterday=moscowDate(-1);

const STEP_MS=1000/60;

// ---------- DOM ----------
const canvas=$('gc'), ctx=canvas.getContext('2d');
const el={
  welcome:$('welcome'), game:$('game'),
  score:$('score-val'), daily:$('daily-val'), best:$('best-val'), levelV:$('level-val'),
  streakN:$('streak-n'), multN:$('mult-n'), missionsN:$('missions-n'), shotsN:$('shots-n'),
  wDaily:$('w-daily-best'), wBest:$('w-best'), wStreak:$('w-streak'),
  modal:$('modal'), modalCard:$('modal-card'), modalBadge:$('modal-badge'), modalTitle:$('modal-title'), modalScore:$('modal-score'),
  mmodal:$('mmodal'), mlist:$('mmodal-list'), toasts:$('toasts'), dailyDate:$('daily-date'),
  decoRow:$('deco-row')
};

// ---------- звук ----------
let AC=null;
let muted=lsGet('sling.muted', false);
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
  launch(){ tone(300, 540, 0.18, 'square', 0.05); tone(150, 230, 0.12, 'sine', 0.04); },
  hit(pts){ tone(420+Math.min(pts,8)*55, 460+Math.min(pts,8)*55, 0.1, 'triangle', 0.06); tone(640+Math.min(pts,8)*55, 640, 0.08, 'sine', 0.04, 0.045); },
  clink(){ tone(240, 180, 0.05, 'sine', 0.03); },
  win(){ [523,659,784,1047].forEach((f,i)=>tone(f, f, 0.16, 'sine', 0.06, i*0.095)); },
  lose(){ [330,262,196].forEach((f,i)=>tone(f, f, 0.2, 'triangle', 0.08, i*0.14)); },
  mission(){ tone(880, 880, 0.1, 'sine', 0.1); tone(1174, 1174, 0.16, 'sine', 0.1, 0.1); },
  record(){ [523,659,784,1047].forEach((f,i)=>tone(f, f, 0.14, 'triangle', 0.1, i*0.11)); },
  click(){ tone(440, 440, 0.04, 'sine', 0.05); }
};

// ---------- стрик ----------
const getMult = s => 1 + Math.min(Math.max(s-1,0),10)*0.05;
let streak = lsGet('sling.streak', 0), lastDay = lsGet('sling.lastDay', '');
function effStreak(){ return (lastDay===today || lastDay===yesterday) ? streak : 0; }
function refreshMult(){ mult = effStreak()>0 ? getMult(streak) : 1; }
function markDay(){
  if(lastDay===today){ mult=getMult(streak); return; }
  streak = (lastDay===yesterday) ? (streak||0)+1 : 1;
  lastDay = today;
  lsSet('sling.streak', streak); lsSet('sling.lastDay', lastDay);
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

// ---------- миссии ----------
const MISSIONS=[
  {id:'score300', t:()=>'Набери 300 очков (суммарно)',              n:300, cum:true},
  {id:'spare2',   t:()=>'Пройди уровень с запасом 2+ выстрелов',    n:2,  cum:true},
  {id:'moving5',  t:()=>'Сбей 5 движущихся кристаллов (за день)',   n:5,  cum:true},
  {id:'level5',   t:()=>'Дойди до 5-го уровня',                     n:5},
  {id:'clears3',  t:()=>'Полностью зачисти 3 уровня (за день)',     n:3,  cum:true},
  {id:'targets30',t:()=>'Сбей 30 кристаллов (за день)',             n:30, cum:true},
  {id:'t20hit',   t:()=>'Сбей кристалл на 20 очков',                n:1},
  {id:'score500', t:()=>'Набери 500 очков (суммарно)',              n:500, cum:true}
];
let missions=[], mState=lsGet('sling.missions.'+today, {});
let mDirty=false;
function flushMissions(){ if(!mDirty) return; mDirty=false; lsSet('sling.missions.'+today, mState); }
function pickMissions(){
  const seed = xmur3('sling-missions-'+today)();
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
  const before=st.p;
  st.p = def.cum ? st.p + val : Math.max(st.p, val);
  if(st.p!==before) mDirty=true;
  mState[id]=st;
  if(st.p >= def.n){
    st.done = true; st.p = def.n; mDirty=true;
    const reward = Math.round(25*mult);
    score += reward;
    toast(`🎯 Миссия: <b>${def.t()}</b> · +<b>${reward}</b>`);
    snd.mission();
  }
  renderMissionsChip();
}
function renderMissionsChip(){ el.missionsN.textContent = missions.filter(m=>(mState[m.id]||{}).done).length+'/3'; }
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

// ---------- уровни ----------
// points: 5=большой, 10=средний, 15=малый, 20=крошечный
const LEVELS=[
  {targets:[{x:0.72,y:0.18,w:55,points:5}], obstacles:[], shots:2},
  {targets:[{x:0.18,y:0.18,w:50,points:5},{x:0.76,y:0.15,w:50,points:5}], obstacles:[], shots:3},
  {targets:[{x:0.28,y:0.14,w:44,points:10},{x:0.76,y:0.22,w:50,points:5}],
   obstacles:[{x:0.38,y:0.38,w:8,h:80}], shots:4},
  {targets:[{x:0.20,y:0.14,w:44,points:10},{x:0.76,y:0.12,w:38,points:15,moving:true,moveRange:24,moveSpeed:0.02},{x:0.50,y:0.30,w:50,points:5}],
   obstacles:[], shots:4},
  {targets:[{x:0.15,y:0.10,w:38,points:15},{x:0.80,y:0.12,w:40,points:10}],
   obstacles:[{x:0.05,y:0.24,w:8,h:70},{x:0.70,y:0.28,w:8,h:70}], shots:4},
  {targets:[{x:0.12,y:0.18,w:42,points:10},{x:0.50,y:0.10,w:32,points:15},{x:0.85,y:0.14,w:38,points:15,moving:true,moveRange:18,moveSpeed:0.025}],
   obstacles:[{x:0.22,y:0.30,w:8,h:60},{x:0.76,y:0.30,w:8,h:60}], shots:5},
  {targets:[{x:0.06,y:0.14,w:26,points:20},{x:0.21,y:0.14,w:26,points:20},{x:0.36,y:0.14,w:26,points:20},{x:0.51,y:0.14,w:26,points:20},{x:0.66,y:0.14,w:26,points:20},{x:0.81,y:0.14,w:26,points:20}],
   obstacles:[{x:0.14,y:0.38,w:8,h:60},{x:0.46,y:0.38,w:8,h:60},{x:0.78,y:0.38,w:8,h:60}], shots:5},
  {targets:[{x:0.15,y:0.10,w:32,points:15},{x:0.83,y:0.18,w:40,points:10},{x:0.48,y:0.32,w:36,points:10,moving:true,moveRange:14,moveSpeed:0.02}],
   obstacles:[{x:0.06,y:0.24,w:8,h:65},{x:0.72,y:0.32,w:8,h:60}], shots:5},
  {targets:[{x:0.12,y:0.12,w:26,points:20,moving:true,moveRange:30,moveSpeed:0.03},{x:0.50,y:0.10,w:26,points:15,moving:true,moveRange:18,moveSpeed:0.035},{x:0.85,y:0.12,w:26,points:20,moving:true,moveRange:30,moveSpeed:0.03},{x:0.35,y:0.32,w:30,points:10},{x:0.65,y:0.32,w:30,points:10}],
   obstacles:[{x:0.25,y:0.24,w:8,h:55},{x:0.68,y:0.24,w:8,h:55}], shots:5},
  {targets:[{x:0.10,y:0.12,w:28,points:20},{x:0.28,y:0.30,w:36,points:10,moving:true,moveRange:18,moveSpeed:0.025},{x:0.50,y:0.09,w:26,points:20},{x:0.72,y:0.28,w:36,points:10,moving:true,moveRange:18,moveSpeed:0.025},{x:0.88,y:0.12,w:28,points:20}],
   obstacles:[{x:0.20,y:0.20,w:8,h:50},{x:0.80,y:0.20,w:8,h:50}], shots:6},
  {targets:[{x:0.12,y:0.22,w:40,points:5},{x:0.50,y:0.09,w:32,points:15},{x:0.85,y:0.22,w:40,points:5}],
   obstacles:[{x:0.30,y:0.32,w:8,h:55},{x:0.62,y:0.32,w:8,h:55}], shots:4},
  {targets:[{x:0.10,y:0.10,w:32,points:15,moving:true,moveRange:28,moveSpeed:0.025},{x:0.50,y:0.20,w:36,points:10,moving:true,moveRange:32,moveSpeed:0.02},{x:0.88,y:0.10,w:32,points:15,moving:true,moveRange:28,moveSpeed:0.025}],
   obstacles:[{x:0.40,y:0.32,w:8,h:50},{x:0.52,y:0.32,w:8,h:50}], shots:5},
  {targets:[{x:0.15,y:0.10,w:24,points:20,moving:true,moveRange:18,moveSpeed:0.025},{x:0.38,y:0.10,w:24,points:20,moving:true,moveRange:18,moveSpeed:0.025},{x:0.62,y:0.10,w:24,points:20,moving:true,moveRange:18,moveSpeed:0.025},{x:0.85,y:0.10,w:24,points:20,moving:true,moveRange:18,moveSpeed:0.025}],
   obstacles:[{x:0.05,y:0.30,w:8,h:55},{x:0.48,y:0.30,w:8,h:55},{x:0.87,y:0.30,w:8,h:55}], shots:6},
  {targets:[{x:0.10,y:0.24,w:34,points:10},{x:0.28,y:0.18,w:30,points:15},{x:0.46,y:0.10,w:24,points:20},{x:0.64,y:0.18,w:30,points:15},{x:0.82,y:0.24,w:34,points:10}],
   obstacles:[{x:0.20,y:0.34,w:8,h:50},{x:0.53,y:0.28,w:8,h:55},{x:0.75,y:0.34,w:8,h:50}], shots:5},
  {targets:[{x:0.06,y:0.10,w:24,points:20},{x:0.20,y:0.28,w:30,points:15,moving:true,moveRange:16,moveSpeed:0.03},{x:0.40,y:0.09,w:26,points:20},{x:0.56,y:0.26,w:30,points:15,moving:true,moveRange:18,moveSpeed:0.03},{x:0.76,y:0.10,w:24,points:20},{x:0.92,y:0.22,w:30,points:10,moving:true,moveRange:12,moveSpeed:0.025}],
   obstacles:[{x:0.14,y:0.18,w:8,h:45},{x:0.34,y:0.20,w:8,h:45},{x:0.66,y:0.20,w:8,h:45},{x:0.86,y:0.18,w:8,h:45}], shots:7},
];

// ---------- физика ----------
const GRAVITY=0.28, MAX_PULL=100, POWER_MULT=0.22;

// ---------- состояние ----------
let cw=0, ch=0, dpr=1;
let level=0, score=0, shotsLeft=5;
let targets=[], obstacles=[], proj=null, shatters=[];
let gameState='menu';
let dragX=0, dragY=0, touchActive=false;
let animId=null, acc=0, lastT=0, paused=false, stepCount=0;
let dailyBest=lsGet('sling.daily.'+today, 0), best=lsGet('sling.best', 0);

function fitCanvas(){
  const rect=canvas.parentElement.getBoundingClientRect();
  dpr=Math.min(window.devicePixelRatio||1, 2);
  cw=Math.floor(rect.width); ch=Math.floor(rect.height);
  canvas.width=cw*dpr; canvas.height=ch*dpr;
  canvas.style.width=cw+'px'; canvas.style.height=ch+'px';
  ctx.setTransform(dpr,0,0,dpr,0,0);
}
const slingX=()=>cw/2, slingY=()=>ch*0.74;

// кристаллы по очкам: цвет + размер фиксирован уровнем
function crystalColor(pts){
  if(pts>=20) return '#E8B04B';
  if(pts>=15) return '#D4A574';
  if(pts>=10) return '#B08D57';
  return '#6B5D48';
}

function loadLevel(idx){
  const lv=LEVELS[idx];
  targets=lv.targets.map(t=>({
    x:t.x*cw, y:t.y*ch, w:t.w, h:t.w,   // кристаллы — ромбы
    baseX:t.x*cw, points:t.points,
    hit:false, hitAnim:0,
    moving:t.moving||false, moveRange:t.moveRange||0, moveSpeed:t.moveSpeed||0,
    rot:Math.random()*Math.PI*2,
  }));
  obstacles=lv.obstacles.map(o=>({
    x:o.x*cw, y:o.y*ch,
    w:o.w<1?o.w*cw:o.w, h:o.h<1?o.h*ch:o.h,
  }));
  shotsLeft=lv.shots;
  proj=null;
  gameState='aiming';
  touchActive=false;
  updateHUD();
}

// ---------- выстрел ----------
function fireProjectile(vx, vy){
  proj={x:slingX(), y:slingY()-7, vx, vy, r:7, trail:[], lifetime:0};
  gameState='flying';
  shotsLeft--;
  snd.launch();
  updateHUD();
}

function update(){
  stepCount++;
  // движущиеся цели — двигаются только в полёте снаряда (честное прицеливание)
  for(const t of targets){
    if(t.moving&&!t.hit){
      t.x=t.baseX+Math.sin(stepCount*t.moveSpeed)*t.moveRange;
    }
    if(t.hit&&t.hitAnim<1) t.hitAnim=Math.min(1, t.hitAnim+0.08);
    t.rot+=0.01;
  }
  // шattering-анимации
  for(let i=shatters.length-1;i>=0;i--){
    const s=shatters[i];
    s.x+=s.vx; s.y+=s.vy; s.vy+=0.12; s.rot+=0.1; s.life--;
    if(s.life<=0) shatters.splice(i,1);
  }

  if(gameState!=='flying'||!proj) return;

  proj.lifetime++;
  if(proj.lifetime>300){ endShot(); return; }

  proj.vy+=GRAVITY;
  proj.x+=proj.vx;
  proj.y+=proj.vy;
  proj.trail.push({x:proj.x, y:proj.y});
  if(proj.trail.length>18) proj.trail.shift();

  // стены
  if(proj.x<proj.r){ proj.x=proj.r; proj.vx=Math.abs(proj.vx)*0.6; snd.clink(); }
  if(proj.x>cw-proj.r){ proj.x=cw-proj.r; proj.vx=-Math.abs(proj.vx)*0.6; snd.clink(); }

  // препятствия
  for(const o of obstacles){
    if(proj.x+proj.r>o.x&&proj.x-proj.r<o.x+o.w&&proj.y+proj.r>o.y&&proj.y-proj.r<o.y+o.h){
      const cx=o.x+o.w/2, cy=o.y+o.h/2;
      const dx=proj.x-cx, dy=proj.y-cy;
      if(Math.abs(dx/Math.max(o.w,1))>Math.abs(dy/Math.max(o.h,1))){
        proj.vx=-Math.sign(proj.vx)*Math.abs(proj.vx)*0.65;
        proj.x+=Math.sign(proj.vx)*3;
      } else {
        proj.vy=-Math.sign(proj.vy)*Math.abs(proj.vy)*0.65;
        proj.y+=Math.sign(proj.vy)*3;
      }
      snd.clink();
      burst(proj.x, proj.y, '#8A7350', 5);
    }
  }

  // попадания
  for(const t of targets){
    if(t.hit) continue;
    if(proj.x+proj.r>t.x&&proj.x-proj.r<t.x+t.w&&proj.y+proj.r>t.y&&proj.y-proj.r<t.y+t.h){
      t.hit=true;
      score+=t.points;
      snd.hit(t.points);
      burst(t.x+t.w/2, t.y+t.h/2, crystalColor(t.points), 14);
      shatter(t.x+t.w/2, t.y+t.h/2, t.w, crystalColor(t.points));
      missionProgress('targets30',1);
      if(t.points>=20) missionProgress('t20hit',1);
      if(t.moving) missionProgress('moving5',1);
      updateHUD();
    }
  }

  if(proj.y>ch+20||proj.x<-100||proj.x>cw+100){ endShot(); return; }
  if(proj.y>ch-25&&Math.abs(proj.vy)<2){ endShot(); return; }
  if(Math.abs(proj.vx)<0.2&&Math.abs(proj.vy)<0.2&&proj.y>ch-60){ endShot(); return; }
}

function endShot(){
  proj=null;
  if(targets.every(t=>t.hit)){
    const bonus=shotsLeft*25;
    if(bonus>0) score+=bonus;
    gameState='done';
    snd.win();
    missionProgress('clears3',1);
    if(shotsLeft>=2) missionProgress('spare2',1);
    finishLevel(true, bonus);
  } else if(shotsLeft<=0){
    gameState='done';
    snd.lose();
    finishLevel(false, 0);
  } else {
    gameState='aiming';
    touchActive=false;
  }
}

function finishLevel(win, bonus){
  markDay();
  const final=Math.round(score*mult);
  const isDailyRec=final>dailyBest;
  if(isDailyRec){ dailyBest=final; lsSet('sling.daily.'+today, dailyBest); }
  const isRec=final>best;
  if(isRec){ best=final; lsSet('sling.best', best); }
  missionProgress('score300', score);
  missionProgress('score500', score);
  flushMissions();

  el.modalBadge.textContent=isRec?'Новый рекорд':(win?'Уровень пройден':'Выстрелы кончились');
  el.modalBadge.classList.toggle('record', isRec);
  el.modalCard.classList.toggle('modal-record', isRec);
  el.modalTitle.textContent=win?'Все кристаллы разбиты':'Мишени остались целы';
  el.modalScore.innerHTML=win
    ? `Очки: <b>${score}</b>${bonus>0?` · Бонус за выстрелы: <b>+${bonus}</b>`:''}<br>Рекорд: <b>${best}</b>`
    : `Очки: <b>${score}</b> · Осталось целей: <b>${targets.filter(t=>!t.hit).length}</b><br>Рекорд: <b>${best}</b>`;
  $('modal-btn').textContent=win?'Дальше →':'Повторить';
  $('modal-btn').onclick=()=>{
    snd.click();
    el.modal.classList.add('hidden');
    if(win){ level++; if(level>=LEVELS.length){ level=0; score=0; } }
    loadLevel(level);
  };
  el.modal.classList.remove('hidden');
  showWelcomeRecords(); updateHUD();
}

// ---------- частицы ----------
let particles=[];
function burst(x, y, color, n){
  for(let i=0;i<n;i++){
    const a=Math.random()*Math.PI*2, v=1+Math.random()*2.6;
    particles.push({x, y, vx:Math.cos(a)*v, vy:Math.sin(a)*v, life:26, max:26, r:1.4+Math.random()*2, c:color});
  }
}
function shatter(x, y, size, color){
  for(let i=0;i<6;i++){
    const a=Math.PI*2*i/6;
    shatters.push({x, y, vx:Math.cos(a)*1.6, vy:Math.sin(a)*1.6-1, rot:a, size:size*0.28, color, life:30});
  }
}

// ---------- отрисовка ----------
function roundRect(c,x,y,w,h,r){ r=Math.min(r,w/2,h/2); c.beginPath(); c.moveTo(x+r,y); c.arcTo(x+w,y,x+w,y+h,r); c.arcTo(x+w,y+h,x,y+h,r); c.arcTo(x,y+h,x,y,r); c.arcTo(x,y,x+w,y,r); c.closePath(); }

function drawCrystal(t, screenX, screenY){
  const half=t.w/2;
  const color=crystalColor(t.points);
  ctx.save();
  ctx.translate(screenX+half, screenY+half);
  ctx.rotate(t.rot);
  const scale=t.hit?1-t.hitAnim*0.5:1;
  ctx.scale(scale, scale);
  ctx.globalAlpha=t.hit?1-t.hitAnim:1;
  // ромб
  ctx.beginPath();
  ctx.moveTo(0,-half*1.15); ctx.lineTo(half,0); ctx.lineTo(0,half*1.15); ctx.lineTo(-half,0);
  ctx.closePath();
  const g=ctx.createLinearGradient(-half,-half,half,half);
  g.addColorStop(0, lighten(color, 60));
  g.addColorStop(0.55, color);
  g.addColorStop(1, darken(color, 45));
  ctx.fillStyle=g;
  ctx.fill();
  ctx.strokeStyle='rgba(255,255,255,.35)'; ctx.lineWidth=1;
  ctx.stroke();
  // грань
  ctx.beginPath();
  ctx.moveTo(0,-half*1.15); ctx.lineTo(0, half*1.15);
  ctx.moveTo(-half,0); ctx.lineTo(half,0);
  ctx.strokeStyle='rgba(10,10,15,.25)'; ctx.lineWidth=1;
  ctx.stroke();
  ctx.restore();
  if(!t.hit){
    ctx.fillStyle='#14100B';
    ctx.font='bold 10px Inter, sans-serif'; ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillText(t.points, screenX+half, screenY+half+0.5);
  }
  ctx.globalAlpha=1;
}
function lighten(color, amt){ return shift(color, amt); }
function darken(color, amt){ return shift(color, -amt); }
function shift(color, amt){
  const hex=color.replace('#','');
  const r=clamp(parseInt(hex.substr(0,2),16)+amt,0,255);
  const g=clamp(parseInt(hex.substr(2,2),16)+amt,0,255);
  const b=clamp(parseInt(hex.substr(4,2),16)+amt,0,255);
  return `rgb(${r},${g},${b})`;
}

function draw(){
  ctx.clearRect(0,0,cw,ch);
  // ночное небо
  const grad=ctx.createLinearGradient(0,0,0,ch);
  grad.addColorStop(0,'#0B0D16'); grad.addColorStop(0.6,'#12101C'); grad.addColorStop(1,'#1A1424');
  ctx.fillStyle=grad;
  ctx.fillRect(0,0,cw,ch);
  // звёзды-точки
  ctx.fillStyle='rgba(212,165,116,.25)';
  for(let i=0;i<24;i++){
    const sx=(i*167.3)%cw, sy=(i*97.7)%(ch*0.5);
    ctx.fillRect(sx, sy, 1.4, 1.4);
  }
  // земля
  ctx.fillStyle='#151D18';
  ctx.fillRect(0, ch-25, cw, 25);
  ctx.fillStyle='rgba(212,165,116,.18)';
  ctx.fillRect(0, ch-25, cw, 2);

  // препятствия
  for(const o of obstacles){
    const g=ctx.createLinearGradient(o.x, o.y, o.x+o.w, o.y);
    g.addColorStop(0,'#3A2C1C'); g.addColorStop(0.5,'#2A2116'); g.addColorStop(1,'#221A10');
    ctx.fillStyle=g;
    roundRect(ctx, o.x, o.y, o.w, o.h, 3); ctx.fill();
    ctx.fillStyle='#B08D57';
    ctx.fillRect(o.x+1, o.y+1, o.w-2, 3);
  }

  // кристаллы
  for(const t of targets) drawCrystal(t, t.x, t.y);

  // осколки
  for(const s of shatters){
    ctx.save();
    ctx.translate(s.x, s.y);
    ctx.rotate(s.rot);
    ctx.globalAlpha=s.life/30;
    ctx.fillStyle=s.color;
    ctx.beginPath();
    ctx.moveTo(0,-s.size); ctx.lineTo(s.size,0); ctx.lineTo(0,s.size); ctx.lineTo(-s.size,0);
    ctx.closePath(); ctx.fill();
    ctx.restore();
  }
  ctx.globalAlpha=1;

  // рогатка
  const s={x:slingX(), y:slingY()};
  ctx.strokeStyle='#3A2C1C';
  ctx.lineWidth=5; ctx.lineCap='round';
  ctx.beginPath();
  ctx.moveTo(s.x-18, s.y-28); ctx.lineTo(s.x-18, s.y+10);
  ctx.moveTo(s.x+18, s.y-28); ctx.lineTo(s.x+18, s.y+10);
  ctx.stroke();
  ctx.lineCap='butt';

  // прицеливание
  if(gameState==='aiming'&&touchActive){
    const dx=s.x-dragX, dy=s.y-dragY;
    const pull=Math.min(Math.sqrt(dx*dx+dy*dy), MAX_PULL);
    if(pull>10){
      const powerRatio=pull/MAX_PULL;
      drawPowerBar(powerRatio);
      const angle=Math.atan2(dy, dx);
      const velocity=pull*POWER_MULT;
      // резинка
      ctx.strokeStyle='#8A7350'; ctx.lineWidth=3;
      ctx.beginPath();
      ctx.moveTo(s.x-18, s.y-28); ctx.lineTo(dragX, dragY); ctx.lineTo(s.x+18, s.y-28);
      ctx.stroke();
      // курсор
      ctx.strokeStyle='#EDEDF0'; ctx.lineWidth=2;
      ctx.beginPath(); ctx.arc(dragX, dragY, 12, 0, Math.PI*2); ctx.stroke();
      ctx.fillStyle='#EDEDF0';
      ctx.beginPath(); ctx.arc(dragX, dragY, 4, 0, Math.PI*2); ctx.fill();
      // траектория
      let px=s.x, py=s.y-7, pvx=Math.cos(angle)*velocity, pvy=Math.sin(angle)*velocity;
      ctx.strokeStyle='rgba(232,176,75,.35)';
      ctx.lineWidth=2; ctx.setLineDash([4,6]);
      ctx.beginPath(); ctx.moveTo(px, py);
      for(let i=0;i<40;i++){
        pvy+=GRAVITY; px+=pvx; py+=pvy;
        if(py>ch||px<-20||px>cw+20) break;
        ctx.lineTo(px, py);
      }
      ctx.stroke(); ctx.setLineDash([]);
      pvy=Math.sin(angle)*velocity; px=s.x; py=s.y-7;
      for(let i=0;i<40;i++){
        pvy+=GRAVITY; px+=pvx; py+=pvy;
        if(py>ch||px<-20||px>cw+20) break;
        ctx.fillStyle=`rgba(232,176,75,${0.55+0.4*(1-i/40)})`;
        ctx.beginPath(); ctx.arc(px, py, 2.4, 0, Math.PI*2); ctx.fill();
      }
    } else {
      restingStone(s.x, s.y-7);
    }
  } else if(gameState==='aiming'){
    restingStone(s.x, s.y-7);
    if(shotsLeft>0){
      ctx.fillStyle='rgba(237,237,240,.35)';
      ctx.font='13px Inter, sans-serif'; ctx.textAlign='center';
      ctx.fillText('Оттяни и отпусти', cw/2, ch-55);
    }
  }

  // снаряд
  if(proj){
    for(let i=0;i<proj.trail.length;i++){
      const a=(i/proj.trail.length)*0.5;
      ctx.fillStyle=`rgba(138,115,80,${a})`;
      ctx.beginPath(); ctx.arc(proj.trail[i].x, proj.trail[i].y, 3, 0, Math.PI*2); ctx.fill();
    }
    ctx.fillStyle='#B08D57';
    ctx.beginPath(); ctx.arc(proj.x, proj.y, proj.r, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle='#D4A574';
    ctx.beginPath(); ctx.arc(proj.x-2, proj.y-3, 2.5, 0, Math.PI*2); ctx.fill();
  }

  // частицы
  for(const p of particles){
    ctx.globalAlpha=Math.max(0, p.life/p.max);
    ctx.fillStyle=p.c;
    ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI*2); ctx.fill();
  }
  ctx.globalAlpha=1;
}
function restingStone(x, y){
  ctx.fillStyle='#2A2116';
  ctx.beginPath(); ctx.arc(x, y, 7, 0, Math.PI*2); ctx.fill();
  ctx.strokeStyle='rgba(212,165,116,.5)'; ctx.lineWidth=1;
  ctx.stroke();
}
function drawPowerBar(ratio){
  const barW=8, barH=76, bx=14, by=ch-30-barH;
  ctx.fillStyle='rgba(0,0,0,.45)';
  roundRect(ctx, bx-1, by-1, barW+2, barH+2, 4); ctx.fill();
  const fillH=barH*ratio;
  const grad=ctx.createLinearGradient(bx, by+barH, bx, by);
  grad.addColorStop(0,'#8B9D83'); grad.addColorStop(0.6,'#D4A574'); grad.addColorStop(1,'#E4545F');
  ctx.fillStyle=grad;
  roundRect(ctx, bx, by+barH-fillH, barW, fillH, 3); ctx.fill();
}

// ---------- HUD ----------
function updateHUD(){
  el.score.textContent=score;
  el.daily.textContent=dailyBest;
  el.best.textContent=best;
  el.levelV.textContent=level+1;
  el.shotsN.textContent=shotsLeft;
}
function showWelcomeRecords(){
  el.wDaily.textContent=dailyBest;
  el.wBest.textContent=best;
  el.wStreak.textContent='🔥 '+effStreak();
}

// ---------- цикл ----------
function loop(now){
  animId=requestAnimationFrame(loop);
  if(!lastT) lastT=now;
  let delta=now-lastT; lastT=now;
  if(paused){ draw(); return; }
  delta=Math.min(delta,100);
  acc+=delta;
  let steps=0;
  while(acc>=STEP_MS&&steps<4){ update(); acc-=STEP_MS; steps++; }
  if(steps===4) acc=0;
  flushMissions();
  // частицы
  for(let i=particles.length-1;i>=0;i--){
    const p=particles[i];
    p.x+=p.vx; p.y+=p.vy; p.vy+=0.08;
    if(--p.life<=0) particles.splice(i,1);
  }
  draw();
}

// ---------- ввод ----------
canvas.addEventListener('touchstart',e=>{
  e.preventDefault();
  if(gameState!=='aiming') return;
  const t=e.touches[0], r=canvas.getBoundingClientRect();
  dragX=t.clientX-r.left; dragY=t.clientY-r.top; touchActive=true;
},{passive:false});
canvas.addEventListener('touchmove',e=>{
  e.preventDefault();
  if(gameState!=='aiming'||!touchActive) return;
  const t=e.touches[0], r=canvas.getBoundingClientRect();
  dragX=t.clientX-r.left; dragY=t.clientY-r.top;
},{passive:false});
canvas.addEventListener('touchend',e=>{
  e.preventDefault();
  if(gameState!=='aiming'||!touchActive) return;
  releaseShot();
},{passive:false});
canvas.addEventListener('mousedown',e=>{
  if(gameState!=='aiming') return;
  const r=canvas.getBoundingClientRect();
  dragX=e.clientX-r.left; dragY=e.clientY-r.top; touchActive=true;
});
canvas.addEventListener('mousemove',e=>{
  if(gameState!=='aiming'||!touchActive) return;
  const r=canvas.getBoundingClientRect();
  dragX=e.clientX-r.left; dragY=e.clientY-r.top;
});
canvas.addEventListener('mouseup',()=>{
  if(gameState!=='aiming'||!touchActive) return;
  releaseShot();
});
function releaseShot(){
  const s={x:slingX(), y:slingY()};
  const dx=s.x-dragX, dy=s.y-dragY;
  const pull=Math.sqrt(dx*dx+dy*dy);
  if(pull>15){
    const limited=Math.min(pull, MAX_PULL);
    const angle=Math.atan2(dy, dx);
    const velocity=limited*POWER_MULT;
    fireProjectile(Math.cos(angle)*velocity, Math.sin(angle)*velocity);
  }
  touchActive=false;
}

// ---------- экраны ----------
function startGame(){
  el.welcome.classList.add('hidden');
  el.modal.classList.add('hidden');
  el.game.classList.remove('hidden');
  fitCanvas();
  level=0; score=0;
  loadLevel(0);
}
function toMenu(){
  el.game.classList.add('hidden');
  el.modal.classList.add('hidden');
  el.welcome.classList.remove('hidden');
  showWelcomeRecords();
}

$('btn-play').addEventListener('click',()=>{ snd.click(); startGame(); });
$('btn-new').addEventListener('click',()=>{ snd.click(); if(gameState!=='menu'){ score=Math.max(0, score); loadLevel(level); } });
$('btn-menu').addEventListener('click',()=>{ snd.click(); toMenu(); });
$('btn-missions').addEventListener('click',openMissions);
$('missions-chip').addEventListener('click',openMissions);
$('mmodal-btn').addEventListener('click',()=>{ snd.click(); el.mmodal.classList.add('hidden'); });
function openMissions(){ snd.click(); renderMissionsModal(); el.mmodal.classList.remove('hidden'); }

function updateSoundBtn(){ $('btn-sound').textContent=muted?'🔇':'🔊'; }
$('btn-sound').addEventListener('click',()=>{
  muted=!muted; lsSet('sling.muted', muted);
  updateSoundBtn(); if(!muted) snd.click();
});
updateSoundBtn();

document.addEventListener('visibilitychange',()=>{ paused=document.hidden; if(!document.hidden) lastT=0; });

function onResize(){
  if(el.game.classList.contains('hidden')) return;
  fitCanvas();
  // пересчитать позиции уровня под новый размер
  const lv=LEVELS[level];
  targets=lv.targets.map((t,i)=>{
    const old=targets[i]||{};
    return {
      x:t.x*cw, y:t.y*ch, w:t.w, h:t.w,
      baseX:t.x*cw, points:t.points,
      hit:old.hit||false, hitAnim:0,
      moving:t.moving||false, moveRange:t.moveRange||0, moveSpeed:t.moveSpeed||0,
      rot:Math.random()*Math.PI*2,
    };
  });
  obstacles=lv.obstacles.map(o=>({x:o.x*cw, y:o.y*ch, w:o.w<1?o.w*cw:o.w, h:o.h<1?o.h*ch:o.h}));
}
window.addEventListener('resize', onResize);
if(window.visualViewport) window.visualViewport.addEventListener('resize', onResize);

// ---------- init ----------
(function init(){
  for(let i=0;i<7;i++) el.decoRow.appendChild(document.createElement('i'));
  el.dailyDate.textContent='Рекорд дня · '+today;
  pickMissions(); renderMissionsChip();
  showWelcomeRecords(); updateHUD();
  fitCanvas();
  animId=requestAnimationFrame(loop);
})();

// ---------- debug hooks ----------
window.__sl={
  get state(){ return gameState; },
  get score(){ return score; },
  get level(){ return level+1; },
  get targetsLeft(){ return targets.filter(t=>!t.hit).length; },
  get best(){ return best; },
  get missionsDone(){ return missions.filter(m=>(mState[m.id]||{}).done).length; },
  fire(vx, vy){ if(gameState==='aiming') fireProjectile(vx, vy); },
  flush(){ flushMissions(); },
};
