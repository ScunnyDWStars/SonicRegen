import type { Renderer } from '../engine/renderer';
import type { Game } from './game';

export interface Scene {
  /** One logic frame. */
  update(game: Game): void;
  render(r: Renderer, game: Game): void;
  /** Music track this scene wants (null = keep current). */
  readonly music?: string | null;
}
