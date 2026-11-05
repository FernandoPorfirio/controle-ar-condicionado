import i18n from "i18next";
import { initReactI18next } from "react-i18next";

const ptBR = {
  status: {
    cooling: "Gelando",
    heating: "Aquecendo",
    auto: "Automático",
    reached: "Na temperatura",
    fan: "Ventilando",
    drying: "Desumidificando",
    off: "Desligado",
    error: "Erro no aparelho",
    loading: "Carregando…",
  },
  room: "Ambiente",
  target: "Alvo",
  power: { on: "Ligar", off: "Desligar" },
  mode: {
    title: "Modo",
    COOL: "Frio",
    HEAT: "Quente",
    AUTO: "Auto",
    AIR_DRY: "Secar",
    FAN: "Ventilar",
    AIR_CLEAN: "Purificar",
    ENERGY_SAVING: "Econômico",
  },
  wind: {
    title: "Vento",
    AUTO: "Auto",
    SLOW: "Mínimo",
    LOW: "Baixo",
    MID: "Médio",
    HIGH: "Alto",
    POWER: "Turbo",
    NATURE: "Natural",
  },
  swing: "Oscilar",
  timer: {
    stop: "Desligar em",
    start: "Ligar em",
    none: "Sem timer",
    active: "{{time}} restantes",
    cancel: "Cancelar",
  },
  settings: {
    title: "Configurações",
    language: "Idioma",
    theme: "Tema",
    themeSystem: "Sistema",
    themeLight: "Claro",
    themeDark: "Escuro",
    displayLight: "Luz do display do ar",
    idleOpacity: "Opacidade sem o mouse em cima",
    autostart: "Iniciar com o Windows",
    devices: "Aparelhos na conta",
    devicesHint: "Para controlar outro ar, coloque o ID dele em THINQ_DEVICE_ID no .env e reinicie o app.",
    inUse: "em uso",
    back: "Voltar",
  },
  setup: {
    title: "Conectar à conta LG",
    step1: "Abra o site de tokens da LG:",
    step2: "Antes de entrar, escolha o país da sua conta LG (se o site abrir em outro idioma, use uma aba anônima).",
    step3: "Entre com e-mail e senha, não pelo QR code nem login do Google/Apple.",
    step4: "Crie um token marcando todas as permissões e cole abaixo.",
    country: "País da conta LG",
    token: "Token (PAT)",
    keepToken: "Deixe vazio para manter o atual",
    connect: "Conectar",
    connecting: "Conectando…",
    chooseDevice: "Qual ar-condicionado controlar?",
    autostart: "Abrir junto com o Windows",
    privacy: "O token fica guardado no Gerenciador de Credenciais do Windows e só é usado para falar com a LG.",
  },
  account: {
    title: "Conta LG",
    country: "País",
    device: "Ar-condicionado",
    changeToken: "Trocar token",
    disconnect: "Desconectar",
    fromEnv: "Configurado pelo arquivo .env. Edite o arquivo para mudar.",
  },
  actions: {
    hide: "Ocultar",
    settings: "Configurações",
    refresh: "Atualizar",
    more: "Mais controles",
    colder: "Diminuir temperatura",
    warmer: "Aumentar temperatura",
    drag: "Arraste para mover",
  },
  updated: "Atualizado {{time}}",
  errors: {
    offline: {
      title: "Sem conexão com a internet",
      text: "Os comandos voltam quando a conexão voltar. Tentando de novo a cada minuto.",
    },
    lg_down: {
      title: "A LG não está respondendo",
      text: "O problema está nos servidores da LG. Tentando de novo a cada minuto.",
    },
    device_offline: {
      title: "O ar-condicionado está offline",
      text: "Ele não está conectado ao Wi-Fi. Confira se está na tomada e se aparece no app LG ThinQ.",
    },
    token_invalid: {
      title: "O token da LG não vale mais",
      text: "Ele pode ter sido apagado ou expirado. Gere outro no site da LG e cole aqui.",
    },
    token_country: {
      title: "A LG recusou o token",
      text: "Ele foi criado com o país errado. Gere outro escolhendo o país antes de entrar no site.",
    },
    country_mismatch: { title: "País diferente do da conta", text: "Escolha o mesmo país da sua conta LG." },
    no_control: { title: "Token sem permissão para controlar", text: "Gere outro token marcando todas as permissões." },
    rate_limited: {
      title: "A LG pausou o acesso por um tempo",
      text: "Foram muitas chamadas em pouco tempo. O app tenta de novo sozinho em alguns minutos.",
    },
    device_missing: { title: "Ar-condicionado não encontrado", text: "Ele pode ter sido removido da conta LG." },
    no_ac: {
      title: "Nenhum ar-condicionado nesta conta",
      text: "Use o token da conta LG onde o ar está cadastrado no app ThinQ.",
    },
    credentials: {
      title: "Não deu para usar o Gerenciador de Credenciais",
      text: "O Windows não deixou ler ou salvar o token. Tente de novo; se continuar, reinicie o PC.",
    },
    env_locked: { title: "Configurado pelo .env", text: "Edite o arquivo .env para mudar a configuração." },
    autostart: {
      title: "Não deu para mudar o início com o Windows",
      text: "Tente de novo. A opção também fica em Configurações do Windows → Aplicativos → Inicialização.",
    },
    token_required: { title: "Falta o token", text: "Cole o token gerado no site da LG." },
    unsupported: { title: "Não disponível neste modelo", text: "O seu ar-condicionado não tem essa função." },
    unknown: {
      title: "Algo deu errado com a LG",
      text: "Tente de novo em instantes. Se continuar, abra um issue no GitHub com o código abaixo.",
    },
    rejected: "O ar não aceitou a mudança. Alguns ajustes só funcionam com ele ligado.",
    lastRead: "Última leitura às {{time}}",
    actions: {
      retry: "Tentar agora",
      changeToken: "Trocar token",
      openSite: "Abrir site da LG",
      howToFix: "Como resolver",
      changeCountry: "Trocar país",
      chooseDevice: "Escolher aparelho",
      copy: "Copiar detalhes",
      copied: "Copiado",
    },
  },
  close: "Fechar",
};

const en: typeof ptBR = {
  status: {
    cooling: "Cooling",
    heating: "Heating",
    auto: "Auto",
    reached: "At target",
    fan: "Fan only",
    drying: "Drying",
    off: "Off",
    error: "Device error",
    loading: "Loading…",
  },
  room: "Room",
  target: "Target",
  power: { on: "Turn on", off: "Turn off" },
  mode: {
    title: "Mode",
    COOL: "Cool",
    HEAT: "Heat",
    AUTO: "Auto",
    AIR_DRY: "Dry",
    FAN: "Fan",
    AIR_CLEAN: "Purify",
    ENERGY_SAVING: "Eco",
  },
  wind: {
    title: "Fan speed",
    AUTO: "Auto",
    SLOW: "Min",
    LOW: "Low",
    MID: "Mid",
    HIGH: "High",
    POWER: "Turbo",
    NATURE: "Natural",
  },
  swing: "Swing",
  timer: {
    stop: "Turn off in",
    start: "Turn on in",
    none: "No timer",
    active: "{{time}} left",
    cancel: "Cancel",
  },
  settings: {
    title: "Settings",
    language: "Language",
    theme: "Theme",
    themeSystem: "System",
    themeLight: "Light",
    themeDark: "Dark",
    displayLight: "AC display light",
    idleOpacity: "Opacity when not hovered",
    autostart: "Start with Windows",
    devices: "Devices on the account",
    devicesHint: "To control another AC, put its ID in THINQ_DEVICE_ID in .env and restart the app.",
    inUse: "in use",
    back: "Back",
  },
  setup: {
    title: "Connect your LG account",
    step1: "Open LG's token site:",
    step2: "Before signing in, pick your LG account's country (use a private window if the site opens in another language).",
    step3: "Sign in with email and password, not the QR code or Google/Apple sign-in.",
    step4: "Create a token with every permission checked and paste it below.",
    country: "LG account country",
    token: "Token (PAT)",
    keepToken: "Leave empty to keep the current one",
    connect: "Connect",
    connecting: "Connecting…",
    chooseDevice: "Which air conditioner?",
    autostart: "Open when Windows starts",
    privacy: "The token is stored in Windows Credential Manager and only used to talk to LG.",
  },
  account: {
    title: "LG account",
    country: "Country",
    device: "Air conditioner",
    changeToken: "Change token",
    disconnect: "Disconnect",
    fromEnv: "Configured by the .env file. Edit the file to change it.",
  },
  actions: {
    hide: "Hide",
    settings: "Settings",
    refresh: "Refresh",
    more: "More controls",
    colder: "Lower temperature",
    warmer: "Raise temperature",
    drag: "Drag to move",
  },
  updated: "Updated {{time}}",
  errors: {
    offline: {
      title: "No internet connection",
      text: "Commands will work again once you're back online. Retrying every minute.",
    },
    lg_down: { title: "LG isn't responding", text: "The problem is on LG's servers. Retrying every minute." },
    device_offline: {
      title: "The air conditioner is offline",
      text: "It isn't connected to Wi-Fi. Check that it's plugged in and shows up in the LG ThinQ app.",
    },
    token_invalid: {
      title: "The LG token is no longer valid",
      text: "It may have been deleted or expired. Create another one on LG's site and paste it here.",
    },
    token_country: {
      title: "LG rejected the token",
      text: "It was created with the wrong country. Create another one, picking the country before signing in.",
    },
    country_mismatch: { title: "Country doesn't match the account", text: "Pick the same country as your LG account." },
    no_control: { title: "Token can't control devices", text: "Create another token with every permission checked." },
    rate_limited: {
      title: "LG paused access for a while",
      text: "Too many calls in a short time. The app will retry on its own in a few minutes.",
    },
    device_missing: { title: "Air conditioner not found", text: "It may have been removed from the LG account." },
    no_ac: {
      title: "No air conditioner on this account",
      text: "Use the token of the LG account where the AC is registered in the ThinQ app.",
    },
    credentials: {
      title: "Couldn't use Credential Manager",
      text: "Windows didn't allow reading or saving the token. Try again; if it keeps happening, restart the PC.",
    },
    env_locked: { title: "Configured by .env", text: "Edit the .env file to change the configuration." },
    autostart: {
      title: "Couldn't change start with Windows",
      text: "Try again. The option is also in Windows Settings → Apps → Startup.",
    },
    token_required: { title: "Token missing", text: "Paste the token created on LG's site." },
    unsupported: { title: "Not available on this model", text: "Your air conditioner doesn't have this feature." },
    unknown: {
      title: "Something went wrong with LG",
      text: "Try again in a moment. If it keeps happening, open a GitHub issue with the code below.",
    },
    rejected: "The AC didn't accept the change. Some settings only work while it's on.",
    lastRead: "Last reading at {{time}}",
    actions: {
      retry: "Try now",
      changeToken: "Change token",
      openSite: "Open LG's site",
      howToFix: "How to fix",
      changeCountry: "Change country",
      chooseDevice: "Choose device",
      copy: "Copy details",
      copied: "Copied",
    },
  },
  close: "Close",
};

function savedLanguage(): string {
  try {
    const saved = localStorage.getItem("language");
    if (saved) return saved;
  } catch {
    // sem localStorage: segue o idioma do sistema
  }
  return navigator.language.toLowerCase().startsWith("pt") ? "pt-BR" : "en";
}

i18n.use(initReactI18next).init({
  resources: { "pt-BR": { translation: ptBR }, en: { translation: en } },
  lng: savedLanguage(),
  fallbackLng: "en",
  interpolation: { escapeValue: false },
});

export function setLanguage(lng: string) {
  i18n.changeLanguage(lng);
  document.documentElement.lang = lng;
  try {
    localStorage.setItem("language", lng);
  } catch {
    // preferência só não fica salva
  }
}

export default i18n;
