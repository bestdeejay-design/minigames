export const CONFIG=Object.freeze({
  worldSize:2000,objectCount:800,bots:5,roundSeconds:120,respawnSeconds:3,
  respawnScoreFactor:.70,spatialCell:110,baseRadius:20,growthFactor:1.1,maxRadius:160,
  moveSpeed:184,botSpeed:125,botThinkSeconds:.55,botStuckSeconds:1.8,
  pickupAnimationSeconds:.35,streetSpacing:210,streetWidth:35,
  objectKinds:{person:{count:320,size:7,points:2,color:'#e5c6a4'},tree:{count:220,size:15,points:5,color:'#6eab7c'},car:{count:160,size:24,points:12,color:'#e58d86'},building:{count:100,size:42,points:35,color:'#98a8c2'}},
  skinCostBase:65,skinCostGrowth:1.6,perkCostBase:90,perkCostGrowth:1.8,perkStartRadiusBonus:4,
  skins:[{name:'Бирюза',rim:'#8ce9df',body:'#163d43',particles:'#80e5cc'},{name:'Закат',rim:'#ffad87',body:'#4e2836',particles:'#ffc794'},{name:'Неон',rim:'#bc9af3',body:'#30264e',particles:'#e4adff'},{name:'Золото',rim:'#efcf83',body:'#4f3b28',particles:'#fff4ad'},{name:'Лёд',rim:'#9fcaf4',body:'#263e58',particles:'#d6efff'},{name:'Пламя',rim:'#ff748c',body:'#4a202a',particles:'#ffb0a2'}],
});
export const holeRadius=(score,perk=0)=>Math.min(CONFIG.maxRadius,CONFIG.baseRadius+perk*CONFIG.perkStartRadiusBonus+CONFIG.growthFactor*Math.sqrt(Math.max(0,score)));
