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
  },
  updated: "Atualizado {{time}}",
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
  },
  updated: "Updated {{time}}",
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
