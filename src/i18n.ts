import i18n from "i18next";
import { initReactI18next } from "react-i18next";

const ptBR = {
  status: {
    cooling: "Gelando",
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
  mode: { title: "Modo", COOL: "Frio", AIR_DRY: "Secar", FAN: "Ventilar" },
  wind: { title: "Vento", AUTO: "Auto", LOW: "Baixo", MID: "Médio", HIGH: "Alto" },
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
    back: "Voltar",
  },
  actions: { hide: "Ocultar", settings: "Configurações", refresh: "Atualizar" },
  updated: "Atualizado {{time}}",
};

const en: typeof ptBR = {
  status: {
    cooling: "Cooling",
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
  mode: { title: "Mode", COOL: "Cool", AIR_DRY: "Dry", FAN: "Fan" },
  wind: { title: "Fan speed", AUTO: "Auto", LOW: "Low", MID: "Mid", HIGH: "High" },
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
    back: "Back",
  },
  actions: { hide: "Hide", settings: "Settings", refresh: "Refresh" },
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
