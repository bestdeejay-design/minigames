const SOUND_KEY = 'rubezh64-sound';

export class AudioSystem {
  constructor() {
    try { this.enabled = localStorage.getItem(SOUND_KEY) === 'on'; }
    catch (_) { this.enabled = false; }
    this.unlocked = false;
    this.context = null;
    this.volume = 0.07;
  }

  unlock() {
    this.unlocked = true; // Only called from a real click or key press.
    if (!this.enabled) return;
    try {
      const Context = window.AudioContext || window.webkitAudioContext;
      if (!Context) return;
      if (!this.context) this.context = new Context();
      if (this.context.state === 'suspended') this.context.resume().catch(() => {});
    } catch (_) { /* Audio is optional. */ }
  }

  toggle() {
    this.enabled = !this.enabled;
    try { localStorage.setItem(SOUND_KEY, this.enabled ? 'on' : 'off'); } catch (_) {}
    if (this.enabled) { this.unlock(); this.play('select'); }
    return this.enabled;
  }

  note(frequency, duration, offset = 0, type = 'sine', gainScale = 1) {
    if (!this.context || !this.enabled) return;
    const at = this.context.currentTime + offset;
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, at);
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(this.volume * gainScale, at + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + duration);
    oscillator.connect(gain).connect(this.context.destination);
    oscillator.start(at);
    oscillator.stop(at + duration + 0.02);
  }

  play(name) {
    if (!this.enabled || !this.unlocked) return;
    this.unlock();
    if (!this.context) return;
    try {
      switch (name) {
        case 'select': this.note(620, .08, 0, 'sine', .35); break;
        case 'order': this.note(390, .07, 0, 'triangle', .35); this.note(550, .1, .07, 'sine', .28); break;
        case 'error': this.note(190, .16, 0, 'sawtooth', .23); break;
        case 'build': this.note(420, .11, 0, 'triangle', .4); this.note(630, .17, .12, 'triangle', .4); break;
        case 'train': this.note(480, .1, 0, 'sine', .35); this.note(700, .11, .1, 'sine', .3); break;
        case 'shot': this.note(850, .08, 0, 'sawtooth', .12); break;
        case 'hit': this.note(125, .14, 0, 'triangle', .35); break;
        case 'victory': [523,659,784,1046].forEach((f,i)=>this.note(f,.23,i*.15,'sine',.45)); break;
        case 'defeat': [400,300,210].forEach((f,i)=>this.note(f,.25,i*.16,'triangle',.45)); break;
        default: break;
      }
    } catch (_) { /* Never stop gameplay because of an audio device. */ }
  }
}
