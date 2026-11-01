import { Board, type CellChange, type Owner } from './board';
import {
  BOARD_SIZES,
  DEVIL_FLIGHT_MS,
  DIFFICULTIES,
  rushFactor,
  gainFor,
  lossFor,
  playersFor,
  type BoardSizeId,
  type DifficultyId,
  type PlayerId,
} from './config';
import { PlayerEngine, type PlayerEvent } from './player';
import { createRng, type Rng } from './rng';

export interface MatchOptions {
  difficulties: Partial<Record<PlayerId, DifficultyId>>;
  /** Número de jogadores (2 a 4); por omissão 2. */
  players?: number;
  boardSize: BoardSizeId;
  /** Segundos; 0 = sem limite. */
  timeLimitSec: number;
  seed?: number;
}

export type EndReason = 'conquest' | 'time';

export type MatchEvent =
  | { type: 'player'; player: PlayerId; event: PlayerEvent }
  | { type: 'board'; player: PlayerId; changes: CellChange[]; reason: 'gain' | 'loss' }
  | { type: 'devil'; from: PlayerId; to: PlayerId }
  | { type: 'end'; winner: Owner; reason: EndReason };

/** Sementes por lugar (as dos jogadores 1 e 2 mantêm-se para as partidas a dois). */
const SEED_SALT: Record<PlayerId, number> = { 1: 0x1234567, 2: 0x7654321, 3: 0x2468ace, 4: 0x13579bd };

/** Junta os jogadores e o tabuleiro, e aplica as regras de conquista. */
export class Match {
  readonly options: MatchOptions;
  readonly board: Board;
  /** Só os lugares em jogo têm motor (ver `ids`). */
  readonly players: Record<PlayerId, PlayerEngine>;
  /** Jogadores em jogo, por ordem. */
  readonly ids: PlayerId[];
  private readonly rng: Rng;
  private readonly listeners: Array<(e: MatchEvent) => void> = [];
  status: 'ready' | 'running' | 'ended' = 'ready';
  startedAt = 0;
  winner: Owner = 0;
  endReason: EndReason | null = null;
  /** Diabinhos em voo: amaldiçoam o alvo quando aterram. */
  private devilsInFlight: Array<{ to: PlayerId; landsAt: number }> = [];
  private now = 0;

  constructor(options: MatchOptions) {
    this.options = options;
    const seed = options.seed ?? Math.floor(Math.random() * 2 ** 31);
    this.rng = createRng(seed);
    this.ids = playersFor(options.players ?? 2);
    const size = BOARD_SIZES[options.boardSize];
    // A dois, o tabuleiro é comprido (uma casa em cada ponta); a três é um triângulo (uma casa por lado);
    // a quatro é quadrado.
    this.board =
      this.ids.length === 3
        ? Board.triangle(size.square, this.ids)
        : this.ids.length === 4
          ? new Board(size.square, size.square, this.ids)
          : new Board(size.depth, size.breadth, this.ids);
    // Cada jogador tem o seu próprio gerador para que as sequências sejam independentes.
    const players = {} as Record<PlayerId, PlayerEngine>;
    for (const id of this.ids) {
      const difficulty = DIFFICULTIES[options.difficulties[id] ?? 'normal'];
      players[id] = new PlayerEngine(id, difficulty, createRng(seed ^ SEED_SALT[id]));
      players[id].on((e) => this.onPlayerEvent(id, e));
    }
    this.players = players;
  }

  on(listener: (e: MatchEvent) => void): void {
    this.listeners.push(listener);
  }

  private emit(e: MatchEvent): void {
    for (const l of this.listeners) l(e);
  }

  start(now: number): void {
    if (this.status !== 'ready') return;
    this.status = 'running';
    this.now = now;
    this.startedAt = now;
    for (const id of this.ids) this.players[id].start(now);
  }

  /** Segundos que faltam (ou `null` sem limite de tempo). */
  timeLeft(now: number): number | null {
    if (this.options.timeLimitSec <= 0) return null;
    const elapsed = this.status === 'ready' ? 0 : (now - this.startedAt) / 1000;
    return Math.max(0, this.options.timeLimitSec - elapsed);
  }

  /** Fator de velocidade pelo tempo (1 sem limite de tempo; desce até 0,55 no fim). */
  rush(now: number): number {
    if (this.options.timeLimitSec <= 0 || this.status === 'ready') return 1;
    return rushFactor((now - this.startedAt) / 1000 / this.options.timeLimitSec);
  }

  update(now: number): void {
    if (this.status !== 'running') return;
    this.now = now;
    if (this.devilsInFlight.length > 0) {
      const landed = this.devilsInFlight.filter((d) => now >= d.landsAt);
      this.devilsInFlight = this.devilsInFlight.filter((d) => now < d.landsAt);
      for (const d of landed) this.players[d.to].receiveCurse();
    }
    // Num jogo com tempo, as sequências aceleram à medida que o fim se aproxima.
    const rush = this.rush(now);
    for (const id of this.ids) {
      this.players[id].rush = rush;
      this.players[id].update(now);
      if (this.status !== 'running') return;
    }
    const left = this.timeLeft(now);
    if (left !== null && left <= 0) this.end(this.leader(), 'time');
  }

  /** Quem tem mais território (0 se houver empate no primeiro lugar). */
  leader(): Owner {
    let best: Owner = 0;
    let bestCount = -1;
    let tie = false;
    for (const id of this.ids) {
      const n = this.board.count(id);
      if (n > bestCount) {
        best = id;
        bestCount = n;
        tie = false;
      } else if (n === bestCount) {
        tie = true;
      }
    }
    return tie ? 0 : best;
  }

  /** Alvo do diabinho: o único adversário a dois; com mais jogadores, o adversário com mais território. */
  devilTarget(from: PlayerId): PlayerId {
    const others = this.ids.filter((id) => id !== from);
    let target = others[0];
    for (const id of others) if (this.board.count(id) > this.board.count(target)) target = id;
    return target;
  }

  press(player: PlayerId, key: number, now: number): boolean | null {
    if (this.status !== 'running') return null;
    this.now = now;
    return this.players[player].press(key, now);
  }

  private onPlayerEvent(player: PlayerId, event: PlayerEvent): void {
    if (this.status !== 'running') return;
    this.emit({ type: 'player', player, event });
    switch (event.type) {
      case 'success': {
        const changes = this.board.expand(player, gainFor(event.length), this.rng);
        this.emit({ type: 'board', player, changes, reason: 'gain' });
        const conqueror = this.board.conqueror();
        if (conqueror !== 0) this.end(conqueror, 'conquest');
        break;
      }
      case 'error': {
        const changes = this.board.shrink(player, lossFor(this.board.count(player)), this.rng);
        this.emit({ type: 'board', player, changes, reason: 'loss' });
        // Se o erro deixar outro jogador com o tabuleiro todo (só possível se o tabuleiro não tiver neutras),
        // esse jogador ganha.
        const conqueror = this.board.conqueror();
        if (conqueror !== 0) this.end(conqueror, 'conquest');
        break;
      }
      case 'devil': {
        const to = this.devilTarget(player);
        this.devilsInFlight.push({ to, landsAt: this.now + DEVIL_FLIGHT_MS });
        this.emit({ type: 'devil', from: player, to });
        break;
      }
      default:
        break;
    }
  }

  private end(winner: Owner, reason: EndReason): void {
    if (this.status === 'ended') return;
    this.status = 'ended';
    this.winner = winner;
    this.endReason = reason;
    for (const id of this.ids) this.players[id].stop();
    this.emit({ type: 'end', winner, reason });
  }

  /** Termina o jogo sem vencedor (ex.: voltar ao menu). */
  abort(): void {
    this.status = 'ended';
    for (const id of this.ids) this.players[id].stop();
  }
}
