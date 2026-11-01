/**
 * Avatares personalizáveis: cada jogador escolhe corpo, cor, olhos, boca, acessório e nome.
 * Tudo é desenhado em SVG (viewBox 0–100), por isso fica nítido em qualquer tamanho.
 * Durante o jogo o avatar muda de expressão (contente, tonto, assustado).
 */

export const BODIES = ['blob', 'robot', 'cat', 'bear', 'alien', 'ghost'] as const;
export const EYES = ['round', 'happy', 'sleepy', 'cyclops', 'hearts', 'angry'] as const;
export const MOUTHS = ['smile', 'grin', 'open', 'tongue', 'fangs', 'o'] as const;
export const EXTRAS = ['none', 'crown', 'tophat', 'cap', 'glasses', 'shades', 'bow', 'headphones', 'horns'] as const;
/** Paleta dos jogadores (a mesma do MathClash): cor principal, escura e clara. */
export const PALETTE = [
  { name: 'Azul', main: '#3b82f6', dark: '#1e40af', light: '#93c5fd' },
  { name: 'Vermelho', main: '#ef4444', dark: '#991b1b', light: '#fca5a5' },
  { name: 'Verde', main: '#22c55e', dark: '#166534', light: '#86efac' },
  { name: 'Amarelo', main: '#facc15', dark: '#a16207', light: '#fef08a' },
  { name: 'Roxo', main: '#a855f7', dark: '#6b21a8', light: '#d8b4fe' },
  { name: 'Laranja', main: '#f97316', dark: '#9a3412', light: '#fdba74' },
  { name: 'Rosa', main: '#ec4899', dark: '#9d174d', light: '#f9a8d4' },
  { name: 'Ciano', main: '#06b6d4', dark: '#155e75', light: '#67e8f9' },
] as const;

export const SKINS = PALETTE.map((c) => c.main);

export function paletteOf(skin: string): (typeof PALETTE)[number] {
  return PALETTE.find((c) => c.main === skin) ?? PALETTE[0];
}

export type BodyId = (typeof BODIES)[number];
export type EyesId = (typeof EYES)[number];
export type MouthId = (typeof MOUTHS)[number];
export type ExtraId = (typeof EXTRAS)[number];
export type Mood = 'normal' | 'happy' | 'dizzy' | 'scared';

export interface Avatar {
  name: string;
  body: BodyId;
  skin: string;
  eyes: EyesId;
  mouth: MouthId;
  extra: ExtraId;
}

export const NAME_MAX = 12;

export const BODY_LABELS: Record<BodyId, string> = {
  blob: 'Bolinha',
  robot: 'Robô',
  cat: 'Gato',
  bear: 'Urso',
  alien: 'Alien',
  ghost: 'Fantasma',
};

const DEFAULT_AVATARS: Record<1 | 2 | 3 | 4, Avatar> = {
  1: { name: 'Jogador 1', body: 'robot', skin: '#3b82f6', eyes: 'round', mouth: 'smile', extra: 'headphones' },
  2: { name: 'Jogador 2', body: 'cat', skin: '#ef4444', eyes: 'happy', mouth: 'tongue', extra: 'bow' },
  3: { name: 'Jogador 3', body: 'alien', skin: '#22c55e', eyes: 'cyclops', mouth: 'grin', extra: 'none' },
  4: { name: 'Jogador 4', body: 'bear', skin: '#facc15', eyes: 'round', mouth: 'open', extra: 'crown' },
};

export function defaultAvatar(player: 1 | 2 | 3 | 4): Avatar {
  return { ...DEFAULT_AVATARS[player] };
}

function pick<T>(list: readonly T[], value: unknown, fallback: T): T {
  return list.includes(value as T) ? (value as T) : fallback;
}

/** Valida um avatar vindo do armazenamento (dados antigos ou corrompidos não rebentam o jogo). */
export function sanitizeAvatar(data: unknown, player: 1 | 2 | 3 | 4): Avatar {
  const d = defaultAvatar(player);
  if (!data || typeof data !== 'object') return d;
  const a = data as Record<string, unknown>;
  const name = typeof a.name === 'string' ? cleanName(a.name) : '';
  return {
    name: name || d.name,
    body: pick(BODIES, a.body, d.body),
    skin: pick(SKINS, a.skin, d.skin),
    eyes: pick(EYES, a.eyes, d.eyes),
    mouth: pick(MOUTHS, a.mouth, d.mouth),
    extra: pick(EXTRAS, a.extra, d.extra),
  };
}

export function cleanName(name: string): string {
  return Array.from(name.replace(/\s+/g, ' ').trim()).slice(0, NAME_MAX).join('');
}

export function randomAvatar(name: string, rng: () => number = Math.random): Avatar {
  const r = <T,>(list: readonly T[]) => list[Math.floor(rng() * list.length)];
  return { name, body: r(BODIES), skin: r(SKINS), eyes: r(EYES), mouth: r(MOUTHS), extra: r(EXTRAS) };
}

// ------------------------------------------------------------------ desenho

const INK = '#1a1033';
const OUTLINE = `stroke="${INK}" stroke-opacity=".35" stroke-width="3"`;

/** Mistura uma cor com preto (t<0) ou branco (t>0). */
function shade(hex: string, t: number): string {
  const n = parseInt(hex.slice(1), 16);
  const mix = (c: number) => Math.round(t < 0 ? c * (1 + t) : c + (255 - c) * t);
  const r = mix((n >> 16) & 255);
  const g = mix((n >> 8) & 255);
  const b = mix(n & 255);
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
}

function bodySvg(body: BodyId, skin: string): string {
  const dark = shade(skin, -0.25);
  const light = shade(skin, 0.45);
  const hi = `<ellipse cx="36" cy="34" rx="12" ry="7" fill="#fff" opacity=".28" transform="rotate(-25 36 34)"/>`;
  switch (body) {
    case 'blob':
      return `<circle cx="50" cy="56" r="38" fill="${skin}" ${OUTLINE}/>${hi}`;
    case 'robot':
      return `<line x1="50" y1="22" x2="50" y2="9" stroke="${INK}" stroke-width="3"/>
        <circle cx="50" cy="8" r="5" fill="#f87171" ${OUTLINE}/>
        <rect x="6" y="46" width="8" height="18" rx="3" fill="${dark}"/>
        <rect x="86" y="46" width="8" height="18" rx="3" fill="${dark}"/>
        <rect x="13" y="21" width="74" height="70" rx="18" fill="${skin}" ${OUTLINE}/>
        <rect x="22" y="36" width="56" height="44" rx="12" fill="${light}" opacity=".35"/>${hi}`;
    case 'cat':
      return `<path d="M17 46 L20 9 L45 26 Z" fill="${skin}" ${OUTLINE}/>
        <path d="M83 46 L80 9 L55 26 Z" fill="${skin}" ${OUTLINE}/>
        <path d="M23 36 L24 17 L37 27 Z" fill="${light}" opacity=".7"/>
        <path d="M77 36 L76 17 L63 27 Z" fill="${light}" opacity=".7"/>
        <circle cx="50" cy="58" r="35" fill="${skin}" ${OUTLINE}/>
        <path d="M14 66 L30 64 M14 73 L30 69 M86 66 L70 64 M86 73 L70 69" stroke="${INK}" stroke-opacity=".45" stroke-width="2" stroke-linecap="round"/>${hi}`;
    case 'bear':
      return `<circle cx="24" cy="26" r="13" fill="${skin}" ${OUTLINE}/>
        <circle cx="76" cy="26" r="13" fill="${skin}" ${OUTLINE}/>
        <circle cx="24" cy="26" r="6" fill="${dark}"/>
        <circle cx="76" cy="26" r="6" fill="${dark}"/>
        <circle cx="50" cy="57" r="37" fill="${skin}" ${OUTLINE}/>
        <ellipse cx="50" cy="72" rx="16" ry="12" fill="${light}" opacity=".6"/>${hi}`;
    case 'alien':
      return `<path d="M38 24 L28 6 M62 24 L72 6" stroke="${INK}" stroke-width="3" stroke-linecap="round"/>
        <circle cx="28" cy="6" r="5" fill="${skin}" ${OUTLINE}/>
        <circle cx="72" cy="6" r="5" fill="${skin}" ${OUTLINE}/>
        <ellipse cx="50" cy="57" rx="35" ry="38" fill="${skin}" ${OUTLINE}/>${hi}`;
    case 'ghost':
      return `<path d="M14 58 A36 36 0 0 1 86 58 L86 94 L74 86 L62 94 L50 86 L38 94 L26 86 L14 94 Z" fill="${skin}" ${OUTLINE} stroke-linejoin="round"/>${hi}`;
  }
}

function eyesSvg(eyes: EyesId | 'dizzy' | 'scared'): string {
  const pair = (fn: (x: number) => string) => fn(38) + fn(62);
  switch (eyes) {
    case 'round':
      return pair((x) => `<ellipse cx="${x}" cy="52" rx="7" ry="8" fill="#fff"/><circle cx="${x + 1}" cy="54" r="3.8" fill="${INK}"/><circle cx="${x + 2.5}" cy="52" r="1.3" fill="#fff"/>`);
    case 'happy':
      return pair((x) => `<path d="M${x - 7} 55 Q${x} 45 ${x + 7} 55" fill="none" stroke="${INK}" stroke-width="4" stroke-linecap="round"/>`);
    case 'sleepy':
      return pair((x) => `<path d="M${x - 7} 52 Q${x} 59 ${x + 7} 52" fill="none" stroke="${INK}" stroke-width="4" stroke-linecap="round"/><path d="M${x - 8} 49 L${x + 8} 49" stroke="${INK}" stroke-opacity=".3" stroke-width="2"/>`);
    case 'cyclops':
      return `<circle cx="50" cy="50" r="13" fill="#fff" stroke="${INK}" stroke-opacity=".3" stroke-width="2"/><circle cx="50" cy="52" r="7" fill="#22c55e"/><circle cx="50" cy="52" r="3.5" fill="${INK}"/><circle cx="53" cy="48" r="2" fill="#fff"/>`;
    case 'hearts':
      return pair((x) => `<path d="M${x} 59 L${x - 7} 51 A4 4 0 0 1 ${x} 46 A4 4 0 0 1 ${x + 7} 51 Z" fill="#e11d48" stroke="${INK}" stroke-opacity=".3" stroke-width="1.5" stroke-linejoin="round"/>`);
    case 'angry':
      return pair((x) => `<ellipse cx="${x}" cy="54" rx="6.5" ry="7" fill="#fff"/><circle cx="${x + (x < 50 ? 1.5 : -1.5)}" cy="56" r="3.6" fill="${INK}"/>`) +
        `<path d="M29 43 L45 49 M71 43 L55 49" stroke="${INK}" stroke-width="4.5" stroke-linecap="round"/>`;
    case 'dizzy':
      return pair((x) => `<path d="M${x - 6} 47 L${x + 6} 59 M${x + 6} 47 L${x - 6} 59" stroke="${INK}" stroke-width="4" stroke-linecap="round"/>`);
    case 'scared':
      return pair((x) => `<circle cx="${x}" cy="52" r="8.5" fill="#fff" stroke="${INK}" stroke-opacity=".3" stroke-width="1.5"/><circle cx="${x}" cy="52" r="2" fill="${INK}"/>`) +
        `<path d="M30 40 Q37 35 44 39 M70 40 Q63 35 56 39" stroke="${INK}" stroke-width="3" fill="none" stroke-linecap="round"/>`;
  }
}

function mouthSvg(mouth: MouthId | 'sad'): string {
  switch (mouth) {
    case 'smile':
      return `<path d="M39 69 Q50 80 61 69" fill="none" stroke="${INK}" stroke-width="4" stroke-linecap="round"/>`;
    case 'grin':
      return `<path d="M35 67 Q50 88 65 67 Z" fill="${INK}" stroke="${INK}" stroke-width="2" stroke-linejoin="round"/><path d="M38 68 L62 68 L60 72 L40 72 Z" fill="#fff"/>`;
    case 'open':
      return `<ellipse cx="50" cy="73" rx="8" ry="9" fill="${INK}"/><ellipse cx="50" cy="78" rx="5" ry="3.5" fill="#fb7185"/>`;
    case 'tongue':
      return `<path d="M39 69 Q50 78 61 69" fill="none" stroke="${INK}" stroke-width="4" stroke-linecap="round"/><path d="M45 73 Q45 84 51 84 Q57 84 56 72 Z" fill="#fb7185" stroke="${INK}" stroke-opacity=".4" stroke-width="1.5"/>`;
    case 'fangs':
      return `<path d="M37 69 Q50 77 63 69" fill="none" stroke="${INK}" stroke-width="4" stroke-linecap="round"/><path d="M42 72 L44.5 79 L47 73.5 Z M53 73.5 L55.5 79 L58 72 Z" fill="#fff" stroke="${INK}" stroke-opacity=".4" stroke-width="1"/>`;
    case 'o':
      return `<circle cx="50" cy="73" r="5" fill="${INK}"/>`;
    case 'sad':
      return `<path d="M39 77 Q50 66 61 77" fill="none" stroke="${INK}" stroke-width="4" stroke-linecap="round"/>`;
  }
}

function extraSvg(extra: ExtraId, body: BodyId): string {
  // O topo da cabeça varia ligeiramente com o corpo.
  const top = body === 'robot' ? 21 : body === 'ghost' ? 24 : body === 'alien' ? 20 : 20;
  switch (extra) {
    case 'none':
      return '';
    case 'crown':
      return `<path d="M30 ${top + 4} L32 ${top - 14} L41 ${top - 5} L50 ${top - 18} L59 ${top - 5} L68 ${top - 14} L70 ${top + 4} Z" fill="#facc15" stroke="#a16207" stroke-width="2.5" stroke-linejoin="round"/>
        <circle cx="50" cy="${top - 3}" r="3" fill="#ef4444"/>`;
    case 'tophat':
      return `<rect x="33" y="${top - 22}" width="34" height="22" rx="3" fill="#111827" stroke="#000" stroke-opacity=".4" stroke-width="2"/>
        <rect x="33" y="${top - 8}" width="34" height="5" fill="#e11d48"/>
        <rect x="24" y="${top - 1}" width="52" height="6" rx="3" fill="#111827"/>`;
    case 'cap':
      return `<path d="M22 ${top + 14} A28 24 0 0 1 78 ${top + 14} Z" fill="#ef4444" stroke="${INK}" stroke-opacity=".35" stroke-width="2.5"/>
        <path d="M60 ${top + 12} L96 ${top + 14} Q94 ${top + 21} 70 ${top + 19} Z" fill="#b91c1c"/>
        <circle cx="50" cy="${top - 4}" r="3" fill="#b91c1c"/>`;
    case 'glasses':
      return `<g fill="#fff" fill-opacity=".15" stroke="${INK}" stroke-width="3"><circle cx="38" cy="53" r="10"/><circle cx="62" cy="53" r="10"/></g>
        <path d="M48 52 Q50 49 52 52 M28 51 L16 47 M72 51 L84 47" stroke="${INK}" stroke-width="3" fill="none"/>`;
    case 'shades':
      return `<path d="M25 46 H75 V52 Q74 63 63 63 Q52 63 52 53 H48 Q48 63 37 63 Q26 63 25 52 Z" fill="#111827"/>
        <path d="M29 49 L35 49" stroke="#fff" stroke-opacity=".5" stroke-width="2" stroke-linecap="round"/>`;
    case 'bow':
      return `<g transform="translate(70 ${top + 6}) rotate(20)"><path d="M0 0 L-14 -9 L-14 9 Z M0 0 L14 -9 L14 9 Z" fill="#ec4899" stroke="${INK}" stroke-opacity=".35" stroke-width="2" stroke-linejoin="round"/><circle r="4" fill="#be185d"/></g>`;
    case 'headphones':
      return `<path d="M14 54 Q14 ${top - 10} 50 ${top - 10} Q86 ${top - 10} 86 54" fill="none" stroke="#111827" stroke-width="6"/>
        <rect x="6" y="46" width="14" height="22" rx="6" fill="#ef4444" stroke="${INK}" stroke-opacity=".4" stroke-width="2"/>
        <rect x="80" y="46" width="14" height="22" rx="6" fill="#ef4444" stroke="${INK}" stroke-opacity=".4" stroke-width="2"/>`;
    case 'horns':
      return `<path d="M28 ${top + 10} C18 ${top - 2} 20 ${top - 14} 26 ${top - 18} C28 ${top - 8} 34 ${top - 2} 40 ${top + 2} Z" fill="#b91c1c" stroke="${INK}" stroke-opacity=".35" stroke-width="2"/>
        <path d="M72 ${top + 10} C82 ${top - 2} 80 ${top - 14} 74 ${top - 18} C72 ${top - 8} 66 ${top - 2} 60 ${top + 2} Z" fill="#b91c1c" stroke="${INK}" stroke-opacity=".35" stroke-width="2"/>`;
  }
}

/** SVG completo do avatar. O humor (`mood`) substitui temporariamente os olhos e a boca. */
export function avatarSvg(a: Avatar, mood: Mood = 'normal'): string {
  const eyes = mood === 'happy' ? 'happy' : mood === 'dizzy' ? 'dizzy' : mood === 'scared' ? 'scared' : a.eyes;
  const mouth = mood === 'happy' ? 'grin' : mood === 'dizzy' ? 'sad' : mood === 'scared' ? 'o' : a.mouth;
  // Acessórios que tapam os olhos ficam por cima; os que estão atrás da cabeça (auscultadores) também por cima do corpo.
  const body = bodySvg(a.body, a.skin);
  const cheeks = `<ellipse cx="27" cy="66" rx="5" ry="3" fill="#fb7185" opacity=".35"/><ellipse cx="73" cy="66" rx="5" ry="3" fill="#fb7185" opacity=".35"/>`;
  return `<svg viewBox="-4 -4 108 108" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">${body}${cheeks}${eyesSvg(eyes)}${mouthSvg(mouth)}${extraSvg(a.extra, a.body)}</svg>`;
}

/** Elemento DOM com o avatar, que sabe mudar de humor. */
export class AvatarView {
  readonly el: HTMLElement;
  private avatar: Avatar;
  private mood: Mood = 'normal';
  private timer = 0;

  constructor(avatar: Avatar, className = 'avatar') {
    this.avatar = avatar;
    this.el = document.createElement('span');
    this.el.className = className;
    this.render();
  }

  set(avatar: Avatar): void {
    this.avatar = avatar;
    this.render();
  }

  /** Muda de expressão; com `ms` volta ao normal depois desse tempo. */
  setMood(mood: Mood, ms = 0): void {
    clearTimeout(this.timer);
    if (mood !== this.mood) {
      this.mood = mood;
      this.render();
      this.el.dataset.mood = mood;
      this.el.classList.remove('react');
      void this.el.offsetWidth;
      this.el.classList.add('react');
    }
    if (ms > 0 && mood !== 'normal') this.timer = window.setTimeout(() => this.setMood('normal'), ms);
  }

  dispose(): void {
    clearTimeout(this.timer);
  }

  private render(): void {
    this.el.innerHTML = avatarSvg(this.avatar, this.mood);
  }
}
