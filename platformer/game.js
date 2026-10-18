'use strict';
/* Платформер — 8 уровней в стиле AXIIOM. canvas + vanilla JS, без зависимостей.
   Мета: стрик-множитель, ежедневные миссии, рекорды. Движок: fixed timestep, coyote time,
   jump buffer, squash & stretch, частицы. Пересборка: welcome-экран, мета, честные рекорды. */

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

// ---------- DOM ----------
const canvas=$('gc'), ctx=canvas.getContext('2d');
const W=400, H=300;
const DPR=Math.min(window.devicePixelRatio||1, 2);
canvas.width=W*DPR; canvas.height=H*DPR;

const el={
  welcome:$('welcome'), game:$('game'),
  score:$('score-val'), daily:$('daily-val'), best:$('best-val'), levelV:$('level-val'),
  streakN:$('streak-n'), multN:$('mult-n'), missionsN:$('missions-n'), coinsN:$('coins-n'),
  wDaily:$('w-daily-best'), wBest:$('w-best'), wStreak:$('w-streak'),
  modal:$('modal'), modalCard:$('modal-card'), modalBadge:$('modal-badge'), modalTitle:$('modal-title'), modalScore:$('modal-score'),
  mmodal:$('mmodal'), mlist:$('mmodal-list'), toasts:$('toasts'), dailyDate:$('daily-date'),
  decoRow:$('deco-row'), levelIntro:$('level-intro')
};

// ---------- звук ----------
let AC=null;
let muted=lsGet('platformer.muted', false);
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
  jump(){ tone(340, 600, 0.14, 'square', 0.045); },
  coin(){ tone(880, 880, 0.09, 'sine', 0.06); tone(1320, 1320, 0.12, 'sine', 0.05, 0.055); },
  death(){ tone(220, 60, 0.3, 'sawtooth', 0.06); tone(110, 50, 0.4, 'square', 0.04); },
  win(){ [523,659,784,1047].forEach((f,i)=>tone(f, f, 0.16, 'sine', 0.06, i*0.095)); },
  mission(){ tone(880, 880, 0.1, 'sine', 0.1); tone(1174, 1174, 0.16, 'sine', 0.1, 0.1); },
  record(){ [523,659,784,1047,1568].forEach((f,i)=>tone(f, f, 0.2, 'triangle', 0.09, i*0.11)); },
  click(){ tone(440, 440, 0.04, 'sine', 0.05); }
};

// ---------- стрик ----------
const getMult = s => 1 + Math.min(Math.max(s-1,0),10)*0.05;
let streak = lsGet('platformer.streak', 0), lastDay = lsGet('platformer.lastDay', '');
function effStreak(){ return (lastDay===today || lastDay===yesterday) ? streak : 0; }
function refreshMult(){ mult = effStreak()>0 ? getMult(streak) : 1; }
function markDay(){
  if(lastDay===today){ mult=getMult(streak); return; }
  streak = (lastDay===yesterday) ? (streak||0)+1 : 1;
  lastDay = today;
  lsSet('platformer.streak', streak); lsSet('platformer.lastDay', lastDay);
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
  {id:'allCoins2', t:()=>'Собери все монеты в уровне',            n:2,  cum:true},
  {id:'clean3',    t:()=>'Пройди уровень без смертей',            n:3,  cum:true},
  {id:'level5',    t:()=>'Дойди до 5-го уровня',                  n:5},
  {id:'coins25',   t:()=>'Собери 25 монет (за день)',             n:25, cum:true},
  {id:'score300',  t:()=>'Набери 300 очков (суммарно за день)',   n:300, cum:true},
  {id:'game1',     t:()=>'Пройди все 8 уровней',                  n:1},
  {id:'row2',      t:()=>'Пройди 2 уровня подряд без смертей',    n:2,  cum:true},
  {id:'score500',  t:()=>'Набери 500 очков (суммарно за день)',   n:500, cum:true}
];
let missions=[], mState=lsGet('platformer.missions.'+today, {});
let mDirty=false;
function flushMissions(){ if(!mDirty) return; mDirty=false; lsSet('platformer.missions.'+today, mState); }
function pickMissions(){
  const seed = xmur3('platformer-missions-'+today)();
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

// ---------- константы физики ----------
const GRAVITY=0.42, MOVE_ACC=0.55, MOVE_MAX=3.1,
      FRICTION=0.82, JUMP_V=-8.3, JUMP_CUT=0.42,
      COYOTE=7, BUFFER=7, MAX_FALL=11;

// ---------- ввод ----------
const keys={left:false, right:false};
let jumpQueued=0;
function pressJump(){ jumpQueued=BUFFER; audio(); }
document.addEventListener('keydown', e=>{
  if(e.key==='ArrowLeft'||e.key==='a'||e.key==='ф') keys.left=true;
  if(e.key==='ArrowRight'||e.key==='d'||e.key==='в') keys.right=true;
  if(e.key==='ArrowUp'||e.key==='w'||e.key===' '||e.key==='ц'){ if(!e.repeat) pressJump(); e.preventDefault(); }
  if(e.key==='r'||e.key==='к') restartLevel();
  if(e.key==='m'||e.key==='ь') $('btn-sound').click();
});
document.addEventListener('keyup', e=>{
  if(e.key==='ArrowLeft'||e.key==='a'||e.key==='ф') keys.left=false;
  if(e.key==='ArrowRight'||e.key==='d'||e.key==='в') keys.right=false;
  if(e.key==='ArrowUp'||e.key==='w'||e.key===' '){
    if(player.vy<0) player.vy*=JUMP_CUT;
  }
});
function bindHold(id, down, up){
  const elx=$(id);
  const d=e=>{ e.preventDefault(); down(); };
  const u=e=>{ e.preventDefault(); up&&up(); };
  elx.addEventListener('touchstart', d, {passive:false});
  elx.addEventListener('touchend', u, {passive:false});
  elx.addEventListener('touchcancel', u, {passive:false});
  elx.addEventListener('mousedown', d);
  elx.addEventListener('mouseup', u);
  elx.addEventListener('mouseleave', ()=>up&&up());
}

// ---------- уровни ----------
const LEVELS=[
  { name:'Разминка', w:700, spawn:[40,210], sky:'#0E0E16',
    platforms:[{x:0,y:260,w:250,h:40},{x:330,y:260,w:370,h:40},{x:150,y:200,w:70,h:12}],
    spikes:[], coins:[{x:170,y:165},{x:290,y:205},{x:420,y:215}], flag:{x:640,y:260} },
  { name:'Ступени', w:800, spawn:[30,210], sky:'#10101A',
    platforms:[{x:0,y:260,w:200,h:40},{x:260,y:260,w:130,h:40},{x:450,y:260,w:350,h:40},
               {x:210,y:212,w:44,h:10},{x:395,y:198,w:50,h:10},{x:560,y:212,w:50,h:10}],
    spikes:[], coins:[{x:225,y:178},{x:410,y:162},{x:580,y:178},{x:700,y:215}], flag:{x:745,y:260} },
  { name:'Пропасть', w:860, spawn:[30,210], sky:'#0D1018',
    platforms:[{x:0,y:260,w:240,h:40},{x:380,y:230,w:90,h:12},{x:580,y:260,w:280,h:40}],
    spikes:[{x:620,y:246,w:60,h:14}],
    coins:[{x:300,y:190},{x:405,y:190},{x:510,y:200},{x:640,y:200}], flag:{x:810,y:260} },
  { name:'Шипы', w:820, spawn:[30,210], sky:'#140D12',
    platforms:[{x:0,y:260,w:820,h:40},{x:150,y:196,w:60,h:12},{x:490,y:196,w:60,h:12}],
    spikes:[{x:340,y:246,w:80,h:14},{x:560,y:246,w:80,h:14}],
    coins:[{x:170,y:162},{x:510,y:162},{x:370,y:210},{x:720,y:215}], flag:{x:770,y:260} },
  { name:'Плывун', w:900, spawn:[30,210], sky:'#0C1216',
    platforms:[{x:0,y:260,w:200,h:40},{x:260,y:215,w:80,h:12,move:{axis:'x',range:120,speed:.02,phase:0}},
               {x:620,y:230,w:80,h:12},{x:790,y:260,w:110,h:40}],
    spikes:[], coins:[{x:420,y:170},{x:520,y:150},{x:650,y:190},{x:830,y:215}], flag:{x:850,y:260} },
  { name:'В небо', w:700, spawn:[30,210], sky:'#12101E',
    platforms:[{x:0,y:260,w:150,h:40},{x:190,y:215,w:70,h:12},{x:320,y:165,w:70,h:12},
               {x:450,y:120,w:70,h:12},{x:580,y:170,w:120,h:14}],
    spikes:[], coins:[{x:215,y:180},{x:345,y:130},{x:475,y:85},{x:640,y:135}], flag:{x:650,y:170} },
  { name:'Механика', w:900, spawn:[30,210], sky:'#101418',
    platforms:[{x:0,y:260,w:190,h:40},{x:240,y:170,w:70,h:12,move:{axis:'y',range:55,speed:.022,phase:0}},
               {x:410,y:200,w:70,h:12},{x:640,y:160,w:70,h:12,move:{axis:'x',range:80,speed:.02,phase:2}},
               {x:820,y:260,w:80,h:40}],
    spikes:[],
    coins:[{x:265,y:110},{x:435,y:165},{x:700,y:110},{x:850,y:215}], flag:{x:850,y:260} },
  { name:'Финал', w:1000, spawn:[30,210], sky:'#151020',
    platforms:[{x:0,y:260,w:170,h:40},{x:230,y:220,w:60,h:12},{x:360,y:180,w:60,h:12},
               {x:480,y:210,w:70,h:12,move:{axis:'x',range:90,speed:.02,phase:1}},
               {x:660,y:170,w:60,h:12},{x:780,y:220,w:60,h:12},{x:900,y:260,w:100,h:40}],
    spikes:[{x:130,y:246,w:30,h:14},{x:620,y:246,w:30,h:14},{x:840,y:246,w:50,h:14}],
    coins:[{x:250,y:185},{x:385,y:145},{x:540,y:160},{x:685,y:135},{x:805,y:185},{x:945,y:215}],
    flag:{x:950,y:260} },
];

// ---------- состояние ----------
const player={x:0, y:0, w:20, h:22, vx:0, vy:0, grounded:false, coyote:0, face:1, squash:0, onPlatform:null, fallV:0};
let level=0, score=0, coinCount=0, deaths=0, banked=0;
let dailyBest=lsGet('platformer.daily.'+today, 0), best=lsGet('platformer.best', 0);
let coins=[], particles=[], camX=0, shake=0, time=0;
let state='menu';               // menu | intro | play | transition | done
let recordBeaten=false;
let trail=[];
let deathsThisLevel=0, cleanRow=0;

// ---------- жизненный цикл уровня ----------
function loadLevel(i, noIntro){
  const L=LEVELS[i];
  player.x=L.spawn[0]; player.y=L.spawn[1];
  player.vx=0; player.vy=0; player.grounded=false; player.onPlatform=null; player.fallV=0;
  coins=L.coins.map(c=>({x:c.x, y:c.y, got:false, bob:Math.random()*6}));
  particles=[]; camX=0; shake=0; trail=[];
  time=0; deathsThisLevel=0;
  el.levelV.textContent=i+1;
  el.coinsN.textContent=coinCount;
  if(noIntro){ state='play'; return; }
  state='intro';
  showIntro(`Уровень ${i+1}`, L.name);
}
function showIntro(title, sub){
  el.levelIntro.innerHTML=`${title}<small>${sub}</small>`;
  el.levelIntro.classList.remove('hidden','fade');
  setTimeout(()=>el.levelIntro.classList.add('fade'), 900);
  setTimeout(()=>{ el.levelIntro.classList.add('hidden'); state='play'; }, 1400);
}
function restartLevel(){
  if(state!=='play') return;
  snd.click();
  score=banked;
  updateHUD();
  loadLevel(level, true);
}

// ---------- HUD/тосты/модалки ----------
function updateHUD(){
  el.score.textContent=score;
  el.daily.textContent=dailyBest;
  el.best.textContent=best;
  el.coinsN.textContent=coinCount;
  const lc=document.getElementById('lvl-chip');
  if(lc) lc.textContent=level+1;
}
function showWelcomeRecords(){
  el.wDaily.textContent=dailyBest;
  el.wBest.textContent=best;
  el.wStreak.textContent='🔥 '+effStreak();
}
function showModal(badge, title, body, isRec){
  el.modalBadge.textContent=badge;
  el.modalBadge.classList.toggle('record', isRec);
  el.modalCard.classList.toggle('modal-record', isRec);
  el.modalTitle.textContent=title;
  el.modalScore.innerHTML=body;
  el.modal.classList.remove('hidden');
  state='done';
}

// ---------- частицы ----------
function burst(x, y, n, colors, spd=2.4, life=34, grav=0.12){
  for(let i=0;i<n;i++){
    const a=Math.random()*Math.PI*2, v=(0.3+Math.random()*0.7)*spd;
    particles.push({x, y, vx:Math.cos(a)*v, vy:Math.sin(a)*v-0.6, life, max:life, grav, r:1.5+Math.random()*2,
      c:colors[(Math.random()*colors.length)|0]});
  }
}
function dust(x, y, n=4){
  for(let i=0;i<n;i++)
    particles.push({x:x+(Math.random()-.5)*12, y, vx:(Math.random()-.5)*.8, vy:-Math.random()*.7,
      life:20, max:20, grav:-0.005, r:1.5+Math.random()*1.5, c:'rgba(200,200,210,.4)'});
}

// ---------- физика ----------
function collide(a, b){ return a.x<b.x+b.w && a.x+a.w>b.x && a.y<b.y+b.h && a.y+a.h>b.y; }
function spikeHit(s){
  return player.x+4<s.x+s.w && player.x+player.w-4>s.x &&
         player.y+4<s.y+s.h && player.y+player.h>s.y;
}

function update(){
  time++;
  const L=LEVELS[level];

  for(const p of L.platforms){
    if(!p.move) continue;
    p.t=(p.t||0)+1;
    const off=Math.sin(p.t*p.move.speed*0.996+p.move.phase)*p.move.range;
    const nx=p.move.axis==='x'?p.baseX+off:p.baseX;
    const ny=p.move.axis==='y'?p.baseY+off:p.baseY;
    if(p._init){ p.dx=nx-p.x; p.dy=ny-p.y; }
    p.x=nx; p.y=ny; p._init=true;
  }
  if(player.onPlatform&&player.onPlatform.move){
    player.x+=player.onPlatform.dx||0;
    player.y+=player.onPlatform.dy||0;
  }

  if(keys.left){ player.vx-=MOVE_ACC; player.face=-1; }
  if(keys.right){ player.vx+=MOVE_ACC; player.face=1; }
  if(!keys.left&&!keys.right) player.vx*=FRICTION;
  player.vx=clamp(player.vx, -MOVE_MAX, MOVE_MAX);
  player.x+=player.vx;
  for(const p of L.platforms){
    if(collide(player, p)){
      if(player.vx>0) player.x=p.x-player.w;
      else if(player.vx<0) player.x=p.x+p.w;
      player.vx=0;
    }
  }

  player.vy=Math.min(player.vy+GRAVITY, MAX_FALL);
  const wasGrounded=player.grounded;
  player.grounded=false; player.onPlatform=null;
  player.y+=player.vy;
  for(const p of L.platforms){
    if(collide(player, p)){
      if(player.vy>0){
        player.y=p.y-player.h; player.vy=0;
        player.grounded=true; player.onPlatform=p;
      } else if(player.vy<0){
        player.y=p.y+p.h; player.vy=0;
      }
    }
  }

  if(!wasGrounded&&player.grounded){
    if(player.fallV>5){ dust(player.x+player.w/2-camX, player.y+player.h, 6); player.squash=1; if(player.fallV>9) shake=Math.max(shake,3); }
    else if(player.fallV>2) dust(player.x+player.w/2-camX, player.y+player.h, 3);
  }
  player.fallV=player.vy;

  if(player.grounded) player.coyote=COYOTE; else if(player.coyote>0) player.coyote--;
  if(jumpQueued>0){
    jumpQueued--;
    if(player.coyote>0){
      player.vy=JUMP_V; player.coyote=0; jumpQueued=0;
      player.squash=-1; snd.jump();
      dust(player.x+player.w/2-camX, player.y+player.h, 5);
    }
  }
  player.squash*=0.82;

  if(player.x<0) player.x=0;
  if(player.x+player.w>L.w) player.x=L.w-player.w;

  if(L.spikes.some(spikeHit)||player.y>H+60){ die(); return; }

  for(const c of coins){
    if(c.got) continue;
    c.bob+=0.09;
    const cy=c.y+Math.sin(c.bob)*3;
    if(player.x<c.x+9&&player.x+player.w>c.x-9&&player.y<cy+9&&player.y+player.h>cy-9){
      c.got=true; coinCount++; score+=10;
      snd.coin();
      burst(c.x-camX, cy, 10, ['#E8B04B','#D4A574','#F5D9A8'], 2, 26);
      missionProgress('coins25',1);
      updateHUD();
    }
  }

  const fl=L.flag;
  if(player.x+player.w>fl.x&&player.x<fl.x+14&&player.y+player.h>fl.y-44&&player.y<fl.y){
    completeLevel();
  }

  const targetX=clamp(player.x+player.w/2-W/2, 0, L.w-W);
  camX+=(targetX-camX)*0.12;
  if(shake>0) shake*=0.85;

  trail.push({x:player.x+player.w/2, y:player.y+player.h/2, life:10});
  if(trail.length>12) trail.shift();
  trail.forEach(t=>t.life--);

  particles=particles.filter(p=>p.life>0);
  for(const p of particles){ p.x+=p.vx; p.y+=p.vy; p.vy+=p.grav; p.life--; }
}

function die(){
  snd.death();
  deaths++; deathsThisLevel++;
  cleanRow=0;
  shake=7;
  burst(player.x+player.w/2-camX, player.y+player.h/2, 18, ['#C96A6A','#D4A574','#8E8E93'], 3, 30);
  score=banked;
  updateHUD();
  toast(`💀 Смерть ${deaths} · монеты уровня сброшены`);
  setTimeout(()=>{ if(state==='transition') loadLevel(level, true); }, 350);
  state='transition';
}

function completeLevel(){
  snd.win();
  const bonus=50;
  banked=score+bonus;
  score=banked;
  burst(player.x+player.w/2-camX, LEVELS[level].flag.y-30, 26, ['#E8B04B','#8B9D83','#F5F5F7'], 3.4, 46);

  // миссии уровня
  if(coins.every(c=>c.got)) missionProgress('allCoins2',1);
  if(deathsThisLevel===0){ missionProgress('clean3',1); cleanRow++; missionProgress('row2', cleanRow); }
  else cleanRow=0;
  missionProgress('level5', level+1);
  missionProgress('score300', score);
  missionProgress('score500', score);

  const isLast=level===LEVELS.length-1;
  markDay();
  const isDailyRec=score>dailyBest;
  if(isDailyRec){ dailyBest=score; lsSet('platformer.daily.'+today, dailyBest); }
  const isRec=score>best;
  if(isRec){ best=score; lsSet('platformer.best', best); }
  flushMissions();

  if(isLast){
    missionProgress('game1',1);
    flushMissions();
    snd[isRec?'record':'click']();
    showModal(isRec?'Новый рекорд':'Финал', 'Игра пройдена!',
      `Весь путь пройден!<br>Очки: <b>${score}</b> · Монеты: <b>${coinCount}</b> · Смерти: <b>${deaths}</b><br>Рекорд: <b>${best}</b>`, isRec);
    showWelcomeRecords(); updateHUD();
    return;
  }
  if(isRec&&!recordBeaten){ recordBeaten=true; snd.record(); }
  toast(`✅ Уровень ${level+1} пройден · +${bonus}`);
  updateHUD();
  level++;
  state='transition';
  setTimeout(()=>{ if(state==='transition') loadLevel(level); }, 600);
}

// движущиеся платформы: базовые позиции
for(const L of LEVELS)
  for(const p of L.platforms)
    if(p.move){ p.baseX=p.x; p.baseY=p.y; p.dx=0; p.dy=0; }

// ---------- отрисовка ----------
function roundRect(c,x,y,w,h,r){ r=Math.min(r,w/2,h/2); c.beginPath(); c.moveTo(x+r,y); c.arcTo(x+w,y,x+w,y+h,r); c.arcTo(x+w,y+h,x,y+h,r); c.arcTo(x,y+h,x,y,r); c.arcTo(x,y,x+w,y,r); c.closePath(); }

function draw(){
  const L=LEVELS[level];
  ctx.setTransform(DPR,0,0,DPR,0,0);
  ctx.clearRect(0,0,W,H);

  ctx.fillStyle=L.sky;
  ctx.fillRect(0,0,W,H);

  for(const [k, alpha, size] of [[0.25,0.5,1.4],[0.55,0.3,1]]){
    ctx.fillStyle=`rgba(212,165,116,${alpha*0.35})`;
    const off=(camX*k)%80;
    for(let gx=-off; gx<W+80; gx+=80)
      for(let gy=30; gy<H-40; gy+=55){
        const jx=gx+((gx*7+gy*13)%23), jy=gy+((gx*3+gy*5)%17);
        ctx.fillRect(jx, jy, size, size);
      }
  }

  const sx=shake>0.3?(Math.random()-.5)*shake*2:0;
  const sy=shake>0.3?(Math.random()-.5)*shake*2:0;
  ctx.translate(sx, sy);

  for(const p of L.platforms){
    ctx.fillStyle='#1A1A24';
    roundRect(ctx, p.x-camX, p.y, p.w, p.h, 4); ctx.fill();
    ctx.fillStyle='rgba(212,165,116,.35)';
    ctx.fillRect(p.x-camX+2, p.y, p.w-4, 2);
  }

  ctx.fillStyle='#C96A6A';
  for(const s of L.spikes){
    const n=Math.max(2, Math.round(s.w/10));
    const step=s.w/n;
    ctx.beginPath();
    for(let i=0;i<n;i++){
      ctx.moveTo(s.x-camX+i*step, s.y+s.h);
      ctx.lineTo(s.x-camX+i*step+step/2, s.y);
      ctx.lineTo(s.x-camX+(i+1)*step, s.y+s.h);
    }
    ctx.fill();
  }

  for(const c of coins){
    if(c.got) continue;
    const cx=c.x-camX, cy=c.y+Math.sin(c.bob)*3;
    const sq=Math.abs(Math.cos(c.bob*0.7));
    ctx.fillStyle='#E8B04B';
    ctx.beginPath(); ctx.ellipse(cx, cy, 7*(0.35+0.65*sq), 7, 0, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle='rgba(255,240,200,.85)';
    ctx.beginPath(); ctx.arc(cx-2*sq, cy-2, 1.6, 0, Math.PI*2); ctx.fill();
  }

  {
    const fx=L.flag.x-camX, fy=L.flag.y;
    ctx.strokeStyle='#8E8E93'; ctx.lineWidth=2;
    ctx.beginPath(); ctx.moveTo(fx+2, fy); ctx.lineTo(fx+2, fy-46); ctx.stroke();
    const wave=Math.sin(time*0.08)*3;
    ctx.fillStyle='#8B9D83';
    ctx.beginPath();
    ctx.moveTo(fx+3, fy-46);
    ctx.lineTo(fx+22, fy-39+wave);
    ctx.lineTo(fx+3, fy-30);
    ctx.closePath(); ctx.fill();
  }

  for(const t of trail){
    if(t.life<=0) continue;
    ctx.fillStyle=`rgba(212,165,116,${t.life/40})`;
    ctx.beginPath(); ctx.arc(t.x-camX, t.y, 3.5, 0, Math.PI*2); ctx.fill();
  }

  {
    const sq=player.squash;
    const w=player.w*(1+sq*0.25), h=player.h*(1-sq*0.25);
    const px=player.x-camX+(player.w-w)/2, py=player.y+(player.h-h);
    ctx.fillStyle='#D4A574';
    roundRect(ctx, px, py, w, h, 5); ctx.fill();
    ctx.fillStyle='#14100B';
    const ex=px+w/2+player.face*3;
    ctx.beginPath();
    ctx.arc(ex-3, py+7, 1.8, 0, Math.PI*2);
    ctx.arc(ex+3, py+7, 1.8, 0, Math.PI*2);
    ctx.fill();
  }

  for(const p of particles){
    ctx.globalAlpha=Math.max(0, p.life/p.max);
    ctx.fillStyle=p.c;
    ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI*2); ctx.fill();
  }
  ctx.globalAlpha=1;
}

// ---------- главный цикл (fixed timestep) ----------
const STEP=1000/60;
let acc=0, lastT=0;
function loop(now){
  requestAnimationFrame(loop);
  if(!lastT) lastT=now;
  acc+=Math.min(now-lastT, 100);
  lastT=now;
  while(acc>=STEP){
    if(state==='play') update();
    acc-=STEP;
  }
  flushMissions();
  draw();
}

// ---------- экраны ----------
function startGame(){
  el.welcome.classList.add('hidden');
  el.modal.classList.add('hidden');
  el.game.classList.remove('hidden');
  score=0; banked=0; coinCount=0; deaths=0; level=0; recordBeaten=false; cleanRow=0;
  updateHUD();
  loadLevel(0);
}
function toMenu(){
  el.game.classList.add('hidden');
  el.modal.classList.add('hidden');
  el.welcome.classList.remove('hidden');
  state='menu';
  showWelcomeRecords();
}

bindHold('btn-left',  ()=>keys.left=true,  ()=>keys.left=false);
bindHold('btn-right', ()=>keys.right=true, ()=>keys.right=false);
bindHold('btn-jump',  ()=>pressJump(),     ()=>{ if(player.vy<0) player.vy*=JUMP_CUT; });

$('btn-play').addEventListener('click',()=>{ snd.click(); startGame(); });
$('btn-new').addEventListener('click',()=>{ snd.click(); if(state==='play') restartLevel(); });
$('btn-menu').addEventListener('click',()=>{ snd.click(); toMenu(); });
$('modal-btn').addEventListener('click',()=>{ snd.click(); el.modal.classList.add('hidden'); startGame(); });
$('btn-missions').addEventListener('click',openMissions);
$('missions-chip').addEventListener('click',openMissions);
$('mmodal-btn').addEventListener('click',()=>{ snd.click(); el.mmodal.classList.add('hidden'); });
function openMissions(){ snd.click(); renderMissionsModal(); el.mmodal.classList.remove('hidden'); }

function updateSoundBtn(){ $('btn-sound').textContent=muted?'🔇':'🔊'; }
$('btn-sound').addEventListener('click',()=>{
  muted=!muted; lsSet('platformer.muted', muted);
  updateSoundBtn(); if(!muted) snd.click();
});
updateSoundBtn();

['keydown','pointerdown','touchstart'].forEach(ev=>document.addEventListener(ev, audio, {passive:true}));

// ---------- init ----------
(function init(){
  for(let i=0;i<7;i++) el.decoRow.appendChild(document.createElement('i'));
  el.dailyDate.textContent='Рекорд дня · '+today;
  pickMissions(); renderMissionsChip();
  showWelcomeRecords(); updateHUD();
  requestAnimationFrame(loop);
})();

// ---------- debug hooks ----------
window.__pl={
  get state(){ return state; },
  get level(){ return level; },
  get score(){ return score; },
  get deaths(){ return deaths; },
  get best(){ return best; },
  get player(){ return player; },
  get coinsLeft(){ return coins.filter(c=>!c.got).length; },
  get missionsDone(){ return missions.filter(m=>(mState[m.id]||{}).done).length; },
  skipIntro(){ el.levelIntro.classList.add('hidden'); state='play'; },
  win(){ if(state==='play') completeLevel(); },
  kill(){ if(state==='play') die(); },
  grabAll(){ coins.forEach(c=>{ if(!c.got){ c.got=true; score+=10; coinCount++; } }); updateHUD(); },
  jump: pressJump,
  key: (k, v)=>{ keys[k]=v; },
  flush(){ flushMissions(); },
};
