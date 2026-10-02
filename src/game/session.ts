export type Team = 'sonic+tails' | 'sonic' | 'tails' | 'knuckles';

export interface Checkpoint {
  x: number;
  y: number;
  /** Frames on the act timer when the checkpoint was touched. */
  time: number;
  id: number;
}

/** Progress for one playthrough (one save slot). */
export class Session {
  team: Team = 'sonic+tails';
  lives = 3;
  score = 0;
  continues = 0;
  /** Bit i set = Chaos Emerald i collected. */
  emeralds = 0;
  zone = 0;
  act = 0;
  checkpoint: Checkpoint | null = null;
  /** Number of zones available in the zone select. */
  unlocked = 1;
  /** Save slot (0-2), or null for "no save". */
  slot: number | null = null;
  /** Giant rings already used in this act, so they stay gone after a restart. */
  usedGiantRings = new Set<string>();
  /** Rings carried into a special stage, restored when returning. */
  returnState: { x: number; y: number; rings: number; time: number; layer: number } | null = null;
  private nextLife = 50000;

  get emeraldCount(): number {
    let n = 0;
    for (let i = 0; i < 7; i++) if (this.emeralds & (1 << i)) n++;
    return n;
  }
  get allEmeralds(): boolean {
    return this.emeraldCount === 7;
  }
  /** Index of the next special stage to play (first missing emerald). */
  get nextSpecialStage(): number {
    for (let i = 0; i < 7; i++) if (!(this.emeralds & (1 << i))) return i;
    return 0;
  }

  /** Add points; returns the number of extra lives earned (one per 50,000). */
  addScore(n: number): number {
    this.score += n;
    let lives = 0;
    while (this.score >= this.nextLife) {
      this.nextLife += 50000;
      this.lives++;
      lives++;
    }
    return lives;
  }

  resetForNewGame(team: Team): void {
    this.team = team;
    this.lives = 3;
    this.score = 0;
    this.continues = 0;
    this.emeralds = 0;
    this.zone = 0;
    this.act = 0;
    this.checkpoint = null;
    this.usedGiantRings.clear();
    this.returnState = null;
    this.nextLife = 50000;
  }

  toJSON() {
    return {
      team: this.team,
      lives: this.lives,
      score: this.score,
      continues: this.continues,
      emeralds: this.emeralds,
      zone: this.zone,
      unlocked: this.unlocked,
    };
  }

  load(d: Partial<ReturnType<Session['toJSON']>>): void {
    if (d.team) this.team = d.team;
    this.lives = d.lives ?? 3;
    this.score = d.score ?? 0;
    this.continues = d.continues ?? 0;
    this.emeralds = d.emeralds ?? 0;
    this.zone = d.zone ?? 0;
    this.unlocked = Math.max(1, d.unlocked ?? 1);
    this.nextLife = (Math.floor(this.score / 50000) + 1) * 50000;
  }
}
