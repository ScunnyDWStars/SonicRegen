/** Logical buttons, modelled on a 3-button Mega Drive pad. A, B and C all jump. */
export const enum Btn {
  Up = 1,
  Down = 2,
  Left = 4,
  Right = 8,
  A = 16,
  B = 32,
  C = 64,
  Start = 128,
}
export const JUMP = Btn.A | Btn.B | Btn.C;

/** One frame of controller state: what is held and what was newly pressed. */
export class Pad {
  held = 0;
  pressed = 0;
  released = 0;

  /** Feed the raw held mask for this frame; computes pressed/released edges. */
  latch(raw: number): void {
    this.pressed = raw & ~this.held;
    this.released = this.held & ~raw;
    this.held = raw;
  }

  isHeld(b: number): boolean {
    return (this.held & b) !== 0;
  }
  isPressed(b: number): boolean {
    return (this.pressed & b) !== 0;
  }
  isReleased(b: number): boolean {
    return (this.released & b) !== 0;
  }

  copyFrom(o: Pad): void {
    this.held = o.held;
    this.pressed = o.pressed;
    this.released = o.released;
  }

  clear(): void {
    this.held = this.pressed = this.released = 0;
  }
}

export type KeyMap = Record<string, number>;

export const DEFAULT_KEYS: KeyMap = {
  ArrowUp: Btn.Up,
  ArrowDown: Btn.Down,
  ArrowLeft: Btn.Left,
  ArrowRight: Btn.Right,
  KeyW: Btn.Up,
  KeyS: Btn.Down,
  KeyA: Btn.Left,
  KeyD: Btn.Right,
  KeyZ: Btn.A,
  KeyX: Btn.B,
  KeyC: Btn.C,
  Space: Btn.B,
  KeyJ: Btn.A,
  KeyK: Btn.B,
  KeyL: Btn.C,
  Enter: Btn.Start,
};

/** Reads keyboard and the first standard-mapped gamepad into a {@link Pad} once per frame. */
export class InputManager {
  readonly pad = new Pad();
  keys: KeyMap = { ...DEFAULT_KEYS };
  private keyMask = 0;
  /** Keys pressed since the last poll, so taps shorter than a frame still register. */
  private tapMask = 0;
  private readonly down = new Set<string>();
  /** Raw key presses since the last poll, for menus such as key rebinding. */
  readonly keyEvents: string[] = [];
  /** Function keys (debug) pressed since last poll. */
  readonly fnPresses = new Set<string>();

  attach(target: Window): void {
    target.addEventListener('keydown', (e) => {
      if (e.code.startsWith('F') && e.code.length <= 3) {
        if (!e.repeat) this.fnPresses.add(e.code);
        e.preventDefault();
        return;
      }
      if (e.code === 'Backquote') {
        if (!e.repeat) this.fnPresses.add('Backquote');
        return;
      }
      if (!e.repeat) this.keyEvents.push(e.code);
      if (this.keys[e.code] !== undefined) {
        e.preventDefault();
        this.tapMask |= this.keys[e.code]!;
      }
      this.down.add(e.code);
      this.recompute();
    });
    target.addEventListener('keyup', (e) => {
      this.down.delete(e.code);
      this.recompute();
    });
    target.addEventListener('blur', () => {
      this.down.clear();
      this.recompute();
    });
  }

  private recompute(): void {
    let m = 0;
    for (const code of this.down) m |= this.keys[code] ?? 0;
    this.keyMask = m;
  }

  private readGamepad(): number {
    if (typeof navigator === 'undefined' || !navigator.getGamepads) return 0;
    let m = 0;
    for (const gp of navigator.getGamepads()) {
      if (!gp || gp.mapping !== 'standard') continue;
      const b = (i: number) => gp.buttons[i]?.pressed ?? false;
      const ax = gp.axes[0] ?? 0;
      const ay = gp.axes[1] ?? 0;
      if (b(12) || ay < -0.5) m |= Btn.Up;
      if (b(13) || ay > 0.5) m |= Btn.Down;
      if (b(14) || ax < -0.5) m |= Btn.Left;
      if (b(15) || ax > 0.5) m |= Btn.Right;
      if (b(0)) m |= Btn.A;
      if (b(1)) m |= Btn.B;
      if (b(2) || b(3)) m |= Btn.C;
      if (b(9)) m |= Btn.Start;
    }
    return m;
  }

  /** Call once per logic frame. */
  poll(): void {
    let raw = this.keyMask | this.tapMask | this.readGamepad();
    this.tapMask = 0;
    // Opposite directions cancel, as on a real d-pad.
    if ((raw & (Btn.Left | Btn.Right)) === (Btn.Left | Btn.Right)) raw &= ~(Btn.Left | Btn.Right);
    if ((raw & (Btn.Up | Btn.Down)) === (Btn.Up | Btn.Down)) raw &= ~(Btn.Up | Btn.Down);
    this.pad.latch(raw);
  }

  /** Clears per-frame event queues. Call after the frame's update. */
  endFrame(): void {
    this.keyEvents.length = 0;
    this.fnPresses.clear();
  }
}
