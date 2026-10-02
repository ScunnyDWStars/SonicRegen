import {
  animalImg,
  bigBubbleImg,
  brokenMonitorImg,
  bubbleVentImg,
  capsuleImg,
  giantRingImg,
  monitorIconImg,
  monitorImg,
  signpostImg,
  spikesImg,
  springImg,
  starpostImg,
  type MonitorKind,
} from '../art/objects';
import { PALETTES } from '../art/characters';
import { PixelImage } from '../art/pixels';
import type { Renderer } from '../engine/renderer';
import { MAT_SHIFT, Mat } from '../level/builder';
import { DOWN } from '../level/collision';
import type { Player } from '../player/Player';
import type { Act } from '../game/act';
import { GameObject, registerObject, SolidBox } from './base';
import { Ring } from './rings';

// ============================================================================ Monitor

export class Monitor extends GameObject {
  private bumpVy = 0;
  private baseY: number;
  constructor(
    x: number,
    y: number,
    readonly kind: MonitorKind,
  ) {
    super(x, y);
    this.hw = 14;
    this.hh = 15;
    this.solid = new SolidBox(x, y, 15, 16);
    this.depth = 3;
    this.baseY = y;
  }

  /** A ball-state player falling or rolling into the monitor breaks it instead of colliding. */
  override solidFor(p: Player): boolean {
    return !(p.attacking && (p.grounded || p.ysp >= 0));
  }

  override update(act: Act): void {
    if (this.bumpVy !== 0 || this.y !== this.baseY) {
      this.y += this.bumpVy;
      this.bumpVy += 0.21875;
      if (this.y >= this.baseY) {
        this.y = this.baseY;
        this.bumpVy = 0;
      }
      this.solid!.moveTo(this.x, this.y);
    }
    void act;
  }

  override onBonk(_act: Act, p: Player): void {
    // Sonic 1/2 behaviour: hitting from below knocks the monitor up.
    if (p.ysp <= 0 && this.y === this.baseY) this.bumpVy = -1.5;
  }

  override touch(act: Act, p: Player): void {
    if (!p.attacking || !(p.grounded || p.ysp >= 0)) return;
    this.dead = true;
    act.bounce(p, this.y);
    act.effect('explosion', this.x, this.y);
    act.sfx('pop');
    act.addScore(10);
    act.spawn(new BrokenMonitor(this.x, this.baseY, this.kind, p, act));
  }

  override draw(r: Renderer, cx: number, cy: number, act: Act): void {
    r.image(monitorImg(this.kind, Math.floor(act.frame / 4), lifeColor(act)), this.x - cx, this.y - cy);
  }
}

function lifeColor(act: Act): number {
  return PALETTES[act.leader.def.id].main;
}

class BrokenMonitor extends GameObject {
  private t = 0;
  private iconY: number;
  constructor(
    x: number,
    y: number,
    readonly kind: MonitorKind,
    private readonly breaker: Player,
    act: Act,
  ) {
    super(x, y);
    this.hw = 0;
    this.depth = 2;
    this.iconY = y - 4;
    void act;
  }
  override update(act: Act): void {
    this.t++;
    if (this.t < 32) this.iconY -= Math.max(0.25, 3 - this.t * 0.1);
    if (this.t === 60) applyMonitor(act, this.kind, this.breaker);
  }
  override draw(r: Renderer, cx: number, cy: number, act: Act): void {
    r.image(brokenMonitorImg(), this.x - cx, this.y - cy);
    if (this.t < 60) r.image(monitorIconImg(this.kind, lifeColor(act)), this.x - cx, this.iconY - cy);
  }
}

export function applyMonitor(act: Act, kind: MonitorKind, breaker: Player): void {
  const p = act.isLeader(breaker) ? breaker : act.leader;
  switch (kind) {
    case 'rings':
      act.collectRing(p.x, p.y, 10);
      break;
    case 'life':
      act.game.session.lives++;
      act.extraLife();
      break;
    case 'shield':
      p.shield = 'basic';
      act.sfx('shield');
      break;
    case 'fire':
    case 'bubble':
    case 'lightning':
      if (p.underwater && kind !== 'bubble') {
        p.shield = 'basic';
        act.sfx('shield');
      } else {
        p.shield = kind;
        act.sfx(kind === 'fire' ? 'fireShield' : kind === 'bubble' ? 'bubbleShield' : 'lightningShield');
      }
      if (kind === 'bubble') p.air = 1800;
      break;
    case 'invincible':
      if (!p.superForm) {
        p.invincible = 20 * 60;
        act.game.sound.overrideMusic('invincible');
      }
      break;
    case 'shoes':
      p.speedShoes = 20 * 60;
      act.game.sound.setTempo(1.25);
      break;
    case 'eggman':
      p.hurt(act, p.x - p.facing);
      break;
  }
}

registerObject('monitor', (x, y, props) => new Monitor(x, y, (props.kind as MonitorKind) ?? 'rings'));

// ============================================================================ Spring

export type SpringDir = 'up' | 'down' | 'left' | 'right' | 'upLeft' | 'upRight';

export class Spring extends GameObject {
  private pressed = 0;
  readonly power: number;
  private readonly img: PixelImage[];
  constructor(
    x: number,
    y: number,
    readonly dir: SpringDir,
    readonly red: boolean,
  ) {
    super(x, y);
    this.power = red ? 16 : 10;
    this.depth = 4;
    const base = [springImg(red, false), springImg(red, true)];
    const rot = {
      up: 0,
      right: Math.PI / 2,
      down: Math.PI,
      left: -Math.PI / 2,
      upRight: Math.PI / 4,
      upLeft: -Math.PI / 4,
    }[dir];
    this.img = base.map((b) => {
      if (rot === 0) return b;
      const c = b.clone();
      c.ox = 16;
      c.oy = 16;
      return c.rotated(rot);
    });
    if (dir === 'up' || dir === 'down') {
      this.solid = new SolidBox(x, y, 16, 8);
      this.hw = 0;
    } else if (dir === 'left' || dir === 'right') {
      this.solid = new SolidBox(x, y, 8, 16);
      this.hw = 0;
    } else {
      this.hw = 12;
      this.hh = 12;
    }
  }

  override update(): void {
    if (this.pressed > 0) this.pressed--;
  }

  override onStand(act: Act, p: Player): void {
    if (this.dir !== 'up') return;
    p.y -= 8;
    p.springVertical(act, -this.power);
    this.pressed = 8;
  }

  override onBonk(act: Act, p: Player): void {
    if (this.dir !== 'down') return;
    p.springVertical(act, this.power);
    this.pressed = 8;
  }

  override onPush(act: Act, p: Player, side: -1 | 1): void {
    if ((this.dir === 'right' && side === 1) || (this.dir === 'left' && side === -1)) {
      p.x += side * 8;
      p.springHorizontal(act, this.dir === 'right' ? this.power : -this.power);
      this.pressed = 8;
    }
  }

  override touch(act: Act, p: Player): void {
    if (this.dir !== 'upLeft' && this.dir !== 'upRight') return;
    const sx = this.dir === 'upRight' ? 1 : -1;
    p.springVertical(act, -this.power);
    p.xsp = sx * this.power;
    p.facing = sx as 1 | -1;
    this.pressed = 8;
  }

  override draw(r: Renderer, cx: number, cy: number): void {
    const img = this.img[this.pressed > 0 ? 1 : 0]!;
    if (this.dir === 'up') r.image(img, this.x - cx, this.y - cy + 8);
    else r.image(img, this.x - cx, this.y - cy);
  }
}

registerObject(
  'spring',
  (x, y, props) => new Spring(x, y, (props.dir as SpringDir) ?? 'up', Boolean(props.red)),
);

// ============================================================================ Spikes

export class Spikes extends GameObject {
  private readonly img: PixelImage;
  constructor(
    x: number,
    y: number,
    readonly dir: 'up' | 'down' | 'left' | 'right',
    count: number,
  ) {
    super(x, y);
    this.hw = 0;
    const base = spikesImg(count);
    const w = count * 8;
    if (dir === 'up' || dir === 'down') this.solid = new SolidBox(x, y, w / 2, 16);
    else this.solid = new SolidBox(x, y, 16, w / 2);
    const rot = { up: 0, right: Math.PI / 2, down: Math.PI, left: -Math.PI / 2 }[dir];
    this.img = rot === 0 ? base : base.rotated(rot);
    this.depth = 4;
  }
  override onStand(act: Act, p: Player): void {
    if (this.dir === 'up' && p.hurt(act, p.x - p.facing * 2)) p.y -= 4;
  }
  override onBonk(act: Act, p: Player): void {
    if (this.dir === 'down') p.hurt(act, p.x);
  }
  override onPush(act: Act, p: Player, side: -1 | 1): void {
    if ((this.dir === 'right' && side === 1) || (this.dir === 'left' && side === -1)) p.hurt(act, this.x);
  }
  override draw(r: Renderer, cx: number, cy: number): void {
    r.image(this.img, this.x - cx, this.y - cy);
  }
}

registerObject(
  'spikes',
  (x, y, props) => new Spikes(x, y, (props.dir as 'up') ?? 'up', (props.count as number) ?? 4),
);

// ============================================================================ Starpost

export class Starpost extends GameObject {
  active = false;
  private spin = 0;
  constructor(
    x: number,
    y: number,
    readonly id: number,
  ) {
    super(x, y);
    this.hw = 8;
    this.hh = 32;
    this.depth = 1;
  }
  override update(act: Act): void {
    const cp = act.game.session.checkpoint;
    if (!this.active && cp && cp.id >= this.id) this.active = true;
    if (this.spin > 0) this.spin--;
  }
  override touch(act: Act, p: Player): void {
    if (this.active || !act.isLeader(p)) return;
    this.active = true;
    this.spin = 32;
    act.game.session.checkpoint = {
      x: this.x,
      y: this.y + 32 - p.def.standHr - 1,
      time: act.time,
      id: this.id,
    };
    act.sfx('checkpoint');
  }
  override draw(r: Renderer, cx: number, cy: number): void {
    r.image(starpostImg(this.active, Math.floor(this.spin / 2)), this.x - cx, this.y + 16 - cy);
  }
}

registerObject('starpost', (x, y, props) => new Starpost(x, y, (props.id as number) ?? Math.round(x)));

// ============================================================================ Signpost

export class Signpost extends GameObject {
  private state: 'idle' | 'spin' | 'done' = 'idle';
  private t = 0;
  constructor(x: number, y: number) {
    super(x, y);
    this.hw = 24;
    this.hh = 40;
    this.depth = 1;
  }
  override update(act: Act): void {
    if (this.state === 'idle' && act.leader.x >= this.x && act.state === 'play') {
      this.state = 'spin';
      act.sfx('signpost');
      act.camera.maxX = Math.min(act.camera.maxX, this.x - 160);
      act.camera.lockLeft = this.x - 160;
    }
    if (this.state === 'spin') {
      this.t++;
      if (this.t % 6 === 0 && this.t < 120)
        act.effect('sparkle', this.x + (Math.random() - 0.5) * 40, this.y - 40 + Math.random() * 30);
      if (this.t >= 150) {
        this.state = 'done';
        act.clearAct();
      }
    }
  }
  override draw(r: Renderer, cx: number, cy: number, act: Act): void {
    let face: 0 | 1 = 0,
      turn = 1;
    if (this.state !== 'idle') {
      const speed = this.t < 90 ? 1 : 1 + (this.t - 90) / 10;
      const ph = this.state === 'done' ? Math.PI / 2 : (this.t / (4 * speed)) * Math.PI;
      turn = Math.abs(Math.sin(ph));
      face = this.state === 'done' || Math.floor(ph / Math.PI) % 2 === 1 ? 1 : 0;
      if (this.state === 'done') {
        face = 1;
        turn = 1;
      }
    }
    r.image(signpostImg(face, turn, lifeColor(act)), this.x - cx, this.y - cy);
  }
}

registerObject('signpost', (x, y) => new Signpost(x, y));

// ============================================================================ Capsule

export class Capsule extends GameObject {
  private opened = false;
  private t = 0;
  constructor(x: number, y: number) {
    super(x, y);
    this.hw = 0;
    this.solid = new SolidBox(x, y + 4, 28, 28);
    this.depth = 2;
  }
  override onStand(act: Act, p: Player): void {
    if (this.opened || !act.isLeader(p)) return;
    this.opened = true;
    act.sfx('click');
    act.camera.frozenX = true;
  }
  override update(act: Act): void {
    if (!this.opened) return;
    this.t++;
    if (this.t === 20) {
      act.sfx('explode');
      for (let i = 0; i < 8; i++) act.spawn(new Animal(this.x - 20 + i * 6, this.y, i % 4, i * 6));
    }
    if (this.t === 120) act.clearAct();
  }
  override draw(r: Renderer, cx: number, cy: number): void {
    r.image(capsuleImg(this.t >= 20), this.x - cx, this.y - cy);
  }
}

registerObject('capsule', (x, y) => new Capsule(x, y));

// ============================================================================ Giant ring

export class GiantRing extends GameObject {
  private t = 0;
  private flash = 0;
  constructor(x: number, y: number) {
    super(x, y);
    this.hw = 20;
    this.hh = 28;
    this.depth = 1;
  }
  override update(act: Act): void {
    this.t++;
    if (this.persistKey && act.game.session.usedGiantRings.has(this.persistKey)) this.dead = true;
    if (this.flash > 0 && ++this.flash > 40) {
      this.dead = true;
      act.hooks.onGiantRing?.(act);
    }
  }
  override touch(act: Act, p: Player): void {
    if (!act.isLeader(p) || this.flash > 0 || act.state !== 'play') return;
    act.game.session.usedGiantRings.add(this.persistKey ?? '');
    act.sfx('giantRing');
    if (act.game.session.allEmeralds) {
      act.collectRing(this.x, this.y, 50);
      this.dead = true;
      return;
    }
    this.flash = 1;
    p.frozenInput = true;
    p.xsp = p.gsp = p.ysp = 0;
  }
  override draw(r: Renderer, cx: number, cy: number): void {
    if (this.flash > 0) {
      r.fade(this.flash / 40, 0xffffffff);
      return;
    }
    r.image(giantRingImg(Math.floor(this.t / 6)), this.x - cx, this.y - cy);
  }
}

registerObject('giantRing', (x, y) => new GiantRing(x, y));

// ============================================================================ Animals

export class Animal extends GameObject {
  private vx: number;
  private vy = -4;
  private t = 0;
  constructor(
    x: number,
    y: number,
    readonly kind: number,
    private delay = 0,
  ) {
    super(x, y);
    this.hw = 0;
    this.vx = kind % 2 === 0 ? -3 : -2;
    if (delay % 12 === 6) this.vx = -this.vx;
    this.alwaysActive = true;
    this.depth = 5;
  }
  override update(act: Act): void {
    if (this.delay > 0) {
      this.delay--;
      return;
    }
    this.t++;
    this.x += this.t > 16 ? this.vx : 0;
    this.y += this.vy;
    this.vy += this.kind % 2 === 0 ? 0.09375 : 0.21875;
    if (this.vy > 0 && act.floorDist(this.x, this.y + 8, DOWN) < 0) {
      this.vy = this.kind % 2 === 0 ? -3 : -4;
    }
    if (Math.abs(this.x - act.camera.x - 160) > 300 || this.t > 600) this.dead = true;
  }
  override draw(r: Renderer, cx: number, cy: number): void {
    if (this.delay > 0) return;
    r.image(animalImg(this.kind, this.vy < 0 ? 0 : 1), this.x - cx, this.y - cy, { flipX: this.vx > 0 });
  }
}

// ============================================================================ Platforms

/** Draws a block of level material with the zone's theme (used by platforms and ledges). */
export function themedBlock(
  act: Act,
  w: number,
  h: number,
  mat: Mat,
  worldX: number,
  worldY: number,
): PixelImage {
  const img = new PixelImage(w, h);
  img.ox = w / 2;
  img.oy = h / 2;
  const theme = act.zone.theme;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const up = Math.min(31, y),
        down = Math.min(31, h - 1 - y);
      img.data[y * w + x] = theme.paint(mat, worldX + x, worldY + y, up, down, 1);
    }
  return img;
}

export type PlatformMotion = 'none' | 'h' | 'v' | 'circle' | 'fall';

export class Platform extends GameObject {
  private img: PixelImage | null = null;
  private t: number;
  private readonly ox: number;
  private readonly oy: number;
  private fallTimer = -1;
  private vy = 0;
  constructor(
    x: number,
    y: number,
    readonly w: number,
    readonly motion: PlatformMotion,
    readonly range: number,
    readonly period: number,
    phase: number,
    readonly h = 16,
  ) {
    super(x, y);
    this.ox = x;
    this.oy = y;
    this.hw = 0;
    this.t = phase * period;
    this.solid = new SolidBox(x, y, w / 2, h / 2, true);
    this.depth = 3;
    this.alwaysActive = motion !== 'none' && motion !== 'fall';
  }
  override update(act: Act): void {
    this.t++;
    const a = (this.t / this.period) * Math.PI * 2;
    let nx = this.x,
      ny = this.y;
    switch (this.motion) {
      case 'h':
        nx = this.ox + Math.sin(a) * this.range;
        break;
      case 'v':
        ny = this.oy + Math.sin(a) * this.range;
        break;
      case 'circle':
        nx = this.ox + Math.cos(a) * this.range;
        ny = this.oy + Math.sin(a) * this.range;
        break;
      case 'fall':
        if (this.fallTimer > 0 && --this.fallTimer === 0) this.fallTimer = -2;
        if (this.fallTimer === -2) {
          this.vy = Math.min(this.vy + 0.21875, 12);
          ny = this.y + this.vy;
          if (ny > act.level.height + 64) this.dead = true;
        }
        break;
    }
    this.x = nx;
    this.y = ny;
    this.solid!.moveTo(nx, ny);
  }
  override onStand(): void {
    if (this.motion === 'fall' && this.fallTimer === -1) this.fallTimer = 30;
  }
  override draw(r: Renderer, cx: number, cy: number, act: Act): void {
    this.img ??= themedBlock(act, this.w, this.h, Mat.Platform, Math.round(this.ox), Math.round(this.oy));
    r.image(this.img, this.x - cx, this.y - cy);
  }
}

registerObject(
  'platform',
  (x, y, p) =>
    new Platform(
      x,
      y,
      (p.w as number) ?? 64,
      (p.motion as PlatformMotion) ?? 'none',
      (p.range as number) ?? 64,
      (p.period as number) ?? 180,
      (p.phase as number) ?? 0,
      (p.h as number) ?? 16,
    ),
);

/** A ledge that crumbles into pieces after it is stood on. */
export class CollapsingLedge extends GameObject {
  private timer = -1;
  private pieces: { x: number; y: number; vy: number; delay: number; img: PixelImage }[] = [];
  private img: PixelImage | null = null;
  constructor(
    x: number,
    y: number,
    readonly w: number,
    readonly h: number,
  ) {
    super(x, y);
    this.hw = 0;
    this.solid = new SolidBox(x, y, w / 2, h / 2, true);
    this.depth = 2;
  }
  override onStand(): void {
    if (this.timer < 0) this.timer = 24;
  }
  override update(act: Act): void {
    if (this.timer > 0 && --this.timer === 0) {
      act.sfx('collapse');
      this.img ??= themedBlock(
        act,
        this.w,
        this.h,
        Mat.Ground,
        Math.round(this.x - this.w / 2),
        Math.round(this.y - this.h / 2),
      );
      // Break into 16px columns that drop one after another (away from the player).
      const n = Math.ceil(this.w / 16);
      const fromLeft = act.leader.x > this.x;
      for (let i = 0; i < n; i++) {
        const piece = new PixelImage(16, this.h);
        piece.ox = 8;
        piece.oy = this.h / 2;
        for (let y = 0; y < this.h; y++)
          for (let x = 0; x < 16; x++) piece.data[y * 16 + x] = this.img.get(i * 16 + x, y);
        this.pieces.push({
          x: this.x - this.w / 2 + i * 16 + 8,
          y: this.y,
          vy: 0,
          delay: (fromLeft ? i : n - 1 - i) * 4,
          img: piece,
        });
      }
      this.solid = null;
      for (const p of act.players) if (p.onObject) p.leaveGround();
    }
    for (const p of this.pieces) {
      if (p.delay > 0) p.delay--;
      else {
        p.vy += 0.21875;
        p.y += p.vy;
      }
    }
    if (this.pieces.length && this.pieces.every((p) => p.y > act.camera.y + 400)) this.dead = true;
  }
  override draw(r: Renderer, cx: number, cy: number, act: Act): void {
    this.img ??= themedBlock(
      act,
      this.w,
      this.h,
      Mat.Ground,
      Math.round(this.x - this.w / 2),
      Math.round(this.y - this.h / 2),
    );
    if (!this.pieces.length) {
      r.image(this.img, this.x - cx + (this.timer > 0 ? (this.timer & 2) - 1 : 0), this.y - cy);
      return;
    }
    for (const p of this.pieces) r.image(p.img, p.x - cx, p.y - cy);
  }
}

registerObject(
  'collapsingLedge',
  (x, y, p) => new CollapsingLedge(x, y, (p.w as number) ?? 96, (p.h as number) ?? 32),
);

// ============================================================================ Breakable wall

/**
 * A wall that breaks when hit by a fast roll, a fire-shield dash or Knuckles.
 * `knucklesOnly` walls need Knuckles (alternate routes).
 */
export class BreakableWall extends GameObject {
  private img: PixelImage | null = null;
  constructor(
    x: number,
    y: number,
    readonly w: number,
    readonly h: number,
    readonly knucklesOnly: boolean,
  ) {
    super(x, y);
    this.hw = 0;
    this.solid = new SolidBox(x, y, w / 2, h / 2);
    this.depth = 2;
  }
  override solidFor(p: Player, act?: Act): boolean {
    const knux = p.def.id === 'knuckles' && (p.action === 'glide' || p.ball || p.action === 'normal');
    const fast =
      !this.knucklesOnly && ((p.ball && Math.abs(p.xsp) >= 4.5) || (p.shield === 'fire' && p.abilityUsed));
    const superP = p.superForm && Math.abs(p.xsp) > 2;
    const near = Math.abs(p.x - this.x) < this.w / 2 + 14 && Math.abs(p.y - this.y) < this.h / 2 + p.hr;
    if (near && (knux || fast || superP) && act) {
      this.dead = true;
      act.sfx('wallBreak');
      for (let yy = 0; yy < this.h; yy += 24) act.effect('wallBreak', this.x, this.y - this.h / 2 + yy + 12);
      act.addScore(100);
      return false;
    }
    return true;
  }
  override draw(r: Renderer, cx: number, cy: number, act: Act): void {
    this.img ??= themedBlock(
      act,
      this.w,
      this.h,
      Mat.Special,
      Math.round(this.x - this.w / 2),
      Math.round(this.y - this.h / 2),
    );
    r.image(this.img, this.x - cx, this.y - cy);
  }
}

registerObject(
  'breakableWall',
  (x, y, p) => new BreakableWall(x, y, (p.w as number) ?? 32, (p.h as number) ?? 64, Boolean(p.knucklesOnly)),
);

// ============================================================================ Underwater air

class BigBubble extends GameObject {
  private t = 0;
  constructor(x: number, y: number) {
    super(x, y);
    this.hw = 12;
    this.hh = 12;
    this.depth = 6;
  }
  override update(act: Act): void {
    this.t++;
    this.y -= 0.5;
    this.x += Math.sin(this.t / 10) * 0.4;
    if (this.y < act.waterY) this.dead = true;
  }
  override touch(act: Act, p: Player): void {
    if (!p.underwater || p.dead) return;
    p.breathe(act);
    this.dead = true;
  }
  override draw(r: Renderer, cx: number, cy: number): void {
    const s = Math.min(1, this.t / 60);
    if (s < 1) r.image(bigBubbleImg(), this.x - cx, this.y - cy, { alpha: 0.4 + s * 0.6 });
    else r.image(bigBubbleImg(), this.x - cx, this.y - cy);
  }
}

export class BubbleVent extends GameObject {
  private t = 0;
  constructor(x: number, y: number) {
    super(x, y);
    this.hw = 0;
    this.depth = 2;
  }
  override update(act: Act): void {
    this.t++;
    if (this.t % 40 === 0) act.effect('bubble', this.x + (Math.random() - 0.5) * 8, this.y - 4, 2);
    if (this.t % 240 === 120) act.spawn(new BigBubble(this.x, this.y - 8));
  }
  override draw(r: Renderer, cx: number, cy: number, act: Act): void {
    r.image(bubbleVentImg(Math.floor(act.frame / 8)), this.x - cx, this.y - cy);
  }
}

registerObject('bubbleVent', (x, y) => new BubbleVent(x, y));

// ============================================================================ Bumper

export class Bumper extends GameObject {
  private hit = 0;
  private img: PixelImage;
  constructor(x: number, y: number) {
    super(x, y);
    this.hw = 14;
    this.hh = 14;
    this.depth = 3;
    this.img = new PixelImage(32, 32);
    this.img.ox = this.img.oy = 16;
    this.img
      .circle(16, 16, 14, 0xff3030e8)
      .circle(16, 16, 10, 0xff6060ff)
      .circle(16, 16, 5, 0xffffffff)
      .outline(0xff281010);
  }
  override update(): void {
    if (this.hit > 0) this.hit--;
  }
  override touch(act: Act, p: Player): void {
    const a = Math.atan2(p.y - this.y, p.x - this.x);
    p.xsp = Math.cos(a) * 7;
    p.ysp = Math.sin(a) * 7;
    if (p.grounded) p.gsp = p.xsp;
    if (p.ysp < -1 || !p.grounded) {
      p.grounded = false;
      p.onObject = null;
    }
    p.jumping = false;
    act.sfx('bumper');
    if (this.hit === 0) act.addScore(10, this.x, this.y - 16);
    this.hit = 8;
  }
  override draw(r: Renderer, cx: number, cy: number): void {
    const s = this.hit > 0 ? 2 : 0;
    r.image(this.img, this.x - cx + (this.hit & 1 ? s : 0), this.y - cy);
  }
}

registerObject('bumper', (x, y) => new Bumper(x, y));

// ============================================================================ Misc

/** Visual-only marker placed by LevelBuilder.loop (kept for future foreground art). */
registerObject('loopDecor', () => null);

/** Rings placed by the level are plain Ring objects; re-exported for convenience. */
export { Ring };

/** Returns the level material id at a point (for objects that care). */
export function materialAt(act: Act, x: number, y: number): number {
  return act.level.map.get(Math.floor(x), Math.floor(y)) >> MAT_SHIFT;
}
