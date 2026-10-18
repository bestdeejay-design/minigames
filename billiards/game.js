'use strict';
/* Бильярд — портретный стол в стиле AXIIOM. canvas + vanilla JS, без зависимостей.
   Мета: стрик-множитель, ежедневные миссии, рекорды. Физика: субшаги против туннелирования,
   честная логика завершения уровня (победа = все шары забиты; ходы кончились = партия не пройдена). */

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

const STEP_MS = 1000/60;

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
let muted=lsGet('billiards.muted', false);
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
  cue(p){ tone(220+p*160, 140, 0.08, 'square', 0.05); },
  click(p){ tone(900+p*300, 700, 0.04, 'triangle', Math.min(0.07, 0.015+p*0.012)); },
  cushion(){ tone(240, 180, 0.05, 'sine', 0.03); },
  pocket(){ tone(520, 340, 0.1, 'sine', 0.05); tone(260, 180, 0.16, 'sine', 0.04, 0.06); },
  foul(){ tone(196, 120, 0.3, 'sawtooth', 0.05); },
  win(){ [523,659,784,1047].forEach((f,i)=>tone(f, f, 0.16, 'sine', 0.06, i*0.095)); },
  lose(){ [330,262,196].forEach((f,i)=>tone(f, f, 0.2, 'triangle', 0.08, i*0.14)); },
  mission(){ tone(880, 880, 0.1, 'sine', 0.1); tone(1174, 1174, 0.16, 'sine', 0.1, 0.1); },
  record(){ [523,659,784,1047].forEach((f,i)=>tone(f, f, 0.14, 'triangle', 0.1, i*0.11)); },
  click(){ tone(440, 440, 0.04, 'sine', 0.05); }
};

// ---------- стрик ----------
const getMult = s => 1 + Math.min(Math.max(s-1,0),10)*0.05;
let streak = lsGet('billiards.streak', 0), lastDay = lsGet('billiards.lastDay', '');
function effStreak(){ return (lastDay===today || lastDay===yesterday) ? streak : 0; }
function refreshMult(){ mult = effStreak()>0 ? getMult(streak) : 1; }
function markDay(){
  if(lastDay===today){ mult=getMult(streak); return; }
  streak = (lastDay===yesterday) ? (streak||0)+1 : 1;
  lastDay = today;
  lsSet('billiards.streak', streak); lsSet('billiards.lastDay', lastDay);
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
  {id:'multi3',   t:()=>'Забей 3 шара одним ударом',            n:3},
  {id:'score150', t:()=>'Набери 150 очков за партию',           n:150},
  {id:'side3',    t:()=>'Забей 3 шара в боковые лузы (за день)',n:3, cum:true},
  {id:'level3',   t:()=>'Пройди 3 уровня (за день)',            n:3, cum:true},
  {id:'balls10',  t:()=>'Забей 10 шаров (за день)',             n:10, cum:true},
  {id:'spare2',   t:()=>'Пройди уровень с запасом 2+ ходов',    n:2, cum:true},
  {id:'level5',   t:()=>'Дойди до 5-го уровня',                 n:5},
  {id:'score300', t:()=>'Набери 300 очков за партию',           n:300}
];
let missions=[], mState=lsGet('billiards.missions.'+today, {});
let mDirty=false;
function flushMissions(){ if(!mDirty) return; mDirty=false; lsSet('billiards.missions.'+today, mState); }
function pickMissions(){
  const seed = xmur3('billiards-missions-'+today)();
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
function renderMissionsChip(){
  el.missionsN.textContent = missions.filter(m=>(mState[m.id]||{}).done).length+'/3';
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

// ---------- геометрия ----------
let cw=0, ch=0, dpr=1;
const BALL_R=11, POCKET_R=17, FRICTION=0.988, WALL_BOUNCE=0.78, MAX_POWER=16, SUB=3;
const TABLE={ left:0, right:0, top:0, bottom:0 };
let POCKETS=[];
function layoutTable(){
  TABLE.left=cw*0.10; TABLE.right=cw*0.90; TABLE.top=ch*0.10; TABLE.bottom=ch*0.90;
  POCKETS=[
    {x:TABLE.left,  y:TABLE.top,    pts:3},
    {x:TABLE.right, y:TABLE.top,    pts:3},
    {x:TABLE.left,  y:(TABLE.top+TABLE.bottom)/2, pts:7},
    {x:TABLE.right, y:(TABLE.top+TABLE.bottom)/2, pts:7},
    {x:TABLE.left,  y:TABLE.bottom, pts:3},
    {x:TABLE.right, y:TABLE.bottom, pts:3},
  ];
}
// палитра шаров — приглушённые тона AXIIOM
const BALL_COLORS=['#D4A574','#8B9D83','#7A6A8F','#A8763E','#5F7E8A','#B0563F','#C96A6A','#4F6B5C','#E8B04B','#8E8E93'];

// ---------- состояние ----------
let level=1, score=0, shotsLeft=0;
let balls=[], cueBall=null;
let gameState='menu';            // menu | aiming | flying | done
let dragX=0, dragY=0, touchActive=false, settling=false;
let animId=null, acc=0, lastT=0, paused=false;
let pocketedThisShot=0, sidePocketed=0, totalPocketed=0;
let dailyBest=lsGet('billiards.daily.'+today, 0), best=lsGet('billiards.best', 0);
let particles=[];

function fitCanvas(){
  const rect=canvas.parentElement.getBoundingClientRect();
  dpr=Math.min(window.devicePixelRatio||1, 2);
  cw=Math.floor(rect.width); ch=Math.floor(rect.height);
  canvas.width=cw*dpr; canvas.height=ch*dpr;
  canvas.style.width=cw+'px'; canvas.style.height=ch+'px';
  ctx.setTransform(dpr,0,0,dpr,0,0);
  layoutTable();
}

// ---------- генерация уровня (seed от даты+уровня — честно повторяемо) ----------
function genLevel(lv){
  const rng = mulberry32(xmur3('billiards-lv-'+lv+'-'+today)());
  const numTargets=Math.min(1+lv, 11);
  const tl=TABLE.left, tr=TABLE.right, tt=TABLE.top, tb=TABLE.bottom;
  const ctrX=(tl+tr)/2;
  const out=[];
  out.push({x:ctrX, y:tb-(tb-tt)*0.18, r:BALL_R, vx:0, vy:0, cue:true, color:'#EDEDF0', label:'', active:true});
  const apexX=ctrX, apexY=tt+BALL_R+18+(tb-tt)*0.08;
  const spacing=BALL_R*2+1, rowSpacing=BALL_R*Math.sqrt(3);
  let placed=0, row=0;
  while(placed<numTargets){
    for(let col=0; col<=row && placed<numTargets; col++){
      out.push({x:apexX+(col-row/2)*spacing, y:apexY+row*rowSpacing, r:BALL_R, vx:0, vy:0,
        cue:false, color:BALL_COLORS[placed%BALL_COLORS.length], label:String(placed+1), active:true});
      placed++;
    }
    row++;
  }
  // лёгкая случайная нутация, чтобы пирамиды не были клонами
  for(const b of out){ b.x+=(rng()-.5)*0.6; b.y+=(rng()-.5)*0.6; }
  return {balls:out, shots:numTargets+1};
}

function loadLevel(lv, keepScore){
  const data=genLevel(lv);
  balls=data.balls; cueBall=balls[0];
  shotsLeft=data.shots;
  gameState='aiming'; touchActive=false; settling=false;
  pocketedThisShot=0;
  if(!keepScore){ /* score ведётся с начала сессии */ }
  updateHUD();
}

// ---------- удары ----------
function shoot(vx, vy){
  cueBall.vx=vx; cueBall.vy=vy;
  gameState='flying'; shotsLeft--; settling=true; pocketedThisShot=0;
  snd.cue(Math.min(1, Math.hypot(vx,vy)/14));
  updateHUD();
}

function nearPocket(x, y, r){
  for(const p of POCKETS){
    const dx=x-p.x, dy=y-p.y;
    if(dx*dx+dy*dy < (POCKET_R+r+2)*(POCKET_R+r+2)) return true;
  }
  return false;
}

function update(){
  if(gameState!=='flying') return;
  let allStill=true;

  for(const b of balls){
    if(!b.active) continue;
    for(let s=0;s<SUB;s++){
      b.vx*=FRICTION; b.vy*=FRICTION;
      if(Math.abs(b.vx)<0.05) b.vx=0;
      if(Math.abs(b.vy)<0.05) b.vy=0;
      b.x+=b.vx/SUB; b.y+=b.vy/SUB;
      if(Math.abs(b.vx)>0.05||Math.abs(b.vy)>0.05) allStill=false;
      if(!nearPocket(b.x,b.y,b.r)){
        if(b.x-b.r<TABLE.left){ b.x=TABLE.left+b.r; b.vx=Math.abs(b.vx)*WALL_BOUNCE; snd.cushion(); }
        if(b.x+b.r>TABLE.right){ b.x=TABLE.right-b.r; b.vx=-Math.abs(b.vx)*WALL_BOUNCE; snd.cushion(); }
        if(b.y-b.r<TABLE.top){ b.y=TABLE.top+b.r; b.vy=Math.abs(b.vy)*WALL_BOUNCE; snd.cushion(); }
        if(b.y+b.r>TABLE.bottom){ b.y=TABLE.bottom-b.r; b.vy=-Math.abs(b.vy)*WALL_BOUNCE; snd.cushion(); }
      }
    }
  }

  // соударения
  for(let i=0;i<balls.length;i++){
    for(let j=i+1;j<balls.length;j++){
      const a=balls[i], b=balls[j];
      if(!a.active||!b.active) continue;
      collide(a,b);
    }
  }

  // лузы
  for(const b of balls){
    if(!b.active) continue;
    for(const p of POCKETS){
      const dx=b.x-p.x, dy=b.y-p.y;
      if(dx*dx+dy*dy < POCKET_R*POCKET_R){
        b.active=false;
        if(b.cue){
          snd.foul();
          // кий возвращается на кухню
          b.active=true;
          b.x=(TABLE.left+TABLE.right)/2;
          b.y=TABLE.bottom-(TABLE.bottom-TABLE.top)*0.18;
          b.vx=0; b.vy=0;
        } else {
          const gain=10+p.pts;
          score+=gain;
          pocketedThisShot++;
          totalPocketed++;
          if(p.pts===7) sidePocketed++;
          burst(b.x, b.y, p.pts===7?'#E8B04B':'#D4A574', 10);
          snd.pocket();
          updateHUD();
        }
        break;
      }
    }
  }

  if(settling && allStill){
    settling=false;
    endTurn();
  }
}

function collide(a, b){
  const dx=b.x-a.x, dy=b.y-a.y;
  const dist=Math.sqrt(dx*dx+dy*dy), minDist=a.r+b.r;
  if(dist>=minDist || dist<0.001) return;
  const nx=dx/dist, ny=dy/dist, overlap=minDist-dist;
  a.x-=nx*overlap*0.5; a.y-=ny*overlap*0.5;
  b.x+=nx*overlap*0.5; b.y+=ny*overlap*0.5;
  const relV=(b.vx-a.vx)*nx+(b.vy-a.vy)*ny;
  if(relV>0) return;
  const impulse=relV*0.95;
  a.vx+=impulse*nx; a.vy+=impulse*ny;
  b.vx-=impulse*nx; b.vy-=impulse*ny;
  snd.click(Math.min(1, Math.abs(relV)/9));
}

function endTurn(){
  const remaining=balls.filter(b=>b.active && !b.cue).length;
  missionProgress('multi3', pocketedThisShot);
  if(pocketedThisShot>0) missionProgress('balls10', pocketedThisShot);
  if(sidePocketed>0){ missionProgress('side3', sidePocketed); sidePocketed=0; }

  if(remaining===0){
    // честная победа: все шары забиты
    const spare=shotsLeft;
    if(spare>=2) missionProgress('spare2', 1);
    gameState='done';
    snd.win();
    finishLevel(true, spare);
  } else if(shotsLeft<=0){
    // ходы кончились, шары остались — партия не пройдена
    gameState='done';
    snd.lose();
    finishLevel(false, 0);
  } else {
    gameState='aiming';
  }
}

function finishLevel(win, spare){
  markDay();
  const final=Math.round(score*mult);
  const isDailyRec=final>dailyBest;
  if(isDailyRec){ dailyBest=final; lsSet('billiards.daily.'+today, dailyBest); }
  const isRec=final>best;
  if(isRec){ best=final; lsSet('billiards.best', best); }

  if(win){
    missionProgress('score150', score);
    missionProgress('score300', score);
    missionProgress('level3', 1);
    missionProgress('level5', level+1);
    if(isRec){ snd.record(); }
  }
  flushMissions();

  el.modalBadge.textContent = isRec?'Новый рекорд':(win?'Уровень пройден':'Ходы кончились');
  el.modalBadge.classList.toggle('record', isRec);
  el.modalCard.classList.toggle('modal-record', isRec);
  el.modalTitle.textContent = win?'Чисто!':'Не все шары забиты';
  el.modalScore.innerHTML = win
    ? `Очки: <b>${score}</b> · Запас ходов: <b>${spare}</b><br>Рекорд: <b>${best}</b>`
    : `Очки: <b>${score}</b> · Осталось шаров: <b>${balls.filter(b=>b.active&&!b.cue).length}</b><br>Рекорд: <b>${best}</b>`;
  $('modal-btn').textContent = win?'Дальше →':'Повторить';
  $('modal-btn').onclick = ()=>{
    snd.click();
    el.modal.classList.add('hidden');
    if(win){ level++; }
    loadLevel(level);
  };
  el.modal.classList.remove('hidden');
  showWelcomeRecords(); updateHUD();
}

// ---------- частицы ----------
function burst(x, y, color, n){
  for(let i=0;i<n;i++){
    const a=Math.random()*Math.PI*2, v=1+Math.random()*2.4;
    particles.push({x,y,vx:Math.cos(a)*v,vy:Math.sin(a)*v,life:26,max:26,r:1.4+Math.random()*2,c:color});
  }
}

// ---------- предсказание траектории ----------
function simulateTrajectory(sx, sy, svx, svy){
  const tl=TABLE.left+BALL_R, tr=TABLE.right-BALL_R, tt=TABLE.top+BALL_R, tb=TABLE.bottom-BALL_R;
  const sims=[{x:sx,y:sy,vx:svx,vy:svy,dotR:2.5,color:'rgba(255,236,200,1)',dots:[],idx:-1,stopped:false,collided:false}];
  const hitBalls=new Set();
  for(let iter=0; iter<700; iter++){
    let anyMoving=false;
    for(const sim of sims){
      if(sim.stopped) continue;
      sim.vx*=FRICTION; sim.vy*=FRICTION;
      sim.x+=sim.vx; sim.y+=sim.vy;
      if(Math.abs(sim.vx)<0.15&&Math.abs(sim.vy)<0.15){ sim.stopped=true; continue; }
      anyMoving=true;
      if(!nearPocket(sim.x,sim.y,BALL_R)){
        if(sim.x<tl){ sim.x=tl; sim.vx=Math.abs(sim.vx)*WALL_BOUNCE; }
        if(sim.x>tr){ sim.x=tr; sim.vx=-Math.abs(sim.vx)*WALL_BOUNCE; }
        if(sim.y<tt){ sim.y=tt; sim.vy=Math.abs(sim.vy)*WALL_BOUNCE; }
        if(sim.y>tb){ sim.y=tb; sim.vy=-Math.abs(sim.vy)*WALL_BOUNCE; }
      }
      if(iter%2===0) sim.dots.push({x:sim.x,y:sim.y});
    }
    for(const sim of sims){
      if(sim.stopped||sim.collided) continue;
      for(const ball of balls){
        if(!ball.active||ball.cue||hitBalls.has(ball)) continue;
        const dx=ball.x-sim.x, dy=ball.y-sim.y;
        const dist=Math.sqrt(dx*dx+dy*dy);
        if(dist<BALL_R*2&&dist>0.01){
          const nx=dx/dist, ny=dy/dist;
          const relV=sim.vx*nx+sim.vy*ny;
          if(relV<=0) continue;
          const transfer=relV*0.85;
          const c=ball.color;
          const pc=`rgba(${parseInt(c.slice(1,3),16)},${parseInt(c.slice(3,5),16)},${parseInt(c.slice(5,7),16)},1)`;
          const tsim={x:ball.x+nx*BALL_R, y:ball.y+ny*BALL_R, vx:nx*transfer, vy:ny*transfer, dotR:2, color:pc, dots:[], idx:sims.length, stopped:false, collided:false};
          sims.push(tsim);
          sim.collided=sim.idx>0;
          sim.vx-=nx*transfer; sim.vy-=ny*transfer;
          hitBalls.add(ball);
          break;
        }
      }
    }
    if(!anyMoving) break;
  }
  return sims;
}

// ---------- отрисовка ----------
function roundRect(c,x,y,w,h,r){ r=Math.min(r,w/2,h/2); c.beginPath(); c.moveTo(x+r,y); c.arcTo(x+w,y,x+w,y+h,r); c.arcTo(x+w,y+h,x,y+h,r); c.arcTo(x,y+h,x,y,r); c.arcTo(x,y,x+w,y,r); c.closePath(); }

function draw(){
  ctx.clearRect(0,0,cw,ch);
  const tw=TABLE.right-TABLE.left, th=TABLE.bottom-TABLE.top;

  // тень стола
  ctx.fillStyle='rgba(0,0,0,.5)';
  roundRect(ctx,TABLE.left+3,TABLE.top+4,tw,th,10); ctx.fill();
  // деревянный борт
  const railGrad=ctx.createLinearGradient(0,TABLE.top,0,TABLE.bottom);
  railGrad.addColorStop(0,'#3A2C1C'); railGrad.addColorStop(0.5,'#2A2116'); railGrad.addColorStop(1,'#221A10');
  ctx.fillStyle=railGrad;
  roundRect(ctx,TABLE.left,TABLE.top,tw,th,10); ctx.fill();
  ctx.strokeStyle='rgba(212,165,116,.25)'; ctx.lineWidth=1;
  roundRect(ctx,TABLE.left+0.5,TABLE.top+0.5,tw-1,th-1,10); ctx.stroke();
  // сукно
  const railW=9;
  ctx.fillStyle='#17251E';
  roundRect(ctx,TABLE.left+railW,TABLE.top+railW,tw-railW*2,th-railW*2,5); ctx.fill();
  // виньетка сукна
  const vg=ctx.createRadialGradient(cw/2,ch/2,Math.min(tw,th)*0.2,cw/2,ch/2,Math.max(tw,th)*0.62);
  vg.addColorStop(0,'rgba(255,255,255,.045)'); vg.addColorStop(1,'rgba(0,0,0,.28)');
  ctx.fillStyle=vg;
  roundRect(ctx,TABLE.left+railW,TABLE.top+railW,tw-railW*2,th-railW*2,5); ctx.fill();

  // алмазные метки на бортах
  ctx.fillStyle='rgba(212,165,116,.5)';
  for(let i=1;i<8;i++){
    if(i===4) continue;
    const mx=TABLE.left+tw*i/8;
    ctx.fillRect(mx-1.5, TABLE.top+2.5, 3, 3);
    ctx.fillRect(mx-1.5, TABLE.bottom-5.5, 3, 3);
  }
  for(let i=1;i<4;i++){
    const my=TABLE.top+th*i/4;
    ctx.fillRect(TABLE.left+2.5, my-1.5, 3, 3);
    ctx.fillRect(TABLE.right-5.5, my-1.5, 3, 3);
  }

  // головная линия
  const hsY=TABLE.bottom-(TABLE.bottom-TABLE.top)*0.25;
  ctx.strokeStyle='rgba(212,165,116,.14)';
  ctx.lineWidth=1; ctx.setLineDash([4,4]);
  ctx.beginPath(); ctx.moveTo(TABLE.left+railW+4,hsY); ctx.lineTo(TABLE.right-railW-4,hsY); ctx.stroke();
  ctx.setLineDash([]);

  // лузы
  for(const p of POCKETS){
    ctx.fillStyle='#050508';
    ctx.beginPath(); ctx.arc(p.x,p.y,POCKET_R+2,0,Math.PI*2); ctx.fill();
    ctx.fillStyle='#101018';
    ctx.beginPath(); ctx.arc(p.x,p.y,POCKET_R-3,0,Math.PI*2); ctx.fill();
    ctx.strokeStyle='rgba(212,165,116,.35)'; ctx.lineWidth=1;
    ctx.beginPath(); ctx.arc(p.x,p.y,POCKET_R+2,0,Math.PI*2); ctx.stroke();
    ctx.fillStyle='#D4A574';
    ctx.font='bold 9px Inter, sans-serif'; ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillText('+'+p.pts, p.x, p.y+1);
  }

  // шары
  for(const b of balls){
    if(!b.active) continue;
    ctx.fillStyle='rgba(0,0,0,.4)';
    ctx.beginPath(); ctx.arc(b.x+2,b.y+3,b.r,0,Math.PI*2); ctx.fill();
    const grad=ctx.createRadialGradient(b.x-3,b.y-4,1,b.x,b.y,b.r);
    grad.addColorStop(0, lighten(b.color, 55));
    grad.addColorStop(0.7, b.color);
    grad.addColorStop(1, darken(b.color, 42));
    ctx.fillStyle=grad;
    ctx.beginPath(); ctx.arc(b.x,b.y,b.r,0,Math.PI*2); ctx.fill();
    if(b.cue){
      ctx.strokeStyle='rgba(255,255,255,.55)'; ctx.lineWidth=1;
      ctx.stroke();
    }
    if(b.label){
      ctx.fillStyle='rgba(10,10,15,.85)';
      ctx.beginPath(); ctx.arc(b.x,b.y,4.6,0,Math.PI*2); ctx.fill();
      ctx.fillStyle='#EDEDF0';
      ctx.font='bold 7px Inter, sans-serif'; ctx.textAlign='center'; ctx.textBaseline='middle';
      ctx.fillText(b.label, b.x, b.y+0.5);
    }
  }

  // прицеливание
  if(gameState==='aiming'&&touchActive){
    const dx=cueBall.x-dragX, dy=cueBall.y-dragY;
    const pull=Math.min(Math.sqrt(dx*dx+dy*dy), 120);
    if(pull>5){
      const powerRatio=pull/120;
      drawPowerBar(powerRatio);
      const angle=Math.atan2(dy,dx);
      const power=powerRatio*MAX_POWER;
      // кий
      const stickLen=40+pull*0.35;
      ctx.strokeStyle='#8B6B47';
      ctx.lineWidth=4.5; ctx.lineCap='round';
      ctx.beginPath();
      ctx.moveTo(cueBall.x+Math.cos(angle)*(BALL_R+4), cueBall.y+Math.sin(angle)*(BALL_R+4));
      ctx.lineTo(cueBall.x+Math.cos(angle)*stickLen, cueBall.y+Math.sin(angle)*stickLen);
      ctx.stroke();
      ctx.strokeStyle='#D4A574';
      ctx.lineWidth=1.5;
      ctx.beginPath();
      ctx.moveTo(cueBall.x+Math.cos(angle)*(BALL_R+4), cueBall.y+Math.sin(angle)*(BALL_R+4));
      ctx.lineTo(cueBall.x+Math.cos(angle)*(BALL_R+14), cueBall.y+Math.sin(angle)*(BALL_R+14));
      ctx.stroke();
      ctx.lineCap='butt';
      // траектории
      const sims=simulateTrajectory(cueBall.x, cueBall.y, Math.cos(angle)*power, Math.sin(angle)*power);
      for(const sim of sims){
        const dots=sim.dots;
        if(sim.idx===-1&&dots.length>1){
          ctx.strokeStyle='rgba(255,236,200,.22)';
          ctx.lineWidth=1.5; ctx.setLineDash([4,5]);
          ctx.beginPath(); ctx.moveTo(dots[0].x,dots[0].y);
          for(let i=1;i<dots.length;i++) ctx.lineTo(dots[i].x,dots[i].y);
          ctx.stroke(); ctx.setLineDash([]);
        }
        for(let i=0;i<dots.length;i++){
          const p=dots[i], alpha=0.5+0.45*(1-i/dots.length);
          ctx.fillStyle='rgba(255,255,255,.7)';
          ctx.beginPath(); ctx.arc(p.x,p.y,sim.dotR+1,0,Math.PI*2); ctx.fill();
          ctx.fillStyle=sim.color.replace('1)', alpha+')');
          ctx.beginPath(); ctx.arc(p.x,p.y,sim.dotR,0,Math.PI*2); ctx.fill();
        }
      }
    }
    ctx.strokeStyle='rgba(255,255,255,.3)'; ctx.lineWidth=1;
    ctx.beginPath(); ctx.arc(dragX,dragY,10,0,Math.PI*2); ctx.stroke();
  } else if(gameState==='aiming'&&!touchActive&&shotsLeft>0){
    ctx.fillStyle='rgba(237,237,240,.4)';
    ctx.font='13px Inter, sans-serif'; ctx.textAlign='center';
    ctx.fillText('Оттяни от белого шара и отпусти', cw/2, ch*0.965);
  }

  // частицы
  for(const p of particles){
    ctx.globalAlpha=Math.max(0,p.life/p.max);
    ctx.fillStyle=p.c;
    ctx.beginPath(); ctx.arc(p.x,p.y,p.r,0,Math.PI*2); ctx.fill();
  }
  ctx.globalAlpha=1;
}

function drawPowerBar(ratio){
  const barW=8, barH=76;
  const bx=TABLE.left-20, by=TABLE.bottom-barH-6;
  if(bx<6){ return; }
  ctx.fillStyle='rgba(0,0,0,.45)';
  roundRect(ctx,bx-1,by-1,barW+2,barH+2,4); ctx.fill();
  const fillH=barH*ratio;
  const grad=ctx.createLinearGradient(bx,by+barH,bx,by);
  grad.addColorStop(0,'#8B9D83'); grad.addColorStop(0.6,'#D4A574'); grad.addColorStop(1,'#E4545F');
  ctx.fillStyle=grad;
  roundRect(ctx,bx,by+barH-fillH,barW,fillH,3); ctx.fill();
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

// ---------- HUD ----------
function updateHUD(){
  el.score.textContent=score;
  el.daily.textContent=dailyBest;
  el.best.textContent=best;
  el.levelV.textContent=level;
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
  if(paused||gameState!=='flying'){ draw(); return; }
  delta=Math.min(delta,100);
  acc+=delta;
  let steps=0;
  while(acc>=STEP_MS&&steps<4){ update(); acc-=STEP_MS; steps++; }
  if(steps===4) acc=0;
  flushMissions();
  draw();
}

// частицы обновляем на каждый кадр независимо от состояния
setInterval(()=>{
  for(let i=particles.length-1;i>=0;i--){
    const p=particles[i];
    p.x+=p.vx; p.y+=p.vy; p.vy+=0.08; p.life--;
    if(p.life<=0) particles.splice(i,1);
  }
}, 16);

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
  const dx=cueBall.x-dragX, dy=cueBall.y-dragY;
  const pull=Math.sqrt(dx*dx+dy*dy);
  if(pull>10){
    const angle=Math.atan2(dy,dx);
    const power=Math.min(pull/120,1)*MAX_POWER;
    shoot(Math.cos(angle)*power, Math.sin(angle)*power);
  }
  touchActive=false;
}

// ---------- экраны ----------
function startGame(){
  el.welcome.classList.add('hidden');
  el.modal.classList.add('hidden');
  el.game.classList.remove('hidden');
  fitCanvas();
  score=0; level=1;
  loadLevel(1);
}
function toMenu(){
  el.game.classList.add('hidden');
  el.modal.classList.add('hidden');
  el.welcome.classList.remove('hidden');
  showWelcomeRecords();
}

$('btn-play').addEventListener('click',()=>{ snd.click(); startGame(); });
$('btn-new').addEventListener('click',()=>{ snd.click(); if(gameState!=='menu') loadLevel(level); });
$('btn-menu').addEventListener('click',()=>{ snd.click(); toMenu(); });
$('btn-missions').addEventListener('click',openMissions);
$('missions-chip').addEventListener('click',openMissions);
$('mmodal-btn').addEventListener('click',()=>{ snd.click(); el.mmodal.classList.add('hidden'); });
function openMissions(){ snd.click(); renderMissionsModal(); el.mmodal.classList.add('hidden'); el.mmodal.classList.remove('hidden'); }

function updateSoundBtn(){ $('btn-sound').textContent=muted?'🔇':'🔊'; }
$('btn-sound').addEventListener('click',()=>{
  muted=!muted; lsSet('billiards.muted', muted);
  updateSoundBtn(); if(!muted) snd.click();
});
updateSoundBtn();

document.addEventListener('visibilitychange',()=>{ paused=document.hidden; if(!document.hidden) lastT=0; });

function onResize(){
  if(el.game.classList.contains('hidden')) return;
  fitCanvas();
  // пересадить шары в границы нового стола
  for(const b of balls){
    b.x=clamp(b.x, TABLE.left+b.r, TABLE.right-b.r);
    b.y=clamp(b.y, TABLE.top+b.r, TABLE.bottom-b.r);
  }
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
window.__bl={
  get state(){ return gameState; },
  get score(){ return score; },
  get level(){ return level; },
  get ballsLeft(){ return balls.filter(b=>b.active&&!b.cue).length; },
  get best(){ return best; },
  get missionsDone(){ return missions.filter(m=>(mState[m.id]||{}).done).length; },
  strike(vx,vy){ if(gameState==='aiming') shoot(vx,vy); },
  flush(){ flushMissions(); },
};
