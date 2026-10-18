export const CONFIG=Object.freeze({
  columns:5, initialRows:7, maxLevel:6, energyMax:10, energyCost:1,
  energyRegenerationMs:20_000, activeOrders:3, chainMinimum:3,
  extensionBaseCost:75, extensionMultiplier:1.8, vacuumCost:45,
  items:['Семя','Росток','Цветок','Куст','Дерево','Золотое дерево'],
  colors:['#d7b675','#8fdb93','#f6a9d1','#79b477','#7ad0aa','#f6cc6b'],
  orderReward:level=>Math.round(10*level**1.75),
});
