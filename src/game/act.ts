import { rgb, type Color } from '../art/pixels';
import { SCREEN_H, SCREEN_W } from '../engine/constants';
import { Camera } from '../engine/camera';
import { Btn, Pad } from '../engine/input';
import type { Renderer } from '../engine/renderer';
import type { LevelData } from '../level/builder';
import { CollisionView, type Dir } from '../level/collision';
import { TerrainRenderer } from '../level/terrain-render';
import { createObject, GameObject, type SolidBox } from '../objects/base';
import { scatterRings } from '../objects/rings';
import { Player, type CharacterDef } from '../player/Player';
import type { CharId, PlayerWorld, Sfx } from '../player/types';
import type { ZoneDef } from '../zones';
import { CharSprites } from './char-sprites';
import { Effects } from './effects';
import type { Game } from './game';
import { drawHud } from './hud';
import type { Scene } from './scene';

export type ActState = 'card' | 'play' | 'dying' | 'clear' | 'exit';

export interface ActHooks {
  /** Called when the act is cleared and results are done. */
  onCleared?(act: Act): void;
  /** Called when the leader died and the death animation finished. */
  onDeath?(act: Act): void;
  /** Called when a giant ring is entered. */
  onGiantRing?(act: Act): void;
  /** Create the character definition for a character id. */
  characterDef(id: CharId): CharacterDef;
  /** Sidekick input generator (Tails AI), if any. */
  makeSidekickPad?(act: Act, sidekick: Player): () => Pad;
}

export const sprites = new CharSprites();

const DEBUG_COL: Color = rgb(255, 64, 255);

export class Act implements Scene, PlayerWorld {
  readonly music: string | null;
  readonly level: LevelData;
  col: CollisionView;
  readonly camera = new Camera();
  players: Player[] = [];
  objects: GameObject[] = [];
  private spawnQueue: GameObject[] = [];
  terrain: TerrainRenderer | null = null;
  readonly effects = new Effects();
  frame = 0;
  /** Act timer in frames. */
  time = 0;
  state: ActState = 'card';
  stateTimer = 0;
  waterY: number;
  /** Combo counter for consecutive badniks without landing. */
  chain = 0;
  /** Set while a boss fight is in progress (locks camera, changes music). */
  bossActive = false;
  /** Results tally state. */
  results: { timeBonus: number; ringBonus: number; total: number; shown: number } | null = null;
  private sidekickPads = new Map<Player, () => Pad>();
  private lastX = new Map<Player, number>();
  readonly deferred: Array<() => void> = [];
  /** Optional per-act logic (zone scripts: rising water, transitions...). */
  scripts: Array<(act: Act) => void> = [];
  /** Extra draw hooks, drawn after objects (foreground layers). */
  foreground: Array<(r: Renderer, cx: number, cy: number) => void> = [];

  constructor(
    readonly game: Game,
    readonly zone: ZoneDef,
    readonly actIndex: number,
    readonly hooks: ActHooks,
  ) {
    this.level = zone.acts[actIndex]!.build();
    this.music = zone.acts[actIndex]!.music ?? zone.theme.music;
    this.col = new CollisionView(this.level.map);
    this.waterY = this.level.waterY;
    this.camera.setBounds(0, 0, this.level.width, this.level.cameraBottom);
    const s = game.session;
    // Players
    const start = s.checkpoint ?? s.returnState ?? this.level.start;
    const team = s.team;
    const leaderId: CharId = team === 'tails' ? 'tails' : team === 'knuckles' ? 'knuckles' : 'sonic';
    const leader = new Player(hooks.characterDef(leaderId), start.x, start.y);
    leader.canGoSuper = s.allEmeralds;
    this.players.push(leader);
    if (team === 'sonic+tails') {
      const tails = new Player(hooks.characterDef('tails'), start.x - 32, start.y);
      tails.canGoSuper = false;
      this.players.push(tails);
      if (hooks.makeSidekickPad) this.sidekickPads.set(tails, hooks.makeSidekickPad(this, tails));
    }
    if (s.checkpoint) this.time = s.checkpoint.time;
    if (s.returnState) {
      leader.rings = s.returnState.rings;
      this.time = s.returnState.time;
      leader.layer = s.returnState.layer;
      s.returnState = null;
    }
    for (const p of this.players) p.grounded = false;
    // Objects
    this.level.spawns.forEach((sp, i) => {
      const o = createObject(sp.type, sp.x, sp.y, sp.props, this);
      if (!o) return;
      o.persistKey ??= `${sp.type}:${i}`;
      this.objects.push(o);
    });
    this.zone.acts[actIndex]!.setup?.(this);
    this.camera.snap(leader);
  }

  get leader(): Player {
    return this.players[0]!;
  }

  // ------------------------------------------------------------------ PlayerWorld

  get boundLeft(): number {
    return Math.max(this.camera.minX, this.camera.lockLeft);
  }
  get boundRight(): number {
    return this.camera.maxX + SCREEN_W;
  }
  get boundBottom(): number {
    return Math.min(this.level.bottom, this.camera.maxY + SCREEN_H + 32);
  }
  get cameraTop(): number {
    return this.camera.y;
  }
  sfx(s: Sfx): void {
    this.game.sound.sfx(s);
  }
  scatterRings(x: number, y: number, count: number): void {
    scatterRings(this, x, y, count);
  }
  effect(kind: string, x: number, y: number, data = 0): void {
    this.effects.add(kind, x, y, data);
  }

  // ------------------------------------------------------------------ helpers

  spawn(o: GameObject): void {
    this.spawnQueue.push(o);
  }

  /** Score with a floating pop-up; extra lives play the jingle. */
  addScore(n: number, x?: number, y?: number): void {
    const lives = this.game.session.addScore(n);
    if (x !== undefined && y !== undefined) this.effects.add('score', x, y, n);
    if (lives > 0) this.extraLife();
  }

  extraLife(): void {
    this.game.sound.sfx('oneUp');
    this.game.sound.overrideMusic('oneUp');
  }

  collectRing(x: number, y: number, n = 1): void {
    const p = this.leader;
    const before = p.rings;
    p.rings = Math.min(999, p.rings + n);
    this.sfx('ring');
    this.effects.add('sparkle', x, y);
    for (const m of [100, 200]) {
      if (before < m && p.rings >= m) {
        this.game.session.lives++;
        this.extraLife();
      }
    }
  }

  /** Badnik destroyed by player p: chain scoring (100, 200, 500, 1000...). */
  badnikScore(p: Player, x: number, y: number): void {
    const table = [100, 200, 500, 1000];
    const pts = this.chain < table.length ? table[this.chain]! : this.chain >= 15 ? 10000 : 1000;
    this.chain++;
    this.addScore(pts, x, y);
    void p;
  }

  /** Bounce the player off something they destroyed (badniks, monitors). */
  bounce(p: Player, objY: number): void {
    if (p.grounded) return;
    if (p.y < objY && p.ysp > 0) p.ysp = -p.ysp;
    else if (p.ysp < 0) p.ysp += 1;
  }

  isLeader(p: Player): boolean {
    return p === this.players[0];
  }

  /** Called by signposts and capsules. */
  clearAct(): void {
    if (this.state !== 'play') return;
    this.state = 'clear';
    this.stateTimer = 0;
    const secs = Math.floor(this.time / 60);
    const timeBonus =
      secs < 30
        ? 50000
        : secs < 45
          ? 10000
          : secs < 60
            ? 5000
            : secs < 90
              ? 4000
              : secs < 120
                ? 3000
                : secs < 180
                  ? 2000
                  : secs < 240
                    ? 1000
                    : secs < 300
                      ? 500
                      : 0;
    this.results = { timeBonus, ringBonus: this.leader.rings * 100, total: 0, shown: 0 };
    this.game.sound.music('actClear', { restart: true });
  }

  /** Remove level pixels (breakable walls) and refresh the art. */
  clearPixels(x: number, y: number, w: number, h: number): void {
    for (let yy = Math.floor(y); yy < y + h; yy++)
      for (let xx = Math.floor(x); xx < x + w; xx++) this.level.map.set(xx, yy, 0);
    this.terrain?.invalidate(x, y, w, h);
  }

  /** Debug/test helper: teleport the leader to x, standing on the ground (searching down from y). */
  warp(x: number, fromY = 0): void {
    const p = this.leader;
    let y = fromY;
    while (y < this.level.height && !this.col.solid(Math.floor(x), y, 0, true)) y++;
    p.x = x;
    p.y = y - p.hr - 1;
    p.xsp = p.ysp = p.gsp = 0;
    p.grounded = false;
    this.camera.snap(p);
  }

  /** Casts against level collision on path A (objects mostly need simple floor checks). */
  floorDist(x: number, y: number, d: Dir): number {
    return this.col.dist(x, y, d, 0, true);
  }

  // ------------------------------------------------------------------ update

  update(game: Game): void {
    this.frame++;
    this.stateTimer++;
    if (game.pad.isPressed(Btn.Start) && this.state === 'play' && !game.debug) {
      this.paused = !this.paused;
    }
    if (this.paused) return;
    switch (this.state) {
      case 'card':
        // Gameplay is frozen while the title card is up.
        if (this.stateTimer === 1) this.terrainWarm();
        this.stepWorld(new Pad(), true);
        if (this.stateTimer >= 70) {
          this.state = 'play';
          this.stateTimer = 0;
        }
        return;
      case 'play':
        if (this.time < 9 * 60 * 60 + 59 * 60 + 59) this.time++;
        else this.leader.die(this);
        this.stepWorld(game.pad, false);
        if (this.leader.dead) {
          this.state = 'dying';
          this.stateTimer = 0;
          this.camera.frozenX = true;
        }
        return;
      case 'dying':
        this.stepWorld(new Pad(), false);
        if (this.stateTimer === 150) {
          this.state = 'exit';
          this.hooks.onDeath?.(this);
        }
        return;
      case 'clear':
        this.stepWorld(new Pad(), false);
        this.updateResults();
        return;
      case 'exit':
        return;
    }
  }

  paused = false;

  private terrainWarm(): void {
    this.terrain?.warm(this.leader.x, this.leader.y);
  }

  private updateResults(): void {
    const r = this.results!;
    if (this.stateTimer < 120) return;
    if (r.timeBonus > 0 || r.ringBonus > 0) {
      // Pressing a button finishes the tally at once.
      const fast = this.game.pad.isPressed(Btn.Start | Btn.A | Btn.B | Btn.C);
      const t = fast ? r.timeBonus : Math.min(200, r.timeBonus),
        g = fast ? r.ringBonus : Math.min(200, r.ringBonus);
      r.timeBonus -= t;
      r.ringBonus -= g;
      r.total += t + g;
      this.addScore(t + g);
      if (this.stateTimer % 8 === 0) this.sfx('tally');
      if (r.timeBonus === 0 && r.ringBonus === 0) {
        this.sfx('checkpoint');
        r.shown = this.stateTimer;
      }
    }
    if (r.shown && this.stateTimer - r.shown > 120 && this.state === 'clear') {
      this.state = 'exit';
      this.hooks.onCleared?.(this);
    }
  }

  /** Advance objects, players, interactions and camera by one frame. */
  stepWorld(input: Pad, frozen: boolean): void {
    const cam = this.camera;
    const activeL = cam.x - 320,
      activeR = cam.x + SCREEN_W + 320;
    for (const o of this.objects) {
      if (o.solid) o.solid.dx = o.solid.dy = 0;
      if (o.dead) continue;
      if (o.alwaysActive || (o.x >= activeL && o.x <= activeR)) o.update(this);
    }
    for (const s of this.scripts) s(this);
    if (!frozen) {
      this.players.forEach((p, i) => {
        if (p.onObject && p.grounded) {
          p.x += p.onObject.dx;
        }
        let pad = input;
        if (i > 0) pad = this.sidekickPads.get(p)?.() ?? new Pad();
        p.update(pad, this);
        this.applySwappers(p);
        if (p.grounded) {
          if (i === 0) this.chain = 0;
        }
      });
      for (const p of this.players) if (!p.dead) this.interact(p);
    }
    this.flushSpawns();
    this.objects = this.objects.filter((o) => !o.dead);
    if (!this.leader.dead || this.state === 'clear') cam.update(this.leader);
    if (cam.shake > 0) cam.shake--;
    this.effects.update(this.waterY);
    for (const d of this.deferred.splice(0)) d();
  }

  private flushSpawns(): void {
    if (this.spawnQueue.length) {
      this.objects.push(...this.spawnQueue);
      this.spawnQueue.length = 0;
    }
  }

  private applySwappers(p: Player): void {
    const px = this.lastX.get(p) ?? p.x;
    for (const s of this.level.swappers) {
      if (p.y < s.y0 || p.y > s.y1) continue;
      if (s.groundedOnly && !p.grounded) continue;
      if (px < s.x && p.x >= s.x) p.layer = 0;
      else if (px >= s.x && p.x < s.x) p.layer = 1;
    }
    this.lastX.set(p, p.x);
  }

  /** Solid object collision and touch boxes. */
  private interact(p: Player): void {
    const thw = p.instaShield > 0 ? 24 : 8;
    const thh = p.instaShield > 0 ? 24 : p.hr - 3;
    for (const o of this.objects) {
      if (o.dead) continue;
      if (o.solid && (!o.solidFor || o.solidFor(p, this))) this.solidCollide(p, o, o.solid);
      if (p.dead) return;
      if (o.touch && o.hw > 0 && Math.abs(p.x - o.x) < thw + o.hw && Math.abs(p.y - o.y) < thh + o.hh) {
        o.touch(this, p);
        if (p.dead) return;
      }
    }
    this.flushSpawns();
  }

  /** Sonic Physics Guide style solid-object resolution. */
  solidCollide(p: Player, o: GameObject, s: SolidBox): void {
    if (p.onObject === s) {
      // Standing: the physics step already kept the player on top.
      if (!p.grounded) p.onObject = null;
      else {
        o.onStand?.(this, p);
        return;
      }
    }
    const cw = s.hw + 11;
    const ch = s.hh + p.hr;
    const left = p.x - s.x + cw;
    if (left < 0 || left > cw * 2) return;
    const top = p.y - s.y + ch + 4;
    const surfaceOff = s.surface ? s.surface(p.x - s.x) : 0;
    if (top - surfaceOff < 0 || top > ch * 2 + 4) return;
    const xd = left <= cw ? left : left - cw * 2;
    const yd = top <= ch ? top - surfaceOff : top - 4 - ch * 2;
    if (s.topOnly) {
      if (yd < 0 || p.ysp < 0 || yd > 16) return;
      this.landOn(p, o, s, yd);
      return;
    }
    if (Math.abs(xd) <= Math.abs(yd) && !(yd >= 0 && yd <= 6 && p.ysp >= 0)) {
      // Horizontal push-out.
      if (Math.abs(yd) <= 4 && yd < 0) return; // grazing the bottom edge
      p.x -= xd;
      if ((xd > 0 && p.xsp > 0) || (xd < 0 && p.xsp < 0)) {
        p.xsp = 0;
        if (p.grounded) {
          p.gsp = 0;
          p.pushing = true;
        }
      }
      o.onPush?.(this, p, xd > 0 ? -1 : 1);
      return;
    }
    if (yd < 0) {
      if (p.ysp < 0 || !p.grounded) {
        p.y -= yd;
        if (p.ysp < 0) p.ysp = 0;
        o.onBonk?.(this, p);
      } else if (p.grounded && Math.abs(xd) > 4) {
        // Crushed between the object and the floor.
        p.die(this);
      }
      return;
    }
    if (yd > 16 || p.ysp < 0) return;
    this.landOn(p, o, s, yd);
  }

  private landOn(p: Player, o: GameObject, s: SolidBox, yd: number): void {
    p.y -= yd - 4;
    if (!p.grounded) {
      p.ysp = 0;
      p.landOnFloor(this, 0, false);
    }
    p.onObject = s;
    p.angle = 0;
    p.grounded = true;
    o.onStand?.(this, p);
  }

  // ------------------------------------------------------------------ render

  render(r: Renderer, game: Game): void {
    const cam = this.camera;
    const cx = cam.rx,
      cy = cam.ry;
    this.terrain ??= new TerrainRenderer(this.level.map, this.zone.theme);
    this.zone.theme.drawBackground(r, cx, cy, this.frame);
    const objs = this.objects.filter((o) => o.x > cx - 160 && o.x < cx + SCREEN_W + 160);
    objs.sort((a, b) => a.depth - b.depth);
    for (const o of objs) if (o.depth < 0) o.draw(r, cx, cy, this);
    this.terrain.draw(r, cx, cy);
    for (const o of objs) if (o.depth >= 0 && o.depth < 10) o.draw(r, cx, cy, this);
    for (let i = this.players.length - 1; i >= 0; i--) this.drawPlayer(r, this.players[i]!, cx, cy);
    for (const o of objs) if (o.depth >= 10) o.draw(r, cx, cy, this);
    for (const f of this.foreground) f(r, cx, cy);
    this.effects.draw(r, cx, cy, this.frame);
    this.drawWater(r, cy);
    if (game.debug) this.drawDebug(r, cx, cy);
    drawHud(r, this, game);
  }

  drawPlayer(r: Renderer, p: Player, cx: number, cy: number): void {
    if (p.invuln > 0 && p.action !== 'hurt' && this.frame & 4) return;
    const superPhase = p.superForm ? Math.floor(this.frame / 6) : -1;
    let img = sprites.frame(p.def.id, p.anim, p.animFrame, superPhase);
    const ballAnim = p.anim === 'roll' || p.anim === 'spindash';
    const flip = p.facing < 0;
    if (!ballAnim && p.drawAngle !== 0) img = sprites.rotated(img, flip ? -p.drawAngle : p.drawAngle);
    r.image(img, p.x - cx, p.y - cy + (ballAnim ? 0 : 0), { flipX: flip });
    // Shields and invincibility sparkles.
    drawShield(r, p, p.x - cx, p.y - cy, this.frame);
  }

  private drawWater(r: Renderer, cy: number): void {
    const theme = this.zone.theme;
    if (!theme.water || this.waterY === Infinity) return;
    const sy = Math.round(this.waterY - cy);
    if (sy >= SCREEN_H) return;
    const ctx = r.ctx;
    const top = Math.max(0, sy);
    ctx.save();
    ctx.globalCompositeOperation = 'multiply';
    r.rect(0, top, SCREEN_W, SCREEN_H - top, theme.water.tint);
    ctx.restore();
    if (sy >= 0) {
      ctx.globalAlpha = 0.8;
      for (let x = 0; x < SCREEN_W; x += 8) {
        const o = Math.round(Math.sin((x + this.frame * 2) / 12) * 1.5);
        r.rect(x, sy + o - 1, 8, 2, theme.water.surface);
      }
      ctx.globalAlpha = 1;
    }
  }

  private drawDebug(r: Renderer, cx: number, cy: number): void {
    for (const p of this.players) {
      r.box(p.x - p.wr - cx, p.y - p.hr - cy, p.wr * 2 + 1, p.hr * 2 + 1, rgb(0, 255, 255));
      for (const s of p.debugSensors) {
        const len = Math.max(-32, Math.min(32, s.hit.dist));
        const col = s.hit.found ? DEBUG_COL : rgb(255, 255, 0);
        r.line(s.x - cx, s.y - cy, s.x - cx + s.dir.dx * len, s.y - cy + s.dir.dy * len, col);
        r.rect(s.x - cx - 1, s.y - cy - 1, 2, 2, rgb(255, 255, 255));
      }
    }
    for (const o of this.objects) {
      if (o.hw > 0) r.box(o.x - o.hw - cx, o.y - o.hh - cy, o.hw * 2, o.hh * 2, rgb(255, 0, 0));
      if (o.solid) {
        const s = o.solid;
        r.box(s.x - s.hw - cx, s.y - s.hh - cy, s.hw * 2, s.hh * 2, rgb(0, 255, 0));
      }
    }
    for (const s of this.level.swappers) r.line(s.x - cx, s.y0 - cy, s.x - cx, s.y1 - cy, rgb(255, 128, 0));
    const p = this.leader;
    const lines = [
      `X ${p.x.toFixed(1)} Y ${p.y.toFixed(1)}`,
      `GSP ${p.gsp.toFixed(3)}`,
      `XSP ${p.xsp.toFixed(2)} YSP ${p.ysp.toFixed(2)}`,
      `ANG ${p.angle.toFixed(1)} L${p.layer ? 'B' : 'A'}`,
      `${p.action.toUpperCase()} ${p.grounded ? 'GND' : 'AIR'}`,
    ];
    lines.forEach((l, i) => r.text(l, 168, 4 + i * 9, rgb(255, 255, 255)));
  }
}

// --------------------------------------------------------------------------

function drawShield(r: Renderer, p: Player, x: number, y: number, frame: number): void {
  if (p.dead) return;
  if (p.invincible > 0 && !p.superForm) {
    for (let i = 0; i < 4; i++) {
      const a = frame / 6 + (i * Math.PI) / 2;
      const rr = 16 + Math.sin(frame / 3 + i) * 4;
      r.rect(
        x + Math.cos(a) * rr - 1,
        y + Math.sin(a) * rr - 1,
        3,
        3,
        i & 1 ? rgb(255, 255, 160) : rgb(255, 255, 255),
      );
    }
    return;
  }
  if (!p.shield || p.invincible > 0) return;
  if (frame & 1 && p.shield === 'basic') return;
  const ctx = r.ctx;
  const cols: Record<string, [string, string]> = {
    basic: ['rgba(120,200,255,0.5)', 'rgba(255,255,255,0.9)'],
    fire: ['rgba(255,120,32,0.45)', 'rgba(255,220,64,0.9)'],
    bubble: ['rgba(96,176,255,0.35)', 'rgba(200,240,255,0.9)'],
    lightning: ['rgba(255,240,96,0.25)', 'rgba(255,255,200,0.9)'],
  };
  const [fill, edge] = cols[p.shield]!;
  ctx.fillStyle = fill;
  ctx.strokeStyle = edge;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(Math.round(x), Math.round(y), 22, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  if (p.shield === 'lightning') {
    for (let i = 0; i < 3; i++) {
      const a = frame / 5 + (i * Math.PI * 2) / 3;
      r.rect(x + Math.cos(a) * 18, y + Math.sin(a) * 18, 2, 2, rgb(255, 255, 255));
    }
  }
  if (p.shield === 'fire') {
    for (let i = 0; i < 4; i++) {
      const a = -frame / 6 + (i * Math.PI) / 2;
      r.rect(x + Math.cos(a) * 14 - 1, y + Math.sin(a) * 14 - 1, 3, 3, rgb(255, 200, 32));
    }
  }
  if (p.shield === 'bubble') {
    r.rect(x - 8, y - 12, 3, 3, rgb(255, 255, 255));
  }
}
