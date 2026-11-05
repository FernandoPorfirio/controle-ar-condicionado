/**
 * O backend devolve erros como "tipo" ou "tipo|detalhe técnico". O tipo vira um
 * texto traduzido (título, explicação e ações) e o detalhe aparece em letra
 * pequena, para quem precisar pedir ajuda.
 */
export interface AppError {
  kind: string;
  detail: string;
}

export type ErrorAction =
  | "retry"
  | "changeToken"
  | "openSite"
  | "howToFix"
  | "changeCountry"
  | "chooseDevice"
  | "copy";

const KNOWN = new Set([
  "offline",
  "lg_down",
  "device_offline",
  "token_invalid",
  "token_country",
  "country_mismatch",
  "no_control",
  "rate_limited",
  "device_missing",
  "no_ac",
  "credentials",
  "env_locked",
  "autostart",
  "unsupported",
  "token_required",
  "lg",
]);

/** Erros que continuam até a causa ser resolvida (conexão, token, aparelho). */
const PERSISTENT = new Set([
  "offline",
  "lg_down",
  "device_offline",
  "token_invalid",
  "token_country",
  "country_mismatch",
  "no_control",
  "rate_limited",
  "device_missing",
  "no_ac",
  "credentials",
]);

const ACTIONS: Record<string, ErrorAction[]> = {
  offline: ["retry"],
  lg_down: ["retry"],
  device_offline: ["retry"],
  token_invalid: ["changeToken", "openSite"],
  token_country: ["changeToken", "howToFix"],
  country_mismatch: ["changeCountry"],
  no_control: ["changeToken"],
  rate_limited: [],
  device_missing: ["chooseDevice"],
  no_ac: ["changeToken"],
  credentials: ["retry"],
  unknown: ["retry", "copy"],
};

export function parseError(e: unknown): AppError {
  const text = String(e);
  const bar = text.indexOf("|");
  const kind = bar > 0 ? text.slice(0, bar) : text;
  const detail = bar > 0 ? text.slice(bar + 1) : "";
  if (!KNOWN.has(kind)) return { kind: "unknown", detail: text };
  // Erro da LG sem tipo conhecido: mesmo texto do "qualquer outro".
  return kind === "lg" ? { kind: "unknown", detail } : { kind, detail };
}

export const isPersistent = (error: AppError) => PERSISTENT.has(error.kind) || error.kind === "unknown";

export const actionsFor = (error: AppError): ErrorAction[] => ACTIONS[error.kind] ?? [];
