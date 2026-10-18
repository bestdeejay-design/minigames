'use strict';
/* Рулетка — европейское колесо в стиле AXIIOM. canvas + vanilla JS, без зависимостей.
   Мета: стрик, ежедневные миссии, рекорд банка. Банк сохраняется между сессиями.
   Пересборка: один цикл отрисовки, сохраняемый банк, миссии, welcome-экран. */

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
const el={
  welcome:$('welcome'), game:$('game'),
  money:$('money-val'), betV:$('bet-val'), bestV:$('best-val'), resultV:$('result-val'),
  streakN:$('streak-n'), multN:$('mult-n'), missionsN:$('missions-n'),
  wMoney:$('w-money'), wBest:$('w-best'), wStreak:$('w-streak'),
  modal:$('modal'), modalCard:$('modal-card'), modalBadge:$('modal-badge'), modalTitle:$('modal-title'), modalScore:$('modal-score'),
  mmodal:$('mmodal'), mlist:$('mmodal-list'), toasts:$('toasts'),
  decoRow:$('deco-row'), numGrid:$('num-grid'), btnSpin:$('btn-spin')
};

// ---------- звук ----------
let AC=null;
let muted=lsGet('roulette.muted', false);
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
  chip(){ tone(1400, 1000, 0.05, 'triangle', 0.05); },
  spin(){ tone(220, 380, 0.5, 'sawtooth', 0.03); },
  tick(){ tone(1900, 1900, 0.03, 'square', 0.02); },
  win(){ [523,659,784,1047,1319].forEach((f,i)=>tone(f, f, 0.17, 'sine', 0.06, i*0.09)); },
  lose(){ tone(220, 130, 0.35, 'sine', 0.04); },
  mission(){ tone(880, 880, 0.1, 'sine', 0.1); tone(1174, 1174, 0.16, 'sine', 0.1, 0.1); },
  record(){ [659,784,1047,1319].forEach((f,i)=>tone(f, f, 0.18, 'sine', 0.06, i*0.105)); },
  click(){ tone(440, 440, 0.04, 'sine', 0.05); }
};

// ---------- стрик ----------
const getMult = s => 1 + Math.min(Math.max(s-1,0),10)*0.05;
let streak = lsGet('roulette.streak', 0), lastDay = lsGet('roulette.lastDay', '');
function effStreak(){ return (lastDay===today || lastDay===yesterday) ? streak : 0; }
function refreshMult(){ mult = effStreak()>0 ? getMult(streak) : 1; }
function markDay(){
  if(lastDay===today){ mult=getMult(streak); return; }
  streak = (lastDay===yesterday) ? (streak||0)+1 : 1;
  lastDay = today;
  lsSet('roulette.streak', streak); lsSet('roulette.lastDay', lastDay);
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
  {id:'wins3',     t:()=>'Выиграй 3 спина (за день)',               n:3,  cum:true},
  {id:'bank1500',  t:()=>'Доведи банк до 1500',                     n:1500},
  {id:'red5',      t:()=>'Поставь на красное 5 раз (за день)',      n:5,  cum:true},
  {id:'straight1', t:()=>'Угадай число точно (×35)',                n:1},
  {id:'spins10',   t:()=>'Сделай 10 спинов (за день)',              n:10, cum:true},
  {id:'black2',    t:()=>'Выиграй на чёрное 2 раза (за день)',      n:2,  cum:true},
  {id:'profit300', t:()=>'Получи +300 за один спин',                n:300},
  {id:'hitZero',   t:()=>'Выиграй, когда выпал зеро',               n:1}
];
let missions=[], mState=lsGet('roulette.missions.'+today, {});
let mDirty=false;
function flushMissions(){ if(!mDirty) return; mDirty=false; lsSet('roulette.missions.'+today, mState); }
function pickMissions(){
  const seed = xmur3('roulette-missions-'+today)();
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
    const reward = Math.round(50*mult);
    bank += reward;
    toast(`🎯 Миссия: <b>${def.t()}</b> · +<b>${reward}</b> фишек`);
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

// ---------- колесо ----------
const REDS=new Set([1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36]);
const WHEEL_ORDER=[0,32,15,19,4,21,2,25,17,34,6,27,13,36,11,30,8,23,10,5,24,16,33,1,20,14,31,9,22,18,29,7,28,12,35,3,26];
const SECTOR_COUNT=37, SECTOR_ANGLE=Math.PI*2/SECTOR_COUNT;
const PAYOUTS={straight:35, red:1, black:1, odd:1, even:1, '1-18':1, '19-36':1};

function numColor(n){ return n===0?'#2E5C46':REDS.has(n)?'#8A3A3A':'#1E1E2E'; }

let cw=0, ch=0, dpr=1;
function fitCanvas(){
  const rect=canvas.parentElement.getBoundingClientRect();
  dpr=Math.min(window.devicePixelRatio||1, 2);
  cw=Math.floor(rect.width);
  ch=Math.floor(cw*0.72);
  canvas.width=cw*dpr; canvas.height=ch*dpr;
  canvas.style.width=cw+'px'; canvas.style.height=ch+'px';
  ctx.setTransform(dpr,0,0,dpr,0,0);
}

// ---------- состояние ----------
let bank=lsGet('roulette.bank', 1000);
let best=lsGet('roulette.best', 0);
let dailyBest=lsGet('roulette.daily.'+today, 0);
let chipValue=10;
let bets={};
let totalBet=0;
let wheelAngle=0, _rawAngle=0;
let spinning=false, result=null;
let spinStartAngle=0, spinTargetAngle=0, spinStartTime=0, spinDuration=3500;
let sparks=[];
let animId=null, lastT=0, paused=false;
let spinsCount=0, redBets=0, winsCount=0, blackWins=0;

function saveBank(){ lsSet('roulette.bank', Math.round(bank)); }

// ---------- ставки ----------
function buildBetGrid(){
  el.numGrid.innerHTML='';
  const zero=document.createElement('button');
  zero.dataset.bet='n0'; zero.className='b-green';
  zero.innerHTML='<span>0</span>';
  zero.addEventListener('click',()=>placeBet('n0'));
  el.numGrid.appendChild(zero);
  for(let n=1;n<=36;n++){
    const btn=document.createElement('button');
    btn.dataset.bet='n'+n;
    btn.className=REDS.has(n)?'b-red':'b-black';
    btn.innerHTML='<span>'+n+'</span>';
    btn.addEventListener('click',()=>placeBet('n'+n));
    el.numGrid.appendChild(btn);
  }
}
function placeBet(key){
  if(spinning) return;
  if(bank<chipValue){ toast('Недостаточно фишек — минимальная ставка <b>5</b>'); return; }
  bank-=chipValue; totalBet+=chipValue;
  bets[key]=(bets[key]||0)+chipValue;
  if(key==='red') { redBets++; missionProgress('red5',1); }
  snd.chip();
  updateHUD(); updateGrid();
}
function clearBets(){
  if(spinning) return;
  for(const key in bets) bank+=bets[key];
  bets={}; totalBet=0;
  updateHUD(); updateGrid();
}
function updateGrid(){
  document.querySelectorAll('#num-grid button, #outside-bets .ob').forEach(btn=>{
    const key=btn.dataset.bet;
    const amt=bets[key];
    let chip=btn.querySelector('.chip-count');
    if(amt>0){
      if(!chip){ chip=document.createElement('span'); chip.className='chip-count'; btn.appendChild(chip); }
      chip.textContent=amt;
    } else if(chip) chip.remove();
  });
}
function updateHUD(){
  el.money.textContent=Math.round(bank);
  el.betV.textContent=Math.round(totalBet);
  el.bestV.textContent=best;
  el.wMoney.textContent=Math.round(bank);
  el.wBest.textContent=best;
  el.wStreak.textContent='🔥 '+effStreak();
  el.streakN.textContent=effStreak();
  el.multN.textContent='×'+mult.toFixed(2);
  el.btnSpin.disabled=totalBet===0||spinning;
}

// ---------- отрисовка колеса ----------
function drawWheel(){
  const cx=cw/2, cy=ch/2;
  const outerR=Math.min(cw,ch)*0.44;

  ctx.fillStyle='#0B0B14';
  ctx.fillRect(0,0,cw,ch);

  ctx.fillStyle='rgba(0,0,0,.45)';
  ctx.beginPath(); ctx.arc(cx+2,cy+3,outerR+6,0,Math.PI*2); ctx.fill();

  ctx.beginPath(); ctx.arc(cx,cy,outerR+4,0,Math.PI*2);
  ctx.fillStyle='#221A10'; ctx.fill();
  // золотые ромбы
  const diamondR=outerR+2;
  for(let i=0;i<8;i++){
    const da=i*Math.PI/4+wheelAngle;
    const dx=cx+Math.cos(da)*diamondR, dy=cy+Math.sin(da)*diamondR;
    ctx.fillStyle='#D4A574';
    ctx.beginPath();
    ctx.moveTo(dx,dy-3); ctx.lineTo(dx+2,dy); ctx.lineTo(dx,dy+3); ctx.lineTo(dx-2,dy);
    ctx.closePath(); ctx.fill();
  }

  for(let i=0;i<SECTOR_COUNT;i++){
    const a0=i*SECTOR_ANGLE+wheelAngle, a1=a0+SECTOR_ANGLE;
    const n=WHEEL_ORDER[i];
    ctx.beginPath();
    ctx.moveTo(cx,cy);
    ctx.arc(cx,cy,outerR,a0,a1);
    ctx.closePath();
    ctx.fillStyle=numColor(n);
    ctx.fill();
    ctx.strokeStyle='rgba(10,10,15,.6)'; ctx.lineWidth=0.6; ctx.stroke();
  }

  const innerR=outerR*0.64;
  ctx.beginPath(); ctx.arc(cx,cy,innerR,0,Math.PI*2);
  ctx.fillStyle='#12121A'; ctx.fill();
  ctx.strokeStyle='#8A7350'; ctx.lineWidth=2; ctx.stroke();
  for(let i=0;i<12;i++){
    const da=i*Math.PI/6+wheelAngle;
    const dx=cx+Math.cos(da)*(innerR-2), dy=cy+Math.sin(da)*(innerR-2);
    ctx.fillStyle=i%2===0?'rgba(255,255,255,.2)':'rgba(212,165,116,.2)';
    ctx.beginPath(); ctx.arc(dx,dy,2,0,Math.PI*2); ctx.fill();
  }

  const hubR=innerR*0.55;
  ctx.beginPath(); ctx.arc(cx,cy,hubR,0,Math.PI*2);
  ctx.fillStyle='#1A1A24'; ctx.fill();
  ctx.strokeStyle='#5C4A30'; ctx.lineWidth=1.5; ctx.stroke();
  const grad=ctx.createRadialGradient(cx-hubR*0.2,cy-hubR*0.2,0,cx,cy,hubR);
  grad.addColorStop(0,'#3A2C1C'); grad.addColorStop(1,'#1A1424');
  ctx.beginPath(); ctx.arc(cx,cy,hubR*0.7,0,Math.PI*2);
  ctx.fillStyle=grad; ctx.fill();

  ctx.save();
  for(let i=0;i<SECTOR_COUNT;i++){
    const mid=(i+0.5)*SECTOR_ANGLE+wheelAngle;
    const n=WHEEL_ORDER[i];
    const r=(outerR+innerR)/2;
    const x=cx+Math.cos(mid)*r, y=cy+Math.sin(mid)*r;
    ctx.translate(x,y);
    ctx.rotate(mid+Math.PI/2);
    ctx.fillStyle='#EDEDF0';
    ctx.font=`bold ${Math.max(7,Math.round(outerR*0.09))}px Inter, sans-serif`;
    ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillText(n,0,0);
    ctx.rotate(-mid-Math.PI/2);
    ctx.translate(-x,-y);
  }
  ctx.restore();

  // указатель
  ctx.fillStyle='#E4545F';
  ctx.beginPath();
  ctx.moveTo(cx-7, cy-outerR-13);
  ctx.lineTo(cx+7, cy-outerR-13);
  ctx.lineTo(cx, cy-outerR+1);
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle='#F08A94'; ctx.lineWidth=1; ctx.stroke();
}
function drawBall(progress){
  const cx=cw/2, cy=ch/2;
  const outerR=Math.min(cw,ch)*0.44;
  if(spinning&&progress<1){
    const ballAngle=wheelAngle+Math.sin(progress*12)*(1-progress)*4+progress*6;
    const br=outerR*(0.88-progress*0.22);
    for(let t=1;t<=3;t++){
      const ta=ballAngle-t*0.15;
      ctx.beginPath();
      ctx.arc(cx+Math.cos(ta)*br, cy+Math.sin(ta)*br, outerR*0.055*(1-t*0.2), 0, Math.PI*2);
      ctx.fillStyle=`rgba(255,255,255,${0.2-t*0.05})`; ctx.fill();
    }
    ctx.beginPath();
    ctx.arc(cx+Math.cos(ballAngle)*br, cy+Math.sin(ballAngle)*br, outerR*0.055, 0, Math.PI*2);
    ctx.fillStyle='#EDEDF0'; ctx.fill();
    ctx.strokeStyle='#D4A574'; ctx.lineWidth=1; ctx.stroke();
  } else if(result!==null){
    const idx=WHEEL_ORDER.indexOf(result);
    const mid=(idx+0.5)*SECTOR_ANGLE+wheelAngle;
    const br=outerR*0.57;
    const bx=cx+Math.cos(mid)*br, by=cy+Math.sin(mid)*br;
    const size=outerR*0.05;
    ctx.beginPath(); ctx.arc(bx,by,size+3,0,Math.PI*2);
    ctx.strokeStyle='rgba(212,165,116,.35)'; ctx.lineWidth=2; ctx.stroke();
    ctx.beginPath(); ctx.arc(bx,by,size,0,Math.PI*2);
    ctx.fillStyle='#EDEDF0'; ctx.fill();
    ctx.strokeStyle='#D4A574'; ctx.lineWidth=1.5; ctx.stroke();
  }
}
function draw(){
  drawWheel();
  drawBall(spinProgress());
  // конфетти
  for(let i=sparks.length-1;i>=0;i--){
    const p=sparks[i];
    p.x+=p.vx; p.y+=p.vy; p.vy+=0.07; p.life--;
    if(p.life<=0){ sparks.splice(i,1); continue; }
    ctx.globalAlpha=Math.max(0,p.life/p.max);
    ctx.fillStyle=p.c;
    ctx.beginPath(); ctx.arc(p.x,p.y,p.r,0,Math.PI*2); ctx.fill();
  }
  ctx.globalAlpha=1;
}
const spinProgress=()=>spinning?Math.min((performance.now()-spinStartTime)/spinDuration,1):1;

function confetti(){
  const cx=cw/2, cy=ch/2;
  for(let i=0;i<34;i++){
    const a=Math.random()*Math.PI*2, v=1.5+Math.random()*3.5;
    sparks.push({x:cx, y:cy, vx:Math.cos(a)*v, vy:Math.sin(a)*v-1.5, life:44, max:44, r:1.5+Math.random()*2.5,
      c:['#E8B04B','#D4A574','#F5D9A8','#8B9D83'][(Math.random()*4)|0]});
  }
}

// ---------- спин ----------
function startSpin(){
  if(totalBet===0||spinning) return;
  const resultNum=Math.floor(Math.random()*37);
  result=resultNum;
  const idx=WHEEL_ORDER.indexOf(resultNum);
  const sectorMid=(idx+0.5)*SECTOR_ANGLE;
  const finalAngle=-Math.PI/2-sectorMid;
  const finalNorm=((finalAngle%(Math.PI*2))+Math.PI*2)%(Math.PI*2);
  const fullTurns=5+Math.floor(Math.random()*4);
  spinStartAngle=_rawAngle;
  const extra=finalNorm-(spinStartAngle%(Math.PI*2));
  spinTargetAngle=spinStartAngle+fullTurns*Math.PI*2+(extra>=0?extra:extra+Math.PI*2);
  spinStartTime=performance.now();
  spinning=true;
  el.btnSpin.disabled=true;
  el.resultV.textContent='…';
  snd.spin();
  let tickN=0;
  const rattle=setInterval(()=>{
    tickN++;
    if(!spinning||muted){ clearInterval(rattle); return; }
    snd.tick();
    if(tickN>26) clearInterval(rattle);
  },130);
  updateHUD();
}
function stepSpin(){
  if(!spinning) return;
  const progress=spinProgress();
  const eased=1-Math.pow(1-progress,3);
  _rawAngle=spinStartAngle+(spinTargetAngle-spinStartAngle)*eased;
  wheelAngle=_rawAngle%(Math.PI*2);
  if(progress>=1){
    _rawAngle=spinTargetAngle;
    wheelAngle=spinTargetAngle%(Math.PI*2);
    spinning=false;
    payOut();
  }
}

// ---------- выплаты ----------
function payOut(){
  let win=0, straightHit=false;
  const n=result;
  const isRed=REDS.has(n);
  const isEven=n!==0&&n%2===0;
  const isOdd=n!==0&&n%2===1;
  for(const key in bets){
    const amt=bets[key];
    if(key==='n'+n){ win+=amt+amt*PAYOUTS.straight; straightHit=true; }
    else if(key==='red'&&isRed) win+=amt+amt*PAYOUTS.red;
    else if(key==='black'&&!isRed&&n!==0){ win+=amt+amt*PAYOUTS.black; }
    else if(key==='odd'&&isOdd) win+=amt+amt*PAYOUTS.odd;
    else if(key==='even'&&isEven) win+=amt+amt*PAYOUTS.even;
    else if(key==='1-18'&&n>=1&&n<=18) win+=amt+amt*PAYOUTS['1-18'];
    else if(key==='19-36'&&n>=19&&n<=36) win+=amt+amt*PAYOUTS['19-36'];
  }
  if(bets['black']&&!isRed&&n!==0) blackWins++;
  bets={}; totalBet=0;
  bank+=win;
  spinsCount++;
  missionProgress('spins10',1);
  missionProgress('bank1500', Math.round(bank));
  if(win>0){
    winsCount++;
    missionProgress('wins3',1);
    missionProgress('profit300', Math.round(win));
    if(straightHit) missionProgress('straight1',1);
    if(n===0) missionProgress('hitZero',1);
  }
  if(blackWins>0) missionProgress('black2', blackWins);

  markDay();
  const isDailyRec=Math.round(bank)>dailyBest;
  if(isDailyRec){ dailyBest=Math.round(bank); lsSet('roulette.daily.'+today, dailyBest); }
  const isRec=Math.round(bank)>best;
  if(isRec){ best=Math.round(bank); lsSet('roulette.best', best); }
  flushMissions(); saveBank();

  const color=n===0?'зелёное':isRed?'красное':'чёрное';
  el.resultV.textContent=n+' '+(isRed?'●':n===0?'◆':'●');
  snd[win>0?'win':'lose']();
  if(win>0) confetti();
  if(isRec&&best>1000){ toast('🏆 Новый рекорд банка: <b>'+best+'</b>!'); snd.record(); }

  el.modalBadge.textContent=isRec?'Новый рекорд банка':(win>0?'Выигрыш':'Проигрыш');
  el.modalBadge.classList.toggle('record', isRec);
  el.modalCard.classList.toggle('modal-record', isRec);
  el.modalTitle.textContent=win>0?`+${Math.round(win)} фишек`:`Выпало ${n}`;
  el.modalScore.innerHTML=`Число <b>${n}</b> (${color}) · Банк: <b>${Math.round(bank)}</b> · Спин #${spinsCount}`;
  el.modalBtn.textContent='Ещё!';
  el.modalBtn.onclick=()=>{
    snd.click();
    el.modal.classList.add('hidden');
    if(bank<5){
      bank=1000; saveBank();
      toast('Банк закончился — выдано <b>1000</b> фишек на новый заход');
    }
    updateHUD();
  };
  el.modal.classList.remove('hidden');
  updateHUD(); updateGrid();
}

// ---------- цикл ----------
function loop(now){
  animId=requestAnimationFrame(loop);
  if(!lastT) lastT=now;
  const delta=Math.min(now-lastT,100); lastT=now;
  if(!paused){
    stepSpin();
  }
  draw();
}

// ---------- ввод/экраны ----------
el.btnSpin.addEventListener('click',()=>startSpin());
$('btn-clear').addEventListener('click',()=>{ clearBets(); });
document.querySelectorAll('.chip-btn').forEach(btn=>{
  btn.addEventListener('click',()=>{
    document.querySelectorAll('.chip-btn').forEach(b=>b.classList.remove('active'));
    btn.classList.add('active');
    chipValue=parseInt(btn.dataset.val);
    snd.click();
  });
});
document.querySelectorAll('#outside-bets .ob').forEach(btn=>{
  btn.addEventListener('click',()=>placeBet(btn.dataset.bet));
});

$('btn-play').addEventListener('click',()=>{ snd.click(); startGame(); });
$('btn-menu').addEventListener('click',()=>{ snd.click(); toMenu(); });
$('btn-missions').addEventListener('click',openMissions);
$('missions-chip').addEventListener('click',openMissions);
$('mmodal-btn').addEventListener('click',()=>{ snd.click(); el.mmodal.classList.add('hidden'); });
function openMissions(){ snd.click(); renderMissionsModal(); el.mmodal.classList.remove('hidden'); }

$('btn-reset-bank').addEventListener('click',()=>{
  snd.click();
  bank=1000; bets={}; totalBet=0;
  saveBank(); updateHUD();
  toast('Банк сброшен до <b>1000</b> фишек');
});

function updateSoundBtn(){ $('btn-sound').textContent=muted?'🔇':'🔊'; }
$('btn-sound').addEventListener('click',()=>{
  muted=!muted; lsSet('roulette.muted', muted);
  updateSoundBtn(); if(!muted) snd.click();
});
updateSoundBtn();

document.addEventListener('visibilitychange',()=>{ paused=document.hidden; });

function startGame(){
  el.welcome.classList.add('hidden');
  el.modal.classList.add('hidden');
  el.game.classList.remove('hidden');
  fitCanvas();
  updateHUD(); updateGrid();
}
function toMenu(){
  el.game.classList.add('hidden');
  el.modal.classList.add('hidden');
  el.welcome.classList.remove('hidden');
  saveBank();
  updateHUD();
}

function onResize(){
  if(el.game.classList.contains('hidden')) return;
  fitCanvas();
}
window.addEventListener('resize', onResize);
if(window.visualViewport) window.visualViewport.addEventListener('resize', onResize);

// ---------- init ----------
(function init(){
  for(let i=0;i<7;i++) el.decoRow.appendChild(document.createElement('i'));
  pickMissions(); renderMissionsChip();
  buildBetGrid();
  fitCanvas();
  updateHUD();
  animId=requestAnimationFrame(loop);
})();

// ---------- debug hooks ----------
window.__rl={
  get balance(){ return Math.round(bank); },
  get spinning(){ return spinning; },
  get result(){ return result; },
  get best(){ return best; },
  get missionsDone(){ return missions.filter(m=>(mState[m.id]||{}).done).length; },
  bet(key){ placeBet(key); },
  spin(){ startSpin(); },
  flush(){ flushMissions(); saveBank(); },
};
