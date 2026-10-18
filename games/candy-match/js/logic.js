import {CONFIG as C} from './config.js';
export const index=(x,y)=>y*C.size+x;
export const coords=i=>[i%C.size,Math.floor(i/C.size)];
export const adjacent=(a,b)=>{const [ax,ay]=coords(a),[bx,by]=coords(b);return Math.abs(ax-bx)+Math.abs(ay-by)===1;};
export function rng(seed){let s=seed>>>0;return{get state(){return s;},next(){s=(s+0x6D2B79F5)>>>0;let t=s;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return ((t^(t>>>14))>>>0)/4294967296;},int(n){return Math.floor(this.next()*n);}};}
const copyTile=t=>t?{color:t.color,special:t.special||null}:null;
const cloneBoard=b=>b.map(copyTile);
export function scan(board){const runs=[];for(let y=0;y<C.size;y++)for(let x=0;x<C.size;){const first=board[index(x,y)]?.color;if(first===undefined||first<0){x++;continue;}let end=x+1;while(end<C.size&&board[index(end,y)]?.color===first)end++;if(end-x>=C.minimumMatch)runs.push({cells:Array.from({length:end-x},(_,n)=>index(x+n,y)),orientation:'row',color:first});x=end;}
for(let x=0;x<C.size;x++)for(let y=0;y<C.size;){const first=board[index(x,y)]?.color;if(first===undefined||first<0){y++;continue;}let end=y+1;while(end<C.size&&board[index(x,end)]?.color===first)end++;if(end-y>=C.minimumMatch)runs.push({cells:Array.from({length:end-y},(_,n)=>index(x,y+n)),orientation:'col',color:first});y=end;}return runs;}
export function possibleMoves(board){const result=[];for(let i=0;i<board.length;i++){for(const next of [i%C.size<C.size-1?i+1:-1,i+C.size<board.length?i+C.size:-1]){if(next<0)continue;const a=board[i],b=board[next];if(!a||!b)continue;if(a.special&&b.special||a.special==='rainbow'||b.special==='rainbow'){result.push([i,next]);continue;}[board[i],board[next]]=[b,a];const valid=scan(board).length>0;[board[i],board[next]]=[a,b];if(valid)result.push([i,next]);}}return result;}
export function createBoard(random){let board;for(let attempt=0;attempt<300;attempt++){board=[];for(let y=0;y<C.size;y++)for(let x=0;x<C.size;x++){let options=Array.from({length:C.colors},(_,n)=>n);options=options.filter(v=>!(x>=2&&board[index(x-1,y)]?.color===v&&board[index(x-2,y)]?.color===v)&&!(y>=2&&board[index(x,y-1)]?.color===v&&board[index(x,y-2)]?.color===v));board.push({color:options[random.int(options.length)],special:null});}if(possibleMoves(board).length)return board;}throw Error('No board with playable moves');}
function specialSpawns(runs,from,to){const created=new Map(),horizontal=new Set(),vertical=new Set();for(const r of runs)for(const n of r.cells)(r.orientation==='row'?horizontal:vertical).add(n);
  for(const i of horizontal)if(vertical.has(i))created.set(i,{special:'bomb',priority:3});
  for(const r of runs){if(r.cells.length<4)continue;const type=r.cells.length>=C.rainbowLength?'rainbow':r.orientation;const priority=type==='rainbow'?4:2;const anchor=r.cells.includes(to)?to:r.cells.includes(from)?from:r.cells[Math.floor(r.cells.length/2)];if((created.get(anchor)?.priority||0)<priority)created.set(anchor,{special:type,priority});}
  // A T or L intersection wins over a stripe unless five in a line was made.
  for(const i of horizontal)if(vertical.has(i)&&created.get(i)?.priority!==4)created.set(i,{special:'bomb',priority:3});
  return created;
}
function activate(board,set,special,at,color,triggered){const [x,y]=coords(at);const add=(xx,yy)=>{if(xx>=0&&xx<C.size&&yy>=0&&yy<C.size)set.add(index(xx,yy));};
  if(special==='row')for(let xx=0;xx<C.size;xx++)add(xx,y);
  if(special==='col')for(let yy=0;yy<C.size;yy++)add(x,yy);
  if(special==='bomb')for(let yy=y-C.bombRadius;yy<=y+C.bombRadius;yy++)for(let xx=x-C.bombRadius;xx<=x+C.bombRadius;xx++)add(xx,yy);
  if(special==='rainbow'){const target=color>=0?color:board.find(t=>t&&t.color>=0)?.color??0;for(let i=0;i<board.length;i++)if(board[i]?.color===target)set.add(i);}
  triggered.add(at);
}
function comboClear(board,from,to){const a=board[from],b=board[to],set=new Set([from,to]);const pair=[a.special,b.special];const rainbows=pair.filter(v=>v==='rainbow').length;
  if(rainbows===2){for(let i=0;i<board.length;i++)set.add(i);return set;}
  if(rainbows===1){const other=a.special==='rainbow'?b:a;const color=other.color;
    for(let i=0;i<board.length;i++)if(board[i]?.color===color){set.add(i);if(other.special==='row'||other.special==='col'){const [x,y]=coords(i);for(let v=0;v<C.size;v++){set.add(index(v,y));set.add(index(x,v));}}if(other.special==='bomb'){const [x,y]=coords(i);for(let yy=y-1;yy<=y+1;yy++)for(let xx=x-1;xx<=x+1;xx++)if(xx>=0&&xx<C.size&&yy>=0&&yy<C.size)set.add(index(xx,yy));}}return set;
  }
  const [x,y]=coords(to);if(pair.includes('bomb')&&pair.every(v=>v==='bomb'))for(let yy=y-2;yy<=y+2;yy++)for(let xx=x-2;xx<=x+2;xx++)if(xx>=0&&xx<C.size&&yy>=0&&yy<C.size)set.add(index(xx,yy));
  else if(pair.includes('bomb'))for(let d=-1;d<=1;d++)for(let v=0;v<C.size;v++){if(y+d>=0&&y+d<C.size)set.add(index(v,y+d));if(x+d>=0&&x+d<C.size)set.add(index(x+d,v));}
  else for(const pos of [from,to]){const [xx,yy]=coords(pos);for(let v=0;v<C.size;v++){set.add(index(v,yy));set.add(index(xx,v));}}
  return set;
}
export function playMove(state,from,to){if(!adjacent(from,to))return{valid:false};const board=cloneBoard(state.board),ice=[...state.ice],random=rng(state.seed),first=board[from],second=board[to];if(!first||!second)return{valid:false};[board[from],board[to]]=[second,first];let combo=first.special&&second.special||first.special==='rainbow'||second.special==='rainbow';let runs=combo?[]:scan(board);if(!combo&&!runs.length)return{valid:false};let clear=combo?comboClear(board,from,to):null,score=0,colors=Array(C.colors).fill(0),hits=Array(board.length).fill(0),frames=[],cascades=0,specials=0;
  while(cascades<C.maxCascade){if(!clear){runs=scan(board);if(!runs.length)break;clear=new Set(runs.flatMap(r=>r.cells));}const created=combo&&cascades===0?new Map():specialSpawns(runs,from,to);const triggered=new Set(),initial=[...clear];for(let head=0,queue=initial;head<queue.length;head++){const i=queue[head],tile=board[i];if(!tile?.special||triggered.has(i))continue;activate(board,clear,tile.special,i,tile.color,triggered);for(const n of clear)if(!queue.includes(n))queue.push(n);}
    const before=cloneBoard(board),removed=[...clear];for(const i of removed){const tile=board[i];if(tile?.color>=0)colors[tile.color]++;if(ice[i]>0){ice[i]--;hits[i]++;}board[i]=null;}
    for(const [anchor,recipe] of created){if(!clear.has(anchor))continue;const base=before[anchor];board[anchor]={color:recipe.special==='rainbow'?-1:base.color,special:recipe.special};specials++;}
    const drops=[];for(let x=0;x<C.size;x++){let write=C.size-1;for(let y=C.size-1;y>=0;y--){const tile=board[index(x,y)];if(!tile)continue;board[index(x,write)]=tile;if(write!==y){board[index(x,y)]=null;drops.push({from:y,to:write,x,tile:copyTile(tile)});}write--;}for(let y=write;y>=0;y--){const tile={color:random.int(C.colors),special:null};board[index(x,y)]=tile;drops.push({from:y-write-1,to:y,x,tile:copyTile(tile)});}}
    score+=Math.round(removed.length*C.scorePerTile*(1+cascades*C.cascadeMultiplier)+created.size*24);
    frames.push({before,after:cloneBoard(board),removed,drops,created:[...created]});cascades++;clear=null;combo=false;
  }
  return{valid:true,board,ice,seed:random.state,score,colors,hits,frames,cascades,specials};
}
export function generateLevel(level,seed=(Math.random()*0xffffffff)>>>0){if(level<1||level>C.levels)throw Error('Invalid level');for(let attempt=0;attempt<80;attempt++){const random=rng((seed+attempt*11939)>>>0),board=createBoard(random),initialSeed=random.state,sim={board:cloneBoard(board),ice:Array(C.size*C.size).fill(0),seed:initialSeed};const selector=rng(seed^0xa5f045d3^attempt),witness=[],hitCounts=Array(board.length).fill(0);let score=0,collected=Array(C.colors).fill(0);
    for(let step=0;step<C.witnessMoves;step++){let moves=possibleMoves(sim.board);if(!moves.length){const shuffler=rng(sim.seed);sim.board=createBoard(shuffler);sim.seed=shuffler.state;continue;}const [from,to]=moves[selector.int(moves.length)],result=playMove(sim,from,to);if(!result.valid)continue;witness.push([from,to]);sim.board=result.board;sim.seed=result.seed;score+=result.score;for(let i=0;i<C.colors;i++)collected[i]+=result.colors[i];result.hits.forEach((n,i)=>hitCounts[i]+=n);for(const frame of result.frames)for(const i of frame.removed)hitCounts[i]++;}
    const kind=level<=5?'score':level<=10?'color':'ice';let goal={kind,amount:0,color:0};let ice=Array(board.length).fill(0);
    if(kind==='score')goal.amount=Math.max(60,Math.floor(score*.60));
    if(kind==='color'){let color=collected.indexOf(Math.max(...collected));goal={kind,amount:Math.max(5,Math.floor(collected[color]*.60)),color};}
    if(kind==='ice'){const candidates=hitCounts.map((v,i)=>({v,i})).filter(o=>o.v>=C.iceHits).sort((a,b)=>b.v-a.v);const needed=3+(level-11);if(candidates.length<needed)continue;for(const {i} of candidates.slice(0,needed))ice[i]=C.iceHits;goal.amount=needed;}
    const state={board,ice,seed:initialSeed};return{state,goal,witness,moveLimit:C.baseMoves+level*C.movesPerLevel};
  }throw Error('Could not generate certifiably solvable level');}
