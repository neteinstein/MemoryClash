import { describe, expect, it } from 'vitest';
import { gainFor, lossFor, type BoardSizeId } from '../src/game/config';
import { Match, type MatchEvent } from '../src/game/match';
import type { PlayerEngine } from '../src/game/player';

function setup(timeLimitSec = 0, boardSize: BoardSizeId = 'small') {
  const m = new Match({
    difficulties: { 1: 'easy', 2: 'normal' },
    boardSize,
    timeLimitSec,
    seed: 123,
  });
  const events: MatchEvent[] = [];
  m.on((e) => events.push(e));
  return { m, events };
}

function step(m: Match, t: number, until: () => boolean, limit = 600_000): number {
  while (!until()) {
    t += 10;
    m.update(t);
    if (t > limit) throw new Error('timeout');
  }
  return t;
}

function answer(m: Match, p: PlayerEngine, t: number): number {
  for (const key of p.roundSequence) {
    t += 50;
    m.press(p.id, key, t);
  }
  return t;
}

describe('Match', () => {
  it('acelera à medida que o fim do tempo se aproxima', () => {
    const { m } = setup(100);
    m.start(0);
    expect(m.rush(0)).toBe(1);
    expect(m.rush(50_000)).toBeLessThan(1);
    expect(m.rush(90_000)).toBeLessThan(m.rush(50_000));
    expect(m.rush(100_000)).toBeCloseTo(0.55);
    const free = setup(0).m;
    free.start(0);
    expect(free.rush(1e9)).toBe(1);
  });

  it('as sequências tocam mais depressa perto do fim', () => {
    const early = setup(100).m;
    early.start(0);
    const late = setup(100).m;
    late.start(0);
    const p = early.players[1];
    const q = late.players[1];
    // Primeira ronda de cada um: um começa logo, o outro já com 90% do tempo passado.
    let t = 0;
    while (p.phase !== 'input') { t += 10; early.update(t); }
    t = 90_000;
    q.phase = 'success';
    q.phaseStart = t - 10_000;
    late.update(t);
    expect(q.stepMs).toBeLessThan(p.stepMs);
  });

  it('ganha uma célula por cada nota da sequência acertada', () => {
    expect(gainFor(3)).toBe(3);
    expect(gainFor(12)).toBe(12);
  });

  it('um acerto expande o território do jogador', () => {
    const { m, events } = setup();
    m.start(0);
    const p1 = m.players[1];
    let t = step(m, 0, () => p1.phase === 'input');
    const before = m.board.count(1);
    const len = p1.roundSequence.length;
    t = answer(m, p1, t);
    expect(m.board.count(1)).toBe(before + gainFor(len));
    expect(events.some((e) => e.type === 'board' && e.reason === 'gain')).toBe(true);
  });

  it('um erro tira um bocadinho do tabuleiro', () => {
    const { m } = setup();
    m.start(0);
    const p2 = m.players[2];
    const t = step(m, 0, () => p2.phase === 'input');
    const before = m.board.count(2);
    m.press(2, (p2.roundSequence[0] + 1) % p2.difficulty.keys, t + 10);
    expect(m.board.count(2)).toBe(before - lossFor(before));
  });

  it('o diabinho amaldiçoa o adversário', () => {
    const { m, events } = setup(0, 'large');
    m.start(0);
    const p1 = m.players[1];
    let t = 0;
    // O jogador 2 nunca responde (vai errando por tempo), o jogador 1 acerta sempre.
    while (p1.stats.devilsSent === 0) {
      t = step(m, t, () => p1.phase === 'input');
      t = answer(m, p1, t);
    }
    expect(m.status).toBe('running');
    expect(events.some((e) => e.type === 'devil' && e.from === 1 && e.to === 2)).toBe(true);
    // A maldição só pega quando o diabinho aterra.
    expect(m.players[2].stats.devilsReceived).toBe(0);
    step(m, t, () => m.players[2].stats.devilsReceived > 0);
    expect(m.players[2].stats.devilsReceived).toBe(1);
    expect(m.players[2].pendingCurses + m.players[2].activeCurse).toBeGreaterThan(0);
  });

  it('ganha quem conquista o tabuleiro completo', () => {
    const { m, events } = setup();
    m.start(0);
    const p1 = m.players[1];
    let t = 0;
    while (m.status === 'running') {
      t = step(m, t, () => p1.phase === 'input' || m.status !== 'running');
      if (m.status !== 'running') break;
      t = answer(m, p1, t);
    }
    expect(m.board.conqueror()).toBe(1);
    expect(events.at(-1)).toEqual({ type: 'end', winner: 1, reason: 'conquest' });
    expect(m.players[2].phase).toBe('done');
  });

  it('com limite de tempo, ganha quem tiver mais território', () => {
    const { m, events } = setup(5);
    m.start(0);
    const p1 = m.players[1];
    let t = step(m, 0, () => p1.phase === 'input');
    t = answer(m, p1, t);
    step(m, t, () => m.status === 'ended');
    expect(events.at(-1)).toMatchObject({ type: 'end', winner: 1, reason: 'time' });
  });
});
