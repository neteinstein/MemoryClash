# Memory Clash

Jogo de memória para **2 jogadores em simultâneo**, que corre no **browser** e em **Android**.

Cada jogador tem o seu teclado de cores. O jogo toca uma sequência de teclas (cor + som) e o jogador tem de a repetir sem erros. Os dois jogam ao mesmo tempo, por isso os sons dos dois teclados sobrepõem-se — faz parte da dificuldade. Cada acerto faz a cor do jogador crescer no tabuleiro do meio; ganha quem conquistar o tabuleiro completo.

## Regras

| Situação | O que acontece |
| --- | --- |
| Acertas a sequência | A tua cor expande no tabuleiro **uma célula por cada nota** da sequência (quanto mais longa, mais ganhas): primeiro casas livres, depois casas roubadas ao adversário. A sequência cresce uma nota e **acelera**. |
| Erras (ou demoras demasiado) | Perdes um bocadinho do território (≈8%, mínimo 2 células), que fica livre. A sequência volta a ter **2 notas** e abranda um pouco. |
| 5 acertos seguidos | Aparece um **diabinho** 😈 que voa até ao adversário: a próxima sequência dele tem **+3 notas e toca 35% mais depressa**. Os diabinhos acumulam (até 2). |
| Conquistas o tabuleiro todo | Ganhas! |
| Limite de tempo (por omissão 2 min) | À medida que o fim se aproxima, **as sequências aceleram** (até 45% mais rápidas, ⚡ no relógio). Quando o tempo acaba, ganha quem tiver mais território. Também há a opção ∞ (sem limite). |

### Dificuldade (escolhida por cada jogador)

| Nível | Teclas | Sequência inicial | Velocidade | Tempo por toque |
| --- | --- | --- | --- | --- |
| Fácil | 4 | 2 notas | calma, acelera devagar | 5 s |
| Normal | 4 | 3 notas | rápida | 4 s |
| Difícil | 6 | 3 notas | veloz | 3,2 s |
| Pesadelo | 8 | 4 notas | alucinante | 2,6 s |

Como cada jogador escolhe o seu nível, dá para equilibrar um jogo entre, por exemplo, um adulto e uma criança. Os valores estão todos em [`src/game/config.ts`](src/game/config.ts).

### Avatares

No ecrã inicial, cada jogador escolhe tudo na sua metade: o avatar com as setas ‹ ›, a cor (que é também a sua cor no tabuleiro; a do adversário fica bloqueada), a dificuldade e, quando estiver pronto, carrega em **PRONTO!**. O jogo começa quando os dois estiverem prontos. Tocar no avatar ou no nome abre o editor completo (olhos, boca, acessório, nome, 🎲 aleatório). Fica tudo guardado no dispositivo. Durante o jogo o avatar reage: fica contente quando acertas, tonto quando erras e assustado quando lhe chega um diabinho.

### Controlos

- **Telemóvel/tablet:** cada jogador toca no seu teclado (multitoque). Em retrato, o ecrã divide-se em cima/baixo e a metade do Jogador 2 fica rodada, para jogarem frente a frente com o telemóvel pousado na mesa (pode desligar-se no menu: "Frente a frente").
- **Computador:** Jogador 1 usa `Q W E R / A S D F`, Jogador 2 usa `U I O P / J K L Ç` (só as colunas necessárias para o nível). `Espaço` ou `Esc` pausa.
- No Android, o botão "voltar" pausa o jogo.

## Desenvolvimento

Requer Node.js 22+.

```bash
npm install
npm run dev        # servidor de desenvolvimento (abre no browser; --host permite testar no telemóvel na mesma rede)
npm test           # testes das regras do jogo (Vitest)
npm run build      # versão web de produção em dist/
npm run build:single  # o jogo inteiro num só ficheiro: dist-single/memoryclash.html
```

A pasta `dist/` é um site estático: pode ser publicada em qualquer lado (o workflow [`pages.yml`](.github/workflows/pages.yml) publica-a no GitHub Pages — basta ativar *Settings → Pages → Source: GitHub Actions*).

### Android

O Android usa [Capacitor](https://capacitorjs.com): o mesmo código web corre dentro de uma app nativa (`android/`).

```bash
npm run android:sync   # build web + copia para o projeto Android
npm run android:open   # abre no Android Studio
npm run android:apk    # compila um APK de debug (precisa do Android SDK e Java 21)
```

O APK fica em `android/app/build/outputs/apk/debug/app-debug.apk`. O workflow de CI ([`ci.yml`](.github/workflows/ci.yml)) compila-o em cada push/PR e deixa-o disponível como artefacto.

Na app Android o ecrã não se apaga durante o jogo e as barras do sistema ficam escondidas (ecrã inteiro).

## Estrutura

```
src/
  game/        regras puras, sem DOM (testadas em tests/)
    config.ts    níveis, cores/notas, equilíbrio
    board.ts     tabuleiro: expansão, perda de território, conquista
    player.ts    máquina de estados de cada jogador (mostrar → responder → acerto/erro)
    match.ts     junta os dois jogadores e o tabuleiro; diabinhos e fim de jogo
  audio/synth.ts sons gerados em tempo real com Web Audio (sem ficheiros de áudio)
  ui/          menu, ecrã de jogo, avatares, diabinho animado
android/       projeto nativo Capacitor
```

Todo o jogo é conduzido por um relógio que pode ser pausado (`update(now)`), o que torna as regras deterministas e fáceis de testar.
