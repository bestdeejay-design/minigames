export const CONFIG=Object.freeze({
  initialMines:3, maxMines:8, firstLevel:1, upgradeGrowth:1.15,
  milestoneLevels:[25,50,100], milestoneMultiplier:2,
  baseYield:[5,14,36,94,245,640,1665,4330],
  baseUpgradeCost:[10,35,100,340,1200,4200,15500,58000],
  unlockCost:[0,0,0,420,1800,8000,42000,205000],
  managerCost:[120,320,850,2300,7000,22000,68000,210000],
  cycleSeconds:4.2, managerSpeed:1.65, maxOfflineSeconds:8*60*60,
  offlineEfficiency:.5, doubleAdSeconds:3, prestigeThreshold:10_000_000,
  maxCurrency:1e300,
  crystalIncomeBonus:.10, saveInterval:5,
});
