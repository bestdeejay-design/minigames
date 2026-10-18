import {CONFIG as C} from './config.js';
import {clamp,lerp,load,save} from '../../_shared/runtime.js';
export function landing(moving,below){const overlap=Math.min(moving.x+moving.width,below.x+below.width)-Math.max(moving.x,below.x);const perfect=Math.abs(moving.x-below.x)<=C.perfectTolerancePx;return {overlap:Math.max(0,overlap),perfect};}
export class Game{
  constructor(api){this.api=api;this.best=load(api.slug,{best:0}).best||0;this.blocks=[];this.chunks=[];this.camera=0;this.t=0;this.prepare();}
  prepare(){const w=this.api.w||390;this.baseWidth=Math.min(w-C.maxWidthPadding,C.initialWidthRatio*w);this.blocks=[{x:(w-this.baseWidth)/2,width:this.baseWidth,level:0,settle:0}];this.floors=0;this.score=0;this.perfect=0;this.camera=0;this.chunks=[];this.mode='move';this.endDelay=0;this.spawn();this.hud();}
  resize(w){if(!this.blocks.length)return;const old=this.lastW||w,dx=(w-old)/2;for(const b of this.blocks)b.x+=dx;if(this.active)this.active.x+=dx;for(const c of this.chunks)c.x+=dx;this.lastW=w;}
  start(){this.lastW=this.api.w;this.prepare();this.api.toast('Тапните, чтобы уронить блок');}
  restart(){this.prepare();this.api.toast('Поймайте ритм!');}
  hud(){this.api.hud({'Этажи':this.floors,'Очки':this.score,'Perfect':this.perfect?`×${this.perfect}`:'—'});}
  spawn(){const below=this.blocks[this.blocks.length-1],width=below.width;this.active={x:-width-5,width,y:-(this.floors+1)*C.blockHeight-C.dropHeight,vy:0,dir:1};}
  down(){this.drop();} key(e){if(e.code==='Space'||e.code==='Enter')this.drop();}
  drop(){if(this.mode!=='move')return;this.mode='drop';this.active.vy=0;this.api.sound.play('move');}
  update(dt){this.t+=dt;const target=Math.max(0,(this.floors-C.cameraFollowFrom)*C.blockHeight);this.camera=lerp(this.camera,target,1-Math.exp(-C.cameraEase*dt));for(const b of this.blocks)b.settle=Math.max(0,b.settle-dt);
    for(const c of this.chunks){c.vy+=C.fallGravity*dt;c.y+=c.vy*dt;c.x+=c.vx*dt;c.angle+=c.spin*dt;c.life-=dt;}this.chunks=this.chunks.filter(c=>c.life>0);
    if(this.mode==='move'){const speed=Math.min(C.maxSpeed,C.baseSpeed+this.floors*C.speedPerFloor);this.active.x+=this.active.dir*speed*dt;if(this.active.dir>0&&this.active.x+this.active.width>=this.api.w-6){this.active.x=this.api.w-6-this.active.width;this.active.dir=-1;}else if(this.active.dir<0&&this.active.x<=6){this.active.x=6;this.active.dir=1;}}
    else if(this.mode==='drop'){this.active.vy+=C.gravity*dt;this.active.y+=this.active.vy*dt;const landY=-(this.floors+1)*C.blockHeight;if(this.active.y>=landY){this.active.y=landY;this.settle();}}
    else if(this.mode==='failed'){this.endDelay-=dt;if(this.endDelay<=0){this.mode='end';this.api.finish('Промах!',`Построено этажей: ${this.floors} · очков: ${this.score}.`,this.best);}}
  }
  settle(){const top=this.blocks[this.blocks.length-1],a=this.active,result=landing(a,top);if(result.overlap<=0){this.mode='failed';this.endDelay=C.finishDelay;a.vy=-40;this.chunk(a.x,a.y,a.width);this.api.impact(a.x+a.width/2,this.screenY(a.y),{sound:'lose',color:'#f48693',count:20,shake:9,text:'МИМО!'});return;}
    let x,width;if(result.perfect){this.perfect++;width=top.width;if(this.perfect>=C.perfectExpansionStart)width=Math.min(this.api.w-C.maxWidthPadding,top.width*C.perfectExpansion);x=top.x+(top.width-width)/2;this.score+=C.perfectBonusBase+this.perfect;this.api.combo(`PERFECT ×${this.perfect}`);this.api.impact(x+width/2,this.screenY(a.y),{sound:'perfect',pitch:this.perfect-1,count:17,color:this.color(this.floors+1),shake:3,text:`+${C.perfectBonusBase+this.perfect}`});for(let n=0;n<5;n++)this.api.fx.ring(x+width/2,this.screenY(a.y)+C.blockHeight/2,this.color(this.floors+1),n*15);}
    else{this.perfect=0;x=Math.max(a.x,top.x);width=result.overlap;const left=x-a.x,right=a.x+a.width-(x+width);if(left>.01)this.chunk(a.x,a.y,left,-1);if(right>.01)this.chunk(x+width,a.y,right,1);this.api.impact(x+width/2,this.screenY(a.y),{sound:'hit',color:this.color(this.floors+1),count:10,shake:Math.min(6,3+Math.abs(a.width-width)/22)});}
    this.floors++;this.score++;this.blocks.push({x,width,level:this.floors,settle:.3});this.best=Math.max(this.best,this.score);save(this.api.slug,{best:this.best});this.hud();this.mode='move';this.spawn();}
  chunk(x,y,width,dir=1){this.chunks.push({x,y,width,vy:-70,vx:dir*95,spin:dir*2.8,angle:0,life:C.chunkLife,level:this.floors+1});}
  screenY(worldY){return this.api.h-72+worldY+this.camera;}
  color(level){return `hsl(${(195+level*19)%360} 75% 64%)`;}
  draw(ctx,w,h,now){const hue=(212+this.floors/C.backgroundChangeEvery*45)%360,grad=ctx.createLinearGradient(0,0,0,h);grad.addColorStop(0,`hsl(${hue} 38% 14%)`);grad.addColorStop(1,`hsl(${(hue+25)%360} 40% 8%)`);ctx.fillStyle=grad;ctx.fillRect(0,0,w,h);ctx.fillStyle='#ffffff10';for(let i=0;i<45;i++){const x=(i*197)%w,y=(i*101+now*8)%(h+20);ctx.fillRect(x,y,2,2);}ctx.fillStyle='#ffffff29';ctx.fillRect(0,this.screenY(0)+C.blockHeight,w,h);
    // World heights are integers; widths and x stay floats until rasterization. No rounding drift.
    for(const b of this.blocks){const y=this.screenY(-b.level*C.blockHeight);if(y>h+40||y<-C.blockHeight*2)continue;this.block(ctx,b.x,y,b.width,C.blockHeight,this.color(b.level),b.settle);}
    for(const c of this.chunks){const y=this.screenY(c.y);if(y>h+70||y<-70)continue;ctx.save();ctx.translate(c.x+c.width/2,y+C.blockHeight/2);ctx.rotate(c.angle);ctx.globalAlpha=clamp(c.life/.7,0,1);this.block(ctx,-c.width/2,-C.blockHeight/2,c.width,C.blockHeight,this.color(c.level));ctx.restore();}
    if(this.mode==='move'||this.mode==='drop')this.block(ctx,this.active.x,this.screenY(this.active.y),this.active.width,C.blockHeight,this.color(this.floors+1));
    ctx.fillStyle='#d7e4fa';ctx.textAlign='center';ctx.font='800 13px system-ui';ctx.fillText('ТАП ИЛИ ПРОБЕЛ — БРОСИТЬ',w/2,Math.min(h-20,48),w-24);
    if(this.perfect) {ctx.textAlign='right';ctx.fillStyle='#ffe1ab';ctx.fillText(`${this.perfect} идеальных подряд`,w-17,h-24);}}
  block(ctx,x,y,w,h,color,settle=0){const squash=settle?Math.sin(settle/.3*Math.PI)*.22:0;ctx.save();ctx.translate(x+w/2,y+h/2);ctx.scale(1+squash,1-squash);ctx.fillStyle='#0006';ctx.fillRect(-w/2+3,-h/2+5,w,h);ctx.fillStyle=color;ctx.fillRect(-w/2,-h/2,w,h-2);ctx.fillStyle='#ffffff58';ctx.fillRect(-w/2,-h/2,w,4);ctx.fillStyle='#081e3155';ctx.fillRect(-w/2,h/2-6,w,4);ctx.restore();}
}
