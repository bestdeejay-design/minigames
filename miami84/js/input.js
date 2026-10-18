export class InputController {
  constructor(canvas, callbacks = {}) {
    this.canvas = canvas;
    this.callbacks = callbacks;
    this.keys = {};
    this.fireDown = false;
    this.fireJustPressed = false;
    this.jumpPressed = false;
    this.reloadPressed = false;
    this.weaponSlotRequested = 0;
    this.wheelDelta = 0;
    this.pointerLocked = false;

    // Виртуальный джойстик (мобильное управление)
    this.joyX = 0;
    this.joyY = 0;
    this._joyTouchId = null;
    this._joyCenter = { x: 0, y: 0 };
    this._lookTouchId = null;
    this._lookLast = { x: 0, y: 0 };

    if (typeof window !== 'undefined' && typeof document !== 'undefined') {
      this._bindDesktopEvents();
      this._bindMobileControls();
    }
  }

  resetTransient() {
    this.keys = {};
    this.fireDown = false;
    this.fireJustPressed = false;
    this.jumpPressed = false;
    this.reloadPressed = false;
    this.joyX = 0;
    this.joyY = 0;
  }

  requestPointerLock() {
    if (!this.canvas || typeof document === 'undefined') return;
    if (this.canvas.requestPointerLock) {
      try {
        const res = this.canvas.requestPointerLock();
        if (res && typeof res.catch === 'function') {
          res.catch(() => {});
        }
      } catch (_e) {
        // Игнорируется на мобильных и без захвата указателя
      }
    }
  }

  _bindDesktopEvents() {
    window.addEventListener('keydown', (e) => {
      this.keys[e.code] = true;
      if (e.code === 'Space') this.jumpPressed = true;
      if (e.code === 'KeyR') this.reloadPressed = true;
      if (e.code === 'Digit1') this.weaponSlotRequested = 1;
      if (e.code === 'Digit2') this.weaponSlotRequested = 2;
      if (e.code === 'Digit3') this.weaponSlotRequested = 3;
      if (e.code === 'KeyE') this.callbacks.onInteract?.();
      if (e.code === 'KeyV' || e.code === 'KeyC') this.callbacks.onCameraCycle?.();
      if (e.code === 'KeyQ') this.callbacks.onRadioNext?.();
      if (e.code === 'KeyN') this.callbacks.onToggleNight?.();
      if (e.code === 'Escape' || e.code === 'KeyP') this.callbacks.onPauseToggle?.();
    });

    window.addEventListener('keyup', (e) => {
      this.keys[e.code] = false;
      if (e.code === 'Space') this.jumpPressed = false;
    });

    document.addEventListener('pointerlockchange', () => {
      this.pointerLocked = document.pointerLockElement === this.canvas;
      if (!this.pointerLocked && this.callbacks.onPointerUnlock) {
        this.callbacks.onPointerUnlock();
      }
    });

    if (this.canvas) {
      this.canvas.addEventListener('mousedown', (e) => {
        this.callbacks.onFirstInteraction?.();
        if (e.button === 0) {
          if (!this.pointerLocked && this.callbacks.isPlaying?.()) {
            this.requestPointerLock();
          }
          this.fireDown = true;
          this.fireJustPressed = true;
        }
      });

      window.addEventListener('mouseup', (e) => {
        if (e.button === 0) {
          this.fireDown = false;
        }
      });

      window.addEventListener('mousemove', (e) => {
        if (!this.callbacks.isPlaying?.()) return;
        if (this.pointerLocked || e.buttons === 1) {
          this.callbacks.onLook?.(e.movementX || 0, e.movementY || 0);
        }
      });

      window.addEventListener(
        'wheel',
        (e) => {
          if (!this.callbacks.isPlaying?.()) return;
          this.wheelDelta = Math.sign(e.deltaY);
        },
        { passive: true }
      );
    }
  }

  _bindMobileControls() {
    const joyZone = document.getElementById('touch-joystick-zone');
    const joyKnob = document.getElementById('touch-joystick-knob');
    const lookZone = document.getElementById('touch-look-zone');

    if (joyZone) {
      joyZone.addEventListener(
        'touchstart',
        (e) => {
          e.preventDefault();
          this.callbacks.onFirstInteraction?.();
          const t = e.changedTouches[0];
          this._joyTouchId = t.identifier;
          const rect = joyZone.getBoundingClientRect();
          this._joyCenter = {
            x: rect.left + rect.width * 0.5,
            y: rect.top + rect.height * 0.5,
          };
        },
        { passive: false }
      );

      joyZone.addEventListener(
        'touchmove',
        (e) => {
          e.preventDefault();
          for (let i = 0; i < e.changedTouches.length; i++) {
            const t = e.changedTouches[i];
            if (t.identifier === this._joyTouchId) {
              const maxR = 44;
              const dx = Math.max(-maxR, Math.min(maxR, t.clientX - this._joyCenter.x));
              const dy = Math.max(-maxR, Math.min(maxR, t.clientY - this._joyCenter.y));
              this.joyX = dx / maxR;
              this.joyY = dy / maxR;
              if (joyKnob) {
                joyKnob.style.transform = `translate(${dx}px, ${dy}px)`;
              }
            }
          }
        },
        { passive: false }
      );

      const resetJoy = (e) => {
        for (let i = 0; i < e.changedTouches.length; i++) {
          if (e.changedTouches[i].identifier === this._joyTouchId) {
            this._joyTouchId = null;
            this.joyX = 0;
            this.joyY = 0;
            if (joyKnob) {
              joyKnob.style.transform = 'translate(0px, 0px)';
            }
          }
        }
      };
      joyZone.addEventListener('touchend', resetJoy);
      joyZone.addEventListener('touchcancel', resetJoy);
    }

    if (lookZone) {
      lookZone.addEventListener(
        'touchstart',
        (e) => {
          this.callbacks.onFirstInteraction?.();
          const t = e.changedTouches[0];
          this._lookTouchId = t.identifier;
          this._lookLast = { x: t.clientX, y: t.clientY };
        },
        { passive: true }
      );

      lookZone.addEventListener(
        'touchmove',
        (e) => {
          for (let i = 0; i < e.changedTouches.length; i++) {
            const t = e.changedTouches[i];
            if (t.identifier === this._lookTouchId) {
              const dx = (t.clientX - this._lookLast.x) * 2.2;
              const dy = (t.clientY - this._lookLast.y) * 2.2;
              this._lookLast = { x: t.clientX, y: t.clientY };
              this.callbacks.onLook?.(dx, dy);
            }
          }
        },
        { passive: true }
      );

      const endLook = (e) => {
        for (let i = 0; i < e.changedTouches.length; i++) {
          if (e.changedTouches[i].identifier === this._lookTouchId) {
            this._lookTouchId = null;
          }
        }
      };
      lookZone.addEventListener('touchend', endLook);
      lookZone.addEventListener('touchcancel', endLook);
    }

    // Мобильные кнопки действий
    const bindBtn = (id, onDown, onUp) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.callbacks.onFirstInteraction?.();
        onDown?.();
      });
      if (onUp) {
        el.addEventListener('pointerup', (e) => {
          e.preventDefault();
          onUp();
        });
        el.addEventListener('pointercancel', onUp);
      }
    };

    bindBtn(
      'btn-mobile-fire',
      () => {
        this.fireDown = true;
        this.fireJustPressed = true;
      },
      () => {
        this.fireDown = false;
      }
    );
    bindBtn(
      'btn-mobile-jump',
      () => {
        this.jumpPressed = true;
      },
      () => {
        this.jumpPressed = false;
      }
    );
    bindBtn('btn-mobile-reload', () => {
      this.reloadPressed = true;
    });
    bindBtn('btn-mobile-weapon', () => {
      this.wheelDelta = 1;
    });
    bindBtn('btn-mobile-car', () => {
      this.callbacks.onInteract?.();
    });
    bindBtn('btn-mobile-camera', () => {
      this.callbacks.onCameraCycle?.();
    });
  }
}
