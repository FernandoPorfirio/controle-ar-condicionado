# Changelog

Todas as mudanças relevantes deste projeto ficam registradas aqui.

O formato segue o [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/) e o projeto usa [Versionamento Semântico](https://semver.org/lang/pt-BR/).

## [Não lançado]

## [0.4.0] - 2026-11-05

### Alterado

- Perto das bordas da tela, o widget cresce para dentro: para a esquerda quando o painel não cabe à direita e para cima quando não cabe embaixo. A barra fica parada; se não couber de nenhum jeito, o widget é empurrado para dentro da tela e volta ao lugar ao fechar.
- Ao soltar o widget com parte dele fora da tela, ele volta para dentro da área útil.

### Adicionado

- Pontilhado de arrastar na barra, que aparece com o mouse em cima, no lado que fica parado.

## [0.3.0] - 2026-11-05

### Alterado

- O widget virou uma barra compacta ("mini fantasma") de cerca de 100 × 30 px: em repouso mostra só o ponto de status e a temperatura ambiente → alvo, semitransparente.
- Com o mouse em cima aparecem −/+, liga/desliga e a seta que abre o painel com modo, vento, oscilação, timer, configurações, atualizar e ocultar.
- O painel de controles fecha sozinho 6 s depois que o mouse sai e abre para cima quando não há espaço embaixo.
- A janela é transparente e acompanha o tamanho do widget, sem área invisível bloqueando cliques.
- As releases do GitHub passam a sair publicadas (antes ficavam como rascunho) e o instalador também fica como artefato do workflow.

### Adicionado

- Configuração "Opacidade sem o mouse em cima" (100%, 80% ou 55%).
- Documentação de instalação, locais dos arquivos, atualização, desinstalação e erros comuns no README e no `.env.example`.

## [0.2.0] - 2026-11-03

Não publicada em Releases (ficou como rascunho).

### Adicionado

- Tela "Conectar à conta LG": o token é informado no próprio app, testado com a LG antes de salvar e guardado no Gerenciador de Credenciais do Windows.
- Em ⚙ → Conta LG: trocar de aparelho, trocar o token e desconectar.

### Corrigido

- A temperatura alvo não volta mais na tela logo depois de mudar: o valor enviado vale até a LG confirmar (até 90 s).

### Removido

- Item "Abrir pasta do .env" do menu da bandeja.

## [0.1.0] - 2026-11-03

Não publicada em Releases (ficou como rascunho).

### Adicionado

- Widget na bandeja do Windows (Tauri 2 + React) que controla um ar-condicionado LG pela ThinQ Connect API oficial.
- Liga/desliga, temperatura alvo em passos de 1 °C, modo, velocidade do vento, oscilação e timers para ligar e desligar.
- Controles montados a partir do profile de cada modelo, com suporte a mais de um aparelho por conta (`THINQ_DEVICE_ID`).
- Interface em PT-BR e inglês, tema claro, escuro ou do sistema.
- Workflow do GitHub Actions que gera o instalador do Windows a cada tag `v*`.
- Script `scripts/thinq_probe.py` para diagnosticar o token e o aparelho.

[Não lançado]: https://github.com/FernandoPorfirio/controle-ar-condicionado/compare/v0.4.0...HEAD
[0.4.0]: https://github.com/FernandoPorfirio/controle-ar-condicionado/compare/v0.3.0...v0.4.0
[0.3.0]: https://github.com/FernandoPorfirio/controle-ar-condicionado/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/FernandoPorfirio/controle-ar-condicionado/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/FernandoPorfirio/controle-ar-condicionado/tree/v0.1.0
