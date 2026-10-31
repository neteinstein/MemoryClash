import { describe, expect, it } from 'vitest';
import { avatarSvg, BODIES, cleanName, defaultAvatar, EXTRAS, EYES, MOUTHS, NAME_MAX, randomAvatar, sanitizeAvatar, SKINS } from '../src/ui/avatar';
import { createRng } from '../src/game/rng';

describe('avatar', () => {
  it('usa o avatar por omissão quando os dados são inválidos', () => {
    expect(sanitizeAvatar(null, 1)).toEqual(defaultAvatar(1));
    expect(sanitizeAvatar('x', 2)).toEqual(defaultAvatar(2));
    const a = sanitizeAvatar({ name: '  Ana  ', body: 'dragão', skin: '#000000', eyes: 'hearts', mouth: 'grin', extra: 'crown' }, 1);
    expect(a).toEqual({ ...defaultAvatar(1), name: 'Ana', eyes: 'hearts', mouth: 'grin', extra: 'crown' });
  });

  it('limita o nome e trata nomes vazios', () => {
    expect(cleanName('  um   nome    muito comprido demais ')).toHaveLength(NAME_MAX);
    expect(cleanName('😈😈😈😈😈😈😈😈😈😈😈😈😈😈')).toBe('😈'.repeat(NAME_MAX));
    expect(sanitizeAvatar({ name: '   ' }, 2).name).toBe('Jogador 2');
  });

  it('desenha todas as combinações sem rebentar', () => {
    for (const body of BODIES)
      for (const eyes of EYES)
        for (const mouth of MOUTHS)
          for (const extra of EXTRAS) {
            const svg = avatarSvg({ name: 'x', body, skin: SKINS[0], eyes, mouth, extra });
            expect(svg.startsWith('<svg')).toBe(true);
            expect(svg).not.toContain('undefined');
          }
    for (const mood of ['happy', 'dizzy', 'scared'] as const) {
      expect(avatarSvg(defaultAvatar(1), mood)).not.toContain('undefined');
    }
  });

  it('gera avatares aleatórios válidos', () => {
    const rng = createRng(3);
    for (let i = 0; i < 50; i++) {
      const a = randomAvatar('Zé', rng);
      expect(sanitizeAvatar(a, 1)).toEqual(a);
    }
  });
});
