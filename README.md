# Мини-игры AXIIOM

> Коллекция из 13 браузерных мини-игр: физика, аркады, головоломки и стратегии.
> Без регистрации, без установки — открыл и играешь. Разработка **[AXIIOM](https://axiiom.ru)**.

**Живой каталог игр:** https://bestdeejay-design.github.io/minigames/

---

## Игры

| Игра | Жанр | Ссылка |
|------|------|--------|
| 🎱 Бильярд | спорт-симулятор с реалистичной физикой | [играть](https://bestdeejay-design.github.io/minigames/billiards/) |
| 🧨 Разлом | брейкер: рой шаров, вызов дня, стрик и миссии | [играть](https://bestdeejay-design.github.io/minigames/breaker/) |
| 🪙 Coin Tap | аркада на реакцию | [играть](https://bestdeejay-design.github.io/minigames/coin-tap/) |
| 💠 Кристаллы | merge-drop: физика слияний, вызов дня | [играть](https://bestdeejay-design.github.io/minigames/crystals/) |
| 🎯 FPS Corridor | 3D-шутер от первого лица | [играть](https://bestdeejay-design.github.io/minigames/fps3d/) |
| 🧩 Три в ряд | головоломка | [играть](https://bestdeejay-design.github.io/minigames/match3/) |
| 🏃 Mini Platformer | платформер | [играть](https://bestdeejay-design.github.io/minigames/platformer/) |
| 🏎 Гонка | аркадные гонки | [играть](https://bestdeejay-design.github.io/minigames/race/) |
| 🎰 Рулетка | демо казино без риска | [играть](https://bestdeejay-design.github.io/minigames/roulette/) |
| 🚀 Шутер | космический шутер | [играть](https://bestdeejay-design.github.io/minigames/shooter/) |
| 🪃 Рогатка | физическая аркада | [играть](https://bestdeejay-design.github.io/minigames/sling/) |
| 🧱 Тетрис | падающие блоки: SRS, T-спины, Спринт | [играть](https://bestdeejay-design.github.io/minigames/tetris/) |
| 🏙 Небоскрёб | экономическая стратегия | [играть](https://bestdeejay-design.github.io/minigames/tycoon/) |

## Технически

- Каждая игра — самостоятельная статическая страница: `canvas` + vanilla JS,
  без зависимостей и сборки.
- Общий тёмный UI-кит хаба (`index.html`), прогресс и рекорды — в `localStorage`.
- Мини-игры используются в портфолио AXIIOM как быстрые наглядные примеры
  геймдев- и UI-навыков.

## Структура

```
index.html   — хаб-каталог со ссылками на все игры
<game>/      — папка игры: index.html, style.css, game.js
               (match3 и fps3d — однофайловые: только index.html)
```

---

Нужна своя браузерная игра, промо-страница или интерактивный лендинг?
[AXIIOM](https://axiiom.ru) — от идеи до релиза.
