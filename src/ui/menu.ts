import { synth } from '../audio/synth';
import {
  BOARD_SIZE_ORDER,
  BOARD_SIZES,
  DEVIL_STREAK,
  DIFFICULTIES,
  DIFFICULTY_ORDER,
  KEYS,
  TIME_LIMITS,
  type PlayerId,
} from '../game/config';
import { AvatarView, BODIES, BODY_LABELS, paletteOf, SKINS, type Avatar } from './avatar';
import { openAvatarEditor } from './avatar-editor';
import { DEVIL_SVG } from './devil';
import { h, onClick } from './dom';
import { keyboardHint } from './game-view';
import { activePlayers, bigScreen, playerTheme, saveSettings, themeVars, zoneVars, type Settings } from './settings';

const ARROW_LEFT = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg>';
const ARROW_RIGHT = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 5l7 7-7 7"/></svg>';

export interface MenuCallbacks {
  onPlay: () => void;
  /** Volta a desenhar o menu (ex.: mudou o número de jogadores). */
  onRebuild: () => void;
}

/** Ecrã inicial: cada jogador escolhe a sua dificuldade na sua metade do ecrã. */
export class MenuView {
  readonly root: HTMLElement;
  private readonly settings: Settings;
  private readonly callbacks: MenuCallbacks;
  private readonly overlay: HTMLElement;
  private readonly ready: Record<PlayerId, boolean> = { 1: false, 2: false, 3: false, 4: false };
  /** Jogadores em jogo; com 3 ou 4 (só em ecrãs grandes) há um em cada lado. */
  private readonly ids: PlayerId[];
  private readonly refreshers: Array<() => void> = [];
  private readonly onKeyDown = (e: KeyboardEvent) => {
    if (e.code === 'Enter' && this.overlay.classList.contains('hidden')) {
      e.preventDefault();
      this.play();
    } else if (e.code === 'Escape') {
      this.closeHelp();
    }
  };

  constructor(settings: Settings, callbacks: MenuCallbacks) {
    this.settings = settings;
    this.callbacks = callbacks;
    this.overlay = h('div', { class: 'overlay hidden' });
    this.ids = activePlayers(settings);
    const layout = this.ids.length > 2 ? ` multi players-${this.ids.length}` : settings.rotateP2 ? ' rotate-p2' : '';
    this.root = h(
      'div',
      { class: `arena menu${layout}` },
      ...this.ids.map((id) => this.playerPanel(id)),
      this.centerPanel(),
      this.overlay,
    );
    this.refreshAll();
  }

  mount(parent: HTMLElement): void {
    parent.append(this.root);
    window.addEventListener('keydown', this.onKeyDown);
  }

  destroy(): void {
    window.removeEventListener('keydown', this.onKeyDown);
    this.root.remove();
  }

  private save(): void {
    saveSettings(this.settings);
  }

  /** Metade de cada jogador: avatar (com setas), cor, dificuldade e botão PRONTO. */
  private playerPanel(player: PlayerId): HTMLElement {
    /** Cores dos outros jogadores em jogo (não se podem repetir). */
    const taken = () => this.ids.filter((id) => id !== player).map((id) => this.settings.avatars[id].skin);
    const avatar = () => this.settings.avatars[player];
    const view = new AvatarView(avatar(), 'avatar avatar-setup');
    const title = h('div', { class: 'setup-title' });
    const sub = h('div', { class: 'setup-sub' });
    const swatches = h('div', { class: 'swatches' });
    const diffs = h('div', { class: 'diff-row' });
    const hint = h('div', { class: 'kbd-hint' });
    const ready = h('button', { class: 'ready' }, 'Pronto!');
    const zone = h('section', { class: `zone zone-p${player} menu-zone` });

    const setAvatar = (a: Avatar) => {
      this.settings.avatars[player] = a;
      this.save();
      this.refreshAll();
    };
    const cycle = (dir: number) => {
      synth.unlock();
      synth.click();
      const i = BODIES.indexOf(avatar().body);
      setAvatar({ ...avatar(), body: BODIES[(i + dir + BODIES.length) % BODIES.length] });
      view.setMood('happy', 500);
    };
    const prev = h('button', { class: 'arrow', 'aria-label': 'Avatar anterior', html: ARROW_LEFT });
    const next = h('button', { class: 'arrow', 'aria-label': 'Avatar seguinte', html: ARROW_RIGHT });
    onClick(prev, () => cycle(-1));
    onClick(next, () => cycle(1));
    const edit = () => {
      synth.unlock();
      synth.click();
      openAvatarEditor(this.overlay, player, avatar(), setAvatar, () => this.closeHelp(), taken());
    };
    onClick(view.el, edit);
    onClick(title, edit);
    view.el.setAttribute('role', 'button');
    view.el.setAttribute('aria-label', 'Personalizar avatar');

    for (const color of SKINS) {
      const b = h('button', { class: 'swatch', style: `--sw:${color}`, 'data-color': color, 'aria-label': color });
      onClick(b, () => {
        if (taken().includes(color)) return;
        synth.unlock();
        synth.click();
        setAvatar({ ...avatar(), skin: color });
      });
      swatches.append(b);
    }

    for (const id of DIFFICULTY_ORDER) {
      const d = DIFFICULTIES[id];
      const dots = h('span', { class: 'diff-dots' });
      for (let i = 0; i < d.keys; i++) dots.append(h('i', { style: `--key:${KEYS[i].color}` }));
      const btn = h(
        'button',
        { class: 'diff', 'data-id': id },
        dots,
        h('span', { class: 'diff-label' }, d.label),
        h('span', { class: 'diff-hint' }, d.hint),
      );
      onClick(btn, () => {
        synth.unlock();
        synth.click();
        this.settings.difficulties[player] = id;
        this.save();
        this.refreshAll();
      });
      diffs.append(btn);
    }

    onClick(ready, () => {
      synth.unlock();
      synth.click();
      this.ready[player] = !this.ready[player];
      this.refreshAll();
      if (this.ids.every((id) => this.ready[id])) window.setTimeout(() => this.play(), 250);
    });

    this.refreshers.push(() => {
      const a = avatar();
      const theme = playerTheme(this.settings, player);
      zone.setAttribute('style', zoneVars(theme));
      view.set(a);
      title.textContent = a.name;
      sub.textContent = `${BODY_LABELS[a.body]} · ✎ personalizar`;
      const others = taken();
      swatches.querySelectorAll<HTMLElement>('.swatch').forEach((el) => {
        const isTaken = others.includes(el.dataset.color ?? '');
        el.classList.toggle('selected', el.dataset.color === a.skin);
        el.classList.toggle('taken', isTaken);
        el.setAttribute('aria-label', isTaken ? 'Cor de outro jogador' : paletteOf(el.dataset.color ?? '').name);
      });
      const current = this.settings.difficulties[player];
      diffs.querySelectorAll<HTMLElement>('.diff').forEach((el) => el.classList.toggle('selected', el.dataset.id === current));
      hint.textContent = `Teclado: ${keyboardHint(player, DIFFICULTIES[current].keys)}`;
      ready.classList.toggle('on', this.ready[player]);
      ready.textContent = this.ready[player] ? '✔ Pronto' : 'Pronto!';
    });

    zone.append(
      h(
        'div',
        { class: 'zone-inner' },
        title,
      h('div', { class: 'setup-avatar' }, prev, view.el, next),
      sub,
      swatches,
      diffs,
        hint,
        ready,
      ),
    );
    return zone;
  }

  private refreshAll(): void {
    this.refreshers.forEach((r) => r());
    this.root?.setAttribute('style', themeVars(this.settings));
  }

  private segmented<T extends string | number>(
    label: string,
    values: readonly T[],
    text: (v: T) => string,
    get: () => T,
    set: (v: T) => void,
  ): HTMLElement {
    const group = h('div', { class: 'seg' });
    const refresh = () =>
      group.querySelectorAll<HTMLElement>('button').forEach((b, i) => b.classList.toggle('selected', values[i] === get()));
    values.forEach((v) => {
      const b = h('button', {}, text(v));
      onClick(b, () => {
        synth.unlock();
        synth.click();
        set(v);
        this.save();
        refresh();
      });
      group.append(b);
    });
    refresh();
    return h('div', { class: 'setting' }, h('span', { class: 'setting-label' }, label), group);
  }

  private centerPanel(): HTMLElement {
    const help = h('button', { class: 'chip' }, '? Como jogar');
    onClick(help, () => this.openHelp());

    const rotate = h('button', { class: 'chip toggle' });
    const refreshRotate = () => {
      rotate.classList.toggle('on', this.settings.rotateP2);
      rotate.textContent = this.settings.rotateP2 ? 'Frente a frente: sim' : 'Frente a frente: não';
      this.root?.classList.toggle('rotate-p2', this.settings.rotateP2);
    };
    onClick(rotate, () => {
      this.settings.rotateP2 = !this.settings.rotateP2;
      this.save();
      refreshRotate();
    });
    rotate.classList.toggle('on', this.settings.rotateP2);
    rotate.textContent = this.settings.rotateP2 ? 'Frente a frente: sim' : 'Frente a frente: não';

    return h(
      'div',
      { class: 'mid menu-mid' },
      h(
        'h1',
        { class: 'logo' },
        h('span', { class: 'logo-a' }, ...logoLetters('Memory', [])),
        h('span', { class: 'logo-b' }, ...logoLetters('Clash', ['#facc15', '#f97316', '#ec4899', '#a855f7', '#06b6d4'], 6)),
      ),
      h('p', { class: 'tagline' }, 'Repete a sequência e pinta o tabuleiro!'),
      // Em ecrãs grandes (tablets) podem jogar até 4, um em cada lado.
      bigScreen()
        ? this.segmented(
            'Jogadores',
            [2, 3, 4] as const,
            (v) => String(v),
            () => this.settings.playerCount,
            (v) => {
              if (v === this.settings.playerCount) return;
              this.settings.playerCount = v;
              this.save();
              this.callbacks.onRebuild();
            },
          )
        : null,
      this.segmented(
        'Tabuleiro',
        BOARD_SIZE_ORDER,
        (v) => BOARD_SIZES[v].label,
        () => this.settings.boardSize,
        (v) => (this.settings.boardSize = v),
      ),
      this.segmented(
        'Tempo',
        TIME_LIMITS,
        (v) => (v === 0 ? '∞' : `${v / 60} min`),
        () => this.settings.timeLimitSec as (typeof TIME_LIMITS)[number],
        (v) => (this.settings.timeLimitSec = v),
      ),
      h('div', { class: 'menu-actions' }, help, this.ids.length > 2 ? null : rotate),
      h('div', { class: 'menu-tip' }, this.ids.length > 2 ? 'Carreguem todos em PRONTO para começar' : 'Carreguem os dois em PRONTO para começar'),
    );
  }

  private play(): void {
    synth.unlock();
    this.callbacks.onPlay();
  }

  private openHelp(): void {
    synth.unlock();
    const close = h('button', { class: 'btn primary' }, 'Percebi!');
    onClick(close, () => this.closeHelp());
    const devil = h('span', { class: 'inline-devil', html: DEVIL_SVG });
    this.overlay.className = 'overlay dim';
    this.overlay.replaceChildren(
      h(
        'div',
        { class: 'card help' },
        h('h2', {}, 'Como jogar'),
        h(
          'ul',
          {},
          h('li', {}, 'Todos jogam ao mesmo tempo, cada um no seu teclado de cores. Em tablets podem jogar 3 ou 4, um em cada lado do ecrã.'),
          h('li', {}, 'Cada teclado toca uma sequência de cores e sons. Quando acabar, repete-a pela mesma ordem.'),
          h('li', {}, 'Cada acerto faz a tua cor crescer no tabuleiro do meio — primeiro nas casas livres, depois a roubar ao adversário.'),
          h('li', {}, 'A sequência cresce uma nota e acelera a cada acerto. Os sons dos dois jogadores sobrepõem-se: concentra-te!'),
          h('li', {}, 'Se errares (ou demorares demasiado), perdes um bocadinho do teu território e a sequência volta a ter 2 notas.'),
          h(
            'li',
            {},
            devil,
            ` Ao fim de ${DEVIL_STREAK} acertos seguidos aparece um diabinho que vai amaldiçoar o adversário: a próxima sequência dele fica mais longa e mais rápida.`,
          ),
          h('li', {}, 'Ganha quem conquistar o tabuleiro completo. Com limite de tempo, as sequências aceleram perto do fim (⚡) e ganha quem tiver mais território quando o tempo acabar.'),
          h('li', {}, 'Cada jogador escolhe o avatar, a cor e a dificuldade na sua metade do ecrã (dá para equilibrar um jogo entre um adulto e uma criança). Toca no avatar para o personalizar. O jogo começa quando os dois carregarem em PRONTO.'),
          h('li', { class: 'desktop-only' }, 'No computador: J1 usa Q W E R / A S D F, J2 usa U I O P / J K L Ç. Espaço pausa.'),
        ),
        close,
      ),
    );
  }

  private closeHelp(): void {
    this.overlay.className = 'overlay hidden';
    this.overlay.replaceChildren();
  }
}

/** Letras do logótipo, cada uma a ondular com um pequeno atraso (como no MathClash). */
function logoLetters(word: string, colors: string[], offset = 0): HTMLElement[] {
  return Array.from(word).map((ch, i) =>
    h('span', { class: 'ch', style: `--i:${i + offset}${colors[i] ? `;--lc:${colors[i]}` : ''}` }, ch),
  );
}
