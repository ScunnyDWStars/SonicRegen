/**
 * Movement constants in pixels per frame (and per frame squared), taken from the
 * Sonic Physics Guide's documentation of the Mega Drive games.
 */
export interface PhysicsConsts {
  acc: number;
  dec: number;
  frc: number;
  top: number;
  air: number;
  grv: number;
  jump: number;
  jumpRelease: number;
  rollFrc: number;
  rollDec: number;
}

export const SLP = 0.125;
export const SLP_ROLL_UP = 0.078125;
export const SLP_ROLL_DOWN = 0.3125;
export const MAX_FALL = 16;
export const ROLL_TOP = 16;
export const FALL_SPEED_THRESHOLD = 2.5;
export const CONTROL_LOCK_FRAMES = 30;
export const HURT_GRV = 0.1875;
export const PUSH_RADIUS = 10;

const BASE: PhysicsConsts = {
  acc: 0.046875,
  dec: 0.5,
  frc: 0.046875,
  top: 6,
  air: 0.09375,
  grv: 0.21875,
  jump: 6.5,
  jumpRelease: 4,
  rollFrc: 0.0234375,
  rollDec: 0.125,
};

export interface PhysicsMods {
  underwater: boolean;
  superForm: boolean;
  speedShoes: boolean;
  /** Character's base jump strength (Knuckles jumps lower). */
  jump: number;
}

/** Returns the constants for the current situation. */
export function physicsFor(m: PhysicsMods): PhysicsConsts {
  const c = { ...BASE, jump: m.jump };
  if (m.superForm) {
    c.acc = 0.1875;
    c.dec = 1;
    c.frc = 0.046875;
    c.top = 10;
    c.air = 0.375;
    c.jump = m.jump + 1.5;
    c.rollFrc = 0.0234375;
  } else if (m.speedShoes) {
    c.acc = 0.09375;
    c.frc = 0.09375;
    c.top = 12;
    c.air = 0.1875;
    c.rollFrc = 0.046875;
  }
  if (m.underwater) {
    c.acc /= 2;
    c.dec /= 2;
    c.frc /= 2;
    c.top /= 2;
    c.air /= 2;
    c.rollFrc /= 2;
    c.grv = 0.0625;
    c.jump = m.jump === 6 ? 3 : 3.5;
    if (m.superForm) c.jump += 1;
    c.jumpRelease = 2;
  }
  return c;
}
