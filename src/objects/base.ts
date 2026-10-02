import type { Renderer } from '../engine/renderer';
import type { Player } from '../player/Player';
import type { SolidRef } from '../player/types';
import type { Act } from '../game/act';

/** A solid box that players can stand on or push against. */
export class SolidBox implements SolidRef {
  dx = 0;
  dy = 0;
  constructor(
    public x: number,
    public y: number,
    public hw: number,
    public hh: number,
    public topOnly = false,
  ) {}
  surface?: (localX: number) => number;
  /** Where the box will be `frames` from now (moving platforms; used by tools and AI). */
  predict?: (frames: number) => { x: number; y: number };
  /** Move the box and remember the delta for standing players. */
  moveTo(x: number, y: number): void {
    this.dx = x - this.x;
    this.dy = y - this.y;
    this.x = x;
    this.y = y;
  }
}

export abstract class GameObject {
  /** Touch box half sizes (centred on x, y). 0 = no touch box. */
  hw = 8;
  hh = 8;
  dead = false;
  /** Lower draws first. Terrain is drawn at 0; most objects at 1-5; players at 10. */
  depth = 3;
  /** Keep updating even when off-screen. */
  alwaysActive = false;
  solid: SolidBox | null = null;
  /** Called with the respawn key so destroyed objects stay destroyed after a restart. */
  persistKey: string | null = null;

  constructor(
    public x: number,
    public y: number,
  ) {}

  update(_act: Act): void {}
  draw(_r: Renderer, _cx: number, _cy: number, _act: Act): void {}
  /** Return false to make the solid box ignore this player this frame (e.g. a rolling player breaks it). */
  solidFor?(p: Player, act?: Act): boolean;
  /** Player's touch box overlaps this object's. */
  touch?(act: Act, p: Player): void;
  /** Player landed on / is standing on the solid box. */
  onStand?(act: Act, p: Player): void;
  /** Player pushes the side of the solid box (side = -1 left, 1 right of the object). */
  onPush?(act: Act, p: Player, side: -1 | 1): void;
  /** Player hits the solid box from below. */
  onBonk?(act: Act, p: Player): void;
}

export type ObjectFactory = (
  x: number,
  y: number,
  props: Record<string, unknown>,
  act: Act,
) => GameObject | null;

const registry = new Map<string, ObjectFactory>();

export function registerObject(type: string, f: ObjectFactory): void {
  registry.set(type, f);
}

export function createObject(
  type: string,
  x: number,
  y: number,
  props: Record<string, unknown>,
  act: Act,
): GameObject | null {
  const f = registry.get(type);
  if (!f) {
    if (import.meta.env?.DEV) console.warn(`Unknown object type: ${type}`);
    return null;
  }
  return f(x, y, props, act);
}

export function knownObjectTypes(): string[] {
  return [...registry.keys()];
}
