import { buildAnimations, PALETTES, superPalette, type AnimFrames } from '../art/characters';
import type { PixelImage } from '../art/pixels';
import type { CharId } from '../player/types';

const ROT_STEPS = 32;

/** Lazily-built character animation frames, including rotated copies for slopes. */
export class CharSprites {
  private readonly normal = new Map<CharId, Record<string, AnimFrames>>();
  private readonly superSets = new Map<string, Record<string, AnimFrames>>();
  private readonly rotCache = new Map<PixelImage, Map<number, PixelImage>>();

  anims(id: CharId, superPhase = -1): Record<string, AnimFrames> {
    if (superPhase < 0) {
      let a = this.normal.get(id);
      if (!a) {
        a = buildAnimations(id, PALETTES[id]);
        this.normal.set(id, a);
      }
      return a;
    }
    // Super forms cycle through 4 palette phases.
    const key = `${id}:${superPhase & 3}`;
    let a = this.superSets.get(key);
    if (!a) {
      a = buildAnimations(id, superPalette(id, ((superPhase & 3) / 4) * Math.PI * 2));
      this.superSets.set(key, a);
    }
    return a;
  }

  frame(id: CharId, anim: string, index: number, superPhase = -1): PixelImage {
    const set = this.anims(id, superPhase);
    const frames = set[anim] ?? set.idle!;
    return frames[index % frames.length]!;
  }

  /** Returns `img` rotated counter-clockwise by `deg`, quantised to 32 steps. */
  rotated(img: PixelImage, deg: number): PixelImage {
    const step = ((Math.round((deg / 360) * ROT_STEPS) % ROT_STEPS) + ROT_STEPS) % ROT_STEPS;
    if (step === 0) return img;
    let m = this.rotCache.get(img);
    if (!m) {
      m = new Map();
      this.rotCache.set(img, m);
    }
    let out = m.get(step);
    if (!out) {
      out = img.rotated(-(step / ROT_STEPS) * Math.PI * 2);
      m.set(step, out);
    }
    return out;
  }
}
