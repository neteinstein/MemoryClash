import type { PlayerId } from './config';
import type { Rng } from './rng';

/** 0 = neutra, 1 = jogador 1, 2 = jogador 2. */
export type Owner = 0 | PlayerId;

export interface CellChange {
  index: number;
  from: Owner;
  to: Owner;
}

/** Aleatoriedade na escolha das células: dá à fronteira um aspeto orgânico. */
const JITTER = 1.6;

/**
 * Tabuleiro partilhado. A linha 0 é a "casa" do jogador 1 e a última linha a casa do jogador 2.
 * Cada acerto expande a cor do jogador a partir do território que já tem; cada erro devolve
 * células da linha da frente à neutralidade.
 */
export class Board {
  readonly depth: number;
  readonly breadth: number;
  readonly cells: Uint8Array;

  constructor(depth: number, breadth: number) {
    if (depth < 2 || breadth < 1) throw new Error('Tabuleiro demasiado pequeno');
    this.depth = depth;
    this.breadth = breadth;
    this.cells = new Uint8Array(depth * breadth);
    for (let c = 0; c < breadth; c++) {
      this.cells[this.index(this.homeRow(1), c)] = 1;
      this.cells[this.index(this.homeRow(2), c)] = 2;
    }
  }

  get size(): number {
    return this.cells.length;
  }

  index(row: number, col: number): number {
    return row * this.breadth + col;
  }

  rowOf(index: number): number {
    return Math.floor(index / this.breadth);
  }

  colOf(index: number): number {
    return index % this.breadth;
  }

  owner(index: number): Owner {
    return this.cells[index] as Owner;
  }

  homeRow(player: PlayerId): number {
    return player === 1 ? 0 : this.depth - 1;
  }

  /** Distância (em linhas) entre a célula e a casa do jogador. */
  distanceFromHome(player: PlayerId, index: number): number {
    const row = this.rowOf(index);
    return player === 1 ? row : this.depth - 1 - row;
  }

  neighbors(index: number): number[] {
    const row = this.rowOf(index);
    const col = this.colOf(index);
    const out: number[] = [];
    if (row > 0) out.push(index - this.breadth);
    if (row < this.depth - 1) out.push(index + this.breadth);
    if (col > 0) out.push(index - 1);
    if (col < this.breadth - 1) out.push(index + 1);
    return out;
  }

  count(owner: Owner): number {
    let n = 0;
    for (let i = 0; i < this.cells.length; i++) if (this.cells[i] === owner) n++;
    return n;
  }

  /** Percentagem (0–100) do tabuleiro que pertence ao dono indicado. */
  share(owner: Owner): number {
    return (this.count(owner) / this.size) * 100;
  }

  /** Devolve o jogador que conquistou o tabuleiro inteiro, ou 0. */
  conqueror(): Owner {
    const first = this.cells[0] as Owner;
    if (first === 0) return 0;
    for (let i = 1; i < this.cells.length; i++) if (this.cells[i] !== first) return 0;
    return first;
  }

  /** Células que o jogador pode conquistar já: vizinhas do seu território (ou da sua casa, se não tiver nada). */
  frontier(player: PlayerId): number[] {
    const out: number[] = [];
    const hasAny = this.count(player) > 0;
    for (let i = 0; i < this.cells.length; i++) {
      if (this.cells[i] === player) continue;
      if (!hasAny) {
        if (this.rowOf(i) === this.homeRow(player)) out.push(i);
        continue;
      }
      if (this.neighbors(i).some((n) => this.cells[n] === player)) out.push(i);
    }
    return out;
  }

  /** Células do jogador que tocam em território que não é dele (a linha da frente). */
  border(player: PlayerId): number[] {
    const out: number[] = [];
    for (let i = 0; i < this.cells.length; i++) {
      if (this.cells[i] !== player) continue;
      if (this.neighbors(i).some((n) => this.cells[n] !== player)) out.push(i);
    }
    return out;
  }

  /**
   * Expande o território do jogador em `amount` células. Primeiro ocupa células neutras;
   * quando não há neutras ao alcance, rouba células ao adversário.
   */
  expand(player: PlayerId, amount: number, rng: Rng): CellChange[] {
    const changes: CellChange[] = [];
    for (let k = 0; k < amount; k++) {
      const frontier = this.frontier(player);
      if (frontier.length === 0) break;
      const neutral = frontier.filter((i) => this.cells[i] === 0);
      const pool = neutral.length > 0 ? neutral : frontier;
      let best = pool[0];
      let bestScore = Infinity;
      for (const i of pool) {
        const score = this.distanceFromHome(player, i) + rng() * JITTER;
        if (score < bestScore) {
          bestScore = score;
          best = i;
        }
      }
      changes.push({ index: best, from: this.cells[best] as Owner, to: player });
      this.cells[best] = player;
    }
    return changes;
  }

  /** Retira `amount` células da linha da frente do jogador, devolvendo-as à neutralidade. */
  shrink(player: PlayerId, amount: number, rng: Rng): CellChange[] {
    const changes: CellChange[] = [];
    for (let k = 0; k < amount; k++) {
      let pool = this.border(player);
      if (pool.length === 0) {
        pool = [];
        for (let i = 0; i < this.cells.length; i++) if (this.cells[i] === player) pool.push(i);
      }
      if (pool.length === 0) break;
      let best = pool[0];
      let bestScore = -Infinity;
      for (const i of pool) {
        const score = this.distanceFromHome(player, i) + rng() * JITTER;
        if (score > bestScore) {
          bestScore = score;
          best = i;
        }
      }
      changes.push({ index: best, from: player, to: 0 });
      this.cells[best] = 0;
    }
    return changes;
  }
}
