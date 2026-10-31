import { defaultAvatar, sanitizeAvatar, type Avatar } from './avatar';
import { BOARD_SIZES, DIFFICULTIES, TIME_LIMITS, type BoardSizeId, type DifficultyId, type PlayerId } from '../game/config';

export interface Settings {
  difficulties: Record<PlayerId, DifficultyId>;
  boardSize: BoardSizeId;
  timeLimitSec: number;
  /** Em retrato, roda a metade do jogador 2 (jogar frente a frente com o telemóvel na mesa). */
  rotateP2: boolean;
  muted: boolean;
  avatars: Record<PlayerId, Avatar>;
}

const KEY = 'memoryclash.settings.v1';

export const DEFAULT_SETTINGS: Settings = {
  difficulties: { 1: 'normal', 2: 'normal' },
  boardSize: 'medium',
  timeLimitSec: 0,
  rotateP2: true,
  muted: false,
  avatars: { 1: defaultAvatar(1), 2: defaultAvatar(2) },
};

export function loadSettings(): Settings {
  const s: Settings = structuredClone(DEFAULT_SETTINGS);
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return s;
    const data = JSON.parse(raw) as Partial<Settings>;
    for (const id of [1, 2] as PlayerId[]) {
      const d = data.difficulties?.[id];
      if (d && d in DIFFICULTIES) s.difficulties[id] = d;
    }
    if (data.boardSize && data.boardSize in BOARD_SIZES) s.boardSize = data.boardSize;
    if (typeof data.timeLimitSec === 'number' && (TIME_LIMITS as readonly number[]).includes(data.timeLimitSec)) {
      s.timeLimitSec = data.timeLimitSec;
    }
    if (typeof data.rotateP2 === 'boolean') s.rotateP2 = data.rotateP2;
    if (typeof data.muted === 'boolean') s.muted = data.muted;
    for (const id of [1, 2] as PlayerId[]) s.avatars[id] = sanitizeAvatar(data.avatars?.[id], id);
  } catch {
    // Sem armazenamento disponível (modo privado, etc.): usa os valores por omissão.
  }
  return s;
}

export function saveSettings(s: Settings): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    // Ignorar: as definições ficam só para esta sessão.
  }
}
