import { describe, expect, it } from 'vitest';
import { Board } from '../src/game/board';
import { Match, type MatchEvent } from '../src/game/match';
import { createRng } from '../src/game/rng';
import type { PlayerEngine } from '../src/game/player';

describe('3 e 4 jogadores', () => {
  it('cada jogador começa numa borda diferente, com os cantos neutros', () => {
    const b = new Board(8, 8, [1, 2, 3, 4]);
    for (const p of [1, 2, 3, 4] as const) expect(b.count(p)).toBe(6);
    expect(b.owner(b.index(0, 0))).toBe(0);
    expect(b.owner(b.index(0, 3))).toBe(1);
    expect(b.owner(b.index(7, 3))).toBe(2);
    expect(b.owner(b.index(3, 0))).toBe(3);
    expect(b.owner(b.index(3, 7))).toBe(4);
  });

  it('com 3 jogadores a borda direita fica livre', () => {
    const b = new Board(8, 8, [1, 2, 3]);
    expect(b.count(1)).toBe(7);
    expect(b.count(3)).toBe(6);
    expect(b.owner(b.index(3, 7))).toBe(0);
  });

  it('o jogador 3 cresce a partir da esquerda', () => {
    const b = new Board(8, 8, [1, 2, 3, 4]);
    const changes = b.expand(3, 6, createRng(1));
    for (const ch of changes) expect(b.colOf(ch.index)).toBeLessThanOrEqual(2);
  });

  it('a partida a 4 usa um tabuleiro quadrado e todos jogam', () => {
    const m = new Match({ difficulties: { 1: 'easy', 2: 'easy', 3: 'easy', 4: 'easy' }, players: 4, boardSize: 'small', timeLimitSec: 0, seed: 7 });
    expect(m.ids).toEqual([1, 2, 3, 4]);
    expect(m.board.depth).toBe(m.board.breadth);
    m.start(0);
    for (const id of m.ids) expect(m.players[id].phase).toBe('showing');
  });

  it('o diabinho vai para o adversário com mais território', () => {
    const m = new Match({ difficulties: { 1: 'easy', 2: 'easy', 3: 'easy', 4: 'easy' }, players: 4, boardSize: 'large', timeLimitSec: 0, seed: 9 });
    const events: MatchEvent[] = [];
    m.on((e) => events.push(e));
    // O jogador 4 fica com mais território do que os outros.
    m.board.expand(4, 10, createRng(2));
    m.start(0);
    const p1: PlayerEngine = m.players[1];
    let t = 0;
    while (p1.stats.devilsSent === 0) {
      while (p1.phase !== 'input') { t += 10; m.update(t); }
      for (const key of p1.roundSequence) { t += 50; m.press(1, key, t); }
    }
    expect(events.find((e) => e.type === 'devil')).toMatchObject({ from: 1, to: 4 });
  });

  it('com tempo, ganha quem tem mais território; empate no topo não tem vencedor', () => {
    const m = new Match({ difficulties: {}, players: 3, boardSize: 'small', timeLimitSec: 1, seed: 3 });
    m.start(0);
    expect(m.leader()).toBe(0); // J1 e J2 começam ambos com 7 células
    m.board.expand(1, 1, createRng(4));
    expect(m.leader()).toBe(1);
  });
});
