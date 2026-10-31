import fredokaLatin from '@fontsource-variable/fredoka/files/fredoka-latin-wght-normal.woff2?url';

/**
 * Fredoka (SIL OFL), a mesma fonte do MathClash, vem incluída no jogo, por isso funciona offline (Android) e sem pedidos a terceiros.
 * Só o subconjunto latino: cobre o português todo. Enquanto carrega, usa-se a fonte do sistema.
 */
export function loadFonts(): void {
  if (typeof FontFace === 'undefined' || !document.fonts) return;
  try {
    const face = new FontFace('Fredoka', `url(${fredokaLatin}) format('woff2')`, {
      weight: '300 700',
      style: 'normal',
      display: 'swap',
    });
    document.fonts.add(face);
    void face.load().catch(() => undefined);
  } catch {
    // Sem a fonte, fica a do sistema.
  }
}
