# Controle do ar-condicionado LG

[![Última versão](https://img.shields.io/github/v/release/FernandoPorfirio/controle-ar-condicionado?label=vers%C3%A3o)](https://github.com/FernandoPorfirio/controle-ar-condicionado/releases/latest)
[![Downloads](https://img.shields.io/github/downloads/FernandoPorfirio/controle-ar-condicionado/total?label=downloads)](https://github.com/FernandoPorfirio/controle-ar-condicionado/releases)
[![Release](https://github.com/FernandoPorfirio/controle-ar-condicionado/actions/workflows/release.yml/badge.svg)](https://github.com/FernandoPorfirio/controle-ar-condicionado/actions/workflows/release.yml)
![Windows 10 | 11](https://img.shields.io/badge/Windows-10%20%7C%2011-0078D6)

Widget para Windows que controla um ar-condicionado LG pela [ThinQ Connect API](https://connect-pat.lgthinq.com) oficial. É uma barra pequena, sempre no topo e arrastável, que mostra a temperatura do ambiente e o alvo e cresce só quando você vai usar.

**[⬇ Baixar a última versão](https://github.com/FernandoPorfirio/controle-ar-condicionado/releases/latest)** · [Novidades de cada versão](CHANGELOG.md)

Pelo widget dá para:

- ligar e desligar
- mudar a temperatura alvo (passos de 1 °C)
- escolher o modo, a velocidade do vento e a oscilação
- programar o timer para ligar ou desligar
- ver se o ar está gelando ou aquecendo (temperatura ambiente → alvo)

Os botões se adaptam ao seu modelo: modos (frio, quente, auto, secar, ventilar…), velocidades e faixa de temperatura vêm do profile que a LG informa para o aparelho. Funções que o seu ar não tem não aparecem.

A interface tem PT-BR e inglês, e tema claro, escuro ou do sistema.

Requisitos: Windows 10 ou 11, um ar-condicionado LG cadastrado no app LG ThinQ, e internet (o controle passa pela nuvem da LG).

## Instalação

1. Baixe o `Ar-condicionado_x.y.z_x64-setup.exe` da última versão em [Releases](../../releases).
2. Rode o instalador. Ele não tem assinatura digital, então o Windows pode mostrar "O Windows protegeu o computador". Clique em **Mais informações → Executar assim mesmo**.
3. O instalador é só para o seu usuário: não pede senha de administrador e cria um atalho **Ar-condicionado** no menu Iniciar.
4. Abra o app e siga a tela de configuração (abaixo).

## Como usar

O widget é uma barra de uns 100 × 30 px: o ponto de status e **ambiente → alvo** (ex.: `24,5° → 18°`).

- **Em repouso** ele fica semitransparente. A cor do ponto indica o estado: azul piscando = gelando ou aquecendo, verde = na temperatura ou só ventilando, cinza = desligado, vermelho = erro. Passe o mouse sobre o ponto para ver o status e a hora da última atualização.
- **Com o mouse em cima** aparecem **−** e **+** (temperatura), o botão redondo de **liga/desliga** e uma **seta**.
- **A seta** abre o painel com modo, vento, oscilação, timer, atualizar, ⚙ configurações e ocultar. Ele fecha sozinho alguns segundos depois que o mouse sai.
- **Perto das bordas** o widget cresce para dentro da tela: para a esquerda perto da borda direita e para cima perto da borda de baixo. A barra não sai do lugar.
- **Arraste** pela barra (o pontilhado ⋮⋮, o ponto ou as temperaturas) para mudar de lugar. Se ficar parte fora da tela, ele volta para dentro ao soltar. O widget lembra a posição.
- Em **⚙** ficam idioma, tema, opacidade em repouso, luz do display do ar e a conta LG.

O app também tem um ícone na bandeja do sistema, perto do relógio (às vezes escondido na setinha **^**):

- **Clique esquerdo** no ícone: mostra ou esconde o widget.
- **Clique direito**: menu com mostrar/ocultar, ligar/desligar o ar e **Sair**.
- O **✕** do painel só esconde o widget. Para fechar o app de vez, use **Sair** na bandeja.

## Configuração

Na primeira vez que abre, o app mostra a tela **Conectar à conta LG**:

1. Clique no link para abrir https://connect-pat.lgthinq.com
   - **Escolha o país da sua conta LG antes de entrar.** Se o site abrir em outro idioma, use uma aba anônima. Com o país errado, toda chamada falha com `1309 Not allowed api call`.
   - Entre com **e-mail e senha**, não pelo QR code nem pelo login do Google/Apple. Se a sua conta foi criada pelo Google/Apple, defina uma senha para ela no app LG ThinQ ou no site da LG.
   - Crie um token marcando **todas** as permissões.
   - Confira o **Created at** do token: ele deve estar no fuso do seu país (Brasil = GMT-3). GMT+9 indica que o site estava na Coreia; apague e gere outro.
2. Escolha o mesmo país no app, cole o token e clique em **Conectar**.
3. Se a conta tiver mais de um ar-condicionado, escolha qual controlar.

O app testa o token com a LG antes de salvar. Para trocar o token, o país ou o aparelho, ou para desconectar, use **⚙ → Conta LG**.

## Onde fica cada coisa

| O quê | Onde | Observação |
|---|---|---|
| Programa instalado | `%LOCALAPPDATA%\Ar-condicionado\` | `ar-condicionado.exe` e `uninstall.exe` |
| Atalho | Menu Iniciar → **Ar-condicionado** | |
| Token da LG | Gerenciador de Credenciais do Windows → **Credenciais do Windows** → `thinq-pat.app.controle-ar-condicionado` | Nunca fica em arquivo |
| País, aparelho escolhido e client id | `%APPDATA%\app.controle-ar-condicionado\settings.json` | Sem segredos |
| Posição do widget | `%APPDATA%\app.controle-ar-condicionado\.window-state.json` | |
| Cache do WebView | `%LOCALAPPDATA%\app.controle-ar-condicionado\` | |
| Idioma, tema e opacidade | Armazenamento local do WebView (mesma pasta acima) | |
| `.env` (opcional, desenvolvimento) | Raiz do repositório | Veja [`.env.example`](.env.example) |

Para abrir uma dessas pastas, cole o caminho (com o `%…%`) na barra de endereço do Explorer.

## Atualizar e desinstalar

- **Atualizar:** baixe o instalador da versão nova e rode por cima. O token e as preferências são mantidos. Feche o app pela bandeja (**Sair**) antes.
- **Desinstalar:** Configurações do Windows → Aplicativos → **Ar-condicionado** → Desinstalar. Marque **"Delete the application data"** para apagar também `settings.json` e o cache.
- **Apagar o token:** antes de desinstalar, use **⚙ → Conta LG → Desconectar**. Ou depois, remova `thinq-pat.app.controle-ar-condicionado` no Gerenciador de Credenciais. Revogar o token em https://connect-pat.lgthinq.com também o invalida de vez.

## Problemas comuns

| Sintoma | Causa provável | O que fazer |
|---|---|---|
| `LG 1309: Not allowed api call` | Token criado com o país errado no site, ou pelo login social | Gere outro token seguindo a [Configuração](#configuração) e confira o fuso do "Created at" |
| `LG 1310: Not supported domain` | País no app diferente do país da conta | Em **⚙ → Conta LG → Trocar token**, escolha o país certo |
| "Nenhum ar-condicionado encontrado nesta conta" | O ar está em outra conta LG | Use o token da conta onde o ar está cadastrado no app ThinQ |
| `LG 1306` ou bloqueio temporário | Chamadas demais com o mesmo token | Espere algumas horas; o app consulta só a cada 60 s |
| Valor muda no ar, mas a tela demora a confirmar | A nuvem da LG leva um tempo para refletir o comando | Normal: a tela mantém o valor enviado por até 90 s |
| Ícone não aparece | Está escondido na setinha **^** da bandeja | Arraste o ícone para a barra |
| Widget some quando fica em cima da barra de tarefas | A barra de tarefas também é "sempre no topo" e volta para a frente quando é clicada | Deixe o widget logo acima da barra de tarefas (limitação conhecida) |

## Desenvolvimento

Stack: [Tauri 2](https://tauri.app) (Rust) + React + TypeScript + pnpm.

Pré-requisitos: Node 20+, pnpm, Rust stable e o Visual Studio Build Tools com "Desenvolvimento para desktop com C++".

```bash
pnpm install
pnpm tauri dev
```

Para não ter que passar pela tela de configuração a cada teste, use um `.env` na raiz do repositório. Copie [`.env.example`](.env.example) para `.env`; cada variável está explicada no próprio arquivo. Se o `.env` tiver `THINQ_PAT`, ele tem prioridade sobre a configuração salva pelo app.

Para conferir o token e ver o que o seu aparelho suporta, sem enviar comandos (lê o `.env`):

```bash
python scripts/thinq_probe.py
```

O resultado (profile e estado do aparelho) fica em `scripts/out/`, que está no `.gitignore`.

Estrutura:

| Caminho | O quê |
|---|---|
| `src-tauri/src/thinq.rs` | Cliente da ThinQ Connect API e leitura do profile |
| `src-tauri/src/settings.rs` | Token no Gerenciador de Credenciais e `settings.json` |
| `src-tauri/src/lib.rs` | Comandos do Tauri, bandeja e janela |
| `src/App.tsx` | Barra, painel de controles e configurações |
| `src/useWindowFit.ts` | Faz a janela acompanhar o tamanho do widget e crescer para dentro da tela perto das bordas |
| `src/Setup.tsx` | Tela de conexão com a conta LG |
| `src/i18n.ts` | Textos em PT-BR e inglês |
| `scripts/thinq_probe.py` | Diagnóstico da API |

Gerar o instalador localmente (sai em `src-tauri/target/release/bundle/nsis/`):

```bash
pnpm tauri build
```

### Versões e publicação

O projeto usa [Versionamento Semântico](https://semver.org/lang/pt-BR/) (`MAJOR.MINOR.PATCH`) e registra as mudanças no [CHANGELOG.md](CHANGELOG.md), no formato [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/).

O workflow [`release.yml`](.github/workflows/release.yml) compila o instalador no GitHub Actions e publica uma release sempre que uma tag `v*` é enviada:

1. Mova o que está em **Não lançado** no `CHANGELOG.md` para uma seção com a nova versão e a data.
2. Atualize a versão em `package.json`, `src-tauri/Cargo.toml` e `src-tauri/tauri.conf.json`.
3. Faça o commit e o push.
4. Crie e envie a tag: `git tag v0.4.0 && git push origin v0.4.0`.
5. Em uns 15 minutos a release aparece publicada em Releases, com o instalador em *Assets*. O `.exe` também fica como artefato na execução do workflow (aba Actions).

## Segurança

- O token só é lido pelo backend Rust e fica no Gerenciador de Credenciais do Windows. A interface só o envia uma vez, na tela de configuração, e nunca o recebe de volta.
- O app só se comunica com os servidores da LG (`api-*.lgthinq.com`).
- A `x-api-key` em `thinq.rs` não é segredo: é a chave pública do SDK oficial da LG.
- O app consulta o estado a cada 60 s, porque a LG bloqueia tokens que fazem chamadas demais.
