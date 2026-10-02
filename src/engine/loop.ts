import { FRAME_MS } from './constants';

export interface LoopCallbacks {
  /** Advance the game by exactly one 1/60 s frame. */
  update(): void;
  /** Draw the latest state. */
  render(): void;
}

/**
 * Fixed-timestep loop. Logic always advances in whole 1/60 s frames so physics are
 * deterministic, no matter the display refresh rate.
 */
export class GameLoop {
  private acc = 0;
  private last = 0;
  private running = false;
  private rafId = 0;
  /** When true, frames only advance through {@link step}. */
  paused = false;
  private pendingSteps = 0;

  constructor(private readonly cb: LoopCallbacks) {}

  start(): void {
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    const tick = (now: number) => {
      if (!this.running) return;
      this.rafId = requestAnimationFrame(tick);
      this.acc += Math.min(now - this.last, 250);
      this.last = now;
      let steps = 0;
      if (this.paused) {
        this.acc = 0;
        while (this.pendingSteps > 0) {
          this.pendingSteps--;
          this.cb.update();
          steps++;
        }
      } else {
        while (this.acc >= FRAME_MS && steps < 5) {
          this.cb.update();
          this.acc -= FRAME_MS;
          steps++;
        }
        if (steps === 5) this.acc = 0;
      }
      this.cb.render();
    };
    this.rafId = requestAnimationFrame(tick);
  }

  stop(): void {
    this.running = false;
    cancelAnimationFrame(this.rafId);
  }

  /** Advance one frame while paused. */
  step(): void {
    this.pendingSteps++;
  }
}
