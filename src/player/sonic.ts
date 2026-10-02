import type { CharacterDef, Player } from './Player';
import type { PlayerWorld } from './types';

/**
 * Shield abilities shared by every character that can use them (Sonic 3 rules).
 * Returns true if a shield ability was used.
 */
export function shieldAbility(p: Player, w: PlayerWorld): boolean {
  if (p.superForm || p.invincible > 0) return false;
  switch (p.shield) {
    case 'fire':
      p.xsp = 8 * p.facing;
      p.ysp = 0;
      p.abilityUsed = true;
      p.cameraLag = 16;
      w.sfx('fireDash');
      w.effect('fireDash', p.x, p.y, p.facing);
      return true;
    case 'bubble':
      p.xsp = 0;
      p.ysp = 8;
      p.abilityUsed = true;
      p.action = 'bubbleBounce';
      w.sfx('bubbleShield');
      return true;
    case 'lightning':
      p.ysp = -5.5;
      p.abilityUsed = true;
      w.sfx('doubleJump');
      w.effect('sparks', p.x, p.y);
      return true;
    default:
      return false;
  }
}

export const SONIC: CharacterDef = {
  id: 'sonic',
  name: 'SONIC',
  jump: 6.5,
  standHr: 19,
  standWr: 9,
  rollHr: 14,
  rollWr: 7,
  airAbility(p, w) {
    if (shieldAbility(p, w)) return;
    if (p.shield || p.superForm || p.invincible > 0) return;
    // Insta-shield: a brief burst that widens Sonic's attack hitbox.
    p.instaShield = 14;
    p.abilityUsed = true;
    w.sfx('instaShield');
    w.effect('instaShield', p.x, p.y);
  },
};
