import {
  CURSE_EXTRA_NOTES,
  DEVIL_STREAK,
  ERROR_PAUSE_MS,
  FIRST_INPUT_TIMEOUT_FACTOR,
  LEAD_IN_MS,
  MAX_PENDING_CURSES,
  NOTE_RATIO,
  SUCCESS_PAUSE_MS,
  stepMsFor,
  type Difficulty,
  type PlayerId,
} from './config';
import { randomInt, type Rng } from './rng';

export type Phase = 'waiting' | 'showing' | 'input' | 'success' | 'error' | 'done';

export type PlayerEvent =
  | { type: 'round'; length: number; stepMs: number; curse: number }
  | { type: 'show'; key: number; index: number; durationMs: number }
  | { type: 'input'; timeoutMs: number }
  | { type: 'press'; key: number; index: number; correct: boolean }
  | { type: 'success'; length: number; streak: number; cursed: boolean }
  | { type: 'error'; reason: 'wrong' | 'timeout'; expected: number; pressed: number | null; cursed: boolean }
  | { type: 'devil'; streak: number }
  | { type: 'cursed'; pending: number };

export interface PlayerStats {
  successes: number;
  errors: number;
  bestStreak: number;
  bestLength: number;
  devilsSent: number;
  devilsReceived: number;
}

/**
 * Máquina de estados de um jogador: mostra a sequência, espera a resposta e decide
 * acerto/erro. É conduzida por um relógio externo (`update(now)`), o que permite
 * pausar o jogo e testar tudo de forma determinística.
 */
export class PlayerEngine {
  readonly id: PlayerId;
  readonly difficulty: Difficulty;
  private readonly rng: Rng;
  private readonly listeners: Array<(e: PlayerEvent) => void> = [];

  /** Sequência base (cresce uma nota por acerto). */
  sequence: number[] = [];
  /** Sequência desta ronda (a base, mais notas extra se houver maldição). */
  roundSequence: number[] = [];
  phase: Phase = 'waiting';
  phaseStart = 0;
  stepMs = 0;
  speedLevel = 0;
  streak = 0;
  pendingCurses = 0;
  activeCurse = 0;
  showIndex = 0;
  inputIndex = 0;
  lastInputAt = 0;
  readonly stats: PlayerStats = {
    successes: 0,
    errors: 0,
    bestStreak: 0,
    bestLength: 0,
    devilsSent: 0,
    devilsReceived: 0,
  };

  constructor(id: PlayerId, difficulty: Difficulty, rng: Rng) {
    this.id = id;
    this.difficulty = difficulty;
    this.rng = rng;
  }

  on(listener: (e: PlayerEvent) => void): void {
    this.listeners.push(listener);
  }

  private emit(e: PlayerEvent): void {
    for (const l of this.listeners) l(e);
  }

  start(now: number): void {
    this.sequence = this.randomSequence(this.difficulty.startLength);
    this.beginRound(now);
  }

  stop(): void {
    this.phase = 'done';
  }

  get isActive(): boolean {
    return this.phase !== 'done' && this.phase !== 'waiting';
  }

  /** Tempo limite para o próximo toque. */
  get inputTimeoutMs(): number {
    const t = this.difficulty.inputTimeoutMs;
    return this.inputIndex === 0 ? t * FIRST_INPUT_TIMEOUT_FACTOR : t;
  }

  /** Fração (0–1) do tempo de resposta que ainda resta. */
  inputTimeLeft(now: number): number {
    if (this.phase !== 'input') return 0;
    const left = 1 - (now - this.lastInputAt) / this.inputTimeoutMs;
    return Math.max(0, Math.min(1, left));
  }

  /** Recebe um diabinho do adversário: a próxima sequência fica mais difícil. */
  receiveCurse(): void {
    if (this.phase === 'done') return;
    this.pendingCurses = Math.min(MAX_PENDING_CURSES, this.pendingCurses + 1);
    this.stats.devilsReceived++;
    this.emit({ type: 'cursed', pending: this.pendingCurses });
  }

  update(now: number): void {
    switch (this.phase) {
      case 'showing': {
        const len = this.roundSequence.length;
        while (this.showIndex < len && now >= this.phaseStart + this.showIndex * this.stepMs) {
          this.emit({
            type: 'show',
            key: this.roundSequence[this.showIndex],
            index: this.showIndex,
            durationMs: Math.round(this.stepMs * NOTE_RATIO),
          });
          this.showIndex++;
        }
        const showEnd = this.phaseStart + (len - 1) * this.stepMs + this.stepMs * NOTE_RATIO;
        if (this.showIndex >= len && now >= showEnd) {
          this.phase = 'input';
          this.inputIndex = 0;
          this.lastInputAt = now;
          this.emit({ type: 'input', timeoutMs: this.inputTimeoutMs });
        }
        break;
      }
      case 'input':
        if (now - this.lastInputAt > this.inputTimeoutMs) this.fail(now, 'timeout', null);
        break;
      case 'success':
        if (now - this.phaseStart >= SUCCESS_PAUSE_MS) this.beginRound(now);
        break;
      case 'error':
        if (now - this.phaseStart >= ERROR_PAUSE_MS) this.beginRound(now);
        break;
      default:
        break;
    }
  }

  /**
   * Toque numa tecla. Só conta durante a fase de resposta; devolve `null` se foi ignorado,
   * `true` se estava certo e `false` se errou.
   */
  press(key: number, now: number): boolean | null {
    if (this.phase !== 'input') return null;
    if (key < 0 || key >= this.difficulty.keys) return null;
    const index = this.inputIndex;
    const expected = this.roundSequence[index];
    if (key !== expected) {
      this.emit({ type: 'press', key, index, correct: false });
      this.fail(now, 'wrong', key);
      return false;
    }
    this.inputIndex++;
    this.lastInputAt = now;
    this.emit({ type: 'press', key, index, correct: true });
    if (this.inputIndex >= this.roundSequence.length) this.succeed(now);
    return true;
  }

  private beginRound(now: number): void {
    this.activeCurse = this.pendingCurses;
    this.pendingCurses = 0;
    this.roundSequence = this.activeCurse > 0
      ? this.sequence.concat(this.randomSequence(CURSE_EXTRA_NOTES * this.activeCurse, this.sequence))
      : this.sequence.slice();
    this.stepMs = stepMsFor(this.difficulty, this.speedLevel, this.activeCurse);
    this.phase = 'showing';
    this.phaseStart = now + LEAD_IN_MS;
    this.showIndex = 0;
    this.inputIndex = 0;
    this.emit({ type: 'round', length: this.roundSequence.length, stepMs: this.stepMs, curse: this.activeCurse });
  }

  private succeed(now: number): void {
    const length = this.roundSequence.length;
    const cursed = this.activeCurse > 0;
    this.streak++;
    this.speedLevel++;
    this.stats.successes++;
    this.stats.bestStreak = Math.max(this.stats.bestStreak, this.streak);
    this.stats.bestLength = Math.max(this.stats.bestLength, length);
    // A sequência continua a crescer: a nova nota é a primeira das notas extra (se houve maldição),
    // por isso a próxima ronda continua a ser um prolongamento do que acabou de se ouvir.
    if (cursed) {
      this.sequence = this.roundSequence.slice(0, this.sequence.length + 1);
    } else {
      this.sequence.push(this.nextKey(this.sequence));
    }
    this.activeCurse = 0;
    this.phase = 'success';
    this.phaseStart = now;
    this.emit({ type: 'success', length, streak: this.streak, cursed });
    if (this.streak % DEVIL_STREAK === 0) {
      this.stats.devilsSent++;
      this.emit({ type: 'devil', streak: this.streak });
    }
  }

  private fail(now: number, reason: 'wrong' | 'timeout', pressed: number | null): void {
    const expected = this.roundSequence[this.inputIndex];
    const cursed = this.activeCurse > 0;
    this.streak = 0;
    this.speedLevel = Math.max(0, this.speedLevel - 2);
    this.stats.errors++;
    // Depois de um erro, uma sequência nova e um pouco mais curta.
    const nextLength = Math.max(this.difficulty.startLength, this.sequence.length - 1);
    this.sequence = this.randomSequence(nextLength);
    this.activeCurse = 0;
    this.phase = 'error';
    this.phaseStart = now;
    this.emit({ type: 'error', reason, expected, pressed, cursed });
  }

  private randomSequence(length: number, prefix: number[] = []): number[] {
    const out: number[] = [];
    for (let i = 0; i < length; i++) out.push(this.nextKey(prefix.concat(out)));
    return out;
  }

  /** Nova nota aleatória, evitando três notas iguais seguidas. */
  private nextKey(previous: number[]): number {
    const keys = this.difficulty.keys;
    const n = previous.length;
    const banned = n >= 2 && previous[n - 1] === previous[n - 2] ? previous[n - 1] : -1;
    let key = randomInt(this.rng, keys);
    if (key === banned) key = (key + 1 + randomInt(this.rng, keys - 1)) % keys;
    return key;
  }
}
