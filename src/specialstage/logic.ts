import { Btn, JUMP, type Pad } from '../engine/input';
import { STAGES } from './layouts';

export const SIZE = 32;

export const enum Cell {
  Empty = 0,
  Blue = 1,
  Red = 2,
  Bumper = 3,
  Yellow = 4,
  Ring = 5,
}

const CHAR: Record<string, Cell> = {
  '.': Cell.Empty,
  B: Cell.Blue,
  R: Cell.Red,
  O: Cell.Bumper,
  Y: Cell.Yellow,
  r: Cell.Ring,
};

/** Expand a quadrant layout into the full mirrored grid. */
export function buildGrid(quad: string[]): Uint8Array {
  const g = new Uint8Array(SIZE * SIZE);
  for (let y = 0; y < SIZE; y++)
    for (let x = 0; x < SIZE; x++) {
      const qx = x < 16 ? x : SIZE - 1 - x,
        qy = y < 16 ? y : SIZE - 1 - y;
      g[y * SIZE + x] = CHAR[quad[qy]![qx]!] ?? Cell.Empty;
    }
  return g;
}

const wrap = (v: number) => ((v % SIZE) + SIZE) % SIZE;
/** Facing directions: 0 north, 1 east, 2 south, 3 west. */
const DX = [0, 1, 0, -1];
const DY = [-1, 0, 1, 0];

export const JUMP_FRAMES = 32;
const TURN_FRAMES = 8;

export type StageEvent =
  'blue' | 'red' | 'ring' | 'bumper' | 'spring' | 'jump' | 'clear' | 'fail' | 'perfect';

/**
 * Blue Sphere rules: run forward on a wrapping grid, turn at sphere centres, turn
 * every blue sphere red, never touch a red one.
 */
export class StageLogic {
  readonly grid: Uint8Array;
  x = 16;
  y = 16;
  dir = 0;
  /** Facing angle in radians (animated during turns). */
  angle = 0;
  speed = 1 / 16;
  /** +1 forward, -1 bounced backwards by a bumper. */
  moveSign = 1;
  private toNext = 1;
  private queued = 0;
  private turnT = 0;
  private turnFrom = 0;
  private turnTo = 0;
  /** Frames into a jump (0 = on the ground). */
  jumpT = 0;
  jumpLen = JUMP_FRAMES;
  blueLeft = 0;
  ringsLeft = 0;
  rings = 0;
  state: 'intro' | 'run' | 'clear' | 'fail' = 'intro';
  t = 0;
  readonly events: StageEvent[] = [];

  constructor(readonly index: number) {
    this.grid = buildGrid(STAGES[index % STAGES.length]!.quad);
    for (const c of this.grid) {
      if (c === Cell.Blue) this.blueLeft++;
      if (c === Cell.Ring) this.ringsLeft++;
    }
  }

  cell(x: number, y: number): Cell {
    return this.grid[wrap(y) * SIZE + wrap(x)] as Cell;
  }
  private setCell(x: number, y: number, c: Cell): void {
    this.grid[wrap(y) * SIZE + wrap(x)] = c;
  }

  get airborne(): boolean {
    return this.jumpT > 0;
  }

  update(pad: Pad): void {
    this.events.length = 0;
    this.t++;
    if (this.state === 'intro') {
      if (this.t > 60) this.state = 'run';
      return;
    }
    if (this.state !== 'run') return;
    if (this.t % 1800 === 0) this.speed = Math.min(1 / 8, this.speed + 1 / 80);

    if (pad.isHeld(Btn.Left)) this.queued = -1;
    else if (pad.isHeld(Btn.Right)) this.queued = 1;
    // After a bumper, pressing Up runs forward again.
    if (this.moveSign < 0 && pad.isPressed(Btn.Up)) {
      this.moveSign = 1;
      this.toNext = 1 - this.toNext;
    }
    if (pad.isPressed(JUMP) && !this.airborne) {
      this.jumpT = 1;
      this.jumpLen = JUMP_FRAMES;
      this.events.push('jump');
    }
    if (this.airborne && ++this.jumpT > this.jumpLen) this.jumpT = 0;

    if (this.turnT > 0) {
      this.turnT--;
      const k = 1 - this.turnT / TURN_FRAMES;
      this.angle = this.turnFrom + (this.turnTo - this.turnFrom) * k;
      return;
    }

    let step = this.speed;
    while (step > 0 && this.state === 'run') {
      const d = Math.min(step, this.toNext);
      this.x += DX[this.dir]! * d * this.moveSign;
      this.y += DY[this.dir]! * d * this.moveSign;
      this.toNext -= d;
      step -= d;
      if (this.toNext <= 1e-9) {
        this.x = Math.round(this.x);
        this.y = Math.round(this.y);
        this.toNext = 1;
        this.arrive();
        if (this.turnT > 0) break;
      }
    }
    this.x = ((this.x % SIZE) + SIZE) % SIZE;
    this.y = ((this.y % SIZE) + SIZE) % SIZE;
  }

  /** Reached the centre of a cell. */
  private arrive(): void {
    if (!this.airborne) {
      const c = this.cell(this.x, this.y);
      switch (c) {
        case Cell.Blue:
          this.setCell(this.x, this.y, Cell.Red);
          this.blueLeft--;
          this.events.push('blue');
          if (this.blueLeft === 0) {
            this.state = 'clear';
            this.events.push(this.ringsLeft === 0 ? 'perfect' : 'clear');
            return;
          }
          break;
        case Cell.Red:
          this.state = 'fail';
          this.events.push('fail');
          return;
        case Cell.Ring:
          this.setCell(this.x, this.y, Cell.Empty);
          this.rings++;
          this.ringsLeft--;
          this.events.push('ring');
          break;
        case Cell.Bumper:
          this.moveSign = -this.moveSign;
          this.events.push('bumper');
          return;
        case Cell.Yellow:
          this.jumpT = 1;
          this.jumpLen = Math.round(6 / this.speed);
          this.events.push('spring');
          return;
      }
    }
    if (this.queued !== 0 && !this.airborne) {
      this.turnFrom = this.angle;
      this.dir = (this.dir + this.queued + 4) % 4;
      this.turnTo = this.angle + (this.queued * Math.PI) / 2;
      this.turnT = TURN_FRAMES;
      this.queued = 0;
      // A bounced player turning resumes forward motion.
      this.moveSign = 1;
    }
  }
}
