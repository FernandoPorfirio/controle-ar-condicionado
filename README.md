# Controle do ar-condicionado LG

Widget para Windows que controla um ar-condicionado LG pela [ThinQ Connect API](https://connect-pat.lgthinq.com) oficial. Ele fica na bandeja do sistema, com uma janela pequena, sempre no topo e arrastável.

Pela janela dá para:

- ligar e desligar
- mudar a temperatura alvo (passos de 1 °C)
- escolher o modo, a velocidade do vento e a oscilação
- programar o timer para ligar ou desligar
- ver se o ar está gelando ou aquecendo (temperatura ambiente → alvo)

Os botões se adaptam ao seu modelo: modos (frio, quente, auto, secar, ventilar…), velocidades e faixa de temperatura vêm do profile que a LG informa para o aparelho. Funções que o seu ar não tem não aparecem.

A interface tem PT-BR e inglês, e tema claro, escuro ou do sistema.

## Instalação

Baixe o instalador (`…-setup.exe`) da última versão em [Releases](../../releases), instale e siga a [Configuração](#configuração).

O instalador não tem assinatura digital, então o Windows pode mostrar "O Windows protegeu o computador". Clique em **Mais informações → Executar assim mesmo**.

Stack: [Tauri 2](https://tauri.app) (Rust) + React + TypeScript + pnpm.

## Configuração

1. Gere um token pessoal (PAT) em https://connect-pat.lgthinq.com
   - Abra em aba anônima e **escolha o país da sua conta LG antes de logar**. Com o país errado, toda chamada falha com `1309 Not allowed api call`.
   - Entre com **e-mail e senha**, não pelo QR code / login social.
   - Marque todas as permissões.
2. Copie [`.env.example`](.env.example) para um arquivo chamado `.env` e preencha:
   - `THINQ_PAT`: o token gerado acima
   - `THINQ_COUNTRY`: o código do país da conta LG (ex.: `BR`, `US`, `PT`)
   - `THINQ_CLIENT_ID`: qualquer UUID, fixo para a sua instalação (no PowerShell: `[guid]::NewGuid()`). Se ficar vazio, o app gera um novo a cada execução.
   - `THINQ_DEVICE_ID` (opcional): só se a conta tiver mais de um ar-condicionado. Sem ele, o app controla o primeiro que encontrar. Os IDs aparecem no app em **⚙ → Aparelhos na conta**.
3. Coloque o `.env` no lugar certo para o seu caso:

   | Como você usa o app | Onde fica o `.env` |
   |---|---|
   | Rodando pelo código (`pnpm tauri dev`) | Na raiz do repositório, ao lado do `.env.example` |
   | Instalado pelo instalador | Na pasta de configuração do app: `%APPDATA%\app.controle-ar-condicionado\` |

   O caminho é o mesmo para todo mundo. O nome da pasta vem do `identifier` em [`src-tauri/tauri.conf.json`](src-tauri/tauri.conf.json); se você fizer um fork e mudar o identifier, o caminho muda junto. A pasta de configuração é criada na primeira execução. Para abri-la, use o menu da bandeja (clique direito no ícone → **Abrir pasta do .env**) ou cole o caminho acima na barra de endereço do Explorer. Depois de colocar o `.env`, feche o app pela bandeja (**Sair**) e abra de novo.

   Se o `.env` não for encontrado, a janela mostra no rodapé o caminho exato onde ele é esperado.

O `.env` está no `.gitignore`. Nunca o commite nem compartilhe: o token dá controle do seu ar-condicionado.

## Desenvolvimento

Pré-requisitos: Node 20+, pnpm, Rust stable e o Visual Studio Build Tools com "Desenvolvimento para desktop com C++".

```bash
pnpm install
pnpm tauri dev
```

Instalador (`src-tauri/target/release/bundle/nsis/`):

```bash
pnpm tauri build
```

### Publicar uma versão

O workflow [`release.yml`](.github/workflows/release.yml) compila o instalador no GitHub Actions e cria um rascunho em Releases sempre que uma tag `v*` é enviada:

1. Atualize a versão em `package.json`, `src-tauri/Cargo.toml` e `src-tauri/tauri.conf.json`.
2. Crie e envie a tag: `git tag v0.2.0 && git push origin v0.2.0`.
3. Quando o workflow terminar, revise o rascunho em Releases e publique.

Para conferir o token e ver o que o seu aparelho suporta, sem enviar comandos:

```bash
python scripts/thinq_probe.py
```

## Segurança

O token só é lido pelo backend Rust. A interface web nunca o recebe. O app consulta o estado a cada 60 s, porque a LG bloqueia tokens que fazem chamadas demais.
