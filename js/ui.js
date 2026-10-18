import { BUILDING_TYPES, DIFFICULTIES, RULES, TILE_SIZE, UNIT_TYPES, UPGRADES } from './config.js';
import { relayCount } from './relays.js';

export function formatTime(seconds) {
  const value = Math.max(0, Math.floor(seconds));
  return `${String(Math.floor(value / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`;
}
const percent = (value, max) => Math.max(0, Math.min(100, Math.round(value / max * 100)));

export class UI {
  constructor(game, audio) {
    this.game = game;
    this.audio = audio;
    this.selectedDifficulty = game.difficulty;
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
    this.renderDifficulty();
  }
  bind() {
    document.getElementById('start-button').addEventListener('click', () => this.start());
    document.getElementById('again-button').addEventListener('click', () => this.restart());
    document.getElementById('restart-button').addEventListener('click', () => this.restart());
    document.getElementById('change-difficulty-button').addEventListener('click', () => this.chooseNewGame());
    document.getElementById('result-difficulty-button').addEventListener('click', () => this.chooseNewGame());
    document.getElementById('resume-button').addEventListener('click', () => this.resume());
    document.getElementById('help-close-button').addEventListener('click', () => this.closeHelp());
    this.pauseButton.addEventListener('click', () => this.pause());
    document.getElementById('help-button').addEventListener('click', () => this.openHelp());
    this.soundButton.addEventListener('click', () => { this.audio.toggle(); this.updateSound(); });
    document.getElementById('difficulty-options').addEventListener('click', event => {
      const option = event.target.closest('button[data-difficulty]');
      if (!option || !DIFFICULTIES[option.dataset.difficulty]) return;
      this.selectedDifficulty = option.dataset.difficulty;
      this.game.reset(this.selectedDifficulty);
      this.lastSelectionKey = this.lastCommandKey = '';
      this.renderDifficulty();
    });
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
  renderDifficulty() {
    for (const option of document.querySelectorAll('#difficulty-options button')) {
      const active = option.dataset.difficulty === this.selectedDifficulty;
      option.classList.toggle('is-selected', active);
      option.setAttribute('aria-pressed', String(active));
    }
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
  start() {
    this.audio.unlock();
    if (this.game.difficulty !== this.selectedDifficulty) this.game.reset(this.selectedDifficulty);
    this.game.start();
    this.hidePanel();
  }
  restart() {
    this.audio.unlock();
    this.input?.cancelMode();
    this.game.reset(this.selectedDifficulty);
    this.game.start();
    this.resultShown = false;
    this.lastSelectionKey = this.lastCommandKey = this.lastMission = '';
    this.hidePanel();
  }
  chooseNewGame() {
    this.input?.cancelMode();
    this.game.reset(this.selectedDifficulty);
    this.resultShown = false;
    this.lastSelectionKey = this.lastCommandKey = this.lastMission = '';
    this.renderDifficulty();
    this.showPanel('start');
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
    const key = selected.map(e => e.kind === 'relay' ? `${e.id}:${e.owner}:${Math.round(e.control*100)}`
      : `${e.id}:${Math.ceil(e.hp ?? e.amount)}:${Math.round((e.progress || 0)*100)}:${e.cargo || 0}:${e.queue?.length || 0}:${Math.floor((e.training || 0)*2)}:${e.research?.key || ''}:${Math.floor(e.research?.remaining || 0)}:${e.order?.kind || ''}`).join('|');
    if (key === this.lastSelectionKey) return;
    this.lastSelectionKey = key;
    document.getElementById('selection-count').textContent = selected.length > 1 ? `${selected.length} ВЫБРАНО` : '';
    if (!selected.length) {
      this.selectionContent.innerHTML = '<div class="empty-selection"><span class="empty-symbol">⌖</span><strong>Нет выделения</strong><small>Выберите инженера, бойца, здание или узел на карте.</small></div>';
      return;
    }
    if (selected.length > 1) {
      const tally = selected.reduce((counts, entity) => { counts[entity.type] = (counts[entity.type] || 0) + 1; return counts; }, {});
      const names = Object.entries(tally).map(([type, count]) => `${UNIT_TYPES[type]?.name || BUILDING_TYPES[type]?.name || type}: ${count}`).join(' · ');
      const average = Math.round(selected.reduce((sum,e)=>sum+(e.hp || 0)/(e.maxHp || 1),0)/selected.length*100);
      this.selectionContent.innerHTML = `<div class="unit-profile"><div class="profile-icon">${selected.length}</div><div class="profile-main"><div class="profile-title">Отряд <small>${selected.length} единиц</small></div><p class="profile-sub">${names}</p><div class="hp-track ${average < 33 ? 'low' : ''}"><span style="width:${average}%"></span></div><div class="unit-grid">${selected.slice(0,18).map(e=>`<i class="unit-chip ${e.type || ''}" title="${UNIT_TYPES[e.type]?.name || BUILDING_TYPES[e.type]?.name || ''}"></i>`).join('')}</div></div></div>`;
      return;
    }
    const entity = selected[0];
    if (entity.kind === 'mineral') {
      this.selectionContent.innerHTML = `<div class="unit-profile"><div class="profile-icon">◆</div><div class="profile-main"><div class="profile-title">Минеральный узел</div><p class="profile-sub">Кристаллы для строительства и производства</p><div class="profile-meta">Осталось: <b>${Math.ceil(entity.amount)}</b> · ПКМ инженером — добывать</div></div></div>`;
      return;
    }
    if (entity.kind === 'relay') {
      const owner = entity.owner === 'player' ? 'ЭКСПЕДИЦИЯ' : entity.owner === 'enemy' ? 'ПРОТИВНИК' : 'НЕЙТРАЛЕН';
      const capture = Math.round(Math.abs(entity.control) * 100);
      this.selectionContent.innerHTML = `<div class="unit-profile"><div class="profile-icon relay">✦</div><div class="profile-main"><div class="profile-title">${entity.name}<small>${owner}</small></div><p class="profile-sub">Удерживайте юнита у узла ${RULES.relayCaptureSeconds} сек. · соперник может оспорить</p><div class="progress-track"><span style="width:${capture}%"></span></div><div class="profile-meta">Контроль <b>${capture}%</b> · бонус <b>+${RULES.relayIncome} ◆/с</b> и обзор · ПКМ отрядом — к узлу</div></div></div>`;
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
    else if (!building && entity.order.kind === 'attackMove') subtitle += ' · АТАКУЕТ С ПРОДВИЖЕНИЕМ';
    else if (!building && entity.order.kind === 'move') subtitle += ' · ДВИЖЕТСЯ';
    const construction = building && entity.progress < 1 ? `<div class="profile-meta">Постройка: <b>${Math.round(entity.progress*100)}%</b></div><div class="progress-track" style="margin-top:5px"><span style="width:${Math.round(entity.progress*100)}%"></span></div>` : '';
    const queue = building && entity.queue.length ? `<div class="queue-line">ОЧЕРЕДЬ: ${entity.queue.length} · ${Math.round(Math.min(100,entity.training/UNIT_TYPES[entity.queue[0]].trainSeconds*100))}% готово</div>` : '';
    const research = building && entity.research ? `<div class="queue-line">ИССЛЕДОВАНИЕ: ${UPGRADES[entity.research.key].name} · ${Math.round(100*(1-entity.research.remaining/entity.research.total))}%</div>` : '';
    const combat = !building ? `<div class="profile-meta"><span>Урон <b>${this.game.damageFor(entity, {kind:'unit'})}</b></span><span>Дальность <b>${Math.round(stats.range/TILE_SIZE)} кл.</b></span>${entity.type === 'worker' ? `<span>Груз <b>${entity.cargo}</b></span>` : ''}${entity.type === 'support' ? '<span>Лечит союзников рядом</span>' : ''}${entity.type === 'guardian' ? '<span>Усиленная атака зданий</span>' : ''}</div>` : entity.type === 'turret' ? `<div class="profile-meta">Урон <b>${this.game.damageFor(entity,{kind:'unit'})}</b> · дальность <b>${Math.round(stats.range/TILE_SIZE)} кл.</b></div>` : entity.type === 'outpost' ? '<div class="profile-meta">Принимает минералы · выпускает инженеров · +6 населения</div>' : '';
    this.selectionContent.innerHTML = `<div class="unit-profile"><div class="profile-icon ${own ? '' : 'enemy'}">${stats.short}</div><div class="profile-main"><div class="profile-title">${stats.name}<small>${hp} / ${entity.maxHp} HP</small></div><p class="profile-sub">${subtitle}</p><div class="hp-track ${health < 33 ? 'low' : ''}"><span style="width:${health}%"></span></div>${construction}${queue}${research}${combat}</div></div>`;
  }

  renderCommands() {
    const selected = this.game.selected().filter(e => e.team === 'player');
    const primary = selected[0];
    const [used, cap] = this.game.getSupply('player');
    const upgradeLevels = Object.values(this.game.player.upgrades).join(',');
    const key = `${this.game.selection.join(',')}:${Math.floor(this.game.player.minerals)}:${used}:${cap}:${Math.round((primary?.progress || 0)*100)}:${primary?.queue?.length || 0}:${primary?.research?.key || ''}:${upgradeLevels}:${this.input?.buildType || ''}:${this.input?.attackMove || false}`;
    if (key === this.lastCommandKey) return;
    this.lastCommandKey = key;
    const commands = [];
    let mode = 'ОЖИДАНИЕ';
    if (selected.some(e => e.kind === 'unit' && e.type === 'worker')) {
      mode = 'ИНЖЕНЕР / СТРОИТЕЛЬСТВО';
      for (const [type, icon, hotkey] of [['house','⌂','B'],['barracks','▤','R'],['turret','◎','T'],['workshop','⚙','F'],['outpost','✥','O']]) {
        const stats = BUILDING_TYPES[type];
        const locked = !this.game.canBuild(type);
        commands.push({ id:type, name:{house:'Модуль',turret:'Башня',outpost:'Аванпост'}[type] || stats.name, icon, key:hotkey,
          cost:locked ? `НУЖЕН ${BUILDING_TYPES[stats.requires].short}` : stats.cost,
          disabled:locked || this.game.player.minerals < stats.cost,
          title:`${stats.name} · ${stats.cost} минералов${locked ? ` · требуется: ${BUILDING_TYPES[stats.requires].name}` : ''}` });
      }
      commands.push({ id:'gather', name:'Добывать', icon:'◆', key:'G', cost:'авто' });
      commands.push({ id:'stop', name:'Стоп', icon:'■', key:'S', cost:'приказ' });
    } else if (primary?.kind === 'building' && primary.progress >= 1) {
      const stats = BUILDING_TYPES[primary.type];
      mode = stats.trains.length || Object.values(UPGRADES).some(upgrade=>upgrade.building===primary.type) ? 'ПРОИЗВОДСТВО / ТЕХНОЛОГИИ' : 'ЗДАНИЕ';
      for (const type of stats.trains) {
        const unit = UNIT_TYPES[type];
        const hotkey = {worker:'W',marine:'M',scout:'C',guardian:'H',support:'E'}[type];
        commands.push({ id:type, name:unit.name, icon:{worker:'◈',marine:'⬡',scout:'◇',guardian:'⬢',support:'✚'}[type], key:hotkey, cost:unit.cost,
          disabled:this.game.player.minerals<unit.cost || used + unit.supply>cap || primary.queue.length>=5,
          title:`${unit.supply} населения · ${unit.trainSeconds} сек.` });
      }
      for (const [upgradeKey, upgrade] of Object.entries(UPGRADES)) {
        if (upgrade.building !== primary.type) continue;
        const level = this.game.player.upgrades[upgradeKey];
        const cost = upgrade.cost + upgrade.costStep * level;
        commands.push({ id:upgradeKey, name:upgrade.name, icon:upgradeKey==='drills'?'◆':upgradeKey==='plating'?'▣':'⌁', key:upgrade.hotkey,
          cost:level >= upgrade.max ? 'ИЗУЧЕНО' : `${cost} ◆ · ${level}/${upgrade.max}`,
          disabled:level>=upgrade.max || Boolean(primary.research) || this.game.player.minerals<cost,
          title:upgrade.description, upgrade:true });
      }
    } else if (selected.some(e => e.kind === 'unit')) {
      mode = 'ОТРЯД';
      commands.push({ id:'attackMove', name:'Атаковать', icon:'⌖', key:'A', cost:'с движением' });
      commands.push({ id:'stop', name:'Стоп', icon:'■', key:'S', cost:'приказ' });
    } else if (primary?.kind === 'building') mode = primary.progress < 1 ? 'СТРОИТЕЛЬСТВО' : 'ЗДАНИЕ';
    document.getElementById('command-mode').textContent = mode;
    this.commandButtons.innerHTML = commands.map(c => `<button class="command-button ${c.upgrade ? 'is-upgrade' : ''} ${this.input?.buildType === c.id || this.input?.attackMove && c.id === 'attackMove' ? 'is-active' : ''}" type="button" data-command="${c.id}" ${c.disabled ? 'disabled' : ''} title="${c.title || c.name}"><span class="command-icon">${c.icon}</span><span class="command-copy"><strong>${c.name}</strong><small>${typeof c.cost === 'number' ? `${c.cost} ◆` : c.cost}</small></span><span class="command-key">${c.key}</span></button>`).join('');
    if (!this.input?.buildType && !this.input?.attackMove) {
      this.setCommandHint(primary?.kind === 'building' ? 'ПКМ по карте — точка сбора' : 'ЛКМ — выделить · ПКМ — приказ');
    }
  }

  updateMission(used, cap) {
    const buildings = this.game.buildings.filter(b => b.team === 'player');
    const barracks = buildings.some(b => b.type === 'barracks' && b.progress >= 1);
    const workshop = buildings.some(b => b.type === 'workshop' && b.progress >= 1);
    const turret = buildings.some(b => b.type === 'turret' && b.progress >= 1);
    let message;
    if (this.game.mode === 'ready' || !barracks) message = 'Инженеры добывают минералы. Выделите одного: казарма (R), башня (T).';
    else if (this.game.ai?.waveTimer < RULES.waveWarningSeconds) message = 'Вражеская волна близко! Башни и стражи удержат рубеж.';
    else if (cap - used <= 1) message = 'Лимит населения достигнут: постройте жилой модуль (B).';
    else if (!turret) message = 'Башня (T) защищает базу. Разведчик из казармы (C) быстро открывает карту.';
    else if (!workshop) message = 'Мастерская (F) откроет стражей, ремонтников и улучшения.';
    else if (!relayCount(this.game, 'player')) message = 'Отправьте разведчика к ретранслятору: обзор и +2,5 минерала в секунду.';
    else message = 'Удерживайте узлы, исследуйте броню/оружие и найдите вражеские здания.';
    if (message !== this.lastMission) {
      document.getElementById('mission-hint').textContent = message;
      this.lastMission = message;
    }
  }

  showResult() {
    if (this.resultShown) return;
    this.resultShown = true;
    const won = this.game.mode === 'victory';
    document.getElementById('result-kicker').textContent = `${won ? 'МИССИЯ ВЫПОЛНЕНА' : 'СИГНАЛ ПОТЕРЯН'} · ${this.game.settings.name.toUpperCase()}`;
    document.getElementById('result-title').innerHTML = won ? 'Победа<span class="title-dot">.</span>' : 'Поражение<span class="title-dot">.</span>';
    document.getElementById('result-description').textContent = won
      ? 'Все вражеские здания уничтожены. Сектор за экспедицией.'
      : 'Все ваши здания уничтожены. Попробуйте башни, броню или более спокойный режим.';
    document.getElementById('result-time').textContent = formatTime(this.game.time);
    document.getElementById('result-waves').textContent = String(this.game.ai.waveNumber);
    document.getElementById('result-losses').textContent = String(this.game.losses);
    const best = this.game.readBest();
    document.getElementById('result-best').textContent = best === null ? '—' : formatTime(best);
    this.showPanel('result');
  }

  update() {
    const amount = Math.floor(this.game.player.minerals).toLocaleString('ru-RU');
    const minerals = document.getElementById('minerals-count');
    if (minerals.textContent !== amount) minerals.textContent = amount;
    const supply = document.getElementById('supply-count');
    const [used, cap] = this.game.getSupply('player');
    const supplyText = `${used} / ${cap}`;
    if (supply.textContent !== supplyText) supply.textContent = supplyText;
    supply.parentElement.classList.toggle('is-low', cap - used <= 1);
    const relays = relayCount(this.game, 'player');
    const relayText = `${relays} / ${this.game.relays.length}`;
    document.getElementById('relay-count').textContent = relayText;
    document.getElementById('mini-status').textContent = `УЗЛЫ ${relays}/${this.game.relays.length} · 64×64`;
    document.getElementById('sector-label').textContent = `СЕКТОР 01 / РЕЖИМ «${this.game.settings.name.toUpperCase()}»`;
    this.updateMission(used, cap);
    const wave = document.getElementById('wave-timer');
    const waveText = this.game.mode === 'ready' ? '—' : formatTime(this.game.ai.waveTimer);
    if (wave.textContent !== waveText) wave.textContent = waveText;
    wave.parentElement.classList.toggle('is-soon', this.game.mode === 'running' && this.game.ai.waveTimer <= RULES.waveWarningSeconds);
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
