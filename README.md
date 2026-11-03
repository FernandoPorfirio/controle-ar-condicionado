# Controle do ar-condicionado LG

Widget para Windows que controla um ar-condicionado LG pela [ThinQ Connect API](https://connect-pat.lgthinq.com) oficial. Ele fica na bandeja do sistema, com uma janela pequena, sempre no topo e arrastável.

Pela janela dá para:

- ligar e desligar
- mudar a temperatura alvo (passos de 1 °C)
- escolher o modo (frio, secar, ventilar), a velocidade do vento e a oscilação
- programar o timer para ligar ou desligar
- ver se o ar está gelando (temperatura ambiente → alvo)

A interface tem PT-BR e inglês, e tema claro, escuro ou do sistema.

Stack: [Tauri 2](https://tauri.app) (Rust) + React + TypeScript + pnpm.

## Configuração

1. Gere um token pessoal (PAT) em https://connect-pat.lgthinq.com
   - Abra em aba anônima e **escolha o país da sua conta LG antes de logar**. Com o país errado, toda chamada falha com `1309 Not allowed api call`.
   - Entre com **e-mail e senha**, não pelo QR code / login social.
   - Marque todas as permissões.
2. Copie `.env.example` para `.env` e preencha `THINQ_PAT`, `THINQ_COUNTRY` (ex.: `BR`) e `THINQ_CLIENT_ID` (qualquer UUID fixo).
   O `.env` está no `.gitignore` e nunca deve ser commitado.

O app procura o `.env` na pasta atual, na pasta acima, ao lado do executável e em `%APPDATA%\com.fernandoporfirio.arcondicionado\`.

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

Para conferir o token e ver o que o seu aparelho suporta, sem enviar comandos:

```bash
python scripts/thinq_probe.py
```

## Segurança

O token só é lido pelo backend Rust. A interface web nunca o recebe. O app consulta o estado a cada 60 s, porque a LG bloqueia tokens que fazem chamadas demais.
