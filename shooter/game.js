'use strict';
/* Шутер — космический тир в стиле AXIIOM. canvas + vanilla JS, без зависимостей.
   Мета: вызов дня (seed от даты МСК), стрик-множитель, ежедневные миссии, рекорды.
   Пересборка: fixed timestep, сбалансированные дропы, честное мигание неуязвимости, без мёртвого кода. */

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
  score:$('score-val'), daily:$('daily-val'), best:$('best-val'), wlevelV:$('wlevel-val'),
  streakN:$('streak-n'), multN:$('mult-n'), missionsN:$('missions-n'), livesN:$('lives-n'),
  wDaily:$('w-daily-best'), wBest:$('w-best'), wStreak:$('w-streak'),
  modal:$('modal'), modalCard:$('modal-card'), modalBadge:$('modal-badge'), modalTitle:$('modal-title'), modalScore:$('modal-score'),
  mmodal:$('mmodal'), mlist:$('mmodal-list'), toasts:$('toasts'), dailyDate:$('daily-date'),
  decoRow:$('deco-row'), shieldFill:$('danger-fill')
};

// ---------- звук ----------
let AC=null;
let muted=lsGet('shooter.muted', false);
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
  shoot(){ tone(880+wlevel*60, 560, 0.06, 'square', 0.028); },
  boom(){ tone(140, 60, 0.3, 'sawtooth', 0.07); tone(70, 40, 0.35, 'square', 0.045); },
  hurt(){ tone(200, 110, 0.25, 'sawtooth', 0.07); tone(90, 60, 0.3, 'square', 0.04); },
  coin(){ tone(980, 980, 0.07, 'sine', 0.045); tone(1470, 1470, 0.09, 'sine', 0.04, 0.045); },
  power(){ [520,660,880].forEach((f,i)=>tone(f, f, 0.08, 'triangle', 0.04, i*0.05)); },
  over(){ [330,262,196].forEach((f,i)=>tone(f, f, 0.22, 'sine', 0.05, i*0.15)); },
  mission(){ tone(880, 880, 0.1, 'sine', 0.1); tone(1174, 1174, 0.16, 'sine', 0.1, 0.1); },
  record(){ [659,784,1047,1319].forEach((f,i)=>tone(f, f, 0.18, 'sine', 0.06, i*0.105)); },
  click(){ tone(440, 440, 0.04, 'sine', 0.05); }
};

// ---------- стрик ----------
const getMult = s => 1 + Math.min(Math.max(s-1,0),10)*0.05;
let streak = lsGet('shooter.streak', 0), lastDay = lsGet('shooter.lastDay', '');
function effStreak(){ return (lastDay===today || lastDay===yesterday) ? streak : 0; }
function refreshMult(){ mult = effStreak()>0 ? getMult(streak) : 1; }
function markDay(){
  if(lastDay===today){ mult=getMult(streak); return; }
  streak = (lastDay===yesterday) ? (streak||0)+1 : 1;
  lastDay = today;
  lsSet('shooter.streak', streak); lsSet('shooter.lastDay', lastDay);
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
  {id:'kills15',  t:()=>'Уничтожь 15 врагов за один полёт',        n:15},
  {id:'coins10',  t:()=>'Собери 10 монет (за день)',               n:10, cum:true},
  {id:'wlv5',     t:()=>'Прокачай оружие до 5 уровня',             n:5},
  {id:'score800', t:()=>'Набери 800 очков за один полёт',          n:800},
  {id:'tanks3',   t:()=>'Сбей 3 тяжёлых корабля (за день)',        n:3, cum:true},
  {id:'survive60',t:()=>'Продержись 60 секунд в одном полёте',     n:60},
  {id:'burst8',   t:()=>'Уничтожь 8 врагов за один полёт',         n:8},
  {id:'lives2',   t:()=>'Подбери 2 запасные жизни (за день)',      n:2, cum:true}
];
let missions=[], mState=lsGet('shooter.missions.'+today, {});
let mDirty=false;
function flushMissions(){ if(!mDirty) return; mDirty=false; lsSet('shooter.missions.'+today, mState); }
function pickMissions(){
  const seed = xmur3('shooter-missions-'+today)();
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

// ---------- поле ----------
let cw=0, ch=0, dpr=1;
function calcSizes(){
  PW=cw*0.075; PH=PW*1.35;
  EW=cw*0.065; EH=EW;
}
let PW=30, PH=40, EW=26, EH=26;

// ---------- состояние ----------
let mode='daily';
let running=false, over=false, paused=false;
let score=0, lives=3, wlevel=1;
let shield=100, maxShield=100, shieldCd=0;
let player={x:0,y:0}, touchX=null, touchY=null;
let bullets=[], enemyBullets=[], enemies=[], pickups=[], particles=[];
let stars=[];
let frameId=0, fireTimer=0, invuln=0;
let spawnTimer=0, gameTime=0;
let kills=0, coinsGot=0, tanksKilled=0, livesGot=0;
let animId=null, acc=0, lastT=0;
let rng=Math.random;
let dailyBest=lsGet('shooter.daily.'+today, 0), best=lsGet('shooter.best', 0);
let recordBeaten=false;

function fitCanvas(){
  const rect=canvas.parentElement.getBoundingClientRect();
  dpr=Math.min(window.devicePixelRatio||1, 2);
  cw=Math.floor(rect.width); ch=Math.floor(rect.height);
  canvas.width=cw*dpr; canvas.height=ch*dpr;
  canvas.style.width=cw+'px'; canvas.style.height=ch+'px';
  ctx.setTransform(dpr,0,0,dpr,0,0);
  calcSizes();
  initStars();
}

// ---------- оружие ----------
function weaponConfig(lvl){
  const cfg={rate:8, count:1, spread:0, speed:7, dmg:1, side:0};
  if(lvl>=2) cfg.rate=7;
  if(lvl>=3) cfg.rate=6;
  if(lvl>=4){ cfg.count=2; cfg.spread=0.15; }
  if(lvl>=5){ cfg.count=3; cfg.spread=0.12; }
  if(lvl>=6){ cfg.count=5; cfg.spread=0.1; cfg.side=1; }
  if(lvl>=7) cfg.speed=8;
  if(lvl>=8) cfg.dmg=2;
  if(lvl>=9) cfg.speed=10;
  return cfg;
}

// ---------- корабль игрока ----------
function drawShip(x, y){
  ctx.save();
  if(invuln>0 && Math.floor(invuln/8)%2===0) ctx.globalAlpha=0.35;
  const hw=PW/2, hh=PH/2;
  // свечение двигателя
  ctx.fillStyle=`rgba(232,176,75,${0.15+0.12*Math.sin(frameId*0.2)})`;
  ctx.beginPath(); ctx.ellipse(x, y+hh*0.6, PW*0.35, PH*0.12, 0, 0, Math.PI*2); ctx.fill();
  // крылья
  ctx.fillStyle='#D4A574';
  for(const m of [[-1,-0.25,-0.85,-0.8,0.15],[1,-0.25,0.85,-0.8,0.15]]){
    const s=m[0];
    ctx.beginPath();
    ctx.moveTo(x+s*hw*0.15, y-hh*0.05);
    ctx.lineTo(x+s*hw*0.85, y-hh*0.25);
    ctx.lineTo(x+s*hw*0.8, y+hh*0.15);
    ctx.lineTo(x+s*hw*0.15, y+hh*0.1);
    ctx.closePath(); ctx.fill();
  }
  ctx.fillStyle='#B08D57';
  for(const s of [-1,1]){
    ctx.beginPath();
    ctx.moveTo(x+s*hw*0.15, y+hh*0.2);
    ctx.lineTo(x+s*hw*0.78, y+hh*0.05);
    ctx.lineTo(x+s*hw*0.72, y+hh*0.5);
    ctx.lineTo(x+s*hw*0.15, y+hh*0.35);
    ctx.closePath(); ctx.fill();
  }
  // выхлопы на крыльях
  ctx.fillStyle=`rgba(232,176,75,${0.25+0.15*Math.sin(frameId*0.12)})`;
  for(const [ex,ey] of [[x-hw*0.78,y+hh*0.08],[x+hw*0.78,y+hh*0.08],[x-hw*0.71,y+hh*0.48],[x+hw*0.71,y+hh*0.48]]) ctx.fillRect(ex-2,ey,4,5);
  // фюзеляж
  ctx.fillStyle='#EDEDF0';
  roundRect(ctx, x-hw*0.18, y-hh*0.25, PW*0.36, PH*0.65, 3); ctx.fill();
  // нос
  ctx.fillStyle='#C9CDD4';
  ctx.beginPath();
  ctx.moveTo(x-hw*0.14, y-hh*0.25);
  ctx.lineTo(x, y-hh*0.55);
  ctx.lineTo(x+hw*0.14, y-hh*0.25);
  ctx.closePath(); ctx.fill();
  // кабина
  ctx.fillStyle='#3A9FD4';
  ctx.beginPath(); ctx.ellipse(x, y-hh*0.05, hw*0.08, hh*0.12, 0, 0, Math.PI*2); ctx.fill();
  // щит
  if(shield>0){
    const sa=shield/maxShield;
    ctx.strokeStyle=`rgba(139,157,131,${0.12+sa*0.25})`;
    ctx.lineWidth=1.5;
    ctx.beginPath(); ctx.arc(x, y, PW*1.1, 0, Math.PI*2); ctx.stroke();
  }
  ctx.restore();
}

// ---------- враги (AXIIOM-палитра) ----------
function hexPath(cx, cy, rx, ry){
  ctx.beginPath();
  for(let i=0;i<6;i++){
    const a=Math.PI/3*i-Math.PI/6;
    const px=cx+Math.cos(a)*rx, py=cy+Math.sin(a)*ry;
    i===0?ctx.moveTo(px,py):ctx.lineTo(px,py);
  }
  ctx.closePath();
}
function drawTank(e){
  const x=e.x, y=e.y, hw=e.w/2, hh=e.h/2;
  ctx.fillStyle='#4A5568';
  ctx.beginPath();
  ctx.moveTo(x, y-hh); ctx.lineTo(x-hw*1.2, y+hh); ctx.lineTo(x+hw*1.2, y+hh);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle='#5C6B80';
  ctx.fillRect(x-hw*0.3, y-hh*0.5, hw*0.6, hh*1.2);
  ctx.fillStyle='#D4A574';
  ctx.beginPath(); ctx.arc(x, y-hh*0.3, hw*0.15, 0, Math.PI*2); ctx.fill();
  ctx.fillStyle=`rgba(228,84,95,${0.2+0.1*Math.sin(frameId*0.15)})`;
  ctx.fillRect(x-hw*0.9, y+hh-4, hw*0.5, 4); ctx.fillRect(x+hw*0.4, y+hh-4, hw*0.5, 4);
  if(e.hp>1){ ctx.fillStyle='#E4545F'; ctx.fillRect(x-hw*0.25, y+hh-3, hw*0.5, 3); }
}
function drawTurret(e){
  const x=e.x, y=e.y, hw=e.w/2, hh=e.h/2;
  ctx.fillStyle='#3E4756';
  ctx.fillRect(x-hw*0.4, y-hh*0.6, hw*0.8, hh*1.2);
  ctx.fillStyle='#4A5568';
  ctx.beginPath(); ctx.arc(x, y-hh*0.6, hw*0.5, Math.PI, 0); ctx.fill();
  ctx.fillStyle='#6B7686';
  ctx.beginPath(); ctx.arc(x, y-hh*0.6, hw*0.25, Math.PI, 0); ctx.fill();
  ctx.fillStyle='#7A8595';
  ctx.fillRect(x-2, y-hh*0.6-6, 4, 8);
  ctx.fillStyle='#333B47';
  ctx.fillRect(x-hw*0.5, y+hh*0.5, hw, 5);
  ctx.fillStyle=`rgba(228,84,95,${0.15+0.1*Math.sin(frameId*0.1)})`;
  ctx.beginPath(); ctx.arc(x, y-hh*0.6-6, 4, 0, Math.PI*2); ctx.fill();
}
function drawFighter(e){
  const x=e.x, y=e.y, hw=e.w/2, hh=e.h/2;
  ctx.strokeStyle='#1A1A22'; ctx.lineWidth=0.5;
  ctx.fillStyle='#2A2A34';
  hexPath(x-hw*0.75, y, hw*0.65, hh*0.75); ctx.fill(); ctx.stroke();
  ctx.fillStyle='#1A1A22';
  hexPath(x-hw*0.75, y, hw*0.45, hh*0.55); ctx.fill();
  ctx.fillStyle='#2A2A34';
  hexPath(x+hw*0.75, y, hw*0.65, hh*0.75); ctx.fill(); ctx.stroke();
  ctx.fillStyle='#1A1A22';
  hexPath(x+hw*0.75, y, hw*0.45, hh*0.55); ctx.fill();
  ctx.fillStyle='#3A3A46';
  ctx.fillRect(x-hw*0.4, y-1, hw*0.8, 2);
  ctx.fillStyle='#22222B';
  ctx.beginPath(); ctx.arc(x, y, hw*0.3, 0, Math.PI*2); ctx.fill();
  ctx.fillStyle='#3E4756';
  ctx.beginPath(); ctx.arc(x, y, hw*0.15, 0, Math.PI*2); ctx.fill();
  ctx.fillStyle='#D4A574';
  ctx.beginPath(); ctx.arc(x, y, hw*0.08, 0, Math.PI*2); ctx.fill();
}
function drawBomber(e){
  const x=e.x, y=e.y, hw=e.w/2, hh=e.h/2;
  ctx.fillStyle='#2D2D38';
  for(const s of [-1,1]){
    ctx.beginPath();
    ctx.moveTo(x+s*hw*0.1, y-hh);
    ctx.lineTo(x+s*hw, y-hh*0.6);
    ctx.lineTo(x+s*hw, y+hh*0.6);
    ctx.lineTo(x+s*hw*0.1, y+hh);
    ctx.closePath(); ctx.fill();
  }
  ctx.fillStyle='#3A3A46';
  ctx.fillRect(x-hw*0.2, y-hh*0.5, hw*0.4, hh);
  ctx.fillStyle='#14141B';
  ctx.fillRect(x-hw*0.1, y, hw*0.2, hh*0.4);
  ctx.fillStyle='#D4A574';
  ctx.beginPath(); ctx.arc(x, y-hh*0.3, hw*0.1, 0, Math.PI*2); ctx.fill();
}
function drawInterceptor(e){
  const x=e.x, y=e.y, hw=e.w/2, hh=e.h/2;
  ctx.strokeStyle='#1A1A2E'; ctx.lineWidth=0.5;
  ctx.fillStyle='#2A2A44';
  for(const s of [-1,1]){
    ctx.beginPath();
    ctx.moveTo(x+s*hw*0.1, y-hh);
    ctx.lineTo(x+s*hw*1.1, y-hh*0.1);
    ctx.lineTo(x+s*hw*0.9, y+hh*0.5);
    ctx.lineTo(x+s*hw*0.1, y+hh);
    ctx.closePath(); ctx.fill(); ctx.stroke();
  }
  ctx.fillStyle='#1A1A2E';
  ctx.beginPath(); ctx.arc(x, y, hw*0.25, 0, Math.PI*2); ctx.fill();
  ctx.fillStyle='#7A8FC9';
  ctx.beginPath(); ctx.arc(x, y, hw*0.1, 0, Math.PI*2); ctx.fill();
}
function drawDefender(e){
  const x=e.x, y=e.y, hw=e.w/2, hh=e.h/2;
  ctx.fillStyle='#2A2A34'; ctx.strokeStyle='#1A1A22'; ctx.lineWidth=0.5;
  for(let i=0;i<3;i++){
    const a=i*2.094;
    const wx=x+Math.sin(a)*hh*0.3, wy=y-Math.cos(a)*hh*0.3;
    ctx.beginPath();
    ctx.moveTo(x,y);
    ctx.lineTo(wx-Math.cos(a)*hw*0.6, wy-Math.sin(a)*hw*0.6);
    ctx.lineTo(wx+Math.cos(a)*hw*0.6, wy+Math.sin(a)*hw*0.6);
    ctx.closePath(); ctx.fill(); ctx.stroke();
  }
  ctx.fillStyle='#3A3A46';
  ctx.beginPath(); ctx.arc(x, y, hw*0.35, 0, Math.PI*2); ctx.fill();
  ctx.fillStyle='#8B9D83';
  ctx.beginPath(); ctx.arc(x, y, hw*0.15, 0, Math.PI*2); ctx.fill();
  ctx.strokeStyle=`rgba(139,157,131,${0.15+0.1*Math.sin(frameId*0.12)})`;
  ctx.lineWidth=1;
  ctx.beginPath(); ctx.arc(x, y, hw*0.5, 0, Math.PI*2); ctx.stroke();
}
function drawProbe(e){
  const x=e.x, y=e.y, hw=e.w/2, hh=e.h/2;
  ctx.fillStyle='#4A5568';
  ctx.beginPath(); ctx.arc(x, y, hw*0.7, 0, Math.PI*2); ctx.fill();
  ctx.fillStyle='#5C6B80';
  ctx.beginPath(); ctx.arc(x, y, hw*0.45, 0, Math.PI*2); ctx.fill();
  ctx.fillStyle='#C96A6A';
  ctx.beginPath(); ctx.arc(x, y, hw*0.2, 0, Math.PI*2); ctx.fill();
  ctx.strokeStyle='#7A8595'; ctx.lineWidth=0.5;
  ctx.beginPath(); ctx.moveTo(x, y-hh*0.7); ctx.lineTo(x+hw*0.3, y-hh*1.1); ctx.stroke();
  ctx.beginPath(); ctx.arc(x+hw*0.3, y-hh*1.1, 2, 0, Math.PI*2); ctx.fill();
}
function drawPod(p){
  const x=p.x, y=p.y;
  ctx.fillStyle='#6B7686';
  ctx.beginPath(); ctx.ellipse(x, y, 4, 6, 0, 0, Math.PI*2); ctx.fill();
  ctx.fillStyle='#4A5568';
  ctx.beginPath(); ctx.arc(x, y+4, 4, Math.PI, 0); ctx.fill();
  ctx.fillStyle='#D4A574';
  ctx.beginPath(); ctx.arc(x, y-1, 2, 0, Math.PI*2); ctx.fill();
  ctx.fillStyle='rgba(232,176,75,.4)';
  ctx.fillRect(x-3, y+5, 2, 3); ctx.fillRect(x+1, y+5, 2, 3);
}
function drawPickup(p){
  const pulse=1+0.12*Math.sin(frameId*0.08+p.x);
  if(p.type==='coin'){
    ctx.fillStyle='#E8B04B';
    ctx.beginPath(); ctx.arc(p.x, p.y, 7*pulse, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle='#B08D57';
    ctx.beginPath(); ctx.arc(p.x, p.y, 4.4*pulse, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle='#14100B';
    ctx.font='bold 7px Inter, sans-serif'; ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillText('★', p.x, p.y+0.5);
  } else if(p.type==='life'){
    const s=6*pulse;
    ctx.fillStyle='rgba(228,84,95,.2)';
    ctx.beginPath(); ctx.arc(p.x, p.y, s*1.4, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle='#E4545F';
    ctx.beginPath();
    ctx.moveTo(p.x, p.y+s*0.3);
    ctx.bezierCurveTo(p.x, p.y+s*0.8, p.x-s*0.7, p.y+s*0.2, p.x, p.y-s*0.3);
    ctx.bezierCurveTo(p.x+s*0.7, p.y+s*0.2, p.x, p.y+s*0.8, p.x, p.y+s*0.3);
    ctx.fill();
  } else {
    ctx.fillStyle='#2A2116';
    roundRect(ctx, p.x-8, p.y-7, 16, 14, 3); ctx.fill();
    ctx.strokeStyle='rgba(212,165,116,.7)'; ctx.lineWidth=1;
    roundRect(ctx, p.x-8, p.y-7, 16, 14, 3); ctx.stroke();
    ctx.fillStyle='#E8B04B';
    ctx.font='bold 9px Inter, sans-serif'; ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillText('P', p.x, p.y+0.5);
  }
}
function roundRect(c,x,y,w,h,r){ r=Math.min(r,w/2,h/2); c.beginPath(); c.moveTo(x+r,y); c.arcTo(x+w,y,x+w,y+h,r); c.arcTo(x+w,y+h,x,y+h,r); c.arcTo(x,y+h,x,y,r); c.arcTo(x,y,x+w,y,r); c.closePath(); }

// ---------- фон ----------
function initStars(){
  stars=[];
  for(let i=0;i<46;i++) stars.push({x:Math.random()*cw, y:Math.random()*ch, s:0.4+Math.random()*1.8, sp:0.2+Math.random()*0.8});
}
function drawBackground(){
  ctx.fillStyle='#06060E';
  ctx.fillRect(0,0,cw,ch);
  for(const s of stars){
    ctx.fillStyle=`rgba(255,255,255,${0.3+0.7*(s.s-0.3)})`;
    ctx.beginPath(); ctx.arc(s.x, s.y, s.s*0.6, 0, Math.PI*2); ctx.fill();
  }
}

// ---------- спавн ----------
function spawnEnemy(){
  const r=rng();
  if(r<0.18)      enemies.push({type:'tank',        x:10+rng()*(cw-20), y:-20, w:22, h:14, hp:2, pts:25, shootTimer:60+rng()*80, tank:true});
  else if(r<0.30) enemies.push({type:'turret',      x:10+rng()*(cw-20), y:-20, w:16, h:18, hp:1, pts:15, shootTimer:30+rng()*40});
  else if(r<0.50) enemies.push({type:'fighter',     x:Math.random()*cw, y:-20, w:EW, h:EH, hp:1, pts:10, vx:(rng()-0.5)*1.2, shootTimer:40+rng()*60});
  else if(r<0.65) enemies.push({type:'interceptor', x:Math.random()*cw, y:-20, w:EW*0.85, h:EH*0.85, hp:1, pts:15, vx:(rng()-0.5)*2.5, shootTimer:25+rng()*35});
  else if(r<0.78) enemies.push({type:'defender',    x:10+rng()*(cw-20), y:-20, w:24, h:16, hp:3, pts:30, shootTimer:50+rng()*40});
  else            enemies.push({type:'probe',       x:Math.random()*cw, y:-20, w:14, h:14, hp:1, pts:10, vx:(rng()-0.5)*1.5, shootTimer:30+rng()*30});
}
function tryDropBomber(){
  enemies.push({type:'bomber', x:Math.random()*cw, y:-20, w:EW*1.3, h:EH*0.8, hp:3, pts:25, vx:(rng()-0.5), vy:0.8, dropTimer:30});
}

// ---------- забег ----------
function resetRun(){
  fitCanvas();
  player.x=cw/2; player.y=ch*0.7;
  bullets=[]; enemyBullets=[]; enemies=[]; pickups=[]; particles=[];
  lives=3; score=0; wlevel=1; shield=maxShield; shieldCd=0;
  frameId=0; fireTimer=0; invuln=0; spawnTimer=0; gameTime=0;
  kills=0; coinsGot=0; tanksKilled=0; livesGot=0;
  recordBeaten=false; touchX=null; touchY=null;
  rng=(mode==='daily')?mulberry32(xmur3('shooter-daily-'+today)()):Math.random;
  updateHUD();
}

function update(){
  frameId++;
  gameTime+=1/60;
  if(invuln>0) invuln--;
  if(shieldCd>0) shieldCd--;
  else if(shield<maxShield) shield=Math.min(maxShield, shield+0.2);

  for(const s of stars){ s.y+=s.sp; if(s.y>ch){ s.y=-2; s.x=Math.random()*cw; } }

  if(touchX!==null&&touchY!==null){
    const tx=clamp(touchX, PW/2, cw-PW/2);
    const ty=clamp(touchY, PH/2, ch-PH/2);
    player.x+=(tx-player.x)*0.15;
    player.y+=(ty-player.y)*0.15;
  }

  // автоогонь
  const w=weaponConfig(wlevel);
  if(++fireTimer>=w.rate){
    fireTimer=0;
    if(w.count===1){
      snd.shoot();
      bullets.push({x:player.x, y:player.y-PH/2, vx:0, vy:-w.speed, dmg:w.dmg});
    } else {
      const n=w.count-(w.side>0?2:0);
      for(let i=0;i<n;i++){
        const off=(i-(n-1)/2)*w.spread;
        bullets.push({x:player.x+off*15, y:player.y-PH/2, vx:off*0.5, vy:-w.speed, dmg:w.dmg});
      }
      if(w.side){
        bullets.push({x:player.x-PW/2-4, y:player.y, vx:-w.speed*0.7, vy:-w.speed*0.1, dmg:w.dmg});
        bullets.push({x:player.x+PW/2+4, y:player.y, vx:w.speed*0.7, vy:-w.speed*0.1, dmg:w.dmg});
      }
    }
  }

  for(let i=bullets.length-1;i>=0;i--){
    const b=bullets[i];
    b.x+=b.vx; b.y+=b.vy;
    if(b.y+8<0||b.x+3<0||b.x-3>cw) bullets.splice(i,1);
  }
  for(let i=enemyBullets.length-1;i>=0;i--){
    const b=enemyBullets[i];
    b.x+=b.vx; b.y+=b.vy;
    if(b.y>ch+20||b.x<-20||b.x>cw+20) enemyBullets.splice(i,1);
  }

  // спавн
  const interval=Math.max(38, 70-Math.floor(score/1000)*4);
  spawnTimer++;
  if(spawnTimer>=interval){
    spawnTimer=0;
    spawnEnemy();
    if(frameId>300&&rng()<0.08) tryDropBomber();
  }

  // враги
  const speedBonus=Math.floor(score/1000)*0.1;
  const scrollSpeed=Math.min(0.6+speedBonus, 1.8);
  for(let i=enemies.length-1;i>=0;i--){
    const e=enemies[i];
    e.y+=scrollSpeed;
    if(e.type==='tank'||e.type==='turret'||e.type==='defender'){
      e.shootTimer--;
      if(e.shootTimer<=0){
        const spd=e.type==='turret'?2.5:e.type==='defender'?2:1.5;
        e.shootTimer = e.type==='turret'?25+rng()*20 : e.type==='defender'?50+rng()*40 : 70+rng()*40;
        const dx=player.x-e.x, dy=player.y-e.y;
        const d=Math.sqrt(dx*dx+dy*dy)||1;
        enemyBullets.push({x:e.x, y:e.y+5, vx:dx/d*spd, vy:dy/d*spd});
      }
    } else {
      e.x+=e.vx||0;
      e.shootTimer--;
      if(e.shootTimer<=0){
        e.shootTimer = e.type==='interceptor'?30+rng()*25 : e.type==='probe'?40+rng()*30 : 50+rng()*40;
        enemyBullets.push({x:e.x, y:e.y+EH/2, vx:(rng()-0.5)*0.3, vy:2});
      }
      if(e.type==='bomber'&&--e.dropTimer<=0){
        e.dropTimer=50;
        pickups.push({x:e.x+(rng()-0.5)*10, y:e.y+EH/2, type:'pod', vy:0.6});
      }
    }
    if(e.y>ch+40) enemies.splice(i,1);
  }

  // капсулы: поймал = +100
  for(let i=pickups.length-1;i>=0;i--){
    const p=pickups[i];
    if(p.type==='pod'){
      p.y+=p.vy;
      if(p.y>ch+10){ pickups.splice(i,1); continue; }
      if(Math.abs(p.x-player.x)<PW/2+6&&Math.abs(p.y-player.y)<PH/2+6){
        score+=100; snd.coin(); burst(p.x,p.y,'#E8B04B',8); pickups.splice(i,1);
      }
      continue;
    }
    p.y+=1.2;
    if(p.y>ch+20){ pickups.splice(i,1); continue; }
    if(Math.abs(p.x-player.x)<PW/2+10&&Math.abs(p.y-player.y)<PH/2+10){
      if(p.type==='coin'){ score+=100; coinsGot++; snd.coin(); burst(p.x,p.y,'#E8B04B',8); missionProgress('coins10',1); }
      if(p.type==='life'){ lives=Math.min(5,lives+1); livesGot++; snd.power(); burst(p.x,p.y,'#E4545F',10); missionProgress('lives2',1); el.livesN.textContent=lives; }
      if(p.type==='upgrade'){ wlevel=Math.min(9,wlevel+1); snd.power(); burst(p.x,p.y,'#8B9D83',10); missionProgress('wlv5',wlevel); el.wlevelV.textContent=wlevel; }
      pickups.splice(i,1);
    }
  }

  // пули → враги
  for(let i=bullets.length-1;i>=0;i--){
    const b=bullets[i];
    for(let j=enemies.length-1;j>=0;j--){
      const e=enemies[j];
      if(Math.abs(b.x-e.x)<e.w/2+3&&Math.abs(b.y-e.y)<e.h/2+4){
        bullets.splice(i,1);
        e.hp-=b.dmg;
        burst(e.x, e.y, '#8B9D83', 4);
        if(e.hp<=0){
          score+=e.pts; kills++;
          snd.boom();
          burst(e.x, e.y, '#E4545F', 12);
          if(e.tank){ tanksKilled++; missionProgress('tanks3',1); }
          missionProgress('kills15', kills);
          missionProgress('burst8', kills);
          const r=rng();
          // сбалансированные дропы: монета 20%, апгрейд 9%, жизнь 5%
          if(r<0.20)      pickups.push({x:e.x, y:e.y, type:'coin'});
          else if(r<0.29) pickups.push({x:e.x, y:e.y, type:'upgrade'});
          else if(r<0.34) pickups.push({x:e.x, y:e.y, type:'life'});
          enemies.splice(j,1);
        }
        break;
      }
    }
  }

  // вражеские пули → игрок
  if(shieldCd<=0&&invuln<=0){
    for(let i=enemyBullets.length-1;i>=0;i--){
      const b=enemyBullets[i];
      if(Math.abs(b.x-player.x)<PW/2+3&&Math.abs(b.y-player.y)<PH/2+4){
        enemyBullets.splice(i,1);
        hitPlayer(25);
        break;
      }
    }
  }
  if(shieldCd<=0&&invuln<=0){
    for(const e of enemies){
      if(Math.abs(e.x-player.x)<PW/2+e.w/2&&Math.abs(e.y-player.y)<PH/2+e.h/2){
        hitPlayer(35);
        e.hp--;
        if(e.hp<=0){ score+=5; enemies.splice(enemies.indexOf(e),1); }
        break;
      }
    }
  }

  for(let i=particles.length-1;i>=0;i--){
    const p=particles[i];
    p.x+=p.vx; p.y+=p.vy; p.life--;
    if(p.life<=0) particles.splice(i,1);
  }

  // миссии процесса
  missionProgress('score800', score);
  missionProgress('survive60', Math.floor(gameTime));

  if(over) return;
  el.shieldFill.style.width=(shield/maxShield*100)+'%';
}

function hitPlayer(dmg){
  if(shield>0){
    shield=Math.max(0, shield-dmg);
    shieldCd=15;
    burst(player.x, player.y, '#8B9D83', 8);
    return;
  }
  lives--;
  invuln=90;
  burst(player.x, player.y, '#E4545F', 10);
  el.livesN.textContent=lives;
  snd.hurt();
  if(lives<=0){ over=true; snd.over(); burst(player.x, player.y, '#E4545F', 30); gameOver(); }
}

function burst(x, y, color, n){
  for(let i=0;i<n;i++) particles.push({x, y, vx:(Math.random()-0.5)*5, vy:(Math.random()-0.5)*5, life:25+Math.random()*20, max:45, color, r:1.5+Math.random()*3});
}

// ---------- отрисовка ----------
function draw(){
  ctx.clearRect(0,0,cw,ch);
  drawBackground();
  for(const p of pickups) p.type==='pod'?drawPod(p):drawPickup(p);
  for(const b of enemyBullets){
    ctx.fillStyle='#E4545F';
    ctx.shadowColor='#E4545F'; ctx.shadowBlur=6;
    ctx.fillRect(b.x-1.5, b.y-2.5, 3, 5);
    ctx.shadowBlur=0;
  }
  for(const e of enemies){
    if(e.type==='tank') drawTank(e);
    else if(e.type==='turret') drawTurret(e);
    else if(e.type==='bomber') drawBomber(e);
    else if(e.type==='interceptor') drawInterceptor(e);
    else if(e.type==='defender') drawDefender(e);
    else if(e.type==='probe') drawProbe(e);
    else drawFighter(e);
  }
  for(const b of bullets){
    ctx.fillStyle=b.dmg>1?'#E8B04B':'#8B9D83';
    ctx.shadowColor=ctx.fillStyle; ctx.shadowBlur=6;
    ctx.fillRect(b.x-1.5, b.y-4, 3, 8);
    ctx.shadowBlur=0;
  }
  for(const p of particles){
    ctx.globalAlpha=Math.max(0,p.life/p.max);
    ctx.fillStyle=p.color;
    ctx.beginPath(); ctx.arc(p.x,p.y,p.r,0,Math.PI*2); ctx.fill();
  }
  ctx.globalAlpha=1;
  if(!over) drawShip(player.x, player.y);
}

// ---------- HUD/финал ----------
function updateHUD(){
  el.score.textContent=score;
  el.daily.textContent=dailyBest;
  el.best.textContent=best;
  el.wlevelV.textContent=wlevel;
  el.livesN.textContent=lives;
  el.shieldFill.style.width=(shield/maxShield*100)+'%';
}
function showWelcomeRecords(){
  el.wDaily.textContent=dailyBest;
  el.wBest.textContent=best;
  el.wStreak.textContent='🔥 '+effStreak();
}
function gameOver(){
  running=false;
  draw();
  const final=Math.round(score*mult);
  markDay();
  const isDailyRec=final>dailyBest;
  if(isDailyRec){ dailyBest=final; lsSet('shooter.daily.'+today, dailyBest); }
  const isRec=final>best;
  if(isRec){ best=final; lsSet('shooter.best', best); }
  snd[isRec?'record':'click']();
  missionProgress('kills15', kills);
  missionProgress('burst8', kills);
  missionProgress('score800', score);
  flushMissions();
  el.modalBadge.textContent=isRec?'Новый рекорд':'Полёт окончен';
  el.modalBadge.classList.toggle('record', isRec);
  el.modalCard.classList.toggle('modal-record', isRec);
  el.modalTitle.textContent=isRec?'Ас пустоты':'Корабль сбит';
  el.modalScore.innerHTML=`Очки: <b>${score}</b>${mult>1?` ×<b>${mult.toFixed(2)}</b> = <b>${final}</b>`:''} · Сбитых: <b>${kills}</b> · Оружие: <b>Lv.${wlevel}</b><br>Рекорд: <b>${best}</b>`;
  el.modal.classList.remove('hidden');
  showWelcomeRecords(); updateHUD();
}

// ---------- цикл ----------
function loop(now){
  animId=requestAnimationFrame(loop);
  if(!lastT) lastT=now;
  let delta=now-lastT; lastT=now;
  if(paused||!running){ draw(); return; }
  delta=Math.min(delta,100);
  acc+=delta;
  let steps=0;
  while(acc>=STEP_MS&&steps<4){ update(); acc-=STEP_MS; steps++; if(over) break; }
  if(steps===4) acc=0;
  flushMissions();
  updateHUD();
  draw();
}

// ---------- ввод ----------
function onPointer(cx, cy){
  const rect=canvas.getBoundingClientRect();
  touchX=cx-rect.left; touchY=cy-rect.top;
}
canvas.addEventListener('touchstart',e=>{ e.preventDefault(); const t=e.touches[0]; onPointer(t.clientX,t.clientY); },{passive:false});
canvas.addEventListener('touchmove', e=>{ e.preventDefault(); const t=e.touches[0]; onPointer(t.clientX,t.clientY); },{passive:false});
canvas.addEventListener('touchend',  ()=>{ touchX=null; touchY=null; });
canvas.addEventListener('touchcancel',()=>{ touchX=null; touchY=null; });
canvas.addEventListener('mousedown', e=>onPointer(e.clientX,e.clientY));
canvas.addEventListener('mousemove', e=>{ if(e.buttons&1) onPointer(e.clientX,e.clientY); });
canvas.addEventListener('mouseup',   ()=>{ touchX=null; touchY=null; });
canvas.addEventListener('mouseleave',()=>{ touchX=null; touchY=null; });

// ---------- экраны ----------
function startGame(){
  el.welcome.classList.add('hidden');
  el.modal.classList.add('hidden');
  el.game.classList.remove('hidden');
  resetRun();
  running=true; over=false; paused=false;
  lastT=0; acc=0;
  if(!animId) animId=requestAnimationFrame(loop);
}
function toMenu(){
  running=false; over=false;
  el.game.classList.add('hidden');
  el.modal.classList.add('hidden');
  el.welcome.classList.remove('hidden');
  showWelcomeRecords();
}

$('btn-play').addEventListener('click',()=>{ snd.click(); startGame(); });
$('btn-new').addEventListener('click',()=>{ snd.click(); startGame(); });
$('btn-menu').addEventListener('click',()=>{ snd.click(); toMenu(); });
$('modal-btn').addEventListener('click',()=>{ snd.click(); startGame(); });
$('btn-missions').addEventListener('click',openMissions);
$('missions-chip').addEventListener('click',openMissions);
$('mmodal-btn').addEventListener('click',()=>{ snd.click(); el.mmodal.classList.add('hidden'); });
function openMissions(){ snd.click(); renderMissionsModal(); el.mmodal.classList.remove('hidden'); }

function updateSoundBtn(){ $('btn-sound').textContent=muted?'🔇':'🔊'; }
$('btn-sound').addEventListener('click',()=>{
  muted=!muted; lsSet('shooter.muted', muted);
  updateSoundBtn(); if(!muted) snd.click();
});
updateSoundBtn();

function setMode(m){
  mode=m;
  $('mode-daily').classList.toggle('active', m==='daily');
  $('mode-free').classList.toggle('active', m==='free');
}
$('mode-daily').addEventListener('click',()=>{ snd.click(); setMode('daily'); });
$('mode-free').addEventListener('click', ()=>{ snd.click(); setMode('free'); });

document.addEventListener('visibilitychange',()=>{ paused=document.hidden; if(!document.hidden) lastT=0; });

function onResize(){
  if(el.game.classList.contains('hidden')) return;
  const oldCh=ch;
  fitCanvas();
  player.y=clamp(player.y, PH/2, ch-PH/2);
  player.x=clamp(player.x, PW/2, cw-PW/2);
}
window.addEventListener('resize', onResize);
if(window.visualViewport) window.visualViewport.addEventListener('resize', onResize);

['keydown','pointerdown','touchstart'].forEach(ev=>document.addEventListener(ev, audio, {passive:true}));

// ---------- init ----------
(function init(){
  for(let i=0;i<7;i++) el.decoRow.appendChild(document.createElement('i'));
  el.dailyDate.textContent='Вызов дня · '+today;
  pickMissions(); renderMissionsChip();
  showWelcomeRecords(); updateHUD();
  fitCanvas();
  animId=requestAnimationFrame(loop);
})();

// ---------- debug hooks ----------
window.__sh={
  get state(){ return running&&!over?'play':(over?'over':'ui'); },
  get score(){ return score; },
  get lives(){ return lives; },
  get kills(){ return kills; },
  get wlevel(){ return wlevel; },
  get best(){ return best; },
  get mode(){ return mode; },
  get missionsDone(){ return missions.filter(m=>(mState[m.id]||{}).done).length; },
  setScore(v){ score=v; },
  spawnTank(){ enemies.push({type:'tank', x:player.x, y:player.y-60, w:22, h:14, hp:1, pts:25, shootTimer:999, tank:true}); },
  start(){ startGame(); },
};
