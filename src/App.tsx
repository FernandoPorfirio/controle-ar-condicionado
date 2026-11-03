import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import {
  api,
  NOT_CONFIGURED,
  setupApi,
  type AcStatus,
  type DeviceSummary,
  type SetupInfo,
  type TimerKind,
} from "./api";
import { setLanguage } from "./i18n";
import Setup from "./Setup";

// A LG limita chamadas por token; 60 s é seguro para uso contínuo.
const POLL_MS = 60_000;
const REFRESH_AFTER_COMMAND_MS = 5_000;
// A nuvem da LG pode levar um tempo para refletir um comando no estado. Até lá,
// o valor enviado prevalece sobre o lido, para a interface não "voltar".
const PENDING_MS = 90_000;
const TEMPERATURE_DEBOUNCE_MS = 700;

const TIMER_OPTIONS = [30, 60, 120, 180, 240, 360, 480];

type Theme = "system" | "light" | "dark";
type Pending = Map<string, { value: unknown; until: number }>;

/** Aplica sobre o estado lido os comandos ainda não confirmados pela LG. */
function withPending(fresh: AcStatus, pending: Pending): AcStatus {
  const merged: Record<string, unknown> = { ...fresh };
  const now = Date.now();
  for (const [key, p] of pending) {
    if (p.until < now || JSON.stringify(merged[key]) === JSON.stringify(p.value)) pending.delete(key);
    else merged[key] = p.value;
  }
  return merged as unknown as AcStatus;
}

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
  const reached = (heating: boolean) =>
    s.currentTemperature != null &&
    s.targetTemperature != null &&
    (heating ? s.currentTemperature >= s.targetTemperature : s.currentTemperature <= s.targetTemperature);
  if (s.mode === "COOL") return reached(false) ? "reached" : "cooling";
  if (s.mode === "HEAT") return reached(true) ? "reached" : "heating";
  if (s.mode === "AUTO") return "auto";
  if (s.mode === "AIR_DRY") return "drying";
  return "fan";
}

export default function App() {
  const { t, i18n } = useTranslation();
  const [status, setStatus] = useState<AcStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [theme, setTheme] = useState<Theme>(() => readPref("theme", "system"));
  const [devices, setDevices] = useState<DeviceSummary[] | null>(null);
  const [setup, setSetup] = useState<SetupInfo | null>(null);
  const [showSetup, setShowSetup] = useState(false);
  const tempTimer = useRef<number | undefined>(undefined);
  const refreshTimer = useRef<number | undefined>(undefined);
  const pending = useRef<Pending>(new Map());

  const markPending = (patch: Partial<AcStatus>) => {
    for (const [key, value] of Object.entries(patch))
      pending.current.set(key, { value, until: Date.now() + PENDING_MS });
  };

  const refresh = useCallback(async () => {
    try {
      setStatus(withPending(await api.getStatus(), pending.current));
      setError(null);
      setUpdatedAt(new Date());
    } catch (e) {
      if (String(e) === NOT_CONFIGURED) setShowSetup(true);
      else setError(String(e));
    }
  }, []);

  useEffect(() => {
    setupApi.get().then(setSetup);
    refresh();
    const id = window.setInterval(refresh, POLL_MS);
    const unlisten = listen("status-changed", () => window.setTimeout(refresh, REFRESH_AFTER_COMMAND_MS));
    return () => {
      window.clearInterval(id);
      unlisten.then((fn) => fn());
    };
  }, [refresh]);

  useEffect(() => applyTheme(theme), [theme]);

  useEffect(() => {
    if (showSettings && !devices) api.listDevices().then(setDevices, (e) => setError(String(e)));
  }, [showSettings, devices]);

  /** Aplica a mudança na hora (otimista), manda para a LG e confirma o estado depois. */
  const run = useCallback(
    async (patch: Partial<AcStatus>, command: () => Promise<void>) => {
      setStatus((s) => (s ? { ...s, ...patch } : s));
      markPending(patch);
      setBusy(true);
      try {
        await command();
        setError(null);
      } catch (e) {
        // O comando falhou: o estado lido volta a valer.
        for (const key of Object.keys(patch)) pending.current.delete(key);
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
    const { minTemperature, maxTemperature, temperatureStep } = status.device.capabilities;
    // Passo de 1 °C (ou maior, se o modelo exigir); arredonda alvos de 0,5 ajustados no app da LG.
    const step = Math.max(1, temperatureStep);
    const next = Math.round((status.targetTemperature + delta * step) / step) * step;
    const value = Math.min(maxTemperature, Math.max(minTemperature, next));
    const mode = status.mode;
    setStatus({ ...status, targetTemperature: value });
    markPending({ targetTemperature: value });
    // Agrupa cliques seguidos em um único comando.
    window.clearTimeout(tempTimer.current);
    tempTimer.current = window.setTimeout(
      () => run({ targetTemperature: value }, () => api.setTargetTemperature(value, mode)),
      TEMPERATURE_DEBOUNCE_MS,
    );
  };

  const setTimer = (kind: TimerKind, minutes: number) => {
    const timer = minutes ? { hours: Math.floor(minutes / 60), minutes: minutes % 60 } : null;
    const field = kind === "start" ? "startTimer" : kind === "stop" ? "stopTimer" : "sleepTimer";
    run({ [field]: timer }, () => api.setTimer(kind, minutes));
  };

  /** Depois de salvar token, país ou aparelho: recarrega tudo do zero. */
  const onSetupDone = async () => {
    pending.current.clear();
    setShowSetup(false);
    setShowSettings(false);
    setDevices(null);
    setStatus(null);
    setSetup(await setupApi.get());
    refresh();
  };

  const chooseDevice = (id: string) => {
    if (!setup?.country) return;
    setupApi.save(null, setup.country, id).then(onSetupDone, (e) => setError(String(e)));
  };

  const disconnect = async () => {
    await setupApi.clear();
    setStatus(null);
    setDevices(null);
    setShowSettings(false);
    setSetup(await setupApi.get());
    setShowSetup(true);
  };

  const changeTheme = (value: Theme) => {
    setTheme(value);
    writePref("theme", value);
  };

  const timeFormat = new Intl.DateTimeFormat(i18n.language, { hour: "2-digit", minute: "2-digit" });
  const regionName = new Intl.DisplayNames([i18n.language], { type: "region" });
  const acs = (devices ?? []).filter((d) => d.deviceType === "DEVICE_AIR_CONDITIONER");
  const key = status ? statusKey(status) : "loading";
  const caps = status?.device.capabilities;
  const timerKind: TimerKind = status?.power ? "stop" : "start";
  const timerSupported = status?.power ? caps?.stopTimer : caps?.startTimer;
  const activeTimer = status?.power ? status.stopTimer : status?.startTimer;

  return (
    <div className="app" data-state={key}>
      <header className="titlebar" data-tauri-drag-region>
        <span className="title" data-tauri-drag-region>
          {status?.device.name ?? "LG ThinQ"}
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

      {showSetup ? (
        <Setup
          initialCountry={setup?.country ?? null}
          hasToken={setup?.source === "app"}
          onDone={onSetupDone}
          onCancel={setup?.configured ? () => setShowSetup(false) : undefined}
        />
      ) : showSettings ? (
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
          {status && caps?.displayLight && (
            <label className="row">
              {t("settings.displayLight")}
              <input
                type="checkbox"
                checked={status.displayLight}
                onChange={(e) => run({ displayLight: e.target.checked }, () => api.setDisplayLight(e.target.checked))}
              />
            </label>
          )}
          <div>
            <h2>{t("account.title")}</h2>
            {setup?.source === "env" ? (
              <>
                <p className="muted">{t("account.fromEnv")}</p>
                {devices && (
                  <ul className="devices">
                    {devices.map((d) => (
                      <li key={d.id}>
                        <span>
                          <strong>{d.name}</strong> {d.selected && <span className="badge">{t("settings.inUse")}</span>}
                        </span>
                        <span className="muted">
                          {d.model} · {d.deviceType.replace("DEVICE_", "")}
                        </span>
                        <code className="selectable">{d.id}</code>
                      </li>
                    ))}
                  </ul>
                )}
                {devices && devices.length > 1 && <p className="muted">{t("settings.devicesHint")}</p>}
              </>
            ) : (
              <>
                <p className="muted">
                  {t("account.country")}: {setup?.country ? regionName.of(setup.country) : "–"}
                </p>
                {acs.length > 1 && (
                  <label>
                    {t("account.device")}
                    <select
                      value={acs.find((d) => d.selected)?.id ?? ""}
                      onChange={(e) => chooseDevice(e.target.value)}
                    >
                      {acs.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.name} ({d.model})
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                <div className="row">
                  <button className="secondary" onClick={() => setShowSetup(true)}>
                    {t("account.changeToken")}
                  </button>
                  <button className="secondary" onClick={disconnect}>
                    {t("account.disconnect")}
                  </button>
                </div>
              </>
            )}
          </div>
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
                  <button onClick={() => changeTemperature(-1)} disabled={!status?.power}>
                    −
                  </button>
                  <span className="big">{status?.targetTemperature ?? "–"}°</span>
                  <button onClick={() => changeTemperature(1)} disabled={!status?.power}>
                    +
                  </button>
                </div>
              </div>
            </div>
          </section>

          <button
            className={`power ${status?.power ? "on" : ""}`}
            disabled={!caps?.power}
            onClick={() => status && run({ power: !status.power }, () => api.setPower(!status.power))}
          >
            ⏻ {status?.power ? t("power.off") : t("power.on")}
          </button>

          {caps && caps.modes.length > 1 && (
            <section>
              <h3>{t("mode.title")}</h3>
              <div className="segmented">
                {caps.modes.map((m) => (
                  <button
                    key={m}
                    className={status?.mode === m ? "active" : ""}
                    disabled={!status?.power}
                    onClick={() => run({ mode: m }, () => api.setMode(m))}
                  >
                    {t(`mode.${m}`, { defaultValue: m })}
                  </button>
                ))}
              </div>
            </section>
          )}

          {caps && (caps.windStrengths.length > 0 || caps.swing) && (
            <section>
              <h3>{t("wind.title")}</h3>
              <div className="segmented">
                {caps.windStrengths.map((w) => (
                  <button
                    key={w}
                    className={status?.windStrength === w ? "active" : ""}
                    disabled={!status?.power}
                    onClick={() => run({ windStrength: w }, () => api.setWindStrength(w))}
                  >
                    {t(`wind.${w}`, { defaultValue: w })}
                  </button>
                ))}
              </div>
              {caps.swing && (
                <label className="row">
                  {t("swing")}
                  <input
                    type="checkbox"
                    checked={status?.swing ?? false}
                    disabled={!status?.power}
                    onChange={(e) => run({ swing: e.target.checked }, () => api.setSwing(e.target.checked))}
                  />
                </label>
              )}
            </section>
          )}

          {timerSupported && (
            <section>
              <h3>{t(`timer.${timerKind}`)}</h3>
              {activeTimer ? (
                <div className="row">
                  <span>
                    {t("timer.active", { time: formatDuration(activeTimer.hours * 60 + activeTimer.minutes) })}
                  </span>
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
          )}
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
