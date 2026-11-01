/** Regras e parâmetros de equilíbrio do jogo. */

export type PlayerId = 1 | 2 | 3 | 4;

/** Todos os lugares possíveis: J1 em baixo, J2 em cima, J3 à esquerda, J4 à direita. */
export const ALL_PLAYERS: PlayerId[] = [1, 2, 3, 4];

export type PlayerCount = 2 | 3 | 4;

/** Jogadores ativos para um número de jogadores. */
export function playersFor(count: number): PlayerId[] {
  return ALL_PLAYERS.slice(0, Math.min(4, Math.max(2, count)));
}

export type DifficultyId = 'easy' | 'normal' | 'hard' | 'nightmare';

export interface Difficulty {
  id: DifficultyId;
  label: string;
  hint: string;
  /** Número de teclas no teclado do jogador (4, 6 ou 8). */
  keys: number;
  /** Tamanho da primeira sequência. */
  startLength: number;
  /** Duração de cada passo da sequência no início (ms). */
  baseStepMs: number;
  /** Duração mínima de um passo (limite da aceleração). */
  minStepMs: number;
  /** Fator multiplicado ao passo por cada acerto (< 1 acelera). */
  accel: number;
  /** Tempo máximo entre toques durante a resposta (ms). */
  inputTimeoutMs: number;
}

export const DIFFICULTIES: Record<DifficultyId, Difficulty> = {
  easy: {
    id: 'easy',
    label: 'Fácil',
    hint: '4 teclas · calmo',
    keys: 4,
    startLength: 2,
    baseStepMs: 680,
    minStepMs: 380,
    accel: 0.95,
    inputTimeoutMs: 5000,
  },
  normal: {
    id: 'normal',
    label: 'Normal',
    hint: '4 teclas · rápido',
    keys: 4,
    startLength: 3,
    baseStepMs: 560,
    minStepMs: 280,
    accel: 0.93,
    inputTimeoutMs: 4000,
  },
  hard: {
    id: 'hard',
    label: 'Difícil',
    hint: '6 teclas · veloz',
    keys: 6,
    startLength: 3,
    baseStepMs: 480,
    minStepMs: 220,
    accel: 0.92,
    inputTimeoutMs: 3200,
  },
  nightmare: {
    id: 'nightmare',
    label: 'Pesadelo',
    hint: '8 teclas · alucinante',
    keys: 8,
    startLength: 4,
    baseStepMs: 420,
    minStepMs: 170,
    accel: 0.9,
    inputTimeoutMs: 2600,
  },
};

export const DIFFICULTY_ORDER: DifficultyId[] = ['easy', 'normal', 'hard', 'nightmare'];

export interface KeyDef {
  name: string;
  color: string;
  /** Frequência da nota (Hz). */
  freq: number;
}

/**
 * Teclas por ordem de aparecimento: as 4 primeiras são as clássicas; as seguintes
 * entram nos níveis com 6 e 8 teclas. As notas formam um acorde de Lá maior
 * alargado, por isso a sobreposição soa musical… mas confunde na mesma.
 */
export const KEYS: KeyDef[] = [
  { name: 'verde', color: '#22c55e', freq: 329.63 }, // Mi4
  { name: 'vermelho', color: '#ef4444', freq: 440.0 }, // Lá4
  { name: 'amarelo', color: '#facc15', freq: 554.37 }, // Dó#5
  { name: 'azul', color: '#3b82f6', freq: 659.25 }, // Mi5
  { name: 'laranja', color: '#f97316', freq: 493.88 }, // Si4
  { name: 'roxo', color: '#a855f7', freq: 739.99 }, // Fá#5
  { name: 'branco', color: '#e5e7eb', freq: 220.0 }, // Lá3
  { name: 'turquesa', color: '#14b8a6', freq: 277.18 }, // Dó#4
];


export type BoardSizeId = 'small' | 'medium' | 'large';

export interface BoardSize {
  id: BoardSizeId;
  label: string;
  /** Linhas entre a casa do J1 e a casa do J2. */
  depth: number;
  /** Largura (colunas ao longo da casa de cada jogador). */
  breadth: number;
  /** Lado do tabuleiro quadrado usado com 3 ou 4 jogadores. */
  square: number;
}

export const BOARD_SIZES: Record<BoardSizeId, BoardSize> = {
  small: { id: 'small', label: 'Pequeno', depth: 6, breadth: 9, square: 8 },
  medium: { id: 'medium', label: 'Médio', depth: 8, breadth: 12, square: 10 },
  large: { id: 'large', label: 'Grande', depth: 10, breadth: 15, square: 12 },
};

export const BOARD_SIZE_ORDER: BoardSizeId[] = ['small', 'medium', 'large'];

/** Limites de tempo em segundos (0 = sem limite: só a conquista total acaba o jogo). */
export const TIME_LIMITS = [0, 120, 180, 300] as const;
export type TimeLimit = (typeof TIME_LIMITS)[number];

/** Depois de um erro, a sequência recomeça com este número de notas. */
export const ERROR_RESET_LENGTH = 2;
/** Num jogo com tempo, a velocidade sobe até este fator (mais 45%) quando o tempo está a acabar. */
export const FINAL_RUSH = 0.45;

/**
 * Fator de velocidade (≤ 1) para a fração do tempo já passada: começa em 1 e desce cada vez
 * mais depressa à medida que o fim se aproxima.
 */
export function rushFactor(elapsedFraction: number): number {
  const f = Math.min(1, Math.max(0, elapsedFraction));
  return 1 - FINAL_RUSH * f * f;
}

/** Acertos seguidos necessários para soltar um diabinho no adversário. */
export const DEVIL_STREAK = 5;
/** Tempo que o diabinho demora a voar até ao adversário (a maldição só pega quando ele aterra). */
export const DEVIL_FLIGHT_MS = 1600;
/** Notas extra que cada diabinho acrescenta à próxima sequência do adversário. */
export const CURSE_EXTRA_NOTES = 3;
/** A sequência amaldiçoada toca mais depressa (multiplicador do passo). */
export const CURSE_SPEED_FACTOR = 0.65;
/** Passo mínimo absoluto, mesmo com maldição. */
export const CURSE_MIN_STEP_MS = 140;
/** Quantos diabinhos podem acumular sobre o mesmo jogador. */
export const MAX_PENDING_CURSES = 2;

/** Proporção do passo em que a tecla fica acesa (o resto é silêncio entre notas). */
export const NOTE_RATIO = 0.62;
/** Pausa antes da primeira nota de cada ronda. */
export const LEAD_IN_MS = 550;
/** Pausa depois de um acerto (o tabuleiro expande). */
export const SUCCESS_PAUSE_MS = 750;
/** Pausa depois de um erro (mostra a tecla certa). */
export const ERROR_PAUSE_MS = 1300;
/** O primeiro toque tem mais tempo, porque é preciso reagir ao fim da sequência. */
export const FIRST_INPUT_TIMEOUT_FACTOR = 1.5;

/** Células conquistadas por um acerto: uma por cada nota da sequência acertada. */
export function gainFor(sequenceLength: number): number {
  return Math.max(1, sequenceLength);
}

/** Células perdidas num erro: "um bocadinho" do que se tem. */
export function lossFor(owned: number): number {
  if (owned <= 0) return 0;
  return Math.min(owned, Math.max(2, Math.round(owned * 0.08)));
}

/** Duração de cada passo para um nível de velocidade. */
export function stepMsFor(difficulty: Difficulty, speedLevel: number, curse: number): number {
  const base = Math.max(difficulty.minStepMs, difficulty.baseStepMs * Math.pow(difficulty.accel, speedLevel));
  if (curse <= 0) return Math.round(base);
  return Math.round(Math.max(CURSE_MIN_STEP_MS, base * Math.pow(CURSE_SPEED_FACTOR, curse)));
}
