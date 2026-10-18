'use strict';
/* Небоскрёб — idle-тайкун в стиле AXIIOM. canvas + vanilla JS, без зависимостей.
   Мета: стрик-множитель, ежедневные миссии. Прогресс города сохраняется в localStorage.
   Пересборка: векторная графика вместо эмодзи, работающая система терпения, сохранения,
   фиксированный шаг логики. */

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
  money:$('money-val'), floorsV:$('floors-val'), popV:$('pop-val'), bestV:$('best-val'),
  streakN:$('streak-n'), multN:$('mult-n'), missionsN:$('missions-n'),
  wMoney:$('w-money'), wFloors:$('w-floors'), wStreak:$('w-streak'),
  modal:$('modal'), modalCard:$('modal-card'), modalBadge:$('modal-badge'), modalTitle:$('modal-title'), modalScore:$('modal-score'),
  mmodal:$('mmodal'), mlist:$('mmodal-list'), toasts:$('toasts'),
  decoRow:$('deco-row'), shop:$('shop'), btnBuild:$('btn-build')
};

// ---------- звук ----------
let AC=null;
let muted=lsGet('tycoon.muted', false);
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
  build(){ tone(180, 270, 0.18, 'square', 0.05); tone(320, 380, 0.14, 'square', 0.04, 0.11); },
  buy(){ tone(660, 660, 0.09, 'sine', 0.05); tone(880, 880, 0.12, 'sine', 0.05, 0.06); },
  earn(){ tone(1180, 1180, 0.07, 'sine', 0.028); },
  angry(){ tone(220, 140, 0.18, 'sawtooth', 0.045); },
  mission(){ tone(880, 880, 0.1, 'sine', 0.1); tone(1174, 1174, 0.16, 'sine', 0.1, 0.1); },
  record(){ [523,659,784].forEach((f,i)=>tone(f, f, 0.14, 'triangle', 0.1, i*0.11)); },
  click(){ tone(440, 440, 0.04, 'sine', 0.05); }
};

// ---------- стрик ----------
const getMult = s => 1 + Math.min(Math.max(s-1,0),10)*0.05;
let streak = lsGet('tycoon.streak', 0), lastDay = lsGet('tycoon.lastDay', '');
function effStreak(){ return (lastDay===today || lastDay===yesterday) ? streak : 0; }
function refreshMult(){ mult = effStreak()>0 ? getMult(streak) : 1; }
function markDay(){
  if(lastDay===today){ mult=getMult(streak); return; }
  streak = (lastDay===yesterday) ? (streak||0)+1 : 1;
  lastDay = today;
  lsSet('tycoon.streak', streak); lsSet('tycoon.lastDay', lastDay);
  mult = getMult(streak);
  if(streak>1) toast(`🔥 Стрик <b>${streak}</b> · награды миссий ×<b>${mult.toFixed(2)}</b>`);
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
  {id:'earn200',   t:()=>'Заработай 200 монет (за день)',           n:200, cum:true},
  {id:'floors5',   t:()=>'Построй 5 этажей (суммарно)',             n:5,  cum:true},
  {id:'visitors15',t:()=>'Обслужи 15 посетителей (за день)',        n:15, cum:true},
  {id:'biz4',      t:()=>'Открой 4 бизнеса одновременно',           n:4},
  {id:'money1000', t:()=>'Накопи 1000 монет в банке',               n:1000},
  {id:'tips10',    t:()=>'Получи 10 чаевых (за день)',              n:10, cum:true},
  {id:'jewelry',   t:()=>'Открой «Ювелирку»',                       n:1},
  {id:'angry0',    t:()=>'Обслужи 8 посетителей без ушедших (день)',n:8,  cum:true}
];
let missions=[], mState=lsGet('tycoon.missions.'+today, {});
let mDirty=false;
function flushMissions(){ if(!mDirty) return; mDirty=false; lsSet('tycoon.missions.'+today, mState); }
function pickMissions(){
  const seed = xmur3('tycoon-missions-'+today)();
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
    city.money += reward;
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

// ---------- бизнесы ----------
const BUSINESSES=[
  {id:'pizza',   name:'Пиццерия',  letter:'П', cost:0,   income:4,  color:'#C96A6A', dur:3000, pop:30},
  {id:'cafe',    name:'Кафе',      letter:'К', cost:60,  income:6,  color:'#D4A574', dur:3500, pop:25},
  {id:'burger',  name:'Бургерная', letter:'Б', cost:120, income:8,  color:'#E8B04B', dur:2500, pop:20},
  {id:'library', name:'Библиотека',letter:'Л', cost:80,  income:5,  color:'#5F7E8A', dur:5000, pop:15},
  {id:'arcade',  name:'Аркада',    letter:'А', cost:200, income:12, color:'#7A6A8F', dur:4000, pop:20},
  {id:'sushi',   name:'Суши',      letter:'С', cost:350, income:18, color:'#8B9D83', dur:3000, pop:15},
  {id:'fashion', name:'Мода',      letter:'М', cost:500, income:25, color:'#B0563F', dur:4500, pop:10},
  {id:'jewelry', name:'Ювелирка',  letter:'Ю', cost:800, income:35, color:'#E8C9A0', dur:4000, pop:5},
];
const bizById = id => BUSINESSES.find(b=>b.id===id);

// типы гостей: любимые бизнесы, терпение, чаевые
const CHAR_TYPES=[
  {wants:['pizza','cafe','library'],  patience:15000, tip:2, color:'#5F7E8A'},
  {wants:['cafe','burger'],           patience:10000, tip:3, color:'#D4A574'},
  {wants:['sushi','arcade','cafe'],   patience:12000, tip:4, color:'#7A6A8F'},
  {wants:['library','cafe','pizza'],  patience:20000, tip:1, color:'#8B9D83'},
  {wants:['fashion','jewelry','cafe'],patience:15000, tip:5, color:'#B0563F'},
  {wants:['arcade','pizza','burger'], patience:8000,  tip:1, color:'#C96A6A'},
];

// ---------- город (с сохранением) ----------
let city=null;
function freshCity(){
  return {
    money: 150,
    floors: [ {business:null}, {business:'pizza'} ],   // индекс 0 = вход
    bestFloors: 1,
    totalEarned: 0,
    totalVisitors: 0,
    savedAt: Date.now()
  };
}
function saveCity(){ if(city){ city.savedAt=Date.now(); lsSet('tycoon.city', city); } }
function loadCity(){
  const c=lsGet('tycoon.city', null);
  if(c && c.floors && c.floors.length>=2){ city=c; return true; }
  city=freshCity(); return false;
}

// ---------- рантайм-состояние ----------
let cw=0, ch=0, dpr=1;
let floorH=55;
const FLOOR_MIN=34;
let chars=[], elevators=[], charId=0;
let selectedFloor=null;
let spawnTimer=0, saveTimer=0;
let floaters=[];
let animId=null, acc=0, lastT=0, paused=false;
let visitorsServed=0, angryLeft=0, happyStreak=0;

function getFloorY(i){ return ch-(i+1)*floorH; }
function recalcFloorH(){ floorH=Math.min(55, Math.max(FLOOR_MIN, (ch-16)/(city.floors.length+0.4))); }
function getElevatorCount(){ const n=city.floors.length-1; return n<=4?1:n<=8?2:3; }
function getBuildCost(){ return Math.floor(80+(city.floors.length-2)*50); }
function incomePerMin(){
  let perSec=0;
  for(const f of city.floors){
    if(!f.business) continue;
    const b=bizById(f.business); if(!b) continue;
    // средний цикл гостя: ожидание+поездка+визит(dur)+уход, грубо dur+4000
    perSec += (b.income+2)/( (b.dur+4000)/1000 ) * 0.6;
  }
  return Math.round(perSec*60);
}

function fitCanvas(){
  const rect=canvas.parentElement.getBoundingClientRect();
  dpr=Math.min(window.devicePixelRatio||1, 2);
  cw=Math.floor(rect.width); ch=Math.floor(rect.height);
  canvas.width=cw*dpr; canvas.height=ch*dpr;
  canvas.style.width=cw+'px'; canvas.style.height=ch+'px';
  ctx.setTransform(dpr,0,0,dpr,0,0);
  recalcFloorH();
}

// ---------- лифты ----------
function rebuildElevators(){
  const target=getElevatorCount();
  while(elevators.length<target){
    const idx=elevators.length;
    elevators.push({id:idx, y:getFloorY(0)+floorH/2-9, targetFloor:0, occupants:[], state:'idle', timer:30+idx*10, capacity:4});
  }
  while(elevators.length>target){
    const e=elevators.pop();
    for(const occ of e.occupants) occ.state='waiting';
  }
}
function updateElevators(){
  rebuildElevators();
  const gy=getFloorY(0)+floorH/2-9;
  for(const ev of elevators){
    if(ev.state==='idle'){
      ev.y+=(gy-ev.y)*0.1;
      const waiting=chars.filter(c=>c.state==='waiting');
      if(waiting.length>0){
        const take=Math.min(ev.capacity, waiting.length);
        for(let i=0;i<take;i++){ waiting[i].state='elevator'; ev.occupants.push(waiting[i]); }
        ev.state='going';
        ev.targetFloor=ev.occupants[0].targetFloor;
        ev.timer=Math.abs(ev.targetFloor)*10+20;
      }
    }
    else if(ev.state==='going'){
      const ty=getFloorY(ev.targetFloor)+floorH/2-9;
      ev.y+=(ty-ev.y)*0.08;
      ev.timer--;
      if(ev.timer<=0||Math.abs(ev.y-ty)<2){
        ev.y=ty;
        const arriving=ev.occupants.filter(o=>o.targetFloor===ev.targetFloor);
        for(const occ of arriving){
          occ.state='visiting';
          occ.timer=bizById(occ.biz).dur;
        }
        ev.occupants=ev.occupants.filter(o=>o.targetFloor!==ev.targetFloor);
        if(ev.occupants.length>0){
          ev.targetFloor=ev.occupants[0].targetFloor;
          ev.timer=Math.abs(ev.targetFloor-ev.targetFloor)*10+20;
        } else {
          ev.state='returning'; ev.timer=30;
        }
      }
    }
    else if(ev.state==='returning'){
      ev.y+=(gy-ev.y)*0.05;
      ev.timer--;
      if(ev.timer<=0||Math.abs(ev.y-gy)<2){ ev.y=gy; ev.state='idle'; ev.timer=20; }
    }
  }
}

// ---------- гости ----------
function spawnChar(){
  const activeBiz=city.floors.map(f=>f.business).filter(Boolean);
  if(activeBiz.length===0) return;
  const ct=CHAR_TYPES[(Math.random()*CHAR_TYPES.length)|0];
  const wants=ct.wants.filter(w=>activeBiz.includes(w));
  if(wants.length===0) return;
  const wantBiz=wants[(Math.random()*wants.length)|0];
  const idx=city.floors.findIndex(f=>f.business===wantBiz);
  if(idx<0) return;
  chars.push({
    id:charId++, type:ct, biz:wantBiz, targetFloor:idx,
    state:'waiting', timer:ct.patience, gaveTip:false,
    x: 44+((chars.filter(c=>c.state==='waiting').length)%8)*20
  });
}
function updateChars(){
  for(const c of chars){
    if(c.state==='waiting'){
      c.timer-=STEP_MS;
      if(c.timer<=0){
        c.state='gone';
        angryLeft++; happyStreak=0;
        floaters.push({x:c.x, y:getFloorY(0)+floorH/2, text:'ушёл', color:'#E4545F', life:50, max:50});
        snd.angry();
      }
    }
    else if(c.state==='visiting'){
      c.timer-=STEP_MS;
      if(c.timer<=0){
        const b=bizById(c.biz);
        const earn=(b?b.income:0)+(c.gaveTip?0:c.type.tip);
        city.money+=Math.round(earn);
        city.totalEarned+=Math.round(earn);
        visitorsServed++; city.totalVisitors++; happyStreak++;
        if(!c.gaveTip){ missionProgress('tips10',1); c.gaveTip=true; }
        c.state='gone';
        snd.earn();
        floaters.push({x:cw-70-Math.random()*30, y:getFloorY(c.targetFloor)+floorH/2, text:'+$'+Math.round(earn), color:'#E8B04B', life:50, max:50});
        missionProgress('earn200', Math.round(earn));
        missionProgress('visitors15',1);
        if(happyStreak>=8) missionProgress('angry0', visitorsServed);
      }
    }
  }
  chars=chars.filter(c=>c.state!=='gone');
}

// ---------- логика шага ----------
function update(){
  recalcFloorH();
  // пассивный доход — фиксированный, не случайный
  for(let i=1;i<city.floors.length;i++){
    const f=city.floors[i];
    if(!f.business) continue;
    const b=bizById(f.business); if(!b) continue;
    f.acc=(f.acc||0)+STEP_MS;
    if(f.acc>=b.dur*4){ f.acc-=b.dur*4; city.money+=Math.max(1, Math.round(b.income*0.5)); }
  }
  // спавн гостей
  spawnTimer+=STEP_MS;
  const spawnRate=Math.max(1800, 4200-city.floors.filter(f=>f.business).length*220);
  if(spawnTimer>spawnRate && chars.filter(c=>c.state==='waiting'||c.state==='elevator').length<8){
    spawnTimer=0; spawnChar();
  }
  updateElevators();
  updateChars();
  for(let i=floaters.length-1;i>=0;i--){ const f=floaters[i]; f.y-=0.55; if(--f.life<=0) floaters.splice(i,1); }
  // автосохранение раз в 5с
  saveTimer+=STEP_MS;
  if(saveTimer>5000){ saveTimer=0; saveCity(); }
  // миссии состояния
  missionProgress('money1000', city.money);
  const bizCount=city.floors.filter(f=>f.business).length;
  missionProgress('biz4', bizCount);
  if(city.floors.some(f=>f.business==='jewelry')) missionProgress('jewelry',1);
}

// ---------- отрисовка ----------
function draw(){
  ctx.clearRect(0,0,cw,ch);
  // фон
  ctx.fillStyle='#0B0B12';
  ctx.fillRect(0,0,cw,ch);

  const numElev=getElevatorCount();
  const SHAFT=24*numElev+6;
  const shaftX=cw-SHAFT;

  for(let i=0;i<city.floors.length;i++){
    const f=city.floors[i];
    const y=getFloorY(i);
    const isGround=i===0;
    const isSel=selectedFloor===i;

    ctx.fillStyle=isSel?'#2A2116':(isGround?'#0E0E14':'#12121A');
    ctx.fillRect(0,y,cw,floorH);
    ctx.strokeStyle='rgba(255,255,255,.08)'; ctx.lineWidth=1;
    ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(cw,y); ctx.stroke();

    // номер этажа
    ctx.fillStyle='#78787D';
    ctx.font='9px Inter, sans-serif'; ctx.textAlign='left'; ctx.textBaseline='middle';
    ctx.fillText(isGround?'ВХОД':String(i)+'F', 6, y+floorH/2);

    if(f.business && !isGround){
      drawShopfront(34, y+3, floorH-6, bizById(f.business), f);
    } else if(!isGround){
      ctx.strokeStyle='rgba(212,165,116,.3)'; ctx.lineWidth=1;
      roundRect(ctx, 34, y+5, floorH-10, floorH-10, 4); ctx.stroke();
      ctx.fillStyle='rgba(212,165,116,.55)';
      ctx.font='13px Inter, sans-serif'; ctx.textAlign='center';
      ctx.fillText('+', 34+(floorH-10)/2, y+floorH/2-2);
      ctx.fillStyle='rgba(255,255,255,.18)';
      ctx.font='7px Inter, sans-serif';
      ctx.fillText('свободен', 34+(floorH-10)/2, y+floorH/2+10);
    }

    // шахта лифта
    ctx.fillStyle='#08080C';
    ctx.fillRect(shaftX, y, SHAFT, floorH);
    ctx.strokeStyle='rgba(255,255,255,.07)';
    ctx.strokeRect(shaftX, y, SHAFT, floorH);
  }

  // кабины лифтов
  for(const ev of elevators){
    const carX=shaftX+3+ev.id*24;
    ctx.fillStyle=ev.occupants.length>0?'#D4A574':'#8A7350';
    roundRect(ctx, carX, ev.y, 20, 16, 3); ctx.fill();
    if(ev.occupants.length>0){
      ctx.fillStyle='#14100B';
      ctx.font='bold 8px Inter, sans-serif'; ctx.textAlign='center'; ctx.textBaseline='middle';
      ctx.fillText(String(ev.occupants.length), carX+10, ev.y+8);
    }
  }

  // ожидающие гости
  let wx=44;
  for(const c of chars){
    if(c.state!=='waiting') continue;
    const gy=getFloorY(0)+floorH/2;
    const impatient=c.timer<c.type.patience*0.35;
    drawPerson(c.x, gy, c.type.color, impatient);
    wx+=20;
    if(wx>shaftX-14) break;
  }
  // гости внутри лифтов
  for(const ev of elevators){
    const carX=shaftX+3+ev.id*24;
    let px=carX+5;
    for(const occ of ev.occupants){
      drawPerson(px, ev.y+9, occ.type.color, false, 0.7);
      px+=6;
    }
  }
  // гости на этажах (визит)
  for(const c of chars){
    if(c.state!=='visiting') continue;
    const vy=getFloorY(c.targetFloor)+floorH/2;
    const sx=shaftX-24-(chars.filter(o=>o.state==='visiting'&&o.targetFloor===c.targetFloor).indexOf(c)+1)*12;
    drawPerson(sx, vy, c.type.color, false, 0.8);
  }

  // всплывающие суммы
  for(const f of floaters){
    ctx.globalAlpha=Math.max(0,f.life/f.max);
    ctx.fillStyle=f.color;
    ctx.font='bold 11px Inter, sans-serif'; ctx.textAlign='center';
    ctx.fillText(f.text, f.x, f.y);
  }
  ctx.globalAlpha=1;
}

// витрина бизнеса — векторная
function drawShopfront(x, y, h, biz, f){
  const w=floorH-10;
  ctx.fillStyle='#1A1A24';
  roundRect(ctx, x, y, w, h, 4); ctx.fill();
  // навес-маркиза
  ctx.fillStyle=biz.color;
  for(let sx=0; sx<w; sx+=7){
    ctx.fillStyle= (sx/7)%2===0 ? biz.color : shade(biz.color,-30);
    ctx.fillRect(x+sx, y+2, Math.min(7,w-sx), 5);
  }
  // окно
  ctx.fillStyle=shade(biz.color,-55);
  roundRect(ctx, x+4, y+10, w-8, h-20, 2); ctx.fill();
  // монограмма
  ctx.fillStyle='#EDEDF0';
  ctx.font='bold 10px Inter, sans-serif'; ctx.textAlign='center'; ctx.textBaseline='middle';
  ctx.fillText(biz.letter, x+w/2, y+h/2+3);
  // сила света окна — активность
  const visitors=chars.filter(c=>c.state==='visiting'&&city.floors[c.targetFloor]===f);
  if(visitors.length>0){
    ctx.fillStyle='rgba(232,176,75,.5)';
    ctx.fillRect(x+4, y+h-6, w-8, 2);
  }
}
function drawPerson(x, y, color, impatient, scale){
  const s=scale||1;
  ctx.save();
  ctx.translate(x,y);
  ctx.scale(s,s);
  if(impatient && Math.floor(Date.now()/250)%2===0){
    ctx.strokeStyle='rgba(228,84,95,.8)'; ctx.lineWidth=1.5;
    ctx.beginPath(); ctx.arc(0,-3,8,0,Math.PI*2); ctx.stroke();
  }
  // тело
  ctx.fillStyle=color;
  roundRect(ctx,-4,-2,8,9,3); ctx.fill();
  // голова
  ctx.fillStyle='#C9CDD4';
  ctx.beginPath(); ctx.arc(0,-6,3.4,0,Math.PI*2); ctx.fill();
  ctx.restore();
}
function roundRect(c,x,y,w,h,r){ r=Math.min(r,w/2,h/2); c.beginPath(); c.moveTo(x+r,y); c.arcTo(x+w,y,x+w,y+h,r); c.arcTo(x+w,y+h,x,y+h,r); c.arcTo(x,y+h,x,y,r); c.arcTo(x,y,x+w,y,r); c.closePath(); }
function shade(hex, amt){
  const h=hex.replace('#','');
  const r=clamp(parseInt(h.substr(0,2),16)+amt,0,255);
  const g=clamp(parseInt(h.substr(2,2),16)+amt,0,255);
  const b=clamp(parseInt(h.substr(4,2),16)+amt,0,255);
  return `rgb(${r},${g},${b})`;
}

// ---------- HUD ----------
function updateHUD(){
  el.money.textContent=Math.floor(city.money);
  el.floorsV.textContent=city.floors.length-1;
  el.popV.textContent=chars.length;
  el.bestV.textContent=city.bestFloors;
  const cost=getBuildCost();
  el.btnBuild.textContent='Построить $'+cost;
  el.btnBuild.disabled=city.money<cost;
  el.wMoney.textContent=Math.floor(city.money);
  el.wFloors.textContent=city.bestFloors;
  el.wStreak.textContent='🔥 '+effStreak();
  el.streakN.textContent=effStreak();
  el.multN.textContent='×'+mult.toFixed(2);
}

// ---------- магазин ----------
function renderShop(){
  const target=selectedFloor;
  if(target===null||target<=0||city.floors[target].business){ el.shop.classList.add('hidden'); return; }
  el.shop.classList.remove('hidden');
  el.shop.innerHTML='';
  const afford=Math.min(800, city.money+100);
  for(const biz of BUSINESSES){
    if(biz.cost>afford) continue;
    if(biz.cost===0 && target>1) continue;
    if(city.floors.some((f,idx)=>idx>0&&f.business===biz.id&&biz.cost===0)) continue;
    const btn=document.createElement('button');
    btn.className='shop-btn';
    btn.disabled=biz.cost>city.money;
    btn.innerHTML=`<span class="swatch" style="background:${biz.color}">${biz.letter}</span><span class="bname">${biz.name}</span><span class="bprice">$${biz.cost}</span>`;
    btn.addEventListener('click',()=>{
      if(city.money<biz.cost||city.floors[target].business) return;
      city.money-=biz.cost;
      city.floors[target].business=biz.id;
      snd.buy();
      toast(`${biz.name} — открыто! +$${biz.income}/визит`);
      floaters.push({x:cw/2, y:getFloorY(target)+floorH/2, text:biz.letter, color:'#8B9D83', life:50, max:50});
      selectedFloor=null;
      renderShop(); saveCity(); updateHUD();
    });
    el.shop.appendChild(btn);
  }
  if(!el.shop.children.length){
    const p=document.createElement('span');
    p.style.cssText='color:#78787D;font-size:.75rem;padding:6px;';
    p.textContent='Пока нечего открыть — копи монеты';
    el.shop.appendChild(p);
  }
}

// ---------- строительство ----------
function buildFloor(){
  const cost=getBuildCost();
  if(city.money<cost) return false;
  city.money-=cost;
  snd.build();
  city.floors.push({business:null});
  const floors=city.floors.length-1;
  if(floors>city.bestFloors){
    if(city.bestFloors>1){ toast('🏆 Новый рекорд: <b>'+floors+'</b> этажей!'); snd.record(); }
    city.bestFloors=floors;
  }
  missionProgress('floors5',1);
  recalcFloorH();
  selectedFloor=city.floors.length-1;
  renderShop(); saveCity(); updateHUD();
  return true;
}
el.btnBuild.addEventListener('click', buildFloor);

// ---------- тапы ----------
function onCanvasTap(x, y){
  let hit=null;
  for(let i=city.floors.length-1;i>=0;i--){
    const fy=getFloorY(i);
    if(y>=fy&&y<=fy+floorH){ hit=i; break; }
  }
  if(hit!==null&&hit>0&&!city.floors[hit].business){ selectedFloor=hit; }
  else { selectedFloor=null; }
  renderShop();
}
canvas.addEventListener('touchstart',e=>{
  e.preventDefault();
  const t=e.touches[0], r=canvas.getBoundingClientRect();
  onCanvasTap(t.clientX-r.left, t.clientY-r.top);
},{passive:false});
canvas.addEventListener('mousedown',e=>{
  const r=canvas.getBoundingClientRect();
  onCanvasTap(e.clientX-r.left, e.clientY-r.top);
});

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
  updateHUD();
  draw();
}

// ---------- экраны ----------
function startGame(){
  el.welcome.classList.add('hidden');
  el.game.classList.remove('hidden');
  fitCanvas();
  rebuildElevators();
  selectedFloor=null; renderShop();
  if(!animId) animId=requestAnimationFrame(loop);
}
function toMenu(){
  el.game.classList.add('hidden');
  el.shop.classList.add('hidden');
  el.welcome.classList.remove('hidden');
  saveCity();
  updateHUD();
}

$('btn-play').addEventListener('click',()=>{ snd.click(); startGame(); });
$('btn-menu').addEventListener('click',()=>{ snd.click(); toMenu(); });
$('btn-missions').addEventListener('click',openMissions);
$('missions-chip').addEventListener('click',openMissions);
$('mmodal-btn').addEventListener('click',()=>{ snd.click(); el.mmodal.classList.add('hidden'); });
function openMissions(){ snd.click(); renderMissionsModal(); el.mmodal.classList.remove('hidden'); }

$('btn-reset-city').addEventListener('click',()=>{
  snd.click();
  el.modalBadge.textContent='Новый город';
  el.modalTitle.textContent='Снести башню?';
  el.modalScore.innerHTML=`Прогресс текущего города будет удалён: <b>${city.floors.length-1}</b> этажей, банк <b>${Math.floor(city.money)}</b>.`;
  $('modal-btn').textContent='Снести';
  $('modal-btn').onclick=()=>{
    snd.click();
    city=freshCity();
    chars=[]; elevators=[]; selectedFloor=null;
    saveCity();
    el.modal.classList.add('hidden');
    updateHUD();
    toast('🏙 Новый город построен с нуля');
  };
  $('modal-btn2').onclick=()=>{ snd.click(); el.modal.classList.add('hidden'); };
  el.modal.classList.remove('hidden');
});

function updateSoundBtn(){ $('btn-sound').textContent=muted?'🔇':'🔊'; }
$('btn-sound').addEventListener('click',()=>{
  muted=!muted; lsSet('tycoon.muted', muted);
  updateSoundBtn(); if(!muted) snd.click();
});
updateSoundBtn();

document.addEventListener('visibilitychange',()=>{
  paused=document.hidden;
  if(document.hidden) saveCity(); else lastT=0;
});
window.addEventListener('pagehide', saveCity);

function onResize(){
  if(el.game.classList.contains('hidden')) return;
  fitCanvas();
  for(const ev of elevators) ev.y=getFloorY(0)+floorH/2-9;
}
window.addEventListener('resize', onResize);
if(window.visualViewport) window.visualViewport.addEventListener('resize', onResize);

// ---------- init ----------
(function init(){
  for(let i=0;i<7;i++) el.decoRow.appendChild(document.createElement('i'));
  pickMissions(); renderMissionsChip();
  loadCity();
  fitCanvas();
  updateHUD();
  animId=requestAnimationFrame(loop);
})();

// ---------- debug hooks ----------
window.__ty={
  get money(){ return Math.floor(city.money); },
  get floors(){ return city.floors.length-1; },
  get best(){ return city.bestFloors; },
  get visitors(){ return city.totalVisitors; },
  get missionsDone(){ return missions.filter(m=>(mState[m.id]||{}).done).length; },
  get saved(){ return !!lsGet('tycoon.city', null); },
  addMoney(v){ city.money+=v; updateHUD(); },
  build(){ city.money=Math.max(city.money, getBuildCost()+10); updateHUD(); buildFloor(); },
  buyCheapest(){
    const idx=city.floors.findIndex((f,i)=>i>0&&!f.business);
    if(idx<0) return 'no floor';
    city.money=Math.max(city.money, 300); updateHUD();
    selectedFloor=idx; renderShop();
    const btn=el.shop.querySelector('.shop-btn:not(:disabled)');
    if(btn){ btn.click(); return 'bought'; }
    return 'none affordable';
  },
  spawnVisitor(){ spawnChar(); },
  flush(){ flushMissions(); saveCity(); },
};
