import { describe, expect, it } from 'vitest';
import { DEVIL_STREAK, DIFFICULTIES, LEAD_IN_MS, CURSE_EXTRA_NOTES, stepMsFor } from '../src/game/config';
import { PlayerEngine, type PlayerEvent } from '../src/game/player';
import { createRng } from '../src/game/rng';

function setup(difficulty = DIFFICULTIES.normal, seed = 42) {
  const p = new PlayerEngine(1, difficulty, createRng(seed));
  const events: PlayerEvent[] = [];
  p.on((e) => events.push(e));
  return { p, events };
}

/** Avança o relógio em passos de 10 ms até a fase pedida. */
function runUntil(p: PlayerEngine, t: number, phase: string, limit = 120_000): number {
  while (p.phase !== phase) {
    t += 10;
    p.update(t);
    if (t > limit) throw new Error(`não chegou a ${phase}`);
  }
  return t;
}

function answer(p: PlayerEngine, t: number): number {
  for (const key of p.roundSequence) {
    t += 100;
    p.press(key, t);
  }
  return t;
}

describe('PlayerEngine', () => {
  it('mostra a sequência inicial nota a nota e depois espera pela resposta', () => {
    const { p, events } = setup();
    p.start(0);
    expect(p.phase).toBe('showing');
    expect(p.roundSequence).toHaveLength(DIFFICULTIES.normal.startLength);
    const t = runUntil(p, 0, 'input');
    const shows = events.filter((e) => e.type === 'show');
    expect(shows.map((e) => (e as { key: number }).key)).toEqual(p.roundSequence);
    expect(t).toBeGreaterThanOrEqual(LEAD_IN_MS);
  });

  it('ignora toques enquanto a sequência está a ser mostrada', () => {
    const { p } = setup();
    p.start(0);
    expect(p.press(p.roundSequence[0], 100)).toBeNull();
  });

  it('acerto: a sequência cresce uma nota e acelera', () => {
    const { p, events } = setup();
    p.start(0);
    let t = runUntil(p, 0, 'input');
    const before = p.roundSequence.slice();
    const stepBefore = p.stepMs;
    t = answer(p, t);
    expect(p.phase).toBe('success');
    expect(events.some((e) => e.type === 'success')).toBe(true);
    runUntil(p, t, 'showing');
    expect(p.roundSequence).toHaveLength(before.length + 1);
    expect(p.roundSequence.slice(0, before.length)).toEqual(before);
    expect(p.stepMs).toBeLessThan(stepBefore);
  });

  it('erro: perde a série e recomeça com uma sequência mais curta', () => {
    const { p, events } = setup();
    p.start(0);
    let t = runUntil(p, 0, 'input');
    t = answer(p, t);
    t = runUntil(p, t, 'input');
    expect(p.streak).toBe(1);
    const wrong = (p.roundSequence[0] + 1) % DIFFICULTIES.normal.keys;
    expect(p.press(wrong, t + 50)).toBe(false);
    expect(p.phase).toBe('error');
    expect(p.streak).toBe(0);
    const err = events.find((e) => e.type === 'error');
    expect(err).toMatchObject({ reason: 'wrong', pressed: wrong });
    runUntil(p, t, 'showing');
    expect(p.roundSequence).toHaveLength(DIFFICULTIES.normal.startLength);
  });

  it('erro por tempo esgotado', () => {
    const { p, events } = setup();
    p.start(0);
    const t = runUntil(p, 0, 'input');
    runUntil(p, t, 'error');
    expect(events.find((e) => e.type === 'error')).toMatchObject({ reason: 'timeout', pressed: null });
  });

  it(`solta um diabinho a cada ${DEVIL_STREAK} acertos seguidos`, () => {
    const { p, events } = setup(DIFFICULTIES.easy);
    p.start(0);
    let t = 0;
    for (let i = 0; i < DEVIL_STREAK; i++) {
      t = runUntil(p, t, 'input');
      t = answer(p, t);
    }
    expect(p.streak).toBe(DEVIL_STREAK);
    expect(events.filter((e) => e.type === 'devil')).toHaveLength(1);
    expect(p.stats.devilsSent).toBe(1);
  });

  it('maldição: a próxima sequência é mais longa e mais rápida', () => {
    const { p } = setup();
    p.start(0);
    let t = runUntil(p, 0, 'input');
    t = answer(p, t);
    p.receiveCurse();
    t = runUntil(p, t, 'showing');
    const base = DIFFICULTIES.normal.startLength + 1;
    expect(p.activeCurse).toBe(1);
    expect(p.roundSequence).toHaveLength(base + CURSE_EXTRA_NOTES);
    expect(p.stepMs).toBe(stepMsFor(DIFFICULTIES.normal, 1, 1));
    expect(p.stepMs).toBeLessThan(stepMsFor(DIFFICULTIES.normal, 1, 0));
    // Ao superar a maldição volta ao normal, com a sequência base a crescer uma nota.
    t = runUntil(p, t, 'input');
    t = answer(p, t);
    runUntil(p, t, 'showing');
    expect(p.activeCurse).toBe(0);
    expect(p.roundSequence).toHaveLength(base + 1);
  });

  it('nunca gera três notas iguais seguidas', () => {
    const { p } = setup(DIFFICULTIES.easy, 7);
    p.start(0);
    let t = 0;
    for (let i = 0; i < 15; i++) {
      t = runUntil(p, t, 'input');
      const s = p.roundSequence;
      for (let j = 2; j < s.length; j++) expect(s[j] === s[j - 1] && s[j] === s[j - 2]).toBe(false);
      t = answer(p, t);
    }
  });
});
