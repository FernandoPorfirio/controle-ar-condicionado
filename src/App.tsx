import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { api, type AcStatus, type Mode, type TimerKind, type WindStrength } from "./api";
import { setLanguage } from "./i18n";

// A LG limita chamadas por token; 60 s é seguro para uso contínuo.
const POLL_MS = 60_000;
const REFRESH_AFTER_COMMAND_MS = 2_500;
const TEMPERATURE_DEBOUNCE_MS = 700;

const MODES: Mode[] = ["COOL", "AIR_DRY", "FAN"];
const WINDS: WindStrength[] = ["AUTO", "LOW", "MID", "HIGH"];
const TIMER_OPTIONS = [30, 60, 120, 180, 240, 360, 480];

type Theme = "system" | "light" | "dark";

function readPref<T extends string>(key: string, fallback: T): T {
  try {
    return (localStorage.getItem(key) as T) ?? fallback;
  } catch {
    return fallback;
  }
}

function writePref(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // preferência só não fica salva
  }
}

function applyTheme(theme: Theme) {
  if (theme === "system") delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = theme;
}

function formatDuration(minutes: number) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h && m ? `${h}h${String(m).padStart(2, "0")}` : h ? `${h}h` : `${m}min`;
}

function statusKey(s: AcStatus) {
  if (s.error) return "error";
  if (!s.power) return "off";
  if (s.mode === "FAN") return "fan";
  if (s.mode === "AIR_DRY") return "drying";
  if (s.currentTemperature != null && s.targetTemperature != null && s.currentTemperature <= s.targetTemperature) {
    return "reached";
  }
  return "cooling";
}

export default function App() {
  const { t, i18n } = useTranslation();
  const [status, setStatus] = useState<AcStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [theme, setTheme] = useState<Theme>(() => readPref("theme", "system"));
  const tempTimer = useRef<number | undefined>(undefined);
  const refreshTimer = useRef<number | undefined>(undefined);

  const refresh = useCallback(async () => {
    try {
      setStatus(await api.getStatus());
      setError(null);
      setUpdatedAt(new Date());
    } catch (e) {
      setError(String(e));
    }
  }, []);

  useEffect(() => {
    refresh();
    const id = window.setInterval(refresh, POLL_MS);
    const unlisten = listen("status-changed", () => window.setTimeout(refresh, REFRESH_AFTER_COMMAND_MS));
    return () => {
      window.clearInterval(id);
      unlisten.then((fn) => fn());
    };
  }, [refresh]);

  useEffect(() => applyTheme(theme), [theme]);

  /** Aplica a mudança na hora (otimista), manda para a LG e confirma o estado depois. */
  const run = useCallback(
    async (patch: Partial<AcStatus>, command: () => Promise<void>) => {
      setStatus((s) => (s ? { ...s, ...patch } : s));
      setBusy(true);
      try {
        await command();
        setError(null);
      } catch (e) {
        setError(String(e));
      } finally {
        setBusy(false);
        window.clearTimeout(refreshTimer.current);
        refreshTimer.current = window.setTimeout(refresh, REFRESH_AFTER_COMMAND_MS);
      }
    },
    [refresh],
  );

  const changeTemperature = (delta: number) => {
    if (!status?.targetTemperature) return;
    const value = Math.min(status.maxTemperature, Math.max(status.minTemperature, status.targetTemperature + delta));
    setStatus({ ...status, targetTemperature: value });
    // Agrupa cliques seguidos em um único comando.
    window.clearTimeout(tempTimer.current);
    tempTimer.current = window.setTimeout(() => run({}, () => api.setTargetTemperature(value)), TEMPERATURE_DEBOUNCE_MS);
  };

  const setTimer = (kind: TimerKind, minutes: number) => {
    const timer = minutes ? { hours: Math.floor(minutes / 60), minutes: minutes % 60 } : null;
    const field = kind === "start" ? "startTimer" : kind === "stop" ? "stopTimer" : "sleepTimer";
    run({ [field]: timer }, () => api.setTimer(kind, minutes));
  };

  const changeTheme = (value: Theme) => {
    setTheme(value);
    writePref("theme", value);
  };

  const timeFormat = new Intl.DateTimeFormat(i18n.language, { hour: "2-digit", minute: "2-digit" });
  const key = status ? statusKey(status) : "loading";
  const timerKind: TimerKind = status?.power ? "stop" : "start";
  const activeTimer = status?.power ? status.stopTimer : status?.startTimer;

  return (
    <div className="app" data-state={key}>
      <header className="titlebar" data-tauri-drag-region>
        <span className="title" data-tauri-drag-region>
          {status?.name ?? "LG ThinQ"}
        </span>
        <button className="icon" title={t("actions.refresh")} onClick={refresh} disabled={busy}>
          ↻
        </button>
        <button className="icon" title={t("actions.settings")} onClick={() => setShowSettings((v) => !v)}>
          ⚙
        </button>
        <button className="icon" title={t("actions.hide")} onClick={() => getCurrentWindow().hide()}>
          ✕
        </button>
      </header>

      {showSettings ? (
        <main className="settings">
          <h2>{t("settings.title")}</h2>
          <label>
            {t("settings.language")}
            <select value={i18n.language} onChange={(e) => setLanguage(e.target.value)}>
              <option value="pt-BR">Português (BR)</option>
              <option value="en">English</option>
            </select>
          </label>
          <label>
            {t("settings.theme")}
            <select value={theme} onChange={(e) => changeTheme(e.target.value as Theme)}>
              <option value="system">{t("settings.themeSystem")}</option>
              <option value="light">{t("settings.themeLight")}</option>
              <option value="dark">{t("settings.themeDark")}</option>
            </select>
          </label>
          {status && (
            <label className="row">
              {t("settings.displayLight")}
              <input
                type="checkbox"
                checked={status.displayLight}
                onChange={(e) => run({ displayLight: e.target.checked }, () => api.setDisplayLight(e.target.checked))}
              />
            </label>
          )}
          {status && <p className="muted">{status.model}</p>}
          <button className="secondary" onClick={() => setShowSettings(false)}>
            {t("settings.back")}
          </button>
        </main>
      ) : (
        <main>
          <section className="hero">
            <div className="state">
              <span className="dot" />
              {t(`status.${key}`)}
            </div>
            <div className="temps">
              <div>
                <span className="label">{t("room")}</span>
                <span className="big">{status?.currentTemperature ?? "–"}°</span>
              </div>
              <div className="arrow">→</div>
              <div>
                <span className="label">{t("target")}</span>
                <div className="target">
                  <button onClick={() => changeTemperature(-0.5)} disabled={!status?.power}>
                    −
                  </button>
                  <span className="big">{status?.targetTemperature ?? "–"}°</span>
                  <button onClick={() => changeTemperature(0.5)} disabled={!status?.power}>
                    +
                  </button>
                </div>
              </div>
            </div>
          </section>

          <button
            className={`power ${status?.power ? "on" : ""}`}
            disabled={!status}
            onClick={() => status && run({ power: !status.power }, () => api.setPower(!status.power))}
          >
            ⏻ {status?.power ? t("power.off") : t("power.on")}
          </button>

          <section>
            <h3>{t("mode.title")}</h3>
            <div className="segmented">
              {MODES.map((m) => (
                <button
                  key={m}
                  className={status?.mode === m ? "active" : ""}
                  disabled={!status?.power}
                  onClick={() => run({ mode: m }, () => api.setMode(m))}
                >
                  {t(`mode.${m}`)}
                </button>
              ))}
            </div>
          </section>

          <section>
            <h3>{t("wind.title")}</h3>
            <div className="segmented">
              {WINDS.map((w) => (
                <button
                  key={w}
                  className={status?.windStrength === w ? "active" : ""}
                  disabled={!status?.power}
                  onClick={() => run({ windStrength: w }, () => api.setWindStrength(w))}
                >
                  {t(`wind.${w}`)}
                </button>
              ))}
            </div>
            <label className="row">
              {t("swing")}
              <input
                type="checkbox"
                checked={status?.swing ?? false}
                disabled={!status?.power}
                onChange={(e) => run({ swing: e.target.checked }, () => api.setSwing(e.target.checked))}
              />
            </label>
          </section>

          <section>
            <h3>{t(`timer.${timerKind}`)}</h3>
            {activeTimer ? (
              <div className="row">
                <span>{t("timer.active", { time: formatDuration(activeTimer.hours * 60 + activeTimer.minutes) })}</span>
                <button className="secondary" onClick={() => setTimer(timerKind, 0)}>
                  {t("timer.cancel")}
                </button>
              </div>
            ) : (
              <select disabled={!status} value="" onChange={(e) => setTimer(timerKind, Number(e.target.value))}>
                <option value="">{t("timer.none")}</option>
                {TIMER_OPTIONS.map((m) => (
                  <option key={m} value={m}>
                    {formatDuration(m)}
                  </option>
                ))}
              </select>
            )}
          </section>
        </main>
      )}

      <footer>
        {error ? (
          <span className="error" title={error}>
            {error}
          </span>
        ) : (
          updatedAt && <span className="muted">{t("updated", { time: timeFormat.format(updatedAt) })}</span>
        )}
      </footer>
    </div>
  );
}
