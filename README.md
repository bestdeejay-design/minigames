# Мини-игры AXIIOM

> Коллекция из 11 браузерных мини-игр: физика, аркады, головоломки и стратегии.
> Без регистрации, без установки — открыл и играешь. Разработка **[AXIIOM](https://axiiom.ru)**.

**Живой каталог игр:** https://bestdeejay-design.github.io/minigames/

---

## Игры

| Игра | Жанр | Ссылка |
|------|------|--------|
| ✳️ Контур | аркада одним жестом: обводи искры, собирай комбо за 45 секунд | [играть](https://bestdeejay-design.github.io/minigames/contour/) |
| 🎱 Бильярд | спорт-симулятор с реалистичной физикой | [играть](https://bestdeejay-design.github.io/minigames/billiards/) |
| 🪙 Coin Tap | аркада на реакцию | [играть](https://bestdeejay-design.github.io/minigames/coin-tap/) |
| 🎯 FPS Corridor | 3D-шутер от первого лица | [играть](https://bestdeejay-design.github.io/minigames/fps3d/) |
| 🧩 Три в ряд | головоломка | [играть](https://bestdeejay-design.github.io/minigames/match3/) |
| 🏃 Mini Platformer | платформер | [играть](https://bestdeejay-design.github.io/minigames/platformer/) |
| 🏎 Гонка | аркадные гонки | [играть](https://bestdeejay-design.github.io/minigames/race/) |
| 🎰 Рулетка | демо казино без риска | [играть](https://bestdeejay-design.github.io/minigames/roulette/) |
| 🚀 Шутер | космический шутер | [играть](https://bestdeejay-design.github.io/minigames/shooter/) |
| 🪃 Рогатка | физическая аркада | [играть](https://bestdeejay-design.github.io/minigames/sling/) |
| 🏙 Небоскрёб | экономическая стратегия | [играть](https://bestdeejay-design.github.io/minigames/tycoon/) |

## Технически

- Каждая игра — самостоятельная статическая страница без бэкенда и сборки.
  Большинство игр используют `canvas` + vanilla JS; FPS Corridor загружает Three.js из CDN.
- Общий тёмный UI-кит хаба (`index.html`); там, где предусмотрено сохранение,
  прогресс и рекорды хранятся в `localStorage`.
- «Контур» работает без внешних библиотек: управление через Pointer Events,
  рекорд хранится на устройстве, звук включается по желанию.
- Мини-игры используются в портфолио AXIIOM как быстрые наглядные примеры
  геймдев- и UI-навыков.

## Структура

```
index.html   — хаб-каталог со ссылками на все игры
<game>/      — папка игры: index.html и, при необходимости, style.css, game.js
```

---

Нужна своя браузерная игра, промо-страница или интерактивный лендинг?
[AXIIOM](https://axiiom.ru) — от идеи до релиза.
