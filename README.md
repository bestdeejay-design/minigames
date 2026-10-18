# Мини-игры AXIIOM

> Коллекция из 16 браузерных мини-игр: физика, аркады, головоломки и стратегии.
> Без регистрации, без установки — открыл и играешь. Разработка **[AXIIOM](https://axiiom.ru)**.

**Живой каталог игр:** https://bestdeejay-design.github.io/minigames/

---

## Игры

| Игра | Жанр | Ссылка |
|------|------|--------|
| 🛡️ Рубеж 64 | оригинальная RTS: минералы, технологии, ретрансляторы, 3 сложности | [играть](https://bestdeejay-design.github.io/minigames/rubezh64/) |
| ✳️ Контур | аркада одним жестом: обводи искры, собирай комбо за 45 секунд | [играть](https://bestdeejay-design.github.io/minigames/contour/) |
| 🎱 Бильярд | пирамида и лузы, траектория с отскоками, стрик и миссии | [играть](https://bestdeejay-design.github.io/minigames/billiards/) |
| 🧨 Разлом | брейкер: рой шаров, вызов дня, стрик и миссии | [играть](https://bestdeejay-design.github.io/minigames/breaker/) |
| ⚔️ Звёздный рубеж | RTS: кампания, оборона с волнами, две расы (люди/кхарид), техника, турели, ремонт | [играть](https://bestdeejay-design.github.io/minigames/rts/) |
| 🪙 Coin Tap | монетный дождь: бомбы, бонусы, вызов дня и миссии | [играть](https://bestdeejay-design.github.io/minigames/coin-tap/) |
| 💠 Кристаллы | merge-drop: физика слияний, вызов дня | [играть](https://bestdeejay-design.github.io/minigames/crystals/) |
| 🔫 FPS Corridor | 3D-шутер: 6 волн, свайп-обзор на мобильных, миссии | [играть](https://bestdeejay-design.github.io/minigames/fps3d/) |
| 🧩 Три в ряд | головоломка | [играть](https://bestdeejay-design.github.io/minigames/match3/) |
| 🎮 Платформер | 8 уровней, монеты, шипы, coyote time, стрик и миссии | [играть](https://bestdeejay-design.github.io/minigames/platformer/) |
| 🏎 Гонка | ночная трасса, звёзды, вызов дня и миссии | [играть](https://bestdeejay-design.github.io/minigames/race/) |
| 🎰 Рулетка | европейское колесо, сохраняемый банк, стрик и миссии | [играть](https://bestdeejay-design.github.io/minigames/roulette/) |
| 👾 Шутер | космический тир: волны, арсенал, вызов дня и миссии | [играть](https://bestdeejay-design.github.io/minigames/shooter/) |
| 🎯 Рогатка | кристаллы-мишени, баллистика, стрик и миссии | [играть](https://bestdeejay-design.github.io/minigames/sling/) |
| 🧱 Тетрис | падающие блоки: SRS, T-спины, Спринт | [играть](https://bestdeejay-design.github.io/minigames/tetris/) |
| 🏙 Небоскрёб | idle-тайкун: терпение гостей, сохраняемый город, миссии | [играть](https://bestdeejay-design.github.io/minigames/tycoon/) |

## Технически

- Каждая игра — самостоятельная статическая страница без бэкенда и сборки.
  Большинство игр используют `canvas` + vanilla JS; FPS Corridor загружает Three.js из CDN.
- Общий тёмный UI-кит хаба (`index.html`); там, где предусмотрено сохранение,
  прогресс и рекорды хранятся в `localStorage`.
- «Контур» работает без внешних библиотек: управление через Pointer Events,
  рекорд хранится на устройстве, звук включается по желанию.
- «Рубеж 64» — автономные проверки логики: `node --test tests/game.test.mjs`
  из папки игры (нужен только Node.js, без пакетов).
- Игры канона AXIIOM (кристаллы, разлом и 9 пересобранных): welcome-экран,
  вызов дня (seed от даты МСК), стрик-множитель до ×1.5, ежедневные миссии,
  fixed timestep, тосты и модалки в едином стиле.
- Мини-игры используются в портфолио AXIIOM как быстрые наглядные примеры
  геймдев- и UI-навыков.

## Структура

```
index.html   — хаб-каталог со ссылками на все игры
<game>/      — папка игры: index.html, style.css, game.js
               (match3 и fps3d — однофайловые: только index.html,
                rts и rubezh64 — модульные: ES-модули в js/,
                у rubezh64 также автономные тесты в tests/)
```

---

Нужна своя браузерная игра, промо-страница или интерактивный лендинг?
[AXIIOM](https://axiiom.ru) — от идеи до релиза.
