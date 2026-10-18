// Small, dependency-free mobile game shell shared by the ten original games.
// All world coordinates are CSS pixels; only the backing canvases use DPR.
export const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const rand = (a, b) => a + Math.random() * (b - a);
export const choose = items => items[Math.floor(Math.random() * items.length)];
export const timeText = seconds => `${Math.floor(seconds / 60).toString().padStart(2,'0')}:${Math.floor(seconds % 60).toString().padStart(2,'0')}`;
export const bigNumber = value => {
  if (!Number.isFinite(value)) return '∞';
  if (value < 1000) return Math.floor(value).toLocaleString('ru-RU');
  const suffix = ['K','M','B','T'];
  let scale = 1000, index = 0;
  while (value / scale >= 1000 && index < 3) { scale *= 1000; index++; }
  if (value / scale < 1000) return `${(value / scale).toFixed(value / scale < 10 ? 2 : 1)}${suffix[index]}`;
  let n = value / 1e15, letter = 0;
  while (n >= 1000 && letter < 675) { n /= 1000; letter++; }
  return `${n.toFixed(n < 10 ? 2 : 1)}${String.fromCharCode(97 + Math.floor(letter / 26))}${String.fromCharCode(97 + letter % 26)}`;
};
export function load(slug, fallback = {}) {
  try { const raw = localStorage.getItem(`mobile-games:${slug}:v1`); return raw ? { ...fallback, ...JSON.parse(raw) } : { ...fallback }; }
  catch { return { ...fallback }; }
}
export function save(slug, data) { try { localStorage.setItem(`mobile-games:${slug}:v1`, JSON.stringify(data)); } catch { /* Private browsing. */ } }
export function vibrate(ms = 15) { try { if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(ms); } catch { /* Unsupported device. */ } }

class Synth {
  constructor(slug) {
    this.slug = slug;
    try { this.enabled = localStorage.getItem(`mobile-games:${slug}:sound`) !== 'off'; }
    catch { this.enabled = true; }
    this.context = null;
  }
  unlock() {
    if (!this.enabled) return;
    try {
      if (!this.context) this.context = new (window.AudioContext || window.webkitAudioContext)();
      if (this.context.state === 'suspended') this.context.resume();
    } catch { this.context = null; }
  }
  toggle() {
    this.enabled = !this.enabled;
    try { localStorage.setItem(`mobile-games:${this.slug}:sound`, this.enabled ? 'on' : 'off'); } catch { /* No persistence. */ }
    if (this.enabled) this.unlock();
    return this.enabled;
  }
  play(type = 'tap', semitones = 0) {
    if (!this.enabled || !this.context || this.context.state !== 'running') return;
    const table = {
      tap:[320,.035,'sine'], move:[280,.04,'triangle'], good:[520,.13,'sine'],
      perfect:[720,.24,'sine'], merge:[440,.20,'triangle'], coin:[880,.12,'sine'],
      hit:[150,.08,'sawtooth'], blast:[95,.22,'sawtooth'], hurt:[110,.20,'triangle'],
      win:[660,.35,'sine'], lose:[180,.34,'triangle'], level:[780,.3,'sine'],
      pour:[470,.17,'sine'], shoot:[350,.055,'triangle'], select:[650,.08,'sine'],
    };
    const [base, length, wave] = table[type] || table.tap;
    try {
      const now = this.context.currentTime;
      const osc = this.context.createOscillator(), gain = this.context.createGain();
      osc.type = wave;
      osc.frequency.setValueAtTime(base * 2 ** (semitones / 12), now);
      osc.frequency.exponentialRampToValueAtTime(Math.max(40, base * .65 * 2 ** (semitones / 12)), now + length);
      gain.gain.setValueAtTime(.0001, now);
      gain.gain.exponentialRampToValueAtTime(Math.min(.13, type === 'blast' ? .08 : .06), now + .009);
      gain.gain.exponentialRampToValueAtTime(.0001, now + length);
      osc.connect(gain); gain.connect(this.context.destination);
      osc.start(now); osc.stop(now + length + .01);
    } catch { /* Audio context can be unavailable during tab suspension. */ }
  }
}

export class Effects {
  constructor() { this.particles = []; this.labels = []; this.rings = []; this.shake = 0; this.squashes = []; }
  burst(x, y, color = '#f8d486', count = 12, speed = 130) {
    for (let i=0;i<count;i++) { const a = i/count * Math.PI*2 + rand(-.35,.35), s=rand(speed*.35,speed); this.particles.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,life:rand(.3,.75),max:.75,color,r:rand(2,5)}); }
    if (this.particles.length > 400) this.particles.splice(0,this.particles.length-400);
  }
  float(x,y,text,color='#fff2c6') { this.labels.push({x,y,text:String(text),color,life:1,max:1}); if(this.labels.length>45)this.labels.shift(); }
  ring(x,y,color='#ffffff',radius=8) { this.rings.push({x,y,color,r:radius,life:.45}); }
  squash(x,y,r=20) { this.squashes.push({x,y,r,life:.28}); }
  kick(amount=5) { this.shake=Math.max(this.shake,amount); }
  tick(dt) {
    for (const p of this.particles) { p.x+=p.vx*dt; p.y+=p.vy*dt; p.vy+=200*dt; p.life-=dt; }
    for (const p of this.labels) { p.y-=43*dt; p.life-=dt; }
    for (const p of this.rings) { p.r+=145*dt; p.life-=dt; }
    for (const p of this.squashes) p.life-=dt;
    this.particles=this.particles.filter(p=>p.life>0);
    this.labels=this.labels.filter(p=>p.life>0);
    this.rings=this.rings.filter(p=>p.life>0);
    this.squashes=this.squashes.filter(p=>p.life>0);
    this.shake=Math.max(0,this.shake-28*dt);
  }
  draw(ctx) {
    ctx.save();
    for (const p of this.rings) { ctx.globalAlpha=p.life/.45;ctx.strokeStyle=p.color;ctx.lineWidth=2;ctx.beginPath();ctx.arc(p.x,p.y,p.r,0,Math.PI*2);ctx.stroke(); }
    for(const p of this.squashes){ctx.globalAlpha=p.life/.28*.3;ctx.fillStyle='#fff';ctx.beginPath();ctx.ellipse(p.x,p.y,p.r*(1+p.life),p.r*(1-p.life*.5),0,0,Math.PI*2);ctx.fill();}
    for(const p of this.particles){ctx.globalAlpha=clamp(p.life/p.max,0,1);ctx.fillStyle=p.color;ctx.beginPath();ctx.arc(p.x,p.y,p.r,0,Math.PI*2);ctx.fill();}
    for(const p of this.labels){ctx.globalAlpha=clamp(p.life/p.max,0,1);ctx.fillStyle=p.color;ctx.font='900 16px system-ui';ctx.textAlign='center';ctx.shadowColor='#080e19';ctx.shadowBlur=7;ctx.fillText(p.text,p.x,p.y);}
    ctx.restore();
  }
}

export class Runtime {
  constructor({ slug, title, subtitle, intro, Game }) {
    this.slug=slug; this.title=title; this.subtitle=subtitle; this.intro=intro;
    this.canvas=document.getElementById('board'); this.ctx=this.canvas.getContext('2d');
    this.stage=document.querySelector('.stage'); this.overlay=document.getElementById('overlay');
    this.stats=document.getElementById('stats'); this.controls=document.getElementById('actions');
    this.comboEl=document.getElementById('combo'); this.toastEl=document.getElementById('toast');
    this.sound=new Synth(slug); this.fx=new Effects(); this.status='ready';
    this.w=0; this.h=0; this.dpr=1; this.pointer=null; this.last=performance.now();this.acc=0;
    this.actionMap=new Map(); this.toastTimer=0;this.comboTimer=0;
    document.getElementById('sound').addEventListener('click',()=>{this.sound.toggle();this.updateSound();});
    document.getElementById('menu').addEventListener('click',()=>this.menu());
    this.updateSound();
    this.bindInput(); this.resize();
    this.game=new Game(this);
    this.showOverlay('НОВАЯ ИГРА', title, intro, [{label:'Играть',fn:()=>this.start()}]);
    if(window.ResizeObserver)new ResizeObserver(()=>this.resize()).observe(this.stage);
    window.addEventListener('resize',()=>this.resize());
    document.addEventListener('visibilitychange',()=>{if(document.hidden)this.pause();this.last=performance.now();this.acc=0;});
    window.addEventListener('blur',()=>this.pause());
    requestAnimationFrame(t=>this.frame(t));
  }
  updateSound(){const el=document.getElementById('sound');el.textContent=this.sound.enabled?'♪':'♪̸';el.setAttribute('aria-label',this.sound.enabled?'Выключить звук':'Включить звук');el.setAttribute('aria-pressed',String(this.sound.enabled));}
  resize(){const r=this.canvas.getBoundingClientRect(),w=Math.max(1,Math.round(r.width)),h=Math.max(1,Math.round(r.height));const dpr=Math.min(2,window.devicePixelRatio||1);if(w===this.w&&h===this.h&&dpr===this.dpr)return;this.w=w;this.h=h;this.dpr=dpr;this.canvas.width=Math.round(w*dpr);this.canvas.height=Math.round(h*dpr);this.ctx.setTransform(dpr,0,0,dpr,0,0);this.game?.resize?.(w,h);}
  point(e){const r=this.canvas.getBoundingClientRect();return {x:clamp(e.clientX-r.left,0,this.w),y:clamp(e.clientY-r.top,0,this.h)};}
  bindInput(){
    this.canvas.addEventListener('pointerdown',e=>{e.preventDefault();this.sound.unlock();if(this.status!=='playing')return;this.canvas.setPointerCapture(e.pointerId);this.pointer={id:e.pointerId,...this.point(e)};this.game.down?.(this.pointer.x,this.pointer.y,e);});
    this.canvas.addEventListener('pointermove',e=>{if(this.status!=='playing'||this.pointer?.id!==e.pointerId)return;const p=this.point(e);this.pointer={...this.pointer,...p};this.game.move?.(p.x,p.y,e);});
    const up=e=>{if(this.pointer?.id!==e.pointerId)return;const p=this.point(e);this.pointer=null;if(this.status==='playing')this.game.up?.(p.x,p.y,e);};
    this.canvas.addEventListener('pointerup',up);this.canvas.addEventListener('pointercancel',up);
    window.addEventListener('keydown',e=>{if(['Space','ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.code))e.preventDefault();this.sound.unlock();if(this.status==='playing')this.game.key?.(e);else if(this.status==='paused'&&e.code==='Escape')this.resume();});
    window.addEventListener('keyup',e=>this.game.keyUp?.(e));
  }
  frame(now){
    const dt=clamp((now-this.last)/1000,0,.07);this.last=now;
    if(this.status==='playing'){
      this.acc+=dt;let steps=0;
      while(this.acc>=1/60&&steps++<5&&this.status==='playing'){this.game.update?.(1/60);this.fx.tick(1/60);this.acc-=1/60;}
      if(steps>=5)this.acc=0;
    }else this.acc=0;
    if(this.toastTimer>0){this.toastTimer-=dt;if(this.toastTimer<=0)this.toastEl.classList.remove('show');}
    if(this.comboTimer>0){this.comboTimer-=dt;if(this.comboTimer<=0)this.comboEl.classList.remove('show');}
    const ctx=this.ctx;ctx.setTransform(this.dpr,0,0,this.dpr,0,0);ctx.clearRect(0,0,this.w,this.h);
    ctx.save();if(this.fx.shake>0)ctx.translate(rand(-this.fx.shake,this.fx.shake),rand(-this.fx.shake,this.fx.shake));
    this.game.draw?.(ctx,this.w,this.h,now/1000);this.fx.draw(ctx);ctx.restore();
    requestAnimationFrame(t=>this.frame(t));
  }
  hud(values){const entries=Object.entries(values);if(this.stats.children.length!==entries.length||entries.some(([label],i)=>this.stats.children[i]?.dataset.label!==label))this.stats.replaceChildren(...entries.map(([label])=>{const d=document.createElement('div');d.className='stat';d.dataset.label=label;d.innerHTML=`<small></small><strong></strong>`;d.querySelector('small').textContent=label;return d;}));entries.forEach(([,value],i)=>{const t=String(value),el=this.stats.children[i].querySelector('strong');if(el.textContent!==t)el.textContent=t;});}
  actions(list){this.actionMap.clear();this.controls.replaceChildren(...list.map(({id,label,sub='',onClick,disabled=false})=>{const button=document.createElement('button');button.className='action';button.type='button';button.dataset.id=id;button.innerHTML='<strong></strong><small></small>';button.querySelector('strong').textContent=label;button.querySelector('small').textContent=sub;button.disabled=disabled;button.addEventListener('click',()=>{this.sound.unlock();if(this.status==='playing')onClick?.();});this.actionMap.set(id,button);return button;}));}
  actionState(id,{disabled,pulse,label,sub}={}){const button=this.actionMap.get(id);if(!button)return;if(disabled!==undefined)button.disabled=disabled;if(pulse!==undefined)button.classList.toggle('pulse',pulse);if(label!==undefined)button.querySelector('strong').textContent=label;if(sub!==undefined)button.querySelector('small').textContent=sub;}
  toast(text){this.toastEl.textContent=text;this.toastEl.classList.add('show');this.toastTimer=2.2;}
  combo(text){this.comboEl.textContent=text;this.comboEl.classList.remove('show');void this.comboEl.offsetWidth;this.comboEl.classList.add('show');this.comboTimer=1.1;}
  impact(x,y,{color='#f8d486',sound='good',count=14,shake=3,text='',vibration=12,pitch=0}={}){this.fx.burst(x,y,color,count);this.fx.ring(x,y,color);this.fx.kick(shake);if(text)this.fx.float(x,y-18,text,color);this.sound.play(sound,pitch);vibrate(vibration);}
  showOverlay(kicker,title,body,buttons){
    this.overlay.hidden=false;const panel=this.overlay.querySelector('.sheet');panel.replaceChildren();
    const k=document.createElement('span');k.className='eyebrow';k.textContent=kicker;
    const h=document.createElement('h1');h.textContent=title;
    const p=document.createElement('p');p.textContent=body;
    const group=document.createElement('div');group.className='sheet-actions';
    for(const item of buttons){const b=document.createElement('button');b.type='button';b.className=item.secondary?'secondary':'';b.textContent=item.label;b.addEventListener('click',()=>{this.sound.unlock();this.sound.play('select');item.fn();});group.appendChild(b);}
    panel.append(k,h,p,group);
  }
  hideOverlay(){this.overlay.hidden=true;}
  start(){this.status='playing';this.hideOverlay();this.game.start?.();this.last=performance.now();}
  restart(){this.fx=new Effects();this.status='playing';this.hideOverlay();this.game.restart?.();this.last=performance.now();}
  finish(title,body,best,{nextLabel,next}={}){if(this.status==='ended')return;this.status='ended';this.sound.play(title.includes('Побед')?'win':'lose');this.showOverlay('ИГРА ОКОНЧЕНА',title,`${body}\nРекорд: ${best}`, [{label:'Ещё раз',fn:()=>this.restart()},...(next?[{label:nextLabel||'Следующий уровень',fn:()=>{this.status='playing';this.hideOverlay();next();}}]:[]),{label:'В каталог',fn:()=>{window.location.href='../../index.html';},secondary:true}]);}
  pause(){if(this.status!=='playing')return;this.game.onPause?.();this.status='paused';this.showOverlay('ПАУЗА',this.title,'Время остановлено. Продолжить или начать заново?', [{label:'Продолжить',fn:()=>this.resume()},{label:'Рестарт',fn:()=>this.restart(),secondary:true},{label:'В каталог',fn:()=>{window.location.href='../../index.html';},secondary:true}]);}
  resume(){this.status='playing';this.hideOverlay();this.last=performance.now();this.game.onResume?.();}
  menu(){if(this.status==='playing')this.pause();else if(this.status==='paused')this.resume();else if(this.status==='ended')this.showOverlay('ИГРА ОКОНЧЕНА',this.title,'Начать новую попытку?', [{label:'Ещё раз',fn:()=>this.restart()}]);}
  choice(kicker,title,body,options){this.status='choice';this.choiceId=(this.choiceId||0)+1;const id=this.choiceId;this.showOverlay(kicker,title,body,options.map(item=>({label:item.label,fn:()=>{const result=item.fn?.();if(this.status==='choice'&&this.choiceId===id&&result!==false)this.resume();}})));}
}
