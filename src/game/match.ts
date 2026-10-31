import { Board, type CellChange, type Owner } from './board';
import {
  BOARD_SIZES,
  DEVIL_FLIGHT_MS,
  DIFFICULTIES,
  rushFactor,
  gainFor,
  lossFor,
  type BoardSizeId,
  type DifficultyId,
  type PlayerId,
} from './config';
import { PlayerEngine, type PlayerEvent } from './player';
import { createRng, type Rng } from './rng';

export interface MatchOptions {
  difficulties: Record<PlayerId, DifficultyId>;
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

export function opponentOf(player: PlayerId): PlayerId {
  return player === 1 ? 2 : 1;
}

/** Junta os dois jogadores e o tabuleiro, e aplica as regras de conquista. */
export class Match {
  readonly options: MatchOptions;
  readonly board: Board;
  readonly players: Record<PlayerId, PlayerEngine>;
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
    const size = BOARD_SIZES[options.boardSize];
    this.board = new Board(size.depth, size.breadth);
    // Cada jogador tem o seu próprio gerador para que as sequências sejam independentes.
    this.players = {
      1: new PlayerEngine(1, DIFFICULTIES[options.difficulties[1]], createRng(seed ^ 0x1234567)),
      2: new PlayerEngine(2, DIFFICULTIES[options.difficulties[2]], createRng(seed ^ 0x7654321)),
    };
    for (const id of [1, 2] as PlayerId[]) {
      this.players[id].on((e) => this.onPlayerEvent(id, e));
    }
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
    this.players[1].start(now);
    this.players[2].start(now);
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
    this.players[1].rush = rush;
    this.players[2].rush = rush;
    this.players[1].update(now);
    if (this.status !== 'running') return;
    this.players[2].update(now);
    if (this.status !== 'running') return;
    const left = this.timeLeft(now);
    if (left !== null && left <= 0) {
      const p1 = this.board.count(1);
      const p2 = this.board.count(2);
      this.end(p1 === p2 ? 0 : p1 > p2 ? 1 : 2, 'time');
    }
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
        // Se o erro deixar o adversário com o tabuleiro todo (só possível se o tabuleiro não tiver neutras),
        // o adversário ganha.
        const conqueror = this.board.conqueror();
        if (conqueror !== 0) this.end(conqueror, 'conquest');
        break;
      }
      case 'devil': {
        const to = opponentOf(player);
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
    this.players[1].stop();
    this.players[2].stop();
    this.emit({ type: 'end', winner, reason });
  }

  /** Termina o jogo sem vencedor (ex.: voltar ao menu). */
  abort(): void {
    this.status = 'ended';
    this.players[1].stop();
    this.players[2].stop();
  }
}
