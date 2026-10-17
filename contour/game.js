(() => {
  'use strict';

  const canvas = document.getElementById('game-canvas');
  const ctx = canvas.getContext('2d');
  const field = document.getElementById('field');
  const ui = {
    overlay: document.getElementById('overlay'),
    intro: document.getElementById('intro-panel'),
    pause: document.getElementById('pause-panel'),
    result: document.getElementById('result-panel'),
    score: document.getElementById('score'),
    combo: document.getElementById('combo'),
    time: document.getElementById('time'),
    timeStat: document.getElementById('time-stat'),
    best: document.getElementById('best-score'),
    stage: document.getElementById('stage-label'),
    stageDots: document.querySelectorAll('#stage-dots i'),
    ink: document.getElementById('ink-fill'),
    hint: document.getElementById('gesture-hint'),
    toast: document.getElementById('toast'),
    pauseButton: document.getElementById('pause-button'),
    soundButton: document.getElementById('sound-button'),
    resultKicker: document.getElementById('result-kicker'),
    resultTitle: document.getElementById('result-title'),
    resultScore: document.getElementById('result-score'),
    resultMessage: document.getElementById('result-message'),
    resultBest: document.getElementById('result-best'),
    resultLoops: document.getElementById('result-loops'),
  };
  if (!ctx) {
    document.querySelector('.panel-copy').textContent = 'Для этой игры нужен браузер с поддержкой canvas.';
    document.getElementById('start-button').disabled = true;
    return;
  }

  const ROUND_SECONDS = 45;
  const MAX_SECONDS = 55;
  const BEST_KEY = 'axiiom-contour-best-v1';
  const COLOR = { spark: '#b7f9d0', hazard: '#ff777e', bonus: '#ffd079' };
  const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  const game = {
    mode: 'ready', score: 0, best: readBest(), timeLeft: ROUND_SECONDS,
    elapsed: 0, streak: 0, loops: 0, stage: 1,
    goldCooldown: 10, hazardCooldown: 0,
  };

  let width = 0, height = 0, dpr = 1;
  let entities = [], particles = [], flashes = [], floaters = [], spawnQueue = [];
  let stroke = null, activePointer = null, nextId = 1;
  let lastFrame = performance.now(), toastTimer = 0, dangerTimer = 0;
  let soundOn = false, audio = null;

  function readBest() {
    try {
      const saved = Number(localStorage.getItem(BEST_KEY));
      return Number.isFinite(saved) && saved > 0 ? Math.floor(saved) : 0;
    } catch (_) { return 0; }
  }
  function saveBest() {
    try { localStorage.setItem(BEST_KEY, String(game.best)); } catch (_) { /* Private browsing may block storage. */ }
  }
  function format(n) { return Math.floor(n).toLocaleString('ru-RU'); }
  function setText(element, value) { if (element.textContent !== value) element.textContent = value; }
  function clamp(n, min, max) { return Math.max(min, Math.min(max, n)); }
  function distance(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }
  function inkLimit() { return Math.max(380, Math.min(width, height) * 1.85); }
  function closingRadius() { return clamp(width * .105, 35, 44); }
  function multiplier() { return Math.min(4, 1 + Math.floor(game.streak / 2)); }
  function greenTarget() { return clamp(Math.round(width * height / 22000), 5, 8); }
  function hazardTarget() { return game.stage === 1 ? 1 : game.stage === 2 ? 2 : (width * height < 90000 ? 2 : 3); }

  function updateHUD() {
    setText(ui.score, format(game.score));
    setText(ui.best, format(game.best));
    setText(ui.combo, `×${multiplier()}`);
    setText(ui.time, `0:${String(Math.max(0, Math.ceil(game.timeLeft))).padStart(2, '0')}`);
    ui.timeStat.classList.toggle('is-urgent', game.mode === 'playing' && game.timeLeft <= 10);
    setText(ui.stage, `ЗОНА 0${game.stage} / 03`);
    ui.stageDots.forEach((dot, index) => dot.classList.toggle('active', index < game.stage));
  }
  function updateInk() {
    const left = stroke ? clamp(1 - stroke.length / inkLimit(), 0, 1) : 1;
    ui.ink.style.transform = `scaleX(${left})`;
    ui.ink.classList.toggle('is-low', left < .24);
    ui.hint.textContent = stroke ? 'Вернись к началу линии' : 'Обведи искры и замкни линию';
  }
  function showPanel(name) {
    ui.overlay.hidden = false;
    ui.intro.hidden = name !== 'intro';
    ui.pause.hidden = name !== 'pause';
    ui.result.hidden = name !== 'result';
    ui.overlay.setAttribute('aria-labelledby', `${name}-title`);
    ui.pauseButton.disabled = true;
    const firstButton = ui[name].querySelector('button');
    if (firstButton && name !== 'intro') firstButton.focus({ preventScroll: true });
  }
  function hidePanel() {
    ui.overlay.hidden = true;
    ui.pauseButton.disabled = false;
  }
  function showToast(text, bad = false) {
    clearTimeout(toastTimer);
    ui.toast.textContent = text;
    ui.toast.classList.toggle('bad', bad);
    ui.toast.classList.remove('visible');
    // Restart the short entrance animation even if two captures happen quickly.
    void ui.toast.offsetWidth;
    ui.toast.classList.add('visible');
    toastTimer = setTimeout(() => ui.toast.classList.remove('visible'), 1300);
  }

  function tone(frequency, duration = .1, delay = 0, volume = .035) {
    if (!soundOn) return;
    try {
      const Audio = window.AudioContext || window.webkitAudioContext;
      if (!Audio) return;
      if (!audio) audio = new Audio();
      if (audio.state === 'suspended') audio.resume().catch(() => {});
      const oscillator = audio.createOscillator();
      const gain = audio.createGain();
      const start = audio.currentTime + delay;
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(frequency, start);
      gain.gain.setValueAtTime(.001, start);
      gain.gain.exponentialRampToValueAtTime(volume, start + .012);
      gain.gain.exponentialRampToValueAtTime(.001, start + duration);
      oscillator.connect(gain).connect(audio.destination);
      oscillator.start(start);
      oscillator.stop(start + duration + .02);
    } catch (_) { /* The game works without audio. */ }
  }
  function playCaptureSound(bad, many) {
    if (bad) { tone(210, .17); return; }
    tone(560, .08);
    tone(many ? 880 : 720, .14, .085);
  }

  function resize() {
    const rect = canvas.getBoundingClientRect();
    const nextWidth = Math.round(rect.width);
    const nextHeight = Math.round(rect.height);
    if (nextWidth < 2 || nextHeight < 2) return;
    const nextDpr = Math.min(window.devicePixelRatio || 1, 2);
    if (nextWidth === width && nextHeight === height && nextDpr === dpr) return;
    if (width && height) {
      for (const e of entities) {
        e.x = clamp(e.x * nextWidth / width, 26, nextWidth - 26);
        e.y = clamp(e.y * nextHeight / height, 26, nextHeight - 26);
      }
      particles = [];
      flashes = [];
      floaters = [];
      cancelStroke(); // A rotation must not turn an unfinished gesture into a capture.
    }
    width = nextWidth;
    height = nextHeight;
    dpr = nextDpr;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (game.mode === 'paused' || game.mode === 'ended') draw();
  }

  function spawn(type) {
    if (width < 60 || height < 60) return;
    const margin = Math.min(29, Math.min(width, height) * .12);
    let place = null, bestSpace = -1;
    for (let attempt = 0; attempt < 50; attempt++) {
      const candidate = {
        x: margin + Math.random() * (width - margin * 2),
        y: margin + Math.random() * (height - margin * 2),
      };
      const space = entities.length ? Math.min(...entities.map(e => distance(candidate, e))) : 999;
      if (space > bestSpace) { place = candidate; bestSpace = space; }
      if (space > (type === 'hazard' ? 71 : 58)) break;
    }
    const angle = Math.random() * Math.PI * 2;
    const speed = (type === 'spark' ? 8 + Math.random() * 8 : type === 'hazard' ? 5 + Math.random() * 4 : 9 + Math.random() * 5);
    entities.push({
      id: nextId++, type, x: place.x, y: place.y,
      vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
      phase: Math.random() * Math.PI * 2, radius: type === 'spark' ? 10 + Math.random() * 2 : 12,
    });
  }
  function seedField() {
    entities = [];
    for (let i = 0; i < greenTarget(); i++) spawn('spark');
    spawn('hazard');
    spawn('bonus');
  }
  function count(type) { return entities.filter(e => e.type === type).length; }
  function ensurePopulation() {
    const waiting = spawnQueue.filter(job => job.type === 'spark').length;
    const missing = greenTarget() - count('spark') - waiting;
    for (let i = 0; i < missing; i++) spawnQueue.push({ type: 'spark', delay: .28 + i * .14 });
  }
  function updatePopulation(dt) {
    game.goldCooldown -= dt;
    game.hazardCooldown = Math.max(0, game.hazardCooldown - dt);
    for (let i = spawnQueue.length - 1; i >= 0; i--) {
      const job = spawnQueue[i];
      job.delay -= dt;
      if (job.delay <= 0 && !stroke) {
        spawn(job.type);
        spawnQueue.splice(i, 1);
      }
    }
    ensurePopulation();
    if (!stroke && game.hazardCooldown === 0 && count('hazard') < hazardTarget()) spawn('hazard');
    if (!stroke && game.goldCooldown <= 0 && count('bonus') === 0) {
      spawn('bonus');
      game.goldCooldown = 10 + Math.random() * 3;
    }
  }
  function updateEntities(dt, speedFactor = 1) {
    const difficulty = 1 + Math.min(.65, game.elapsed * .016);
    const margin = Math.min(26, Math.min(width, height) * .11);
    for (const e of entities) {
      e.x += e.vx * dt * speedFactor * difficulty;
      e.y += e.vy * dt * speedFactor * difficulty;
      if (e.x < margin || e.x > width - margin) {
        e.x = clamp(e.x, margin, width - margin);
        e.vx *= -1;
      }
      if (e.y < margin || e.y > height - margin) {
        e.y = clamp(e.y, margin, height - margin);
        e.vy *= -1;
      }
    }
  }
  function burst(x, y, type) {
    const amount = reducedMotion ? 4 : (type === 'hazard' ? 11 : 14);
    for (let i = 0; i < amount; i++) {
      const angle = Math.PI * 2 * i / amount + Math.random() * .25;
      const speed = 30 + Math.random() * 95;
      particles.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
        age: 0, life: .42 + Math.random() * .25, radius: 1.4 + Math.random() * 2.2, color: COLOR[type] });
    }
    if (particles.length > 160) particles.splice(0, particles.length - 160);
  }
  function floater(x, y, text, color) { floaters.push({ x, y, text, color, age: 0, life: .85 }); }
  function updateEffects(dt) {
    for (const p of particles) { p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= .97; p.vy *= .97; p.age += dt; }
    for (const f of flashes) f.age += dt;
    for (const f of floaters) { f.y -= 27 * dt; f.age += dt; }
    particles = particles.filter(p => p.age < p.life);
    flashes = flashes.filter(f => f.age < f.life);
    floaters = floaters.filter(f => f.age < f.life);
    if (dangerTimer > 0) {
      dangerTimer -= dt;
      if (dangerTimer <= 0) field.classList.remove('is-danger');
    }
  }

  function startGame() {
    resize();
    game.mode = 'playing';
    game.score = 0;
    game.timeLeft = ROUND_SECONDS;
    game.elapsed = 0;
    game.streak = 0;
    game.loops = 0;
    game.stage = 1;
    game.goldCooldown = 10;
    game.hazardCooldown = 0;
    particles = [];
    flashes = [];
    floaters = [];
    spawnQueue = [];
    cancelStroke();
    seedField();
    field.classList.remove('is-danger');
    clearTimeout(toastTimer);
    ui.toast.classList.remove('visible');
    hidePanel();
    updateHUD();
    lastFrame = performance.now();
    tone(490, .09);
    tone(720, .13, .09);
  }
  function pauseGame() {
    if (game.mode !== 'playing') return;
    cancelStroke();
    game.mode = 'paused';
    showPanel('pause');
    updateHUD();
  }
  function resumeGame() {
    if (game.mode !== 'paused') return;
    game.mode = 'playing';
    hidePanel();
    lastFrame = performance.now();
    updateHUD();
  }
  function finishGame() {
    if (game.mode !== 'playing') return;
    cancelStroke();
    game.mode = 'ended';
    const isRecord = game.score > game.best;
    if (isRecord) { game.best = game.score; saveBest(); }
    ui.resultKicker.textContent = isRecord ? 'НОВЫЙ РЕКОРД' : 'ВРЕМЯ ВЫШЛО';
    ui.resultTitle.innerHTML = isRecord ? 'Это новый рекорд<span class="accent-dot">.</span>'
      : game.loops === 0 ? 'Попробуем ещё<span class="accent-dot">.</span>' : 'Хорошая петля<span class="accent-dot">.</span>';
    ui.resultScore.textContent = format(game.score);
    ui.resultBest.textContent = format(game.best);
    ui.resultLoops.textContent = String(game.loops);
    ui.resultMessage.textContent = game.loops === 0
      ? 'Попробуй обвести искры и вернуть линию к её началу.'
      : isRecord ? 'Отличный результат! Сможешь собрать ещё больше?' : 'Собирай несколько искр одной петлёй, чтобы увеличить счёт.';
    updateHUD();
    draw();
    showPanel('result');
    tone(640, .1);
    tone(820, .16, .11);
  }

  function pointerPosition(event) {
    const rect = canvas.getBoundingClientRect();
    return { x: clamp(event.clientX - rect.left, 0, width), y: clamp(event.clientY - rect.top, 0, height) };
  }
  function signedArea(points) {
    let area = 0;
    for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
      area += points[j].x * points[i].y - points[i].x * points[j].y;
    }
    return area / 2;
  }
  function contains(points, x, y) {
    let inside = false;
    for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
      const a = points[i], b = points[j];
      if ((a.y > y) !== (b.y > y) && x < (b.x - a.x) * (y - a.y) / (b.y - a.y) + a.x) inside = !inside;
    }
    return inside;
  }
  function canClose() {
    return stroke && stroke.length > 115 && stroke.points.length >= 5 && Math.abs(signedArea(stroke.points)) > 1350;
  }
  function releasePointer() {
    const id = activePointer;
    activePointer = null;
    if (id !== null && canvas.hasPointerCapture?.(id)) canvas.releasePointerCapture(id);
  }
  function cancelStroke(message = '') {
    if (!stroke) return;
    stroke = null;
    releasePointer();
    updateInk();
    if (message) showToast(message);
  }
  function appendPoint(point) {
    if (!stroke) return;
    const last = stroke.points[stroke.points.length - 1];
    const step = distance(last, point);
    if (step < 2.5) return;
    stroke.length += step;
    stroke.points.push(point);
    updateInk();
    if (stroke.length > inkLimit()) {
      cancelStroke('Линия закончилась — попробуй компактнее');
    } else if (canClose() && distance(point, stroke.points[0]) <= closingRadius()) {
      closeLoop();
    }
  }
  function closeLoop() {
    if (!stroke) return;
    const points = stroke.points.slice();
    stroke = null;
    releasePointer();
    updateInk();

    const caught = entities.filter(e => contains(points, e.x, e.y));
    const greens = caught.filter(e => e.type === 'spark');
    const reds = caught.filter(e => e.type === 'hazard');
    const golds = caught.filter(e => e.type === 'bonus');
    const caughtIds = new Set(caught.map(e => e.id));
    entities = entities.filter(e => !caughtIds.has(e.id));
    flashes.push({ points, age: 0, life: .42, color: reds.length ? COLOR.hazard : COLOR.spark });
    if (caught.length === 0) {
      game.streak = 0;
      showToast('Пустая петля — попробуй ещё');
      tone(360, .09);
      updateHUD();
      return;
    }

    for (const e of caught) burst(e.x, e.y, e.type);
    const cx = caught.reduce((sum, e) => sum + e.x, 0) / caught.length;
    const cy = caught.reduce((sum, e) => sum + e.y, 0) / caught.length;
    if (reds.length) {
      game.streak = 0;
      game.timeLeft = Math.max(0, game.timeLeft - reds.length * 5);
      game.hazardCooldown = 1.25;
      field.classList.add('is-danger');
      dangerTimer = .45;
      floater(cx, cy + 15, `−${reds.length * 5} сек`, COLOR.hazard);
      navigator.vibrate?.(35);
    } else if (greens.length) {
      game.streak++;
    }
    if (golds.length) {
      game.timeLeft = Math.min(MAX_SECONDS, game.timeLeft + golds.length * 2);
      game.goldCooldown = 8 + Math.random() * 4;
      floater(cx, cy + 34, `+${golds.length * 2} сек`, COLOR.bonus);
    }
    if (greens.length || golds.length) game.loops++;
    const chain = reds.length ? 1 : multiplier();
    const pointsEarned = (greens.length * 10 + Math.max(0, greens.length - 1) * 5 + golds.length * 20) * chain;
    game.score += pointsEarned;
    if (pointsEarned) floater(cx, cy - 9, `+${pointsEarned}`, COLOR.spark);
    ensurePopulation();
    updateHUD();
    if (game.timeLeft <= 0) { finishGame(); return; }
    if (reds.length) showToast(`Ловушка! −${reds.length * 5} сек`, true);
    else if (greens.length >= 3) showToast(`Отличная петля · +${pointsEarned}${chain > 1 ? ` · ×${chain}` : ''}`);
    else if (chain > 1 && greens.length) showToast(`Серия ×${chain} · +${pointsEarned}`);
    else if (golds.length) showToast(`+${golds.length * 2} сек · +${pointsEarned} очков`);
    else showToast(`+${pointsEarned} очков`);
    playCaptureSound(reds.length > 0, greens.length >= 3);
  }

  canvas.addEventListener('pointerdown', event => {
    if (game.mode !== 'playing' || stroke || (event.pointerType === 'mouse' && event.button !== 0)) return;
    event.preventDefault();
    activePointer = event.pointerId;
    canvas.setPointerCapture(event.pointerId);
    stroke = { points: [pointerPosition(event)], length: 0 };
    updateInk();
  });
  canvas.addEventListener('pointermove', event => {
    if (event.pointerId !== activePointer || !stroke) return;
    event.preventDefault();
    appendPoint(pointerPosition(event));
  });
  canvas.addEventListener('pointerup', event => {
    if (event.pointerId !== activePointer || !stroke) return;
    event.preventDefault();
    appendPoint(pointerPosition(event));
    if (!stroke) return; // appendPoint may have completed the loop already.
    if (canClose() && distance(stroke.points[stroke.points.length - 1], stroke.points[0]) <= closingRadius()) closeLoop();
    else cancelStroke(stroke.length > 30 ? 'Замкни линию у её начала' : 'Нарисуй петлю вокруг искр');
  });
  canvas.addEventListener('pointercancel', event => {
    if (event.pointerId === activePointer) cancelStroke();
  });
  canvas.addEventListener('lostpointercapture', event => {
    if (event.pointerId === activePointer) cancelStroke();
  });

  document.getElementById('start-button').addEventListener('click', startGame);
  document.getElementById('again-button').addEventListener('click', startGame);
  document.getElementById('restart-button').addEventListener('click', startGame);
  document.getElementById('resume-button').addEventListener('click', resumeGame);
  ui.pauseButton.addEventListener('click', pauseGame);
  ui.soundButton.addEventListener('click', () => {
    soundOn = !soundOn;
    ui.soundButton.classList.toggle('is-on', soundOn);
    ui.soundButton.setAttribute('aria-pressed', String(soundOn));
    ui.soundButton.setAttribute('aria-label', soundOn ? 'Выключить звук' : 'Включить звук');
    ui.soundButton.title = soundOn ? 'Выключить звук' : 'Включить звук';
    if (soundOn) tone(670, .12);
  });
  window.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
      if (game.mode === 'playing') pauseGame();
      else if (game.mode === 'paused') resumeGame();
    }
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) pauseGame();
    lastFrame = performance.now();
  });
  window.addEventListener('resize', resize);
  if (window.ResizeObserver) new ResizeObserver(resize).observe(field);

  function drawEntity(e, now) {
    const pulse = reducedMotion ? 0 : Math.sin(now * .003 + e.phase);
    ctx.save();
    ctx.translate(e.x, e.y);
    if (e.type === 'spark') {
      const halo = ctx.createRadialGradient(0, 0, 2, 0, 0, 28);
      halo.addColorStop(0, 'rgba(183,249,208,.32)');
      halo.addColorStop(1, 'rgba(183,249,208,0)');
      ctx.fillStyle = halo;
      ctx.beginPath(); ctx.arc(0, 0, 28, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = 'rgba(173,255,207,.26)';
      ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.arc(0, 0, 17 + pulse * 2, 0, Math.PI * 2); ctx.stroke();
      ctx.shadowColor = COLOR.spark; ctx.shadowBlur = 13;
      ctx.fillStyle = COLOR.spark;
      ctx.beginPath(); ctx.arc(0, 0, e.radius, 0, Math.PI * 2); ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#f8fff9';
      ctx.beginPath(); ctx.arc(-2, -2, 2.6, 0, Math.PI * 2); ctx.fill();
    } else if (e.type === 'hazard') {
      ctx.strokeStyle = `rgba(255,119,126,${.3 + pulse * .1})`;
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(0, 0, 19 + pulse * 1.5, 0, Math.PI * 2); ctx.stroke();
      ctx.shadowColor = COLOR.hazard; ctx.shadowBlur = 14;
      ctx.fillStyle = COLOR.hazard;
      ctx.beginPath();
      ctx.moveTo(0, -13); ctx.lineTo(13, 0); ctx.lineTo(0, 13); ctx.lineTo(-13, 0);
      ctx.closePath(); ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#59272c';
      ctx.fillRect(-1.5, -6, 3, 8);
      ctx.beginPath(); ctx.arc(0, 5, 1.7, 0, Math.PI * 2); ctx.fill();
    } else {
      const halo = ctx.createRadialGradient(0, 0, 2, 0, 0, 28);
      halo.addColorStop(0, 'rgba(255,208,121,.3)');
      halo.addColorStop(1, 'rgba(255,208,121,0)');
      ctx.fillStyle = halo;
      ctx.beginPath(); ctx.arc(0, 0, 28, 0, Math.PI * 2); ctx.fill();
      ctx.rotate(reducedMotion ? 0 : now * .0006 + e.phase);
      ctx.shadowColor = COLOR.bonus; ctx.shadowBlur = 13;
      ctx.fillStyle = COLOR.bonus;
      ctx.beginPath();
      for (let i = 0; i < 8; i++) {
        const angle = i * Math.PI / 4 - Math.PI / 2;
        const radius = i % 2 ? 4.5 : 13;
        const x = Math.cos(angle) * radius, y = Math.sin(angle) * radius;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.closePath(); ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#fff8d8';
      ctx.beginPath(); ctx.arc(0, 0, 2.8, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }
  function trace(points) {
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
  }
  function drawStroke() {
    if (!stroke) return;
    const points = stroke.points;
    const start = points[0];
    const low = stroke.length > inkLimit() * .76;
    if (points.length > 1) {
      trace(points);
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.strokeStyle = low ? 'rgba(255,208,121,.23)' : 'rgba(183,249,208,.25)';
      ctx.lineWidth = 17; ctx.shadowColor = low ? COLOR.bonus : COLOR.spark; ctx.shadowBlur = 18; ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = low ? COLOR.bonus : COLOR.spark;
      ctx.lineWidth = 4.5; ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,.58)';
      ctx.lineWidth = 1.2; ctx.stroke();
    }
    ctx.save();
    ctx.strokeStyle = low ? 'rgba(255,208,121,.7)' : 'rgba(183,249,208,.7)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([3, 4]);
    ctx.beginPath(); ctx.arc(start.x, start.y, closingRadius(), 0, Math.PI * 2); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = '#f0fff3'; ctx.shadowColor = COLOR.spark; ctx.shadowBlur = 14;
    ctx.beginPath(); ctx.arc(start.x, start.y, 5, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
  function draw() {
    if (!width || !height) return;
    ctx.clearRect(0, 0, width, height);
    for (const flash of flashes) {
      ctx.save();
      trace(flash.points);
      ctx.closePath();
      ctx.globalAlpha = (1 - flash.age / flash.life) * .19;
      ctx.fillStyle = flash.color;
      ctx.fill('evenodd');
      ctx.globalAlpha = (1 - flash.age / flash.life) * .7;
      ctx.strokeStyle = flash.color;
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.restore();
    }
    const now = performance.now();
    for (const e of entities) drawEntity(e, now);
    for (const p of particles) {
      ctx.globalAlpha = Math.max(0, 1 - p.age / p.life);
      ctx.fillStyle = p.color;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
    drawStroke();
    for (const f of floaters) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, 1 - f.age / f.life);
      ctx.textAlign = 'center';
      ctx.font = '800 17px system-ui, sans-serif';
      ctx.lineWidth = 4;
      ctx.strokeStyle = '#102025';
      ctx.strokeText(f.text, f.x, f.y);
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, f.x, f.y);
      ctx.restore();
    }
  }
  function loop(now) {
    const realDt = Math.min(.15, Math.max(0, (now - lastFrame) / 1000));
    lastFrame = now;
    if (game.mode === 'playing') {
      game.timeLeft = Math.max(0, game.timeLeft - realDt);
      game.elapsed += realDt;
      const newStage = game.elapsed < 14 ? 1 : game.elapsed < 29 ? 2 : 3;
      if (newStage !== game.stage) game.stage = newStage;
      updateEntities(realDt, stroke ? .18 : 1);
      if (!stroke) updatePopulation(realDt);
      else { game.goldCooldown -= realDt; game.hazardCooldown = Math.max(0, game.hazardCooldown - realDt); }
      updateEffects(realDt);
      updateHUD();
      if (game.timeLeft <= 0) finishGame();
    } else if (game.mode === 'ready') {
      updateEntities(realDt, .35);
    }
    if (game.mode === 'playing' || game.mode === 'ready') draw();
    requestAnimationFrame(loop);
  }

  resize();
  seedField();
  updateHUD();
  updateInk();
  requestAnimationFrame(loop);
})();
