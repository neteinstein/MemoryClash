import { synth } from '../audio/synth';
import { type PlayerId } from '../game/config';
import {
  AvatarView,
  avatarSvg,
  BODIES,
  BODY_LABELS,
  cleanName,
  defaultAvatar,
  EXTRAS,
  EYES,
  MOUTHS,
  NAME_MAX,
  paletteOf,
  randomAvatar,
  SKINS,
  type Avatar,
} from './avatar';
import { h, onClick } from './dom';

type Part = 'body' | 'skin' | 'eyes' | 'mouth' | 'extra';

const ROWS: Array<{ part: Part; label: string; values: readonly string[] }> = [
  { part: 'body', label: 'Corpo', values: BODIES },
  { part: 'skin', label: 'Cor', values: SKINS },
  { part: 'eyes', label: 'Olhos', values: EYES },
  { part: 'mouth', label: 'Boca', values: MOUTHS },
  { part: 'extra', label: 'Acessório', values: EXTRAS },
];

/**
 * Editor de avatar. Abre dentro de `overlay`, virado para o jogador que o está a editar
 * (no modo frente a frente, o do Jogador 2 aparece rodado). As alterações aplicam-se logo.
 */
export function openAvatarEditor(
  overlay: HTMLElement,
  player: PlayerId,
  avatar: Avatar,
  onChange: (a: Avatar) => void,
  onClose: () => void,
  /** Cores que os outros jogadores já escolheram (não podem ser repetidas). */
  takenSkins: string[],
): void {
  const card = h('div', { class: `card editor editor-p${player}` });
  const paint = () => {
    const c = paletteOf(avatar.skin);
    card.setAttribute('style', `--pc:${c.main};--pcd:${c.dark};--pcl:${c.light};--pglow:color-mix(in srgb, ${c.main} 55%, transparent)`);
  };
  paint();
  const preview = new AvatarView(avatar, 'avatar avatar-xl');
  const nameInput = h('input', {
    class: 'name-input',
    type: 'text',
    maxlength: NAME_MAX * 2,
    value: avatar.name,
    'aria-label': 'Nome',
    autocomplete: 'off',
    spellcheck: 'false',
    enterkeyhint: 'done',
  }) as HTMLInputElement;
  const rows = ROWS.map((row) => {
    const opts = h('div', { class: `opts opts-${row.part}` });
    return { ...row, opts };
  });

  const update = (next: Avatar) => {
    avatar = next;
    preview.set(avatar);
    onChange(avatar);
    paint();
    renderOptions();
  };

  const renderOptions = () => {
    for (const row of rows) {
      row.opts.replaceChildren(
        ...row.values.map((value) => {
          const selected = avatar[row.part] === value;
          const btn =
            row.part === 'skin'
              ? h('button', {
                  class: `swatch${selected ? ' selected' : ''}${takenSkins.includes(value) ? ' taken' : ''}`,
                  style: `--sw:${value}`,
                  'aria-label': takenSkins.includes(value) ? 'Cor de outro jogador' : paletteOf(value).name,
                  disabled: takenSkins.includes(value),
                })
              : h('button', {
                  class: `opt${selected ? ' selected' : ''}`,
                  title: row.part === 'body' ? BODY_LABELS[value as Avatar['body']] : value,
                  html: avatarSvg({ ...avatar, [row.part]: value } as Avatar),
                });
          onClick(btn, () => {
            synth.click();
            update({ ...avatar, [row.part]: value } as Avatar);
          });
          return btn;
        }),
      );
    }
  };

  nameInput.addEventListener('input', () => {
    const name = cleanName(nameInput.value);
    avatar = { ...avatar, name: name || defaultAvatar(player).name };
    onChange(avatar);
  });
  nameInput.addEventListener('keydown', (e) => {
    e.stopPropagation();
    if (e.key === 'Enter') nameInput.blur();
  });
  nameInput.addEventListener('blur', () => {
    nameInput.value = avatar.name;
  });

  const dice = h('button', { class: 'btn small' }, '🎲 Aleatório');
  onClick(dice, () => {
    synth.click();
    update(randomAvatar(avatar.name));
  });
  const done = h('button', { class: 'btn primary' }, 'Feito');
  onClick(done, () => {
    preview.dispose();
    onClose();
  });

  renderOptions();
  overlay.className = 'overlay dim';
  overlay.replaceChildren(
    (card.append(
      h('h2', {}, `Avatar · Jogador ${player}`),
      h(
        'div',
        { class: 'editor-top' },
        preview.el,
        h('div', { class: 'editor-name' }, h('label', {}, 'Nome', nameInput), dice),
      ),
      ...rows.map((r) => h('div', { class: 'editor-row' }, h('span', { class: 'editor-label' }, r.label), r.opts)),
      done,
    ),
    card),
  );
}
