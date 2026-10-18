'use strict';
/* FPS Corridor — 3D-шутер в стиле AXIIOM. Three.js (CDN), без сборки.
   Мета: стрик-множитель, ежедневные миссии, рекорды.
   Пересборка: мобильный touch-look (свайп — обзор, тап — выстрел), пауза при потере
   фокуса на десктопе, каноничный welcome, миссии, один цикл эффектов. */

import * as THREE from 'three';

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

const IS_MOBILE = matchMedia('(pointer: coarse)').matches;

// ---------- DOM ----------
const el={
  welcome:$('welcome'), ui:$('ui'), modal:$('modal'), modalCard:$('modal-card'),
  modalBadge:$('modal-badge'), modalTitle:$('modal-title'), modalScore:$('modal-score'),
  mmodal:$('mmodal'), mlist:$('mmodal-list'), toasts:$('toasts'),
  wDaily:$('w-daily-best'), wBest:$('w-best'), wStreak:$('w-streak'),
  streakN:null, missionsN:null,
  healthVal:$('health-val'), healthFill:$('health-fill'),
  scoreVal:$('score-val'), scoreDisp:$('score-display'), waveDisp:$('wave-display'),
  ammoDisp:$('ammo-display'), reloadHint:$('reload-hint'), pauseHint:$('pause-hint'),
  tip:$('tip'), crosshair:$('crosshair'), damage:$('damage-overlay'), lightning:$('lightning-overlay'),
  streakMini:$('streak-mini')
};

// ---------- звук ----------
let AC=null;
let muted=lsGet('fps3d.muted', false);
function audio(){ if(!AC){ try{ AC=new (window.AudioContext||window.webkitAudioContext)(); }catch(e){} } if(AC&&AC.state==='suspended') AC.resume(); return AC; }
function beep(type){
  if(!AC||muted) return;
  try{
    const c=AC, o=c.createOscillator(), g=c.createGain();
    o.connect(g); g.connect(c.destination);
    const t=c.currentTime;
    const seq=(points, dur, type2, vol)=>{
      o.type=type2;
      points.forEach(([f, dt])=>o.frequency.setValueAtTime(f, t+dt));
      g.gain.setValueAtTime(vol, t);
      g.gain.exponentialRampToValueAtTime(0.001, t+dur);
      o.start(t); o.stop(t+dur);
    };
    if(type==='shoot')   seq([[1000,0],[80,0.05]], 0.05, 'sawtooth', 0.12);
    if(type==='hit')     seq([[250,0],[60,0.06]], 0.06, 'sine', 0.1);
    if(type==='hurt')    seq([[400,0],[80,0.1]], 0.1, 'sawtooth', 0.09);
    if(type==='reload')  seq([[350,0],[600,0.06],[350,0.12]], 0.18, 'sine', 0.07);
    if(type==='kill')    seq([[150,0],[500,0.08]], 0.1, 'square', 0.07);
    if(type==='wave')    seq([[400,0],[600,0.1],[800,0.2]], 0.25, 'sine', 0.07);
    if(type==='thunder'){
      seq([[60,0],[30,0.3]], 0.3, 'sawtooth', 0.12);
      const o2=c.createOscillator(), g2=c.createGain();
      o2.type='sine'; o2.frequency.setValueAtTime(80, t);
      o2.frequency.exponentialRampToValueAtTime(20, t+0.2);
      g2.gain.setValueAtTime(0.08, t);
      g2.gain.exponentialRampToValueAtTime(0.001, t+0.2);
      o2.connect(g2); g2.connect(c.destination); o2.start(t); o2.stop(t+0.2);
    }
    if(type==='mission'){ seq([[880,0],[1174,0.1]], 0.16, 'sine', 0.09); }
    if(type==='record'){ [523,659,784,1047].forEach((f,i)=>{ const oo=c.createOscillator(), gg=c.createGain(); oo.type='triangle'; oo.frequency.setValueAtTime(f, t+i*0.11); gg.gain.setValueAtTime(0.09, t+i*0.11); gg.gain.exponentialRampToValueAtTime(0.001, t+i*0.11+0.14); oo.connect(gg); gg.connect(c.destination); oo.start(t+i*0.11); oo.stop(t+i*0.11+0.16); }); }
  }catch(e){}
}

// ---------- стрик ----------
const getMult = s => 1 + Math.min(Math.max(s-1,0),10)*0.05;
let streak = lsGet('fps3d.streak', 0), lastDay = lsGet('fps3d.lastDay', '');
function effStreak(){ return (lastDay===today || lastDay===yesterday) ? streak : 0; }
function refreshMult(){ mult = effStreak()>0 ? getMult(streak) : 1; }
function markDay(){
  if(lastDay===today){ mult=getMult(streak); return; }
  streak = (lastDay===yesterday) ? (streak||0)+1 : 1;
  lastDay = today;
  lsSet('fps3d.streak', streak); lsSet('fps3d.lastDay', lastDay);
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
  {id:'kills15',   t:()=>'Уничтожь 15 врагов (за день)',             n:15, cum:true},
  {id:'wave3',     t:()=>'Дойди до 3-й волны',                       n:3},
  {id:'clean1',    t:()=>'Пройди волну без урона',                   n:1},
  {id:'kills10w',  t:()=>'Уничтожь 10 врагов в одной волне',         n:10},
  {id:'score800',  t:()=>'Набери 800 очков за забег',                n:800},
  {id:'waves5',    t:()=>'Пройди 5 волн (суммарно за день)',         n:5, cum:true},
  {id:'nosurv',    t:()=>'Закончи волну с HP выше 50',               n:1},
  {id:'kills40',   t:()=>'Уничтожь 40 врагов (за день)',             n:40, cum:true}
];
let missions=[], mState=lsGet('fps3d.missions.'+today, {});
let mDirty=false;
function flushMissions(){ if(!mDirty) return; mDirty=false; lsSet('fps3d.missions.'+today, mState); }
function pickMissions(){
  const seed = xmur3('fps3d-missions-'+today)();
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
    score += reward;
    toast(`🎯 Миссия: <b>${def.t()}</b> · +<b>${reward}</b>`);
    beep('mission');
    updateHUD();
  }
  renderMissionsChip();
}
function renderMissionsChip(){
  const done=missions.filter(m=>(mState[m.id]||{}).done).length;
  $('btn-missions').textContent = done===3 ? '🎯✓' : '🎯';
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

// ---------- three.js сцена ----------
const WAVES=[4,6,8,10,12,15];
const L=30, W=7, H=4;
let scene, camera, renderer, clock;
let hp=100, score=0, wave=0, alive=true;
let enemies=[];
let flickerLights=[];
let lightningLight, lightningTimer=3+Math.random()*5;
let keys={w:false,a:false,s:false,d:false};
let locked=false;
let ammo=12, maxAmmo=12, reloading=false, reloadTimer=0;
let fireCD=0;
let waveTotal=0, spawned=0, killed=0, spawnTimer=0;
let gameOver=false, paused=false;
let dailyBest=lsGet('fps3d.daily.'+today, 0), best=lsGet('fps3d.best', 0);
let waveDamageTaken=0;

function init(){
  scene=new THREE.Scene();
  scene.background=new THREE.Color(0x08080c);
  scene.fog=new THREE.FogExp2(0x08080c, .03);

  camera=new THREE.PerspectiveCamera(75, innerWidth/innerHeight, 0.1, 60);
  camera.position.set(0, 1.6, L/2-2);

  renderer=new THREE.WebGLRenderer({antialias:true});
  renderer.setSize(innerWidth, innerHeight);
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.shadowMap.enabled=true;
  renderer.toneMapping=THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure=.9;
  document.body.prepend(renderer.domElement);
  clock=new THREE.Clock();

  const hw=W/2, hh=H/2;
  const fm=new THREE.MeshStandardMaterial({color:0x0e0e14, roughness:.9});
  const wm=new THREE.MeshStandardMaterial({color:0x14141c, roughness:.8, metalness:.2});
  const pm=new THREE.MeshStandardMaterial({color:0x1a1a26, roughness:.7});
  const sm=new THREE.MeshStandardMaterial({color:0x2a2a38, roughness:.5, metalness:.2});
  const cm=new THREE.MeshStandardMaterial({color:0x0a0a10, roughness:.9});

  const fl=new THREE.Mesh(new THREE.PlaneGeometry(W, L), fm);
  fl.rotation.x=-Math.PI/2; fl.position.set(0, -hh, 0); fl.receiveShadow=true; scene.add(fl);
  const cl=new THREE.Mesh(new THREE.PlaneGeometry(W, L), cm);
  cl.rotation.x=Math.PI/2; cl.position.set(0, hh, 0); scene.add(cl);
  for(const s of [-1,1]){
    const wl=new THREE.Mesh(new THREE.PlaneGeometry(L, H), wm);
    wl.rotation.y=s*Math.PI/2; wl.position.set(s*hw, 0, 0); scene.add(wl);
  }
  for(let z=-L/2; z<L/2; z+=2.5){
    for(const x of [-hw+.05, hw-.05]){
      const p=new THREE.Mesh(new THREE.PlaneGeometry(2, 1.6), pm);
      p.position.set(x, 0.2, z); p.rotation.y=x<0?Math.PI/2:-Math.PI/2; scene.add(p);
    }
  }
  for(let z=-L/2; z<L/2; z+=3){
    for(const x of [-hw+.02, hw-.02]){
      const st=new THREE.Mesh(new THREE.PlaneGeometry(.05, H-.3), sm);
      st.position.set(x, 0, z); st.rotation.y=x<0?Math.PI/2:-Math.PI/2; scene.add(st);
    }
  }
  for(let z=-L/2+3; z<L/2-3; z+=6){
    for(const x of [-hw+.5, hw-.5]){
      const pl=new THREE.Mesh(new THREE.BoxGeometry(.25, H, .25),
        new THREE.MeshStandardMaterial({color:0x222230, roughness:.6, metalness:.3}));
      pl.position.set(x, 0, z); pl.castShadow=true; scene.add(pl);
    }
  }
  const ew=new THREE.Mesh(new THREE.PlaneGeometry(W, H), wm);
  ew.position.set(0, 0, -L/2); ew.rotation.y=Math.PI; scene.add(ew);
  const bw=new THREE.Mesh(new THREE.PlaneGeometry(W, H),
    new THREE.MeshStandardMaterial({color:0x0e0e14, roughness:.9}));
  bw.position.set(0, 0, L/2); scene.add(bw);

  scene.add(new THREE.AmbientLight(0x1a1a2e, .5));
  for(let z=-L/2+2; z<L/2-2; z+=5){
    const pl=new THREE.PointLight(0x4444aa, .4, 6);
    pl.position.set(0, hh-.3, z); scene.add(pl); flickerLights.push(pl);
  }
  const dl=new THREE.DirectionalLight(0x6666cc, .15);
  dl.position.set(0, 10, 0); scene.add(dl);

  lightningLight=new THREE.PointLight(0xffffff, 0, 20);
  lightningLight.position.set(0, 3, 0); scene.add(lightningLight);

  // оружие
  const g=new THREE.Group();
  const bm=new THREE.MeshStandardMaterial({color:0x2a2a3a, roughness:.4, metalness:.5});
  const dm=new THREE.MeshStandardMaterial({color:0x181822, roughness:.7, metalness:.3});
  const body=new THREE.Mesh(new THREE.BoxGeometry(.08, .05, .35), bm);
  body.position.set(0, -.05, -.35); g.add(body);
  const bar=new THREE.Mesh(new THREE.CylinderGeometry(.018, .025, .3), dm);
  bar.rotation.x=Math.PI/2; bar.position.set(0, -.015, -.4); g.add(bar);
  const grp=new THREE.Mesh(new THREE.BoxGeometry(.04, .08, .04), dm);
  grp.position.set(0, -.1, -.2); g.add(grp);
  g.position.set(.2, -.18, -.25); camera.add(g); scene.add(camera);

  // ---- ввод: десктоп ----
  addEventListener('resize', ()=>{
    camera.aspect=innerWidth/innerHeight; camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
  });
  document.addEventListener('pointerlockchange', ()=>{
    locked=document.pointerLockElement===renderer.domElement;
    if(!locked&&!IS_MOBILE&&!gameOver&&state==='play') setPaused(true);
  });
  document.addEventListener('keydown', e=>{
    const k=e.key;
    if(k.toLowerCase()==='r'&&alive&&!gameOver) startReload();
    if(k==='w'||k==='a'||k==='s'||k==='d') keys[k]=true;
    if(k==='ArrowLeft') camera.rotation.y+=.12;
    if(k==='ArrowRight') camera.rotation.y-=.12;
    if(k===' '){ e.preventDefault(); shoot(); }
  });
  document.addEventListener('keyup', e=>{
    const k=e.key.toLowerCase();
    if(k==='w'||k==='a'||k==='s'||k==='d') keys[k]=false;
  });
  renderer.domElement.addEventListener('mousedown', e=>{
    if(e.button!==0) return;
    if(IS_MOBILE) return;
    if(!locked){ renderer.domElement.requestPointerLock(); return; }
    shoot();
  });

  // ---- ввод: мобильный (свайп = обзор, тап = выстрел) ----
  let tStart=null, tLast=null, tMoved=false;
  renderer.domElement.addEventListener('touchstart', e=>{
    e.preventDefault();
    if(e.touches.length===0) return;
    const t=e.touches[0];
    tStart={x:t.clientX, y:t.clientY, time:Date.now()};
    tLast={x:t.clientX, y:t.clientY};
    tMoved=false;
  }, {passive:false});
  renderer.domElement.addEventListener('touchmove', e=>{
    e.preventDefault();
    if(!tStart||!tLast) return;
    const t=e.touches[0];
    const dx=t.clientX-tLast.x, dy=t.clientY-tLast.y;
    const totalDx=t.clientX-tStart.x, totalDy=t.clientY-tStart.y;
    if(!tMoved && Math.hypot(totalDx, totalDy)>12) tMoved=true;
    if(tMoved){
      camera.rotation.y-=dx*0.005;
      camera.rotation.x=clamp(camera.rotation.x-dy*0.005, -Math.PI/2.5, Math.PI/2.5);
    }
    tLast={x:t.clientX, y:t.clientY};
  }, {passive:false});
  renderer.domElement.addEventListener('touchend', e=>{
    e.preventDefault();
    if(tStart&&!tMoved&&Date.now()-tStart.time<280) shoot();
    tStart=null; tLast=null;
  }, {passive:false});

  $('btn-play').addEventListener('click', ()=>{
    audio(); beep('click');
    startGame();
  });
  $('modal-btn').addEventListener('click', ()=>{ beep('click'); startGame(); });
  $('btn-missions').addEventListener('click', ()=>{ beep('click'); renderMissionsModal(); el.mmodal.classList.remove('hidden'); });
  $('mmodal-btn').addEventListener('click', ()=>{ beep('click'); el.mmodal.classList.add('hidden'); });

  function updateSoundBtn(){ $('btn-sound').textContent=muted?'🔇':'🔊'; }
  $('btn-sound').addEventListener('click', ()=>{
    muted=!muted; lsSet('fps3d.muted', muted);
    updateSoundBtn(); if(!muted){ audio(); beep('click'); }
  });
  updateSoundBtn();

  document.addEventListener('visibilitychange', ()=>{
    paused=document.hidden;
    if(!document.hidden) lastT=0;
  });

  showWelcomeRecords();
  updateHUD(); updateAmmo();
  requestAnimationFrame(animate);
}

function setPaused(v){
  paused=v;
  el.pauseHint.style.opacity=v?'1':'0';
}

// ---------- жизненный цикл ----------
let state='menu';
function startGame(){
  el.welcome.classList.add('hidden');
  el.modal.classList.add('hidden');
  el.mmodal.classList.add('hidden');
  el.ui.classList.remove('hidden');
  hp=100; score=0; wave=0; alive=true; gameOver=false; paused=false;
  killed=0; spawned=0; waveTotal=0; spawnTimer=0; waveDamageTaken=0;
  ammo=maxAmmo; reloading=false; reloadTimer=0; fireCD=0;
  for(const e of enemies) scene.remove(e.mesh);
  enemies=[];
  camera.position.set(0, 1.6, L/2-2);
  camera.rotation.set(0, 0, 0);
  el.crosshair.classList.remove('hit');
  el.pauseHint.style.opacity='0';
  state='play';
  updateHUD(); updateAmmo();
  nextWave();
  if(!IS_MOBILE && document.pointerLockElement!==renderer.domElement)
    renderer.domElement.requestPointerLock();
}
function nextWave(){
  wave++;
  if(wave>WAVES.length){ win(); return; }
  waveTotal=WAVES[wave-1]; spawned=0; killed=0; waveDamageTaken=0;
  el.waveDisp.textContent='ВОЛНА '+wave+' / '+WAVES.length;
  spawnTimer=.3;
  beep('wave');
  showTip(IS_MOBILE?'ВРАГИ ВПЕРЕДИ! СВАЙП — ОБЗОР, ТАП — ВЫСТРЕЛ':'ВРАГИ ВПЕРЕДИ! ИДИ ВПЕРЁД (W)', 3);
}
function showTip(t, s){
  el.tip.textContent=t;
  el.tip.style.opacity='1';
  if(window._tipTimer) clearTimeout(window._tipTimer);
  window._tipTimer=setTimeout(()=>{ el.tip.style.opacity='0'; }, (s||2)*1000);
}
function finishRun(died){
  gameOver=true; alive=false;
  state='over';
  markDay();
  missionProgress('kills15', totalKills);
  missionProgress('kills40', totalKills);
  missionProgress('score800', score);
  flushMissions();
  const final=Math.round(score*mult);
  const isDailyRec=final>dailyBest;
  if(isDailyRec){ dailyBest=final; lsSet('fps3d.daily.'+today, dailyBest); }
  const isRec=final>best;
  if(isRec){ best=final; lsSet('fps3d.best', best); }
  beep(isRec?'record':'hurt');
  el.modalBadge.textContent=isRec?'Новый рекорд':(died?'Полёт окончен':'Все волны отбиты');
  el.modalBadge.classList.toggle('record', isRec);
  el.modalCard.classList.toggle('modal-record', isRec);
  el.modalTitle.textContent=died?'Вы убиты':'Победа!';
  el.modalScore.innerHTML=`Очки: <b>${score}</b>${mult>1?` ×<b>${mult.toFixed(2)}</b> = <b>${final}</b>`:''} · Волна: <b>${Math.min(wave, WAVES.length)}</b> · Сбитых: <b>${totalKills}</b><br>Рекорд: <b>${best}</b>`;
  el.modal.classList.remove('hidden');
  el.ui.classList.add('hidden');
  try{ document.exitPointerLock(); }catch(e){}
  showWelcomeRecords();
}
function win(){ finishRun(false); }
function die(){ finishRun(true); }

// ---------- бой ----------
function startReload(){
  if(reloading||ammo===maxAmmo||!alive||gameOver) return;
  reloading=true; reloadTimer=.8;
  el.reloadHint.style.opacity='1';
  el.reloadHint.textContent='ПЕРЕЗАРЯДКА...';
  beep('reload');
}
function shoot(){
  if(!alive||gameOver||paused) return;
  if(!IS_MOBILE&&!locked){ renderer.domElement.requestPointerLock(); return; }
  if(fireCD>0) return;
  if(ammo<=0){ startReload(); return; }
  ammo--; fireCD=.18; beep('shoot'); updateAmmo();

  const r=new THREE.Raycaster();
  r.setFromCamera({x:0, y:0}, camera);
  let hit=null, hitD=Infinity;
  for(const e of enemies){
    if(!e.alive) continue;
    const d=camera.position.distanceTo(e.mesh.position);
    if(d<25){
      const b=new THREE.Box3().setFromObject(e.mesh);
      if(r.ray.intersectsBox(b)&&d<hitD){ hit=e; hitD=d; }
    }
  }
  if(!hit){
    const fwd=new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
    for(const e of enemies){
      if(!e.alive) continue;
      const dir=new THREE.Vector3().copy(e.mesh.position).sub(camera.position).normalize();
      const angle=fwd.angleTo(dir);
      const d=camera.position.distanceTo(e.mesh.position);
      if(angle<.4&&d<hitD){ hit=e; hitD=d; }
    }
  }
  if(hit){
    hit.hp-=33; beep('hit');
    hit.mesh.material.color.setHex(0xff4444);
    hit.mesh.material.emissive.setHex(0xff2222);
    el.crosshair.classList.add('hit');
    setTimeout(()=>el.crosshair.classList.remove('hit'), 80);
    if(hit.hp<=0){
      hit.alive=false; score+=100; killed++; totalKills++; beep('kill');
      scene.remove(hit.mesh);
      explode(hit.mesh.position.clone());
      missionProgress('kills15', 1);
      missionProgress('kills40', 1);
      missionProgress('kills10w', killed);
      updateHUD();
      if(killed>=waveTotal) setTimeout(waveCleared, 900);
    } else {
      const ref=hit;
      setTimeout(()=>{
        if(ref.alive){ ref.mesh.material.color.setHex(0x44ff44); ref.mesh.material.emissive.setHex(0x44ff44); }
      }, 100);
    }
  }
}
function waveCleared(){
  if(gameOver) return;
  if(waveDamageTaken===0) missionProgress('clean1',1);
  if(hp>50) missionProgress('nosurv',1);
  missionProgress('waves5',1);
  missionProgress('wave3', wave+1);
  nextWave();
}
let totalKills=0;

function explode(pos){
  const n=20, geom=new THREE.BufferGeometry();
  const p=new Float32Array(n*3);
  for(let i=0;i<n;i++){
    p[i*3]=(Math.random()-.5)*.2; p[i*3+1]=(Math.random()-.5)*.2; p[i*3+2]=(Math.random()-.5)*.2;
  }
  geom.setAttribute('position', new THREE.BufferAttribute(p, 3));
  const mat=new THREE.PointsMaterial({size:.08, color:0xff8800, transparent:true, opacity:1, blending:THREE.AdditiveBlending});
  const pts=new THREE.Points(geom, mat); pts.position.copy(pos); scene.add(pts);
  const vel=[];
  for(let i=0;i<n;i++) vel.push(new THREE.Vector3((Math.random()-.5)*4, Math.random()*3, (Math.random()-.5)*4));
  let t=0;
  const iv=setInterval(()=>{
    t+=.016;
    if(t>.35){ clearInterval(iv); scene.remove(pts); return; }
    const a=pts.geometry.attributes.position.array;
    for(let i=0;i<n;i++){
      a[i*3]+=vel[i].x*.016; a[i*3+1]+=vel[i].y*.016; a[i*3+2]+=vel[i].z*.016;
    }
    pts.geometry.attributes.position.needsUpdate=true;
    pts.material.opacity=1-t*2.8;
  }, 16);
}

function spawn(){
  const z=-L/2+3+Math.random()*3;
  const x=(Math.random()-.5)*(W-2);
  const s=1.8+wave*.12;
  const m=new THREE.MeshStandardMaterial({color:0x44ff44, emissive:0x44ff44, emissiveIntensity:.4, roughness:.3, metalness:.4});
  const h=.6+Math.random()*.15;
  const mesh=new THREE.Mesh(new THREE.BoxGeometry(.45, h, .45), m);
  mesh.position.set(x, h/2, z); mesh.castShadow=true; scene.add(mesh);
  const em=new THREE.MeshBasicMaterial({color:0xff2222});
  for(const s2 of [-1,1]){
    const eye=new THREE.Mesh(new THREE.SphereGeometry(.05, 6, 6), em);
    eye.position.set(s2*.1, h/2-.02, -.22); mesh.add(eye);
  }
  enemies.push({mesh, hp:80+wave*10, alive:true, speed:s, shootTimer:Math.random()*.3});
}

function updatePlayer(dt){
  if(!alive||gameOver) return;
  const sp=5;
  const dir=new THREE.Vector3();
  if(keys.w) dir.z-=1;
  if(keys.s) dir.z+=1;
  if(keys.a) dir.x-=1;
  if(keys.d) dir.x+=1;
  if(dir.length()>0){
    dir.normalize(); dir.applyQuaternion(camera.quaternion); dir.y=0;
    if(dir.length()>0){ dir.normalize().multiplyScalar(sp*dt); camera.position.add(dir); }
  }
  const hw=W/2-.3;
  camera.position.x=clamp(camera.position.x, -hw, hw);
  camera.position.z=clamp(camera.position.z, -L/2+1, L/2-1);
}

function updateEnemies(dt){
  const pp=camera.position.clone();
  for(const e of enemies){
    if(!e.alive) continue;
    const d=new THREE.Vector3().copy(pp).sub(e.mesh.position);
    const dist=d.length();
    if(dist>.3){
      d.normalize();
      e.mesh.position.x+=d.x*e.speed*dt;
      e.mesh.position.z+=d.z*e.speed*dt;
    }
    e.mesh.lookAt(pp); e.mesh.rotation.x=0;
    if(dist<1.2){
      e.shootTimer+=dt;
      if(e.shootTimer>.6/(1+wave*.08)){
        e.shootTimer=0;
        damage(5+wave*2);
      }
    }
  }
}

function damage(a){
  if(!alive||gameOver||paused) return;
  hp=Math.max(0, hp-a);
  waveDamageTaken+=a;
  beep('hurt');
  el.damage.style.opacity='.35';
  setTimeout(()=>{ el.damage.style.opacity='0'; }, 80);
  updateHUD();
  if(hp<=0) die();
}

function updateHUD(){
  el.healthVal.textContent=hp;
  el.healthFill.style.width=hp+'%';
  el.scoreVal.textContent=score;
  el.scoreDisp.textContent=score;
  el.streakMini.textContent='🔥 '+effStreak();
  renderMissionsChip();
}
function updateAmmo(){ el.ammoDisp.textContent=ammo+'/'+maxAmmo; }
function showWelcomeRecords(){
  el.wDaily.textContent=dailyBest;
  el.wBest.textContent=best;
  el.wStreak.textContent='🔥 '+effStreak();
}

// ---------- цикл ----------
let lastT=0;
function animate(){
  requestAnimationFrame(animate);
  const dt=Math.min(clock.getDelta(), .05);
  if(!paused&&alive&&!gameOver){
    if(locked&&!IS_MOBILE){
      camera.rotation.y-=(document.movementX||0)*.002;
      camera.rotation.x=clamp(camera.rotation.x-(document.movementY||0)*.002, -Math.PI/2.5, Math.PI/2.5);
    }
    updatePlayer(dt);
    fireCD=Math.max(0, fireCD-dt);
    if(reloading){
      reloadTimer-=dt;
      if(reloadTimer<=0){
        reloading=false; ammo=maxAmmo; updateAmmo();
        el.reloadHint.style.opacity='0';
      }
    }
    spawnTimer-=dt;
    if(spawnTimer<=0&&spawned<waveTotal){
      spawn(); spawned++;
      spawnTimer=Math.max(.15, 1-wave*.04);
    }
    updateEnemies(dt);
    enemies=enemies.filter(e=>e.alive);
  }
  for(const e of enemies){
    if(!e.alive) continue;
    e.mesh.material.emissiveIntensity=.3+Math.sin(Date.now()*.006+e.mesh.position.x)*.2;
  }
  for(const fl of flickerLights){
    const flicker=Math.sin(Date.now()*.017+fl.position.z*2)*.25+.75;
    const bump=Math.sin(Date.now()*.031+fl.position.z*3)*.15;
    fl.intensity=(.3+Math.random()*.1)*(flicker+bump);
  }
  lightningTimer-=dt;
  if(lightningTimer<=0){
    lightningLight.intensity=3+Math.random()*2;
    el.lightning.style.opacity='.15';
    beep('thunder');
    setTimeout(()=>{
      lightningLight.intensity=0;
      el.lightning.style.opacity='0';
    }, 80+Math.random()*60);
    if(Math.random()<.3){
      setTimeout(()=>{
        lightningLight.intensity=2+Math.random()*2;
        el.lightning.style.opacity='.1';
        setTimeout(()=>{
          lightningLight.intensity=0;
          el.lightning.style.opacity='0';
        }, 40+Math.random()*40);
      }, 100+Math.random()*200);
    }
    lightningTimer=4+Math.random()*8;
  }
  renderer.render(scene, camera);
}

// ---------- init ----------
pickMissions();
renderMissionsChip();
init();
