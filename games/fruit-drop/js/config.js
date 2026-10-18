export const CONFIG=Object.freeze({
  types:['Вишня','Клубника','Виноград','Мандарин','Лимон','Персик','Яблоко','Груша','Ананас','Дыня','Арбуз'],
  colors:['#ed6987','#ef6f7d','#9872cd','#f5a866','#f4d375','#f5ba8a','#e67b82','#accf80','#e4b66b','#badf89','#78c989'],
  maxLevel:11,dropPool:5,baseRadius:11,radiusGrowth:1.23,
  gravity:980,substeps:4,solverIterations:2,wallMargin:10,floorMargin:14,
  restitution:.11,friction:.74,damping:.999,settleSpeed:2.3,
  dangerLineOffset:79,dangerSeconds:2,spawnOffset:47,
  releaseCooldown:.55,mergeImpulse:140,maxBallsForTarget:80,
});
