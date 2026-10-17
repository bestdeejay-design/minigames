import { BUILDING_TYPES, RULES, TILE_SIZE, UNIT_TYPES } from './config.js';

export function formatTime(seconds) {
  const value = Math.max(0, Math.floor(seconds));
  return `${String(Math.floor(value / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`;
}
const percent = (value, max) => Math.max(0, Math.min(100, Math.round(value / max * 100)));

export class UI {
  constructor(game, audio) {
    this.game = game;
    this.audio = audio;
    this.overlay = document.getElementById('overlay');
    this.panels = {
      start: document.getElementById('start-panel'),
      pause: document.getElementById('pause-panel'),
      help: document.getElementById('help-panel'),
      result: document.getElementById('result-panel'),
    };
    this.pauseButton = document.getElementById('pause-button');
    this.soundButton = document.getElementById('sound-button');
    this.selectionContent = document.getElementById('selection-content');
    this.commandButtons = document.getElementById('command-buttons');
    this.helpReturn = 'start';
    this.lastNotice = '';
    this.lastSelectionKey = '';
    this.lastCommandKey = '';
    this.lastMission = '';
    this.resultShown = false;
    this.commandHandler = null;
    this.input = null;
    this.bind();
    this.updateSound();
  }
  bind() {
    document.getElementById('start-button').addEventListener('click', () => this.start());
    document.getElementById('again-button').addEventListener('click', () => this.restart());
    document.getElementById('restart-button').addEventListener('click', () => this.restart());
    document.getElementById('resume-button').addEventListener('click', () => this.resume());
    document.getElementById('help-close-button').addEventListener('click', () => this.closeHelp());
    this.pauseButton.addEventListener('click', () => this.pause());
    document.getElementById('help-button').addEventListener('click', () => this.openHelp());
    this.soundButton.addEventListener('click', () => { this.audio.toggle(); this.updateSound(); });
    this.commandButtons.addEventListener('click', event => {
      const button = event.target.closest('button[data-command]');
      if (button && !button.disabled && this.commandHandler) this.commandHandler(button.dataset.command);
    });
    window.addEventListener('keydown', event => {
      if (event.repeat) return;
      if (event.code === 'Space') {
        event.preventDefault();
        if (this.game.mode === 'running') this.pause();
        else if (this.game.mode === 'paused' && !this.panels.pause.hidden) this.resume();
      }
    });
  }
  setCommandHint(text) { document.getElementById('command-hint').textContent = text; }
  updateSound() {
    this.soundButton.setAttribute('aria-pressed', String(this.audio.enabled));
    this.soundButton.setAttribute('aria-label', this.audio.enabled ? 'Выключить звук' : 'Включить звук');
    this.soundButton.querySelector('span').textContent = this.audio.enabled ? 'ВКЛ' : 'ВЫКЛ';
  }
  showPanel(name) {
    this.overlay.hidden = false;
    for (const [key, panel] of Object.entries(this.panels)) panel.hidden = key !== name;
    this.overlay.setAttribute('aria-labelledby', `${name}-title`);
    this.pauseButton.disabled = true;
    if (name !== 'start') this.panels[name].querySelector('button')?.focus({ preventScroll: true });
  }
  hidePanel() { this.overlay.hidden = true; this.pauseButton.disabled = false; }
  start() { this.audio.unlock(); this.game.start(); this.hidePanel(); }
  restart() {
    this.audio.unlock();
    this.input?.cancelMode();
    this.game.reset();
    this.game.start();
    this.resultShown = false;
    this.lastSelectionKey = this.lastCommandKey = '';
    this.hidePanel();
  }
  pause() { if (this.game.mode === 'running') { this.game.pause(); this.showPanel('pause'); } }
  resume() { if (this.game.mode === 'paused') { this.game.resume(); this.hidePanel(); } }
  openHelp() {
    this.helpReturn = this.game.mode === 'ready' ? 'start' : ['victory','defeat'].includes(this.game.mode) ? 'result' : 'pause';
    if (this.game.mode === 'running') this.game.pause();
    this.showPanel('help');
  }
  closeHelp() { this.showPanel(this.helpReturn); }

  renderSelection() {
    const selected = this.game.selected();
    const key = selected.map(e => `${e.id}:${Math.ceil(e.hp ?? e.amount)}:${Math.round((e.progress || 0)*100)}:${e.cargo || 0}:${e.queue?.length || 0}:${Math.floor((e.training || 0)*2)}:${e.order?.kind || ''}`).join('|');
    if (key === this.lastSelectionKey) return;
    this.lastSelectionKey = key;
    document.getElementById('selection-count').textContent = selected.length > 1 ? `${selected.length} ВЫБРАНО` : '';
    if (!selected.length) {
      this.selectionContent.innerHTML = '<div class="empty-selection"><span class="empty-symbol">⌖</span><strong>Нет выделения</strong><small>Выберите инженера, бойца или здание на поле.</small></div>';
      return;
    }
    if (selected.length > 1) {
      const workers = selected.filter(e => e.type === 'worker').length;
      const marines = selected.filter(e => e.type === 'marine').length;
      const average = Math.round(selected.reduce((sum,e)=>sum+(e.hp || 0)/(e.maxHp || 1),0)/selected.length*100);
      this.selectionContent.innerHTML = `<div class="unit-profile"><div class="profile-icon">${selected.length}</div><div class="profile-main"><div class="profile-title">Отряд <small>${selected.length} единиц</small></div><p class="profile-sub">Инженеры: ${workers} · Штурмовики: ${marines}</p><div class="hp-track ${average < 33 ? 'low' : ''}"><span style="width:${average}%"></span></div><div class="unit-grid">${selected.slice(0,16).map(e=>`<i class="unit-chip ${e.type === 'marine' ? 'marine' : ''}" title="${e.type === 'marine' ? 'Штурмовик' : 'Инженер'}"></i>`).join('')}</div></div></div>`;
      return;
    }
    const entity = selected[0];
    if (entity.kind === 'mineral') {
      this.selectionContent.innerHTML = `<div class="unit-profile"><div class="profile-icon">◆</div><div class="profile-main"><div class="profile-title">Минеральный узел</div><p class="profile-sub">Кристаллы для строительства и производства</p><div class="profile-meta">Осталось: <b>${Math.ceil(entity.amount)}</b> · ПКМ инженером — добывать</div></div></div>`;
      return;
    }
    const building = entity.kind === 'building';
    const stats = building ? BUILDING_TYPES[entity.type] : UNIT_TYPES[entity.type];
    const own = entity.team === 'player';
    const hp = Math.ceil(entity.hp);
    const health = percent(hp, entity.maxHp);
    let subtitle = own ? 'ЭКСПЕДИЦИЯ' : 'ПРОТИВНИК';
    if (building && entity.progress < 1) subtitle += ` · СТРОИТСЯ ${Math.round(entity.progress * 100)}%`;
    else if (!building && entity.order.kind === 'harvest') subtitle += entity.cargo ? ' · НЕСЁТ МИНЕРАЛЫ' : ' · ДОБЫВАЕТ';
    else if (!building && entity.order.kind === 'attack') subtitle += ' · АТАКУЕТ';
    else if (!building && entity.order.kind === 'move') subtitle += ' · ДВИЖЕТСЯ';
    const extra = building
      ? `${entity.progress < 1 ? `<div class="profile-meta">Постройка: <b>${Math.round(entity.progress*100)}%</b></div><div class="progress-track" style="margin-top:5px"><span style="width:${Math.round(entity.progress*100)}%"></span></div>` : ''}${entity.queue.length ? `<div class="queue-line">ОЧЕРЕДЬ: ${entity.queue.length} · ${Math.round(Math.min(100,entity.training/UNIT_TYPES[entity.queue[0]].trainSeconds*100))}% готово</div>` : ''}`
      : `<div class="profile-meta"><span>Урон <b>${stats.damage}</b></span><span>Дальность <b>${Math.round(stats.range/TILE_SIZE)} кл.</b></span>${entity.type === 'worker' ? `<span>Груз <b>${entity.cargo}</b></span>` : ''}</div>`;
    this.selectionContent.innerHTML = `<div class="unit-profile"><div class="profile-icon ${own ? '' : 'enemy'}">${stats.short}</div><div class="profile-main"><div class="profile-title">${stats.name}<small>${hp} / ${entity.maxHp} HP</small></div><p class="profile-sub">${subtitle}</p><div class="hp-track ${health < 33 ? 'low' : ''}"><span style="width:${health}%"></span></div>${extra}</div></div>`;
  }

  renderCommands() {
    const selected = this.game.selected().filter(e => e.team === 'player');
    const primary = selected[0];
    const [used, cap] = this.game.getSupply('player');
    const key = `${this.game.selection.join(',')}:${Math.floor(this.game.player.minerals)}:${used}:${cap}:${Math.round((primary?.progress || 0)*100)}:${primary?.queue?.length || 0}:${this.input?.buildType || ''}:${this.input?.attackMove || false}`;
    if (key === this.lastCommandKey) return;
    this.lastCommandKey = key;
    const commands = [];
    let mode = 'ОЖИДАНИЕ';
    if (selected.some(e => e.kind === 'unit' && e.type === 'worker')) {
      mode = 'ИНЖЕНЕР';
      commands.push({ id:'house', name:'Жилой модуль', icon:'⌂', key:'B', cost:BUILDING_TYPES.house.cost, disabled:this.game.player.minerals<BUILDING_TYPES.house.cost });
      commands.push({ id:'barracks', name:'Казарма', icon:'▤', key:'R', cost:BUILDING_TYPES.barracks.cost, disabled:this.game.player.minerals<BUILDING_TYPES.barracks.cost });
      commands.push({ id:'gather', name:'Добывать', icon:'◆', key:'G', cost:'авто' });
      commands.push({ id:'stop', name:'Стоп', icon:'■', key:'S', cost:'приказ' });
    } else if (primary?.kind === 'building' && primary.progress >= 1 && BUILDING_TYPES[primary.type].trains) {
      mode = 'ПРОИЗВОДСТВО';
      const type = BUILDING_TYPES[primary.type].trains;
      commands.push({ id:type, name:UNIT_TYPES[type].name, icon:type === 'worker' ? '◈' : '⬡', key:type === 'worker' ? 'W' : 'M', cost:UNIT_TYPES[type].cost,
        disabled:this.game.player.minerals<UNIT_TYPES[type].cost || used + UNIT_TYPES[type].supply>cap || primary.queue.length>=5 });
    } else if (selected.some(e => e.kind === 'unit')) {
      mode = 'ОТРЯД';
      commands.push({ id:'attackMove', name:'Атаковать', icon:'⌖', key:'A', cost:'с движением' });
      commands.push({ id:'stop', name:'Стоп', icon:'■', key:'S', cost:'приказ' });
    } else if (primary?.kind === 'building') mode = primary.progress < 1 ? 'СТРОИТЕЛЬСТВО' : 'ЗДАНИЕ';
    document.getElementById('command-mode').textContent = mode;
    this.commandButtons.innerHTML = commands.map(c => `<button class="command-button ${this.input?.buildType === c.id || this.input?.attackMove && c.id === 'attackMove' ? 'is-active' : ''}" type="button" data-command="${c.id}" ${c.disabled ? 'disabled' : ''} title="${c.name}${typeof c.cost === 'number' ? ` — ${c.cost} минералов` : ''}"><span class="command-icon">${c.icon}</span><span class="command-copy"><strong>${c.name}</strong><small>${typeof c.cost === 'number' ? `${c.cost} ◆` : c.cost}</small></span><span class="command-key">${c.key}</span></button>`).join('');
    if (!this.input?.buildType && !this.input?.attackMove) {
      this.setCommandHint(primary?.kind === 'building' ? 'ПКМ по карте — назначить точку сбора' : 'ЛКМ — выделить · ПКМ — приказ');
    }
  }

  updateMission(used, cap) {
    const buildings = this.game.buildings.filter(b => b.team === 'player');
    const barracks = buildings.find(b => b.type === 'barracks' && b.progress >= 1);
    const underConstruction = buildings.some(b => b.type === 'barracks' && b.progress < 1);
    const marineCount = this.game.units.filter(u => u.team === 'player' && u.type === 'marine').length;
    let message;
    if (this.game.mode === 'ready' || !barracks && !underConstruction) message = 'Инженеры добывают минералы. Выделите одного и постройте казарму.';
    else if (!barracks) message = 'Казарма строится. Подготовьте место для новых бойцов — постройте жилой модуль.';
    else if (this.game.ai?.waveTimer < 18) message = 'Вражеская волна близко! Соберите бойцов и приготовьтесь к обороне.';
    else if (cap - used <= 1) message = 'Лимит населения достигнут: инженером постройте жилой модуль (B).';
    else if (marineCount < 5) message = 'Выделите казарму и обучайте штурмовиков (M). Больше бойцов — сильнее отряд.';
    else message = 'Соберите отряд (Ctrl + 1), атакуйте с продвижением (A) и уничтожьте базу врага.';
    if (message !== this.lastMission) {
      document.getElementById('mission-hint').textContent = message;
      this.lastMission = message;
    }
  }

  showResult() {
    if (this.resultShown) return;
    this.resultShown = true;
    const won = this.game.mode === 'victory';
    document.getElementById('result-kicker').textContent = won ? 'МИССИЯ ВЫПОЛНЕНА' : 'СИГНАЛ ПОТЕРЯН';
    document.getElementById('result-title').innerHTML = won ? 'Победа<span class="title-dot">.</span>' : 'Поражение<span class="title-dot">.</span>';
    document.getElementById('result-description').textContent = won
      ? 'Все вражеские здания уничтожены. Колония удержала рубеж.'
      : 'Все ваши здания уничтожены. Попробуйте раньше наладить добычу и оборону.';
    document.getElementById('result-time').textContent = formatTime(this.game.time);
    document.getElementById('result-losses').textContent = String(this.game.losses);
    const best = this.game.readBest();
    document.getElementById('result-best').textContent = best === null ? '—' : formatTime(best);
    this.showPanel('result');
  }

  update() {
    const minerals = document.getElementById('minerals-count');
    const amount = Math.floor(this.game.player.minerals).toLocaleString('ru-RU');
    if (minerals.textContent !== amount) minerals.textContent = amount;
    const supply = document.getElementById('supply-count');
    const [used, cap] = this.game.getSupply('player');
    const supplyText = `${used} / ${cap}`;
    if (supply.textContent !== supplyText) supply.textContent = supplyText;
    supply.parentElement.classList.toggle('is-low', cap - used <= 1);
    this.updateMission(used, cap);
    const wave = document.getElementById('wave-timer');
    const remaining = this.game.ai ? this.game.ai.waveTimer : RULES.firstWaveSeconds;
    const waveText = this.game.mode === 'ready' ? '—' : formatTime(remaining);
    if (wave.textContent !== waveText) wave.textContent = waveText;
    const toast = document.getElementById('toast');
    if (this.game.noticeTime > 0) {
      if (this.lastNotice !== this.game.notice) { toast.textContent = this.game.notice; this.lastNotice = this.game.notice; }
      const classes = `toast visible ${this.game.noticeTone === 'normal' ? '' : this.game.noticeTone}`;
      if (toast.className !== classes) toast.className = classes;
    } else { toast.classList.remove('visible'); this.lastNotice = ''; }
    this.renderSelection();
    this.renderCommands();
    if (this.game.mode === 'victory' || this.game.mode === 'defeat') this.showResult();
  }
}
