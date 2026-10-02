import type { CollisionView } from '../level/collision';

export type CharId = 'sonic' | 'tails' | 'knuckles';
export type ShieldType = 'basic' | 'fire' | 'bubble' | 'lightning';

/** A solid object the player can stand on. Positions are the object's centre. */
export interface SolidRef {
  x: number;
  y: number;
  /** Half width / half height of the solid box. */
  hw: number;
  hh: number;
  /** Movement this frame, carried over to a standing player. */
  dx: number;
  dy: number;
  /** Only solid from above. */
  topOnly?: boolean;
  /** Optional surface height function relative to the object's top (for slopes). */
  surface?(localX: number): number;
  /** Future position of a moving platform. */
  predict?(frames: number): { x: number; y: number };
}

export type Sfx =
  | 'jump'
  | 'ring'
  | 'ringLoss'
  | 'spindash'
  | 'release'
  | 'roll'
  | 'skid'
  | 'hurt'
  | 'death'
  | 'spring'
  | 'pop'
  | 'shield'
  | 'fireShield'
  | 'bubbleShield'
  | 'lightningShield'
  | 'fireDash'
  | 'bubbleBounce'
  | 'doubleJump'
  | 'instaShield'
  | 'splash'
  | 'drownWarn'
  | 'drown'
  | 'breath'
  | 'checkpoint'
  | 'signpost'
  | 'bossHit'
  | 'explode'
  | 'fly'
  | 'glide'
  | 'grab'
  | 'wallBreak'
  | 'super'
  | 'oneUp'
  | 'giantRing'
  | 'click'
  | 'select'
  | 'blueSphere'
  | 'redSphere'
  | 'bumper'
  | 'tally'
  | 'collapse';

/** Everything the player needs from the level. */
export interface PlayerWorld {
  col: CollisionView;
  /** Water surface Y in world pixels, or Infinity. */
  waterY: number;
  /** Horizontal and bottom limits (camera / boss arena). */
  boundLeft: number;
  boundRight: number;
  boundBottom: number;
  /** Top of the visible screen (Tails cannot fly above it). */
  cameraTop: number;
  frame: number;
  sfx(s: Sfx): void;
  scatterRings(x: number, y: number, count: number): void;
  /** Visual effects such as splashes, dust and shield bursts. */
  effect(kind: string, x: number, y: number, data?: number): void;
}
