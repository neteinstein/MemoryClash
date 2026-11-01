import { type PlayerId } from './config';
import type { Rng } from './rng';

/** 0 = neutra; 1–4 = jogador. */
export type Owner = 0 | PlayerId;

export interface CellChange {
  index: number;
  from: Owner;
  to: Owner;
}

/** Aleatoriedade na escolha das células: dá à fronteira um aspeto orgânico. */
const JITTER = 1.6;

/**
 * Tabuleiro partilhado. Cada jogador tem uma borda como "casa": a linha 0 é do jogador 1 (em baixo),
 * a última linha do jogador 2 (em cima), a coluna 0 do jogador 3 (esquerda) e a última coluna do
 * jogador 4 (direita). Os cantos partilhados por duas casas começam neutros.
 * Cada acerto expande a cor do jogador a partir do território que já tem; cada erro devolve
 * células da linha da frente à neutralidade.
 */
export type BoardShape = 'rect' | 'triangle';

export class Board {
  readonly shape: BoardShape;
  /** Retângulo: linhas. Triângulo: número de filas (= lado). */
  readonly depth: number;
  /** Retângulo: colunas. Triângulo: igual a `depth`. */
  readonly breadth: number;
  readonly cells: Uint8Array;
  readonly players: PlayerId[];

  constructor(depth: number, breadth: number, players: PlayerId[] = [1, 2], shape: BoardShape = 'rect') {
    if (depth < 2 || breadth < 1) throw new Error('Tabuleiro demasiado pequeno');
    this.shape = shape;
    this.depth = depth;
    this.breadth = breadth;
    this.players = players;
    this.cells = new Uint8Array(shape === 'triangle' ? depth * depth : depth * breadth);
    for (let i = 0; i < this.cells.length; i++) {
      const homes = players.filter((p) => this.distanceFromHome(p, i) === 0);
      if (homes.length === 1) this.cells[i] = homes[0];
    }
  }

  /**
   * Tabuleiro triangular para 3 jogadores: um triângulo de lado `side` feito de `side²` triângulos
   * pequenos (a fila r, a contar do vértice de cima, tem 2r+1). Casas: a base é do jogador 1 (em baixo),
   * o lado esquerdo do jogador 3 e o lado direito do jogador 2. Os três vértices começam neutros.
   */
  static triangle(side: number, players: PlayerId[] = [1, 2, 3]): Board {
    return new Board(side, side, players, 'triangle');
  }

  get size(): number {
    return this.cells.length;
  }

  /** Retângulo: (linha, coluna). Triângulo: (fila a partir do vértice, posição na fila 0..2·fila). */
  index(row: number, col: number): number {
    return this.shape === 'triangle' ? row * row + col : row * this.breadth + col;
  }

  rowOf(index: number): number {
    return this.shape === 'triangle' ? Math.floor(Math.sqrt(index)) : Math.floor(index / this.breadth);
  }

  colOf(index: number): number {
    if (this.shape === 'triangle') {
      const r = this.rowOf(index);
      return index - r * r;
    }
    return index % this.breadth;
  }

  /** Triângulo: as posições pares de cada fila apontam para cima, as ímpares para baixo. */
  pointsUp(index: number): boolean {
    return this.colOf(index) % 2 === 0;
  }

  owner(index: number): Owner {
    return this.cells[index] as Owner;
  }

  /** Distância (em linhas ou colunas) entre a célula e a borda que é a casa do jogador. */
  distanceFromHome(player: PlayerId, index: number): number {
    if (this.shape === 'triangle') {
      // Em "meios passos": cada triângulo pequeno fica a meia fila do vizinho.
      const r = this.rowOf(index);
      const k = this.colOf(index);
      switch (player) {
        case 1:
          return (2 * (this.depth - 1 - r) + (k % 2)) / 2;
        case 2:
          return (2 * r - k) / 2;
        case 3:
          return k / 2;
        default:
          return Infinity;
      }
    }
    switch (player) {
      case 1:
        return this.rowOf(index);
      case 2:
        return this.depth - 1 - this.rowOf(index);
      case 3:
        return this.colOf(index);
      case 4:
        return this.breadth - 1 - this.colOf(index);
    }
  }

  neighbors(index: number): number[] {
    const row = this.rowOf(index);
    const col = this.colOf(index);
    const out: number[] = [];
    if (this.shape === 'triangle') {
      // Lados partilhados: os dois vizinhos da fila e, para cima/baixo, o triângulo encostado.
      if (col > 0) out.push(index - 1);
      if (col < 2 * row) out.push(index + 1);
      if (col % 2 === 0) {
        if (row < this.depth - 1) out.push(this.index(row + 1, col + 1));
      } else {
        out.push(this.index(row - 1, col - 1));
      }
      return out;
    }
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
        if (this.distanceFromHome(player, i) === 0) out.push(i);
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
   * quando não há neutras ao alcance, rouba células aos adversários.
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
