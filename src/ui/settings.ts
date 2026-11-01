import { defaultAvatar, paletteOf, sanitizeAvatar, SKINS, type Avatar } from './avatar';
import { ALL_PLAYERS, BOARD_SIZES, DIFFICULTIES, playersFor, TIME_LIMITS, type BoardSizeId, type DifficultyId, type PlayerCount, type PlayerId } from '../game/config';

export interface Settings {
  difficulties: Record<PlayerId, DifficultyId>;
  boardSize: BoardSizeId;
  timeLimitSec: number;
  /** Em retrato, roda a metade do jogador 2 (jogar frente a frente com o telemóvel na mesa). */
  rotateP2: boolean;
  muted: boolean;
  avatars: Record<PlayerId, Avatar>;
  /** Número de jogadores escolhido (só se usa mais de 2 em ecrãs grandes). */
  playerCount: PlayerCount;
}

/** 3 ou 4 jogadores só em ecrãs grandes (tablets), onde há espaço para um teclado em cada lado. */
export function bigScreen(): boolean {
  return Math.min(window.innerWidth, window.innerHeight) >= 600;
}

/** Jogadores que vão jogar com as definições e o ecrã atuais. */
export function activePlayers(s: Settings): PlayerId[] {
  return playersFor(bigScreen() ? s.playerCount : 2);
}

const KEY = 'memoryclash.settings.v1';
const SETTINGS_VERSION = 2;

export const DEFAULT_SETTINGS: Settings = {
  difficulties: { 1: 'normal', 2: 'normal', 3: 'normal', 4: 'normal' },
  boardSize: 'small',
  timeLimitSec: 120,
  rotateP2: true,
  muted: false,
  avatars: { 1: defaultAvatar(1), 2: defaultAvatar(2), 3: defaultAvatar(3), 4: defaultAvatar(4) },
  playerCount: 2,
};

export function loadSettings(): Settings {
  const s: Settings = structuredClone(DEFAULT_SETTINGS);
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return s;
    const data = JSON.parse(raw) as Partial<Settings>;
    for (const id of ALL_PLAYERS) {
      const d = data.difficulties?.[id];
      if (d && d in DIFFICULTIES) s.difficulties[id] = d;
    }
    // Definições guardadas antes da versão 2 ficaram com os valores por omissão antigos
    // (tabuleiro médio, sem tempo): passam para os novos (tabuleiro pequeno, 2 min).
    const current = (data as { version?: number }).version === SETTINGS_VERSION;
    if (current && data.boardSize && data.boardSize in BOARD_SIZES) s.boardSize = data.boardSize;
    if (current && typeof data.timeLimitSec === 'number' && (TIME_LIMITS as readonly number[]).includes(data.timeLimitSec)) {
      s.timeLimitSec = data.timeLimitSec;
    }
    if (typeof data.rotateP2 === 'boolean') s.rotateP2 = data.rotateP2;
    if (typeof data.muted === 'boolean') s.muted = data.muted;
    if (data.playerCount === 3 || data.playerCount === 4) s.playerCount = data.playerCount;
    for (const id of ALL_PLAYERS) s.avatars[id] = sanitizeAvatar(data.avatars?.[id], id);
    // A cor do avatar é a cor do jogador no tabuleiro: todos têm de ser diferentes.
    const used = new Set<string>();
    for (const id of ALL_PLAYERS) {
      if (used.has(s.avatars[id].skin)) s.avatars[id].skin = SKINS.find((c) => !used.has(c)) ?? SKINS[0];
      used.add(s.avatars[id].skin);
    }
  } catch {
    // Sem armazenamento disponível (modo privado, etc.): usa os valores por omissão.
  }
  return s;
}

export function saveSettings(s: Settings): void {
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...s, version: SETTINGS_VERSION }));
  } catch {
    // Ignorar: as definições ficam só para esta sessão.
  }
}

export interface PlayerTheme {
  name: string;
  color: string;
  dark: string;
  light: string;
  glow: string;
}

/** A cor do jogador é a cor do seu avatar. */
export function playerTheme(s: Settings, player: PlayerId): PlayerTheme {
  const c = paletteOf(s.avatars[player].skin);
  return { name: s.avatars[player].name, color: c.main, dark: c.dark, light: c.light, glow: withAlpha(c.main, 0.55) };
}

/** Variáveis CSS de um jogador (--pc, --pcd, --pcl, --pglow). */
export function zoneVars(t: PlayerTheme): string {
  return `--pc:${t.color};--pcd:${t.dark};--pcl:${t.light};--pglow:${t.glow}`;
}

/** Variáveis CSS com as cores de todos os jogadores (tabuleiro, barra de território, logótipo). */
export function themeVars(s: Settings): string {
  return ALL_PLAYERS.map((id) => {
    const t = playerTheme(s, id);
    return `--p${id}:${t.color};--p${id}d:${t.dark};--p${id}glow:${t.glow}`;
  }).join(';');
}

function withAlpha(hex: string, alpha: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}
