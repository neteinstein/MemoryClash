import balooLatin from '@fontsource-variable/baloo-2/files/baloo-2-latin-wght-normal.woff2?url';

/**
 * Baloo 2 (SIL OFL) vem incluída no jogo, por isso funciona offline (Android) e sem pedidos a terceiros.
 * Só o subconjunto latino: cobre o português todo. Enquanto carrega, usa-se a fonte do sistema.
 */
export function loadFonts(): void {
  if (typeof FontFace === 'undefined' || !document.fonts) return;
  try {
    const face = new FontFace('Baloo 2', `url(${balooLatin}) format('woff2')`, {
      weight: '400 800',
      style: 'normal',
      display: 'swap',
    });
    document.fonts.add(face);
    void face.load().catch(() => undefined);
  } catch {
    // Sem a fonte, fica a do sistema.
  }
}
