import { CONFIG } from './config.js';

function midiToFreq(midi) {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

export class AudioSystem {
  constructor(muted = false) {
    this.ctx = null;
    this.masterGain = null;
    this.reverbNode = null;
    this.muted = Boolean(muted);
    this.stationIndex = 0;
    this._stepIndex = 0;
    this._stepAccum = 0;

    this._engineOsc = null;
    this._engineGain = null;
    this._sirenOsc = null;
    this._sirenGain = null;
    this._sirenActive = false;
    this._sirenPhase = 0;

    this._waveGain = null;
    this._seagullTimer = 6.0;
  }

  unlock() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
      }
      return;
    }
    const AudioCtx =
      typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext);
    if (!AudioCtx) return;

    try {
      this.ctx = new AudioCtx();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = this.muted ? 0 : 0.35;
      this.masterGain.connect(this.ctx.destination);

      this.reverbNode = this._createReverb();
      const reverbGain = this.ctx.createGain();
      reverbGain.gain.value = 0.28;
      this.reverbNode.connect(reverbGain);
      reverbGain.connect(this.masterGain);

      this._initContinuousLoops();
    } catch (_e) {
      this.ctx = null;
    }
  }

  _createReverb() {
    const rate = this.ctx.sampleRate;
    const length = Math.floor(rate * 1.1);
    const impulse = this.ctx.createBuffer(2, length, rate);
    for (let ch = 0; ch < 2; ch++) {
      const data = impulse.getChannelData(ch);
      for (let i = 0; i < length; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, 2.4);
      }
    }
    const convolver = this.ctx.createConvolver();
    convolver.buffer = impulse;
    return convolver;
  }

  _initContinuousLoops() {
    if (!this.ctx) return;

    // 1. Непрерывный осциллятор двигателя машины (высота зависит от скорости)
    this._engineOsc = this.ctx.createOscillator();
    this._engineOsc.type = 'sawtooth';
    this._engineOsc.frequency.value = 55;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 260;
    this._engineGain = this.ctx.createGain();
    this._engineGain.gain.value = 0.0;
    this._engineOsc.connect(filter);
    filter.connect(this._engineGain);
    this._engineGain.connect(this.masterGain);
    this._engineOsc.start();

    // 2. Полицейская сирена
    this._sirenOsc = this.ctx.createOscillator();
    this._sirenOsc.type = 'triangle';
    this._sirenOsc.frequency.value = 680;
    this._sirenGain = this.ctx.createGain();
    this._sirenGain.gain.value = 0.0;
    this._sirenOsc.connect(this._sirenGain);
    this._sirenGain.connect(this.masterGain);
    this._sirenOsc.start();

    // 3. Городской и морской шум прибоя
    const rate = this.ctx.sampleRate;
    const buf = this.ctx.createBuffer(1, rate * 2, rate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      data[i] = (Math.random() * 2 - 1) * 0.35;
    }
    const noise = this.ctx.createBufferSource();
    noise.buffer = buf;
    noise.loop = true;
    const waveFilter = this.ctx.createBiquadFilter();
    waveFilter.type = 'bandpass';
    waveFilter.frequency.value = 380;
    waveFilter.Q.value = 0.9;
    this._waveGain = this.ctx.createGain();
    this._waveGain.gain.value = 0.02;
    noise.connect(waveFilter);
    waveFilter.connect(this._waveGain);
    this._waveGain.connect(this.masterGain);
    noise.start();
  }

  setMuted(muted) {
    this.muted = Boolean(muted);
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setValueAtTime(this.muted ? 0 : 0.35, this.ctx.currentTime);
    }
    return this.muted;
  }

  toggleMute() {
    return this.setMuted(!this.muted);
  }

  nextStation() {
    this.stationIndex = (this.stationIndex + 1) % CONFIG.RADIO_STATIONS.length;
    this._stepIndex = 0;
    this._stepAccum = 0;
    return this.getCurrentStationName();
  }

  getCurrentStationName() {
    return CONFIG.RADIO_STATIONS[this.stationIndex].name;
  }

  update(dt, player) {
    if (!this.ctx || this.muted) return;

    // 1. Синтвейв-радио секвенсер
    const st = CONFIG.RADIO_STATIONS[this.stationIndex];
    if (st && st.bpm > 0) {
      const stepDuration = 60 / st.bpm / 4; // 16-е ноты
      this._stepAccum += dt;
      while (this._stepAccum >= stepDuration) {
        this._stepAccum -= stepDuration;
        this._triggerRadioStep(st, this._stepIndex);
        this._stepIndex = (this._stepIndex + 1) % 16;
      }
    }

    // 2. Модуляция сирены полиции
    if (this._sirenGain && this._sirenOsc) {
      if (this._sirenActive) {
        this._sirenPhase += dt * 4.5;
        const freq = 740 + Math.sin(this._sirenPhase) * 190;
        this._sirenOsc.frequency.setValueAtTime(freq, this.ctx.currentTime);
        this._sirenGain.gain.setValueAtTime(0.06, this.ctx.currentTime);
      } else {
        this._sirenGain.gain.setValueAtTime(0.0, this.ctx.currentTime);
      }
    }

    // 3. Морской прибой и крики чаек у набережной
    if (player && this._waveGain) {
      const beachProximity = Math.max(0.015, Math.min(0.09, (player.x - 60) / 1400));
      this._waveGain.gain.setValueAtTime(beachProximity, this.ctx.currentTime);

      this._seagullTimer -= dt;
      if (this._seagullTimer <= 0) {
        this._seagullTimer = 7.5 + Math.random() * 8.0;
        if (player.x > 65) {
          this._playSeagull();
        }
      }
    }
  }

  _triggerRadioStep(station, step) {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;

    // Бас-секвенсер
    const bassSemitone = station.bassPattern[step % station.bassPattern.length];
    const bassFreq = midiToFreq(station.rootNote + bassSemitone);
    const bassOsc = this.ctx.createOscillator();
    const bassFilter = this.ctx.createBiquadFilter();
    const bassGain = this.ctx.createGain();
    bassOsc.type = 'sawtooth';
    bassOsc.frequency.setValueAtTime(bassFreq, now);
    bassFilter.type = 'lowpass';
    bassFilter.frequency.setValueAtTime(520, now);
    bassFilter.frequency.exponentialRampToValueAtTime(140, now + 0.11);
    bassGain.gain.setValueAtTime(0.11, now);
    bassGain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
    bassOsc.connect(bassFilter);
    bassFilter.connect(bassGain);
    bassGain.connect(this.masterGain);
    bassOsc.start(now);
    bassOsc.stop(now + 0.13);

    // Арпеджио с реверберацией
    const arpSemitone = station.arpPattern[step % station.arpPattern.length];
    const arpFreq = midiToFreq(station.rootNote + 12 + arpSemitone);
    const arpOsc = this.ctx.createOscillator();
    const arpGain = this.ctx.createGain();
    arpOsc.type = 'square';
    arpOsc.frequency.setValueAtTime(arpFreq, now);
    arpGain.gain.setValueAtTime(0.045, now);
    arpGain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
    arpOsc.connect(arpGain);
    arpGain.connect(this.masterGain);
    if (this.reverbNode) arpGain.connect(this.reverbNode);
    arpOsc.start(now);
    arpOsc.stop(now + 0.15);

    // Барабаны: бочка на 0, 4, 8, 12; рабочий с реверберацией на 4, 12
    if (step % 4 === 0) {
      const kick = this.ctx.createOscillator();
      const kGain = this.ctx.createGain();
      kick.type = 'sine';
      kick.frequency.setValueAtTime(135, now);
      kick.frequency.exponentialRampToValueAtTime(38, now + 0.11);
      kGain.gain.setValueAtTime(0.22, now);
      kGain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
      kick.connect(kGain);
      kGain.connect(this.masterGain);
      kick.start(now);
      kick.stop(now + 0.13);
    }
    if (step === 4 || step === 12) {
      this._playNoiseBurst(0.13, 1200, 0.09, true);
    } else if (step % 2 === 1) {
      this._playNoiseBurst(0.035, 5500, 0.025, false);
    }
  }

  _playNoiseBurst(duration, cutoff, volume, useReverb = false) {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const len = Math.max(1, Math.floor(this.ctx.sampleRate * duration));
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    }
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = cutoff * 0.4;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);
    if (useReverb && this.reverbNode) gain.connect(this.reverbNode);
    src.start(now);
  }

  _playSeagull() {
    if (!this.ctx || this.muted) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1650, now);
    osc.frequency.linearRampToValueAtTime(2100, now + 0.08);
    osc.frequency.exponentialRampToValueAtTime(1150, now + 0.32);
    gain.gain.setValueAtTime(0.03, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.34);
    osc.connect(gain);
    if (this.reverbNode) gain.connect(this.reverbNode);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.35);
  }

  setEngineSpeed(speed, active) {
    if (!this.ctx || !this._engineOsc || !this._engineGain) return;
    const now = this.ctx.currentTime;
    if (!active || this.muted) {
      this._engineGain.gain.setValueAtTime(0, now);
      return;
    }
    const freq = 52 + Math.min(28, Math.abs(speed)) * 5.2;
    this._engineOsc.frequency.setValueAtTime(freq, now);
    this._engineGain.gain.setValueAtTime(0.09, now);
  }

  setSirenActive(active) {
    this._sirenActive = Boolean(active);
  }

  // 3 различных синтезированных звука выстрела
  playShot(weaponId = 'pistol') {
    if (!this.ctx || this.muted) return;
    const now = this.ctx.currentTime;

    if (weaponId === 'pistol') {
      this._playNoiseBurst(0.11, 1800, 0.22, true);
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(340, now);
      osc.frequency.exponentialRampToValueAtTime(75, now + 0.09);
      g.gain.setValueAtTime(0.24, now);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
      osc.connect(g);
      g.connect(this.masterGain);
      osc.start(now);
      osc.stop(now + 0.1);
    } else if (weaponId === 'smg') {
      this._playNoiseBurst(0.075, 2400, 0.17, false);
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(420, now);
      osc.frequency.exponentialRampToValueAtTime(110, now + 0.065);
      g.gain.setValueAtTime(0.18, now);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.07);
      osc.connect(g);
      g.connect(this.masterGain);
      osc.start(now);
      osc.stop(now + 0.075);
    } else {
      // Дробовик — мощный низкочастотный удар + широкий шум
      this._playNoiseBurst(0.24, 900, 0.32, true);
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(190, now);
      osc.frequency.exponentialRampToValueAtTime(38, now + 0.22);
      g.gain.setValueAtTime(0.32, now);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.23);
      osc.connect(g);
      g.connect(this.masterGain);
      osc.start(now);
      osc.stop(now + 0.24);
    }
  }

  playEnemyShot() {
    if (!this.ctx || this.muted) return;
    this._playNoiseBurst(0.08, 1600, 0.09, false);
  }

  playStep() {
    if (!this.ctx || this.muted) return;
    this._playNoiseBurst(0.035, 700, 0.035, false);
  }

  playReload() {
    if (!this.ctx || this.muted) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(520, now);
    osc.frequency.setValueAtTime(740, now + 0.08);
    g.gain.setValueAtTime(0.08, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
    osc.connect(g);
    g.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.17);
  }

  playHit() {
    if (!this.ctx || this.muted) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(160, now);
    osc.frequency.exponentialRampToValueAtTime(55, now + 0.12);
    g.gain.setValueAtTime(0.18, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.13);
    osc.connect(g);
    g.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.14);
  }

  playEnemyDown() {
    if (!this.ctx || this.muted) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(320, now);
    osc.frequency.exponentialRampToValueAtTime(90, now + 0.18);
    g.gain.setValueAtTime(0.14, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.19);
    osc.connect(g);
    g.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.2);
  }

  playPickup() {
    if (!this.ctx || this.muted) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(660, now);
    osc.frequency.setValueAtTime(990, now + 0.06);
    g.gain.setValueAtTime(0.14, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
    osc.connect(g);
    g.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.19);
  }

  playExplosion() {
    if (!this.ctx || this.muted) return;
    this._playNoiseBurst(0.55, 320, 0.38, true);
  }

  playMissionComplete() {
    if (!this.ctx || this.muted) return;
    const now = this.ctx.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((freq, idx) => {
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + idx * 0.08);
      g.gain.setValueAtTime(0.16, now + idx * 0.08);
      g.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.08 + 0.24);
      osc.connect(g);
      g.connect(this.masterGain);
      osc.start(now + idx * 0.08);
      osc.stop(now + idx * 0.08 + 0.25);
    });
  }
}
