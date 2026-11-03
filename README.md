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

Baixe o instalador (`…-setup.exe`) da última versão em [Releases](../../releases), instale e abra. O próprio app pede o token da LG (veja [Configuração](#configuração)).

O instalador não tem assinatura digital, então o Windows pode mostrar "O Windows protegeu o computador". Clique em **Mais informações → Executar assim mesmo**.

Stack: [Tauri 2](https://tauri.app) (Rust) + React + TypeScript + pnpm.

## Configuração

Na primeira vez que abre, o app mostra a tela **Conectar à conta LG**:

1. Clique no link para abrir https://connect-pat.lgthinq.com
   - **Escolha o país da sua conta LG antes de entrar.** Se o site abrir em outro idioma, use uma aba anônima. Com o país errado, toda chamada falha com `1309 Not allowed api call`.
   - Entre com **e-mail e senha**, não pelo QR code nem pelo login do Google/Apple.
   - Crie um token marcando todas as permissões.
2. Escolha o mesmo país no app, cole o token e clique em **Conectar**.
3. Se a conta tiver mais de um ar-condicionado, escolha qual controlar.

O app testa o token com a LG antes de salvar. O token fica no **Gerenciador de Credenciais do Windows**; país e aparelho ficam em `%APPDATA%\app.controle-ar-condicionado\settings.json`. Para trocar o token, o país ou o aparelho, ou para desconectar, use **⚙ → Conta LG**.

### Configuração por `.env` (desenvolvimento)

Quem roda pelo código pode usar um `.env` na raiz do repositório, que tem prioridade sobre a configuração do app. Copie [`.env.example`](.env.example) para `.env` e preencha:

- `THINQ_PAT`: o token
- `THINQ_COUNTRY`: o código do país da conta LG (ex.: `BR`, `US`, `PT`)
- `THINQ_CLIENT_ID`: qualquer UUID fixo (no PowerShell: `[guid]::NewGuid()`)
- `THINQ_DEVICE_ID` (opcional): qual ar controlar, se houver mais de um. Os IDs aparecem em **⚙ → Conta LG**.

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

O token só é lido pelo backend Rust e fica guardado no Gerenciador de Credenciais do Windows. A interface web só o envia uma vez, na tela de configuração, e nunca o recebe de volta. O app consulta o estado a cada 60 s, porque a LG bloqueia tokens que fazem chamadas demais.
