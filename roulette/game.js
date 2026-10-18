'use strict';
/* ═══════════════ ЗОЛОТОЕ КОЛЕСО v2.0 · рулетка · AXIIOM canon ═══════════════ */
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
const sfx={
  tick(sp){ tone(900+sp*220,.03,'square',clamp(.02+sp*.05,.02,.08)); },
  drop(){ tone(500,.08,'triangle',.14,-180); },
  chip(){ tone(1500,.04,'square',.08); tone(1200,.05,'square',.06,0,.03); },
  win(){ [523,659,784,1046,1318].forEach((f,i)=>tone(f,.15,'triangle',.15,0,i*.07)); },
  lose(){ tone(240,.3,'sine',.12,-90); },
  bank(){ [392,523,659,784].forEach((f,i)=>tone(f,.12,'sine',.13,0,i*.08)); },
  click(){ tone(700,.05,'square',.07); },
};
/* ─── Хранилище/мета ─── */
const K_BANK='rl.bank',K_BEST='rl.best',K_STREAK='rl.streak',K_LASTDAY='rl.lastDay',K_MUTE='rl.muted',K_MISS='rl.missions.'+today,K_BONUS='rl.bonus.'+today;
const el={ bank:$('bank-val'),bet:$('bet-val'),best:$('best-val'),last:$('last-val'),streakN:$('streak-n'),multN:$('mult-n'),missionsN:$('missions-n'),wBest:$('w-best'),wStreak:$('w-streak'),wDaily:$('w-daily-best'),gc:$('gc'),history:$('history') };
const cv=el.gc,ctx=cv.getContext('2d');
/* ─── Состояние ─── */
let muted=lsGet(K_MUTE,false);
let mode='daily';
let bank=lsGet(K_BANK,1000),best=lsGet(K_BEST,1000);
let dailyBest=lsGet('rl.dailybest.'+today,bank>0?bank:1000);
let streak=lsGet(K_STREAK,0),lastDay=lsGet(K_LASTDAY,'');
let mult=1;
let bets={},chip=10,spinning=false;
let wheelA=0,wheelV=0,ballA=0,ballV=0,ballR=1,ballState='rest',restPocket=-1,deflectors=0;
let history=[],winCells=[],flyChips=[];
const ORDER=[0,32,15,19,4,21,2,25,17,34,6,27,13,36,11,30,8,23,10,5,24,16,33,1,20,14,31,9,22,18,29,7,28,12,35,3,26];
const REDS=new Set([1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36]);
let dailyRng=Math.random;
const sr=(a,b)=>a+dailyRng()*(b-a);
/* ─── Мета ─── */
function effStreak(){ return (lastDay===today||lastDay===yesterday)?streak:0; }
function getMult(s){ return 1+Math.min(Math.max(s-1,0),10)*0.05; }
function touchStreak(){ if(lastDay===today){ mult=getMult(streak); return; } streak=(lastDay===yesterday)?(streak||0)+1:1; lastDay=today; lsSet(K_STREAK,streak); lsSet(K_LASTDAY,lastDay); mult=getMult(streak); if(streak>1)toast(`🔥 Стрик <b>${streak}</b> · бонус миссий ×<b>${mult.toFixed(2)}</b>`); }
const MISSIONS=[
  {id:'win5',    name:'5 победных спинов',        target:5,  track:'wins'},
  {id:'red3',    name:'3 выигрыша на красном',    target:3,  track:'reds'},
  {id:'dozen2',  name:'2 выигрыша на дюжине',     target:2,  track:'dozens'},
  {id:'bank2k',  name:'Банк $2000 и больше',      target:2000,track:'bank'},
  {id:'straight',name:'Выигрыш на числе (×35)',   target:1,  track:'straights'},
  {id:'spins20', name:'Сделать 20 спинов',        target:20, track:'spins'},
  {id:'chips20', name:'Поставить 20 фишек',       target:20, track:'chips'},
  {id:'rich3k',  name:'Поймать банк $3000',       target:3000,track:'bank'},
];
let missionData=lsGet(K_MISS,{p:{},done:{}});
if(!missionData.p)missionData={p:{},done:{}};
function saveMissions(){ lsSet(K_MISS,missionData); }
function missionAward(mid){ if(missionData.done[mid])return; missionData.done[mid]=1; saveMissions(); const bonus=Math.round(60*mult); bank+=bonus; lsSet(K_BANK,bank); toast(`🎯 Миссия выполнена: <b>+$${bonus}</b> в банк`); sfx.bank(); refreshMissionsUI(); refreshStats(); }
function missionTick(track,val,absolute){ MISSIONS.forEach(m=>{ if(m.track!==track||missionData.done[m.id])return; if(absolute){ if(val>(missionData.p[m.id]||0))missionData.p[m.id]=val; } else missionData.p[m.id]=(missionData.p[m.id]||0)+val; if(missionData.p[m.id]>=m.target)missionAward(m.id); }); saveMissions(); refreshMissionsUI(); }
function refreshMissionsUI(){ const done=MISSIONS.filter(m=>missionData.done[m.id]).length; el.missionsN.textContent=done+'/3'; }
function renderMissionsModal(){ const list=$('mmodal-list'); list.innerHTML=''; MISSIONS.forEach(m=>{ const p=Math.min(missionData.p[m.id]||0,m.target); const done=!!missionData.done[m.id]; const d=document.createElement('div'); d.className='mm-item'+(done?' done':''); d.innerHTML=`<span class="mm-check">✓</span><span class="mm-body"><span class="mm-name">${m.name}</span><span class="mm-prog"><b>${fmt(p)}</b> / ${fmt(m.target)}</span></span>`; list.appendChild(d); }); }
function toast(html){ const t=document.createElement('span'); t.className='toast'; t.innerHTML=html; $('toasts').appendChild(t); setTimeout(()=>t.classList.add('out'),2600); setTimeout(()=>t.remove(),3000); }
/* ─── Ставки ─── */
function totalBets(){ return Object.values(bets).reduce((a,b)=>a+b,0); }
function placeBet(key){ if(spinning)return; if(bank<chip){ toast('Не хватает фишек в банке'); return; } bank-=chip; lsSet(K_BANK,bank); bets[key]=(bets[key]||0)+chip; sfx.chip(); missionTick('chips',1); refreshStats(); renderChips(); }
function clearBets(){ if(spinning||!Object.keys(bets).length)return; bank+=totalBets(); lsSet(K_BANK,bank); bets={}; sfx.click(); refreshStats(); renderChips(); }
function renderChips(){ document.querySelectorAll('.cell').forEach(c=>{ const k=c.dataset.bet; c.querySelector('.bet-chip')?.remove(); if(bets[k]){ const b=document.createElement('span'); b.className='bet-chip'; b.textContent=bets[k]; c.appendChild(b); } c.classList.remove('win'); }); }
/* ─── Спин ─── */
function spin(){ if(spinning)return; const tb=totalBets(); if(tb<=0){ toast('Сделай ставку на стол'); return; } if(bank<0)return; spinning=true; $('btn-spin').disabled=true; missionTick('spins',1); missionTick('bank',bank,true);
  /* результат: daily детерминирован, свободная — случайна */
  const idx=mode==='daily'?Math.floor(dailyRng()*37):Math.floor(Math.random()*37);
  const targetNum=ORDER[idx];
  wheelV=sr(4.5,6.5); ballV=-sr(11,14); ballR=1; ballState='rim'; deflectors=0; restPocket=-1;
  window.__target={idx,targetNum,tb};
  const bgT=Math.abs(ballV)/wheelV; window.__bgT=bgT;
}
function settle(num){
  const tb=totalBets(); let win=0; winCells=[];
  const color=num===0?'green':(REDS.has(num)?'red':'black');
  for(const [k,v] of Object.entries(bets)){ if(k[0]==='n'){ const n=+k.slice(1); if(n===num){ win+=v*36; winCells.push('n'+n); } }
    else if(k==='red'&&color==='red'){ win+=v*2; winCells.push('red'); }
    else if(k==='black'&&color==='black'){ win+=v*2; winCells.push('black'); }
    else if(k==='even'&&num!==0&&num%2===0){ win+=v*2; winCells.push('even'); }
    else if(k==='odd'&&num%2===1){ win+=v*2; winCells.push('odd'); }
    else if(k==='d1'&&num>=1&&num<=12){ win+=v*3; winCells.push('d1'); }
    else if(k==='d2'&&num>=13&&num<=24){ win+=v*3; winCells.push('d2'); }
    else if(k==='d3'&&num>=25&&num<=36){ win+=v*3; winCells.push('d3'); } }
  bank+=win; lsSet(K_BANK,bank);
  history.unshift(num); history=history.slice(0,12); renderHistory();
  el.last.textContent=num; el.last.style.color=num===0?'#7EC8E3':(REDS.has(num)?'#E4545F':'#C7C7CC');
  /* рекорды */
  if(bank>best){ best=bank; lsSet(K_BEST,best); }
  if(bank>dailyBest){ dailyBest=bank; lsSet('rl.dailybest.'+today,dailyBest); }
  missionTick('bank',bank,true);
  if(win>0){ sfx.win(); toast(num===0?`🟢 Зеро! Выигрыш <b>$${fmt(win)}</b>`:`${color==='red'?'🔴':'⚫'} <b>${num}</b> · выигрыш <b>$${fmt(win)}</b>`); missionTick('wins',1); if(color==='red'&&(bets.red))missionTick('reds',1); if((bets.d1||bets.d2||bets.d3)&&(winCells.some(c=>c[0]==='d')))missionTick('dozens',1); if(winCells.some(c=>c[0]==='n'))missionTick('straights',1);
    renderChips(); winCells.forEach(c=>{ const elc=document.querySelector(`[data-bet="${c}"]`); if(elc)elc.classList.add('win'); });
    flyChips.push({t:0}); }
  else { sfx.lose(); toast(`${num===0?'🟢 Зеро':(color==='red'?'🔴':'⚫')+' '+num} · мимо`); }
  bets={}; renderChips(); refreshStats(); spinning=false; $('btn-spin').disabled=false;
  /* банк обнулился? */
  if(bank<10){ setTimeout(()=>{ if(bank<10){ bank=1000; lsSet(K_BANK,bank); toast('💸 Банк на нуле — выдали кредит <b>$1000</b>'); sfx.bank(); refreshStats(); } },900); } }
function renderHistory(){ el.history.innerHTML=''; history.forEach(n=>{ const c=document.createElement('span'); c.className='h-cell '+(n===0?'green':(REDS.has(n)?'red':'black')); c.textContent=n; el.history.appendChild(c); }); }
/* ─── Рендер колеса ─── */
function render(){ const w=cv.width,h=cv.height,cx=w/2,cy=h/2; const R=w/2-6;
  ctx.clearRect(0,0,w,h);
  /* обод */
  ctx.fillStyle='#17171F'; ctx.beginPath(); ctx.arc(cx,cy,R+4,0,TAU); ctx.fill();
  ctx.strokeStyle='rgba(212,165,116,.55)'; ctx.lineWidth=2.5; ctx.beginPath(); ctx.arc(cx,cy,R+3,0,TAU); ctx.stroke();
  /* сектора */
  const seg=TAU/37;
  for(let i=0;i<37;i++){ const num=ORDER[i]; const a0=wheelA+i*seg,a1=a0+seg;
    ctx.beginPath(); ctx.moveTo(cx,cy); ctx.arc(cx,cy,R,a0,a1); ctx.closePath();
    ctx.fillStyle=num===0?'#2E5C43':(REDS.has(num)?'#7E3434':'#1B1B24'); ctx.fill();
    ctx.strokeStyle='rgba(212,165,116,.35)'; ctx.lineWidth=1; ctx.stroke();
    /* номер */
    const am=a0+seg/2; ctx.save(); ctx.translate(cx+Math.cos(am)*(R-11),cy+Math.sin(am)*(R-11)); ctx.rotate(am+Math.PI/2); ctx.fillStyle='#F5F5F7'; ctx.font='600 8px Inter,sans-serif'; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText(num,0,0); ctx.restore(); }
  /* дефлекторы */
  for(let i=0;i<8;i++){ const a=wheelA*.4+i*TAU/8; ctx.fillStyle='rgba(212,165,116,.8)'; ctx.beginPath(); ctx.arc(cx+Math.cos(a)*R*.62,cy+Math.sin(a)*R*.62,2.4,0,TAU); ctx.fill(); }
  /* ступица */
  ctx.fillStyle='#14141C'; ctx.beginPath(); ctx.arc(cx,cy,R*.3,0,TAU); ctx.fill(); ctx.strokeStyle='rgba(212,165,116,.5)'; ctx.lineWidth=2; ctx.stroke(); ctx.fillStyle='rgba(212,165,116,.35)'; ctx.beginPath(); ctx.arc(cx,cy,R*.08,0,TAU); ctx.fill();
  /* шар */
  const br=ballR; const ballRpx=R*(br>.5?(.82+ (1-br)*.14):.96);
  const drawA=(ballState==='rest'&&restPocket>=0)?(wheelA+restPocket*TAU/37+TAU/74):ballA;
  ctx.fillStyle='#F2EADC'; ctx.shadowColor='rgba(255,240,210,.9)'; ctx.shadowBlur=10; ctx.beginPath(); ctx.arc(cx+Math.cos(drawA)*ballRpx,cy+Math.sin(drawA)*ballRpx,5.5,0,TAU); ctx.fill(); ctx.shadowBlur=0;
  /* приземление: подсветка кармана */
  if(ballState==='rest'&&restPocket>=0){ const am=wheelA+restPocket*TAU/37+TAU/74; ctx.strokeStyle='rgba(212,165,116,.9)'; ctx.lineWidth=2; ctx.beginPath(); ctx.arc(cx+Math.cos(am)*(R-9),cy+Math.sin(am)*(R-9),7,0,TAU); ctx.stroke(); }
  /* летящие фишки выигрыша */
  flyChips.forEach(fc=>{ ctx.globalAlpha=1-fc.t; const fr=R*.5*(1-fc.t); ctx.fillStyle='#EFC878'; ctx.beginPath(); ctx.arc(cx+Math.cos(fc.t*9)*fr,cy+Math.sin(fc.t*9)*fr,6,0,TAU); ctx.fill(); }); ctx.globalAlpha=1; }
function update(dt){
  if(spinning){
    wheelA+=wheelV*dt; wheelV*=Math.pow(.35,dt); /* медленное торможение колеса */
    if(ballState==='rim'){ ballA+=ballV*dt; ballV*=Math.pow(.42,dt);
      const tickSp=Math.abs(ballV)/12; if(Math.random()<dt*Math.abs(ballV)*3)sfx.tick(tickSp);
      if(Math.abs(ballV)<2.6){ /* дефлекторы */ ballState='fall'; } }
    else if(ballState==='fall'){ ballA+=ballV*dt; ballV*=Math.pow(.12,dt); ballR-=dt*.5;
      if(Math.random()<dt*8){ ballA+=rand(-.06,.06); sfx.tick(.5); }
      if(ballR<=.45){ /* захват кармана */ const seg=TAU/37; let idx=Math.floor(((((ballA-wheelA)%TAU)+TAU)%TAU)/seg); idx=clamp(idx,0,36); restPocket=idx; ballState='rest';
        const num=ORDER[idx]; sfx.drop(); setTimeout(()=>settle(num),650); } } }
  else { wheelA+=0.05*dt; }
  flyChips=flyChips.filter(fc=>{ fc.t+=dt*1.4; return fc.t<1; });
}
/* ─── Цикл ─── */
let last=0,acc=0,rafId=0; const STEP=1/60;
function loop(ts){ rafId=requestAnimationFrame(loop); if(!last)last=ts; let dtms=ts-last; last=ts; if(dtms>200)dtms=200; acc+=dtms; let guard=0; while(acc>=STEP*1000&&guard++<6){ update(STEP); acc-=STEP*1000; } el.bank.textContent='$'+fmt(bank); render(); }
/* ─── Ввод ─── */
document.querySelectorAll('.cell').forEach(c=>c.addEventListener('click',()=>{ audioInit(); placeBet(c.dataset.bet); }));
document.querySelectorAll('.chip-btn').forEach(c=>c.addEventListener('click',()=>{ audioInit(); chip=+c.dataset.chip; document.querySelectorAll('.chip-btn').forEach(x=>x.classList.remove('active')); c.classList.add('active'); sfx.click(); }));
$('btn-spin').addEventListener('click',()=>{ audioInit(); spin(); });
$('btn-clear').addEventListener('click',()=>{ audioInit(); clearBets(); });
$('btn-missions').addEventListener('click',()=>{ renderMissionsModal(); $('mmodal').classList.remove('hidden'); });
$('missions-chip').addEventListener('click',()=>{ renderMissionsModal(); $('mmodal').classList.remove('hidden'); });
$('mmodal-btn').addEventListener('click',()=>$('mmodal').classList.add('hidden'));
$('btn-menu').addEventListener('click',()=>{ $('game').classList.add('hidden'); $('welcome').classList.remove('hidden'); refreshWelcome(); });
$('btn-play').addEventListener('click',()=>{ audioInit(); touchStreak(); if(mode==='daily')dailyRng=mulberry32(xmur3('roulette-'+today)()); else dailyRng=Math.random;
  /* ежедневный бонус */
  if(!lsGet(K_BONUS,false)){ bank+=150; lsSet(K_BANK,bank); lsSet(K_BONUS,true); toast('🎁 Бонус дня: <b>+$150</b>'); sfx.bank(); }
  $('welcome').classList.add('hidden'); $('game').classList.remove('hidden'); refreshStats(); renderChips(); renderHistory(); if(!rafId)rafId=requestAnimationFrame(loop); });
function syncSoundBtn(){ $('btn-sound').textContent=muted?'🔇':'🔊'; }
$('btn-sound').addEventListener('click',()=>{ muted=!muted; lsSet(K_MUTE,muted); if(master)master.gain.value=muted?0:0.5; syncSoundBtn(); if(!muted){ audioInit(); sfx.click(); } });
function refreshStats(){ el.bank.textContent='$'+fmt(bank); el.bet.textContent='$'+fmt(totalBets()); el.best.textContent='$'+fmt(best); }
function refreshWelcome(){ el.wBest.textContent='$'+fmt(best); el.wStreak.textContent='🔥 '+effStreak(); el.wDaily.textContent='$'+fmt(dailyBest); $('daily-date').textContent='Ежедневный бонус $150'; }
document.querySelector('.chip-btn[data-chip="10"]').classList.add('active');
refreshWelcome(); refreshStats(); refreshMissionsUI(); syncSoundBtn(); renderHistory();
/* ─── Debug-хук ─── */
window.__rl={
  spin, state(){ return {bank,bets:JSON.parse(JSON.stringify(bets)),spinning,history:[...history],last:history[0]??null,running:!$('game').classList.contains('hidden'),mode}; },
  bet:(k,v)=>{ chip=v||10; placeBet(k); }, addBank:n=>{ bank+=n; lsSet(K_BANK,bank); }, settle:num=>settle(num),
  missions:()=>missionData, records:()=>({best:lsGet(K_BEST,0),bank,daily:dailyBest,streak:lsGet(K_STREAK,0),today}),
};
