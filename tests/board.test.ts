import { describe, expect, it } from 'vitest';
import { Board } from '../src/game/board';
import { createRng } from '../src/game/rng';

describe('Board', () => {
  it('começa com a linha de casa de cada jogador', () => {
    const b = new Board(6, 9);
    expect(b.count(1)).toBe(9);
    expect(b.count(2)).toBe(9);
    expect(b.count(0)).toBe(6 * 9 - 18);
    for (let c = 0; c < 9; c++) {
      expect(b.owner(b.index(0, c))).toBe(1);
      expect(b.owner(b.index(5, c))).toBe(2);
    }
    expect(b.conqueror()).toBe(0);
  });

  it('expande primeiro para células neutras adjacentes', () => {
    const b = new Board(6, 9);
    const rng = createRng(1);
    for (let k = 0; k < 5; k++) {
      const frontier = b.frontier(1);
      const [ch] = b.expand(1, 1, rng);
      expect(frontier).toContain(ch.index); // sempre colada ao território que já tinha
      expect(ch.from).toBe(0);
      expect(ch.to).toBe(1);
      expect(b.rowOf(ch.index)).toBeLessThanOrEqual(2);
    }
    expect(b.count(1)).toBe(14);
  });

  it('rouba células ao adversário quando já não há neutras ao alcance', () => {
    const b = new Board(4, 3);
    b.expand(1, 3, createRng(2)); // linha 1 toda
    b.expand(2, 3, createRng(3)); // linha 2 toda: não há neutras
    expect(b.count(0)).toBe(0);
    const changes = b.expand(1, 2, createRng(4));
    expect(changes.every((c) => c.from === 2 && c.to === 1)).toBe(true);
    expect(b.count(1)).toBe(8);
    expect(b.count(2)).toBe(4);
  });

  it('perde células da linha da frente para a neutralidade', () => {
    const b = new Board(6, 9);
    for (let c = 0; c < 9; c++) b.cells[b.index(1, c)] = 1; // linhas 0 e 1
    const lost = b.shrink(1, 3, createRng(6));
    expect(lost).toHaveLength(3);
    for (const ch of lost) {
      expect(ch.to).toBe(0);
      expect(b.rowOf(ch.index)).toBe(1); // perde as da frente, não as de casa
    }
    expect(b.count(1)).toBe(15);
  });

  it('recomeça pela casa quando o jogador fica sem território', () => {
    const b = new Board(4, 3);
    b.shrink(2, 3, createRng(7));
    expect(b.count(2)).toBe(0);
    const changes = b.expand(2, 1, createRng(8));
    expect(b.rowOf(changes[0].index)).toBe(3);
    expect(b.count(2)).toBe(1);
  });

  it('deteta a conquista total', () => {
    const b = new Board(3, 2);
    b.expand(1, 10, createRng(9));
    expect(b.count(1)).toBe(6);
    expect(b.conqueror()).toBe(1);
    expect(b.expand(1, 1, createRng(10))).toHaveLength(0);
  });
});
