import { synth } from '../audio/synth';
import {
  BOARD_SIZE_ORDER,
  BOARD_SIZES,
  DEVIL_STREAK,
  DIFFICULTIES,
  DIFFICULTY_ORDER,
  KEYS,
  PLAYER_THEMES,
  TIME_LIMITS,
  type PlayerId,
} from '../game/config';
import { AvatarView } from './avatar';
import { openAvatarEditor } from './avatar-editor';
import { DEVIL_SVG } from './devil';
import { h, onClick } from './dom';
import { keyboardHint } from './game-view';
import { saveSettings, type Settings } from './settings';

export interface MenuCallbacks {
  onPlay: () => void;
}

/** Ecrã inicial: cada jogador escolhe a sua dificuldade na sua metade do ecrã. */
export class MenuView {
  readonly root: HTMLElement;
  private readonly settings: Settings;
  private readonly callbacks: MenuCallbacks;
  private readonly overlay: HTMLElement;
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
    this.root = h(
      'div',
      { class: `arena menu${settings.rotateP2 ? ' rotate-p2' : ''}` },
      this.playerPanel(2),
      this.centerPanel(),
      this.playerPanel(1),
      this.overlay,
    );
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

  private playerPanel(player: PlayerId): HTMLElement {
    const theme = PLAYER_THEMES[player];
    const hint = h('div', { class: 'kbd-hint' });
    const options = h('div', { class: 'diff-grid' });
    const refresh = () => {
      const current = this.settings.difficulties[player];
      options.querySelectorAll<HTMLElement>('.diff').forEach((el) => {
        el.classList.toggle('selected', el.dataset.id === current);
      });
      hint.textContent = `Teclado: ${keyboardHint(player, DIFFICULTIES[current].keys)}`;
    };
    for (const id of DIFFICULTY_ORDER) {
      const d = DIFFICULTIES[id];
      const dots = h('span', { class: 'diff-dots' });
      for (let i = 0; i < d.keys; i++) dots.append(h('i', { style: `--key:${KEYS[i].color}` }));
      const btn = h(
        'button',
        { class: 'diff', 'data-id': id },
        h('span', { class: 'diff-label' }, d.label),
        dots,
        h('span', { class: 'diff-hint' }, d.hint),
      );
      onClick(btn, () => {
        synth.unlock();
        synth.click();
        this.settings.difficulties[player] = id;
        this.save();
        refresh();
      });
      options.append(btn);
    }
    refresh();
    return h(
      'section',
      { class: `zone zone-p${player} menu-zone`, style: `--pc:${theme.color};--pglow:${theme.glow}` },
      this.whoButton(player),
      options,
      hint,
    );
  }

  /** Avatar + nome do jogador; tocar abre o editor de avatar. */
  private whoButton(player: PlayerId): HTMLElement {
    const view = new AvatarView(this.settings.avatars[player], 'avatar avatar-menu');
    const name = h('span', { class: 'who-name' }, this.settings.avatars[player].name);
    const btn = h(
      'button',
      { class: 'who', 'aria-label': `Editar avatar do ${PLAYER_THEMES[player].name}` },
      view.el,
      h('span', { class: 'who-text' }, name, h('span', { class: 'who-edit' }, '✎ editar avatar')),
    );
    onClick(btn, () => {
      synth.click();
      openAvatarEditor(
        this.overlay,
        player,
        this.settings.avatars[player],
        (a) => {
          this.settings.avatars[player] = a;
          view.set(a);
          name.textContent = a.name;
          this.save();
        },
        () => this.closeHelp(),
      );
    });
    return btn;
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
    const play = h('button', { class: 'btn primary play' }, 'Jogar');
    onClick(play, () => this.play());
    const help = h('button', { class: 'btn' }, 'Como jogar');
    onClick(help, () => this.openHelp());

    const rotate = h('button', { class: 'toggle' });
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
        h('span', { class: 'logo-a' }, 'Memory'),
        h('span', { class: 'logo-b' }, 'Clash'),
      ),
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
      h('div', { class: 'menu-actions' }, help, rotate, play),
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
          h('li', {}, 'Os dois jogadores jogam ao mesmo tempo, cada um no seu teclado de cores.'),
          h('li', {}, 'Cada teclado toca uma sequência de cores e sons. Quando acabar, repete-a pela mesma ordem.'),
          h('li', {}, 'Cada acerto faz a tua cor crescer no tabuleiro do meio — primeiro nas casas livres, depois a roubar ao adversário.'),
          h('li', {}, 'A sequência cresce uma nota e acelera a cada acerto. Os sons dos dois jogadores sobrepõem-se: concentra-te!'),
          h('li', {}, 'Se errares (ou demorares demasiado), perdes um bocadinho do teu território e a sequência encurta.'),
          h(
            'li',
            {},
            devil,
            ` Ao fim de ${DEVIL_STREAK} acertos seguidos aparece um diabinho que vai amaldiçoar o adversário: a próxima sequência dele fica mais longa e mais rápida.`,
          ),
          h('li', {}, 'Ganha quem conquistar o tabuleiro completo. Com limite de tempo, ganha quem tiver mais território no fim.'),
          h('li', {}, 'Cada jogador escolhe a sua dificuldade: dá para equilibrar um jogo entre um adulto e uma criança.'),
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
