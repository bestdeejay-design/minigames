'use strict';
/* Coin Tap — монетный дождь в стиле AXIIOM. canvas + vanilla JS, без зависимостей.
   Мета: вызов дня (seed от даты МСК), стрик-множитель, ежедневные миссии, рекорды.
   Пересборка: полностью векторные предметы (без эмодзи), fixed timestep, миссии, стрик. */

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
  levelV:$('level-val'), daily:$('daily-val'), best:$('best-val'), livesV:$('lives-val'),
  streakN:$('streak-n'), multN:$('mult-n'), missionsN:$('missions-n'), targetN:$('target-n'),
  wDaily:$('w-daily-best'), wBest:$('w-best'), wStreak:$('w-streak'),
  modal:$('modal'), modalCard:$('modal-card'), modalBadge:$('modal-badge'), modalTitle:$('modal-title'),
  modalScore:$('modal-score'), modalLegend:$('modal-legend'), modalBtn:$('modal-btn'),
  mmodal:$('mmodal'), mlist:$('mmodal-list'), toasts:$('toasts'), dailyDate:$('daily-date'),
  decoRow:$('deco-row')
};

// ---------- звук ----------
let AC=null;
let muted=lsGet('cointap.muted', false);
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
let comboPitch=0;
const snd={
  coin(){ comboPitch=Math.min(9, comboPitch+1); tone(760+comboPitch*70, 760+comboPitch*70, 0.08, 'sine', 0.05); tone(1140+comboPitch*70, 1140+comboPitch*70, 0.09, 'sine', 0.04, 0.04); },
  bomb(){ tone(150, 60, 0.35, 'sawtooth', 0.09); tone(75, 40, 0.4, 'square', 0.05); },
  power(){ [520,660,880].forEach((f,i)=>tone(f, f, 0.09, 'triangle', 0.045, i*0.055)); },
  shield(){ tone(980, 1200, 0.14, 'triangle', 0.05); },
  win(){ [523,659,784,1047].forEach((f,i)=>tone(f, f, 0.16, 'sine', 0.06, i*0.095)); },
  over(){ [392,330,262,196].forEach((f,i)=>tone(f, f, 0.2, 'sine', 0.05, i*0.13)); },
  mission(){ tone(880, 880, 0.1, 'sine', 0.1); tone(1174, 1174, 0.16, 'sine', 0.1, 0.1); },
  record(){ [659,784,1047,1319].forEach((f,i)=>tone(f, f, 0.18, 'sine', 0.06, i*0.105)); },
  click(){ tone(440, 440, 0.04, 'sine', 0.05); }
};

// ---------- стрик ----------
const getMult = s => 1 + Math.min(Math.max(s-1,0),10)*0.05;
let streak = lsGet('cointap.streak', 0), lastDay = lsGet('cointap.lastDay', '');
function effStreak(){ return (lastDay===today || lastDay===yesterday) ? streak : 0; }
function refreshMult(){ mult = effStreak()>0 ? getMult(streak) : 1; }
function markDay(){
  if(lastDay===today){ mult=getMult(streak); return; }
  streak = (lastDay===yesterday) ? (streak||0)+1 : 1;
  lastDay = today;
  lsSet('cointap.streak', streak); lsSet('cointap.lastDay', lastDay);
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
  {id:'level3',    t:()=>'Дойди до 3-го уровня',                    n:3},
  {id:'level5',    t:()=>'Дойди до 5-го уровня',                    n:5},
  {id:'coins25',   t:()=>'Собери 25 монет (за день)',               n:25, cum:true},
  {id:'golds10',   t:()=>'Собери 10 золотых монет (за день)',       n:10, cum:true},
  {id:'shield2',   t:()=>'Спасись щитом от 2 бомб (за день)',       n:2, cum:true},
  {id:'nobomb2',   t:()=>'Пройди 2 уровня без бомб (за день)',      n:2, cum:true},
  {id:'magnet2',   t:()=>'Активируй 2 магнита (за день)',           n:2, cum:true},
  {id:'full3',     t:()=>'Пройди уровень без потери жизней',        n:1}
];
let missions=[], mState=lsGet('cointap.missions.'+today, {});
let mDirty=false;
function flushMissions(){ if(!mDirty) return; mDirty=false; lsSet('cointap.missions.'+today, mState); }
function pickMissions(){
  const seed = xmur3('cointap-missions-'+today)();
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

// ---------- типы предметов (вектор) ----------
const TYPES={
  coin:   {size:30, points:1, color:'#E8B04B', label:'Монета +1'},
  gold:   {size:36, points:3, color:'#E8C9A0', label:'Золотая +3'},
  bomb:   {size:28, points:0, color:'#E4545F', label:'Бомба — не тапай'},
  magnet: {size:24, points:0, color:'#7A6A8F', label:'Магнит — тянет монеты'},
  slow:   {size:24, points:0, color:'#5F7E8A', label:'Замедление'},
  curse:  {size:24, points:0, color:'#6B4E7E', label:'Проклятье — сжимает'},
  speed:  {size:24, points:0, color:'#C96A6A', label:'Ускорение — опасно'},
  shield: {size:24, points:0, color:'#8B9D83', label:'Щит от одной бомбы'},
};
const TYPE_KEYS=Object.keys(TYPES);

const GROUP_SUBS=[
  {text:'Собери монеты — тапай по ним!'},
  {text:'Золотые монеты дают +3'},
  {text:'Появились бомбы — не задень их', types:['coin','gold','bomb']},
  {text:'Магниты притягивают монеты к центру', types:['coin','gold','bomb','magnet']},
  {text:'Замедление и проклятье в mixes', types:['coin','gold','bomb','magnet','slow','curse']},
  {text:'Всё сразу — держи фокус!', types:TYPE_KEYS},
];

function getLevelConfig(level){
  const t=Math.min((level-1)/49, 1);
  const group = level<=3?0 : level<=6?1 : level<=10?2 : level<=20?3 : level<=35?4 : 5;
  const targets=[3,5,7,10,10,10];
  const spawnIntervals=[46,44,42,39,35,30];   // в шагах (1/60 c)
  const speedMults=[1,1.2,1.5,1.9,2.4,3.2];
  const weightsByGroup=[
    {coin:100},
    {coin:85, gold:15},
    {coin:75, gold:10, bomb:10, magnet:5},
    {coin:60, gold:8, bomb:15, magnet:5, slow:5, curse:4, speed:2, shield:1},
    {coin:45, gold:5, bomb:20, magnet:5, slow:5, curse:7, speed:8, shield:5},
    {coin:30, gold:3, bomb:27, magnet:5, slow:5, curse:10, speed:12, shield:8},
  ];
  const w=weightsByGroup[group];
  return {
    spawnInterval: Math.round((spawnIntervals[group]||46)-t*9),
    speedMult:(speedMults[group]||1)+t*0.6,
    target:targets[group],
    group, weights:w, types:Object.keys(w),
  };
}

// ---------- траектории ----------
function pickTrajectory(level){
  const r=rng();
  if(level<=5){ if(r<0.6) return 'straight'; if(r<0.9) return 'sine'; return 'zigzag'; }
  if(level<=15){ if(r<0.35) return 'straight'; if(r<0.55) return 'sine'; if(r<0.73) return 'zigzag'; if(r<0.88) return 'diagonal'; return 'bounce'; }
  if(r<0.2) return 'straight';
  if(r<0.38) return 'sine';
  if(r<0.55) return 'zigzag';
  if(r<0.73) return 'diagonal';
  return 'bounce';
}

// ---------- состояние ----------
let mode='daily';
let cw=0, ch=0, dpr=1;
let level=1, score=0, lives=3, hasShield=false;
let items=[], pops=[], effects={};
let shake=0, spawnTimer=0, stunTimer=0;
let gameRunning=false, itemId=0, cfg=null;
let levelBombHits=0, levelLostLives=0, comboWindow=[], lastCoinStep=-999;
let animId=null, acc=0, lastT=0, frameId=0, paused=false;
let rng=Math.random;
let dailyBest=lsGet('cointap.daily.'+today, 0), best=lsGet('cointap.level', 0);
let coinsTotal=0, goldsTotal=0;

function fitCanvas(){
  const rect=canvas.parentElement.getBoundingClientRect();
  dpr=Math.min(window.devicePixelRatio||1, 2);
  cw=Math.floor(rect.width); ch=Math.floor(rect.height);
  canvas.width=cw*dpr; canvas.height=ch*dpr;
  canvas.style.width=cw+'px'; canvas.style.height=ch+'px';
  ctx.setTransform(dpr,0,0,dpr,0,0);
}

// ---------- предмет ----------
class Item{
  constructor(type){
    this.id=itemId++;
    this.type=type;
    this.info=TYPES[type];
    this.size=this.info.size;
    this.x=this.size+Math.random()*(cw-this.size*2);
    this.y=-this.size;
    this.baseSpeed=2.5*(cfg?cfg.speedMult:1);
    this.collected=false;
    this.rot=Math.random()*Math.PI*2;
    this.sparkle=Math.random()*100;
    this.trajectory=pickTrajectory(level);
    this.startX=this.x;
    this.txPhase=Math.random()*Math.PI*2;
    this.diagDir=Math.random()<0.5?-1:1;
    this.bounceDir=Math.random()<0.5?-1:1;
  }
  getSpeed(){
    let s=this.baseSpeed;
    if(effects.slow) s*=0.45;
    if(effects.speed) s*=2.2;
    return s;
  }
  update(){
    if(this.collected) return;
    const speed=this.getSpeed();
    this.y+=speed;
    if(this.trajectory==='sine'){
      this.x=this.startX+Math.sin(this.y*0.04+this.txPhase)*55;
    } else if(this.trajectory==='zigzag'){
      this.x=this.startX+Math.sin(Math.floor(this.y*0.06)*1.2+this.txPhase)*45;
    } else if(this.trajectory==='diagonal'){
      this.x+=this.diagDir*0.9;
      if(this.x<this.size){ this.x=this.size; this.diagDir=1; }
      if(this.x>cw-this.size){ this.x=cw-this.size; this.diagDir=-1; }
    } else if(this.trajectory==='bounce'){
      this.x+=this.bounceDir*1.8;
      if(this.x<this.size){ this.x=this.size; this.bounceDir=1; }
      if(this.x>cw-this.size){ this.x=cw-this.size; this.bounceDir=-1; }
    }
    if(effects.magnet && this.type!=='bomb'){
      const dx=cw/2-this.x;
      this.x+=dx*0.025;
    }
    this.rot+=0.01;
    this.sparkle+=0.05;
  }
  radius(){ return effects.curse&&this.type!=='curse' ? this.size*0.62 : this.size; }
  draw(){
    if(this.collected) return;
    const s=this.radius();
    const x=this.x, y=this.y;
    // свечение
    ctx.fillStyle=hexA(this.info.color, 0.14);
    ctx.beginPath(); ctx.arc(x, y, s+5, 0, Math.PI*2); ctx.fill();
    drawGlyph(this.type, x, y, s, this.sparkle);
  }
  contains(tx, ty){
    if(this.collected) return false;
    const s=this.radius();
    const dx=tx-this.x, dy=ty-this.y;
    return dx*dx+dy*dy<=s*s;
  }
}

// векторные глифы предметов
function drawGlyph(type, x, y, s, sparkle){
  switch(type){
    case 'coin':{
      ctx.fillStyle='#E8B04B';
      ctx.beginPath(); ctx.arc(x,y,s*0.92,0,Math.PI*2); ctx.fill();
      ctx.fillStyle='#B08D57';
      ctx.beginPath(); ctx.arc(x,y,s*0.6,0,Math.PI*2); ctx.fill();
      ctx.fillStyle='#14100B';
      ctx.font=`bold ${Math.round(s*0.72)}px Inter, sans-serif`;
      ctx.textAlign='center'; ctx.textBaseline='middle';
      ctx.fillText('★', x, y+1);
      break;
    }
    case 'gold':{
      const g=ctx.createRadialGradient(x-3,y-3,1,x,y,s);
      g.addColorStop(0,'#F5E2B8'); g.addColorStop(0.7,'#E8C9A0'); g.addColorStop(1,'#B08D57');
      ctx.fillStyle=g;
      ctx.beginPath(); ctx.arc(x,y,s*0.9,0,Math.PI*2); ctx.fill();
      ctx.strokeStyle='#F5F5F7'; ctx.lineWidth=1.2;
      ctx.beginPath(); ctx.arc(x,y,s*0.55,0,Math.PI*2); ctx.stroke();
      // искра
      const a=sparkle;
      ctx.fillStyle='rgba(255,255,255,.75)';
      ctx.beginPath(); ctx.arc(x+Math.cos(a)*s*0.5, y+Math.sin(a)*s*0.5, 2.4, 0, Math.PI*2); ctx.fill();
      break;
    }
    case 'bomb':{
      ctx.fillStyle='#1A1A22';
      ctx.beginPath(); ctx.arc(x,y,s*0.8,0,Math.PI*2); ctx.fill();
      ctx.fillStyle='rgba(255,255,255,.18)';
      ctx.beginPath(); ctx.arc(x-s*0.25,y-s*0.3,s*0.2,0,Math.PI*2); ctx.fill();
      // фитиль
      ctx.strokeStyle='#8A7350'; ctx.lineWidth=1.6;
      ctx.beginPath(); ctx.moveTo(x, y-s*0.75); ctx.quadraticCurveTo(x+4, y-s*1.15, x+8, y-s*0.95); ctx.stroke();
      const fl=0.5+0.5*Math.sin(Date.now()*0.02);
      ctx.fillStyle=`rgba(232,176,75,${0.5+fl*0.5})`;
      ctx.beginPath(); ctx.arc(x+8, y-s*0.95, 2.4+fl, 0, Math.PI*2); ctx.fill();
      break;
    }
    case 'magnet':{
      ctx.strokeStyle='#7A6A8F'; ctx.lineWidth=s*0.34; ctx.lineCap='butt';
      ctx.beginPath(); ctx.arc(x, y-s*0.12, s*0.5, Math.PI, 0); ctx.stroke();
      ctx.fillStyle='#C9CDD4';
      ctx.fillRect(x-s*0.68, y-s*0.14, s*0.34, s*0.3);
      ctx.fillRect(x+s*0.34, y-s*0.14, s*0.34, s*0.3);
      ctx.lineCap='butt';
      break;
    }
    case 'slow':{
      ctx.strokeStyle='#5F7E8A'; ctx.lineWidth=2.4;
      ctx.beginPath(); ctx.arc(x, y, s*0.62, 0, Math.PI*2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y-s*0.42); ctx.moveTo(x, y); ctx.lineTo(x+s*0.3, y+s*0.12); ctx.stroke();
      break;
    }
    case 'curse':{
      ctx.strokeStyle='#6B4E7E'; ctx.lineWidth=2.6;
      const pulse=1+0.08*Math.sin(Date.now()*0.008);
      ctx.beginPath(); ctx.arc(x, y, s*0.6*pulse, 0, Math.PI*2); ctx.stroke();
      ctx.fillStyle='#6B4E7E';
      ctx.beginPath(); ctx.arc(x, y, s*0.2, 0, Math.PI*2); ctx.fill();
      break;
    }
    case 'speed':{
      ctx.fillStyle='#C96A6A';
      ctx.beginPath();
      ctx.moveTo(x+s*0.28, y-s*0.75);
      ctx.lineTo(x-s*0.35, y+s*0.1);
      ctx.lineTo(x-s*0.02, y+s*0.1);
      ctx.lineTo(x-s*0.28, y+s*0.75);
      ctx.lineTo(x+s*0.35, y-s*0.1);
      ctx.lineTo(x+s*0.02, y-s*0.1);
      ctx.closePath(); ctx.fill();
      break;
    }
    case 'shield':{
      ctx.strokeStyle='#8B9D83'; ctx.lineWidth=2.4;
      ctx.beginPath();
      ctx.moveTo(x, y-s*0.7);
      ctx.lineTo(x+s*0.55, y-s*0.4);
      ctx.quadraticCurveTo(x+s*0.55, y+s*0.35, x, y+s*0.7);
      ctx.quadraticCurveTo(x-s*0.55, y+s*0.35, x-s*0.55, y-s*0.4);
      ctx.closePath(); ctx.stroke();
      ctx.fillStyle='rgba(139,157,131,.3)';
      ctx.fill();
      break;
    }
  }
}
function hexA(hex, a){
  const h=hex.replace('#','');
  return `rgba(${parseInt(h.substr(0,2),16)},${parseInt(h.substr(2,2),16)},${parseInt(h.substr(4,2),16)},${a})`;
}

// ---------- эффекты тапа ----------
class Pop{
  constructor(x, y, color){
    this.x=x; this.y=y; this.life=1; this.size=10; this.color=color;
    this.particles=[];
    for(let i=0;i<6;i++){
      const a=(Math.PI*2/6)*i+Math.random()*0.3;
      this.particles.push({vx:Math.cos(a)*(2+Math.random()*3), vy:Math.sin(a)*(2+Math.random()*3), size:2+Math.random()*4, x:0, y:0});
    }
  }
  update(){
    this.life-=0.04; this.size+=0.5;
    for(const p of this.particles){
      p.vx*=0.97; p.vy*=0.97; p.x+=p.vx; p.y+=p.vy;
    }
  }
  draw(){
    if(this.life<=0) return;
    ctx.globalAlpha=this.life;
    ctx.strokeStyle=this.color; ctx.lineWidth=2;
    ctx.beginPath(); ctx.arc(this.x, this.y, this.size, 0, Math.PI*2); ctx.stroke();
    ctx.fillStyle=this.color;
    for(const p of this.particles){
      ctx.beginPath(); ctx.arc(this.x+p.x, this.y+p.y, p.size*this.life, 0, Math.PI*2); ctx.fill();
    }
    ctx.globalAlpha=1;
  }
}

// ---------- спавн ----------
function pickType(){
  const types=cfg.types;
  const weights=types.map(t=>cfg.weights[t]);
  const total=weights.reduce((a,b)=>a+b,0);
  let r=rng()*total;
  for(let i=0;i<types.length;i++){
    r-=weights[i];
    if(r<=0) return types[i];
  }
  return types[0];
}
function spawnItem(){
  if(!gameRunning) return;
  if(items.filter(i=>!i.collected).length>18) return;
  items.push(new Item(pickType()));
}

// ---------- тап ----------
function handleTap(x, y){
  if(!gameRunning||stunTimer>0) return;
  for(let i=items.length-1;i>=0;i--){
    const item=items[i];
    if(!item.contains(x, y)) continue;
    item.collected=true;
    const type=item.type;
    if(type==='coin'||type==='gold'){
      const pts=type==='gold'?3:1;
      score+=pts;
      if(type==='coin'){ coinsTotal++; missionProgress('coins25',1); } else { goldsTotal++; missionProgress('golds10',1); }
      pops.push(new Pop(item.x, item.y, TYPES[type].color));
      snd.coin();
      if(score>cfg.target) score=cfg.target;
      updateHUD();
      if(score>=cfg.target){ levelComplete(); return; }
    }
    else if(type==='bomb'){
      if(hasShield){
        hasShield=false;
        missionProgress('shield2',1);
        pops.push(new Pop(item.x, item.y, '#8B9D83'));
        snd.shield(); shake=4;
      } else {
        lives--; levelBombHits++; levelLostLives++;
        shake=8; stunTimer=20;
        snd.bomb();
        pops.push(new Pop(item.x, item.y, '#E4545F'));
        updateHUD();
        if(lives<=0){ gameOver(); return; }
      }
    }
    else if(type==='magnet'){ effects.magnet=180; snd.power(); pops.push(new Pop(item.x, item.y, TYPES.magnet.color)); missionProgress('magnet2',1); }
    else if(type==='slow'){ effects.slow=180; snd.power(); pops.push(new Pop(item.x, item.y, TYPES.slow.color)); }
    else if(type==='curse'){ effects.curse=180; pops.push(new Pop(item.x, item.y, TYPES.curse.color)); }
    else if(type==='speed'){ effects.speed=180; pops.push(new Pop(item.x, item.y, TYPES.speed.color)); }
    else if(type==='shield'){ hasShield=true; snd.shield(); pops.push(new Pop(item.x, item.y, TYPES.shield.color)); }
    updateHUD();
    break;
  }
}

// ---------- уровни ----------
function showLevelStart(){
  cfg=getLevelConfig(level);
  el.modalBadge.textContent='Уровень '+level;
  el.modalTitle.textContent='Цель: '+cfg.target+' очков';
  el.modalScore.textContent=GROUP_SUBS[cfg.group].text;
  const showTypes=GROUP_SUBS[cfg.group].types||cfg.types;
  el.modalLegend.innerHTML=showTypes.map(t=>`<span class="lg"><i style="background:${TYPES[t].color}"></i>${TYPES[t].label}</span>`).join('');
  el.modalBtn.textContent='Начать';
  el.modalBtn.onclick=()=>{ snd.click(); startLevel(); };
  el.modal.classList.remove('hidden');
}
function startLevel(){
  el.modal.classList.add('hidden');
  comboPitch=0; score=0;
  items=[]; pops=[]; effects={};
  spawnTimer=0; stunTimer=0;
  levelBombHits=0; levelLostLives=0;
  gameRunning=true; itemId=0;
  updateHUD();
}
function levelComplete(){
  gameRunning=false;
  comboPitch=0;
  snd.win();
  if(levelBombHits===0&&levelLostLives===0) missionProgress('nobomb2',1);
  if(levelLostLives===0) missionProgress('full3',1);
  missionProgress('level3', level+1);
  missionProgress('level5', level+1);
  const final=Math.round(level*mult);
  markDay();
  const isDailyRec=final>dailyBest;
  if(isDailyRec){ dailyBest=final; lsSet('cointap.daily.'+today, dailyBest); }
  const isRec=level>best;
  if(isRec){ best=level; lsSet('cointap.level', best); }
  flushMissions();
  el.modalBadge.textContent=isRec?'Новый рекорд':'Уровень пройден';
  el.modalBadge.classList.toggle('record', isRec);
  el.modalCard.classList.toggle('modal-record', isRec);
  el.modalTitle.textContent='Уровень '+level+' пройден';
  el.modalScore.textContent='Жизни: '+lives+' · Рекорд уровня: '+best;
  el.modalLegend.innerHTML='';
  el.modalBtn.textContent='Дальше →';
  el.modalBtn.onclick=()=>{ snd.click(); level++; showLevelStart(); };
  el.modal.classList.remove('hidden');
  showWelcomeRecords(); updateHUD();
}
function gameOver(){
  gameRunning=false;
  comboPitch=0;
  markDay();
  const final=Math.round((level-1)*mult);
  const isDailyRec=final>dailyBest;
  if(isDailyRec){ dailyBest=final; lsSet('cointap.daily.'+today, dailyBest); }
  const isRec=(level-1)>best;
  if(isRec){ best=level-1; lsSet('cointap.level', best); }
  flushMissions();
  snd.over();
  el.modalBadge.textContent=isRec?'Новый рекорд':'Забег окончен';
  el.modalBadge.classList.toggle('record', isRec);
  el.modalCard.classList.toggle('modal-record', isRec);
  el.modalTitle.textContent='Жизни кончились';
  el.modalScore.textContent='Дошёл до уровня '+level+' · Рекорд уровня: '+best;
  el.modalLegend.innerHTML='';
  el.modalBtn.textContent='Заново с 1 уровня';
  el.modalBtn.onclick=()=>{ snd.click(); level=1; lives=3; hasShield=false; showLevelStart(); };
  el.modal.classList.remove('hidden');
  showWelcomeRecords(); updateHUD();
}

// ---------- шаг логики ----------
function update(){
  frameId++;
  if(!gameRunning) return;
  if(stunTimer>0) stunTimer--;
  spawnTimer++;
  if(spawnTimer>=cfg.spawnInterval){ spawnTimer=0; spawnItem(); }
  for(const item of items) item.update();
  items=items.filter(i=>!i.collected&&i.y<ch+50);
  for(const p of pops) p.update();
  pops=pops.filter(p=>p.life>0);
  for(const key of Object.keys(effects)){
    effects[key]--;
    if(effects[key]<=0) delete effects[key];
  }
  if(shake>0){ shake*=0.85; if(shake<0.5) shake=0; }
}

// ---------- отрисовка ----------
function draw(){
  ctx.save();
  if(shake>0) ctx.translate((Math.random()-0.5)*shake, (Math.random()-0.5)*shake);
  ctx.clearRect(0,0,cw,ch);
  for(const item of items) item.draw();
  for(const p of pops) p.draw();
  ctx.restore();
}

// ---------- HUD ----------
function updateHUD(){
  el.levelV.textContent=level;
  el.daily.textContent=dailyBest;
  el.best.textContent=best;
  el.livesV.textContent=lives;
  el.targetN.textContent=score+'/'+(cfg?cfg.target:10);
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
  draw();
}

// ---------- ввод ----------
canvas.addEventListener('touchstart',e=>{
  e.preventDefault();
  const t=e.touches[0], r=canvas.getBoundingClientRect();
  handleTap(t.clientX-r.left, t.clientY-r.top);
},{passive:false});
canvas.addEventListener('mousedown',e=>{
  const r=canvas.getBoundingClientRect();
  handleTap(e.clientX-r.left, e.clientY-r.top);
});

// ---------- экраны ----------
function startGame(){
  el.welcome.classList.add('hidden');
  el.game.classList.remove('hidden');
  fitCanvas();
  level=1; lives=3; hasShield=false;
  showLevelStart();
}
function toMenu(){
  gameRunning=false;
  el.game.classList.add('hidden');
  el.modal.classList.add('hidden');
  el.welcome.classList.remove('hidden');
  showWelcomeRecords();
}

$('btn-play').addEventListener('click',()=>{ snd.click(); startGame(); });
$('btn-new').addEventListener('click',()=>{ snd.click(); gameRunning=false; lives=3; hasShield=false; level=1; showLevelStart(); });
$('btn-menu').addEventListener('click',()=>{ snd.click(); toMenu(); });
$('btn-missions').addEventListener('click',openMissions);
$('missions-chip').addEventListener('click',openMissions);
$('mmodal-btn').addEventListener('click',()=>{ snd.click(); el.mmodal.classList.add('hidden'); });
function openMissions(){ snd.click(); renderMissionsModal(); el.mmodal.classList.remove('hidden'); }

function updateSoundBtn(){ $('btn-sound').textContent=muted?'🔇':'🔊'; }
$('btn-sound').addEventListener('click',()=>{
  muted=!muted; lsSet('cointap.muted', muted);
  updateSoundBtn(); if(!muted) snd.click();
});
updateSoundBtn();

function setMode(m){
  mode=m;
  $('mode-daily').classList.toggle('active', m==='daily');
  $('mode-free').classList.toggle('active', m==='free');
  // пересид операции: seed применяется в startLevel через rng
  rng=(m==='daily')?mulberry32(xmur3('cointap-daily-'+today)()):Math.random;
}
$('mode-daily').addEventListener('click',()=>{ snd.click(); setMode('daily'); });
$('mode-free').addEventListener('click', ()=>{ snd.click(); setMode('free'); });

document.addEventListener('visibilitychange',()=>{ paused=document.hidden; if(!document.hidden) lastT=0; });

function onResize(){
  if(el.game.classList.contains('hidden')) return;
  fitCanvas();
  for(const it of items){
    it.x=clamp(it.x, it.size, cw-it.size);
    it.startX=clamp(it.startX, it.size, cw-it.size);
  }
}
window.addEventListener('resize', onResize);
if(window.visualViewport) window.visualViewport.addEventListener('resize', onResize);

['keydown','pointerdown','touchstart'].forEach(ev=>document.addEventListener(ev, audio, {passive:true}));

// ---------- init ----------
(function init(){
  for(let i=0;i<7;i++) el.decoRow.appendChild(document.createElement('i'));
  el.dailyDate.textContent='Вызов дня · '+today;
  pickMissions(); renderMissionsChip();
  setMode('daily');
  showWelcomeRecords(); updateHUD();
  fitCanvas();
  animId=requestAnimationFrame(loop);
})();

// ---------- debug hooks ----------
window.__ct={
  get state(){ return gameRunning?'play':'ui'; },
  get level(){ return level; },
  get score(){ return score; },
  get lives(){ return lives; },
  get best(){ return best; },
  get missionsDone(){ return missions.filter(m=>(mState[m.id]||{}).done).length; },
  tap(x, y){ handleTap(x, y); },
  get items(){ return items.filter(i=>!i.collected).length; },
  spawnCoin(){ if(cfg) items.push(new Item('coin')); },
  spawnBomb(){ if(cfg) items.push(new Item('bomb')); },
  flush(){ flushMissions(); },
};
