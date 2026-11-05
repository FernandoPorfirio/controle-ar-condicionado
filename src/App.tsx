import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { openUrl } from "@tauri-apps/plugin-opener";
import {
  api,
  appApi,
  NOT_CONFIGURED,
  setupApi,
  type AcStatus,
  type DeviceSummary,
  type SetupInfo,
  type TimerKind,
  type TrayState,
} from "./api";
import { actionsFor, isPersistent, parseError, type AppError, type ErrorAction } from "./errors";
import { setLanguage } from "./i18n";
import Icon from "./Icon";
import Notice from "./Notice";
import Setup from "./Setup";
import { useWindowFit } from "./useWindowFit";

// A LG limita chamadas por token; 60 s é seguro para uso contínuo.
const POLL_MS = 60_000;
const REFRESH_AFTER_COMMAND_MS = 5_000;
// A nuvem da LG pode levar um tempo para refletir um comando no estado. Até lá,
// o valor enviado prevalece sobre o lido, para a interface não "voltar".
const PENDING_MS = 90_000;
const TEMPERATURE_DEBOUNCE_MS = 700;

const TIMER_OPTIONS = [30, 60, 120, 180, 240, 360, 480];
// Painel de controles fecha sozinho depois que o mouse sai.
const AUTO_CLOSE_MS = 6_000;
const IDLE_OPACITIES = ["1", "0.8", "0.55"];
// Aviso de comando recusado: some sozinho.
const NOTICE_MS = 5_000;
const PAT_URL = "https://connect-pat.lgthinq.com";
const REPO_URL = "https://github.com/FernandoPorfirio/controle-ar-condicionado";
const HELP_URL = `${REPO_URL}#problemas-comuns`;

type Panel = "controls" | "settings" | "setup" | null;

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

function applyIdleOpacity(value: string) {
  document.documentElement.style.setProperty("--idle-opacity", value);
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
  const [error, setError] = useState<AppError | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [autostart, setAutostart] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const [panel, setPanel] = useState<Panel>(null);
  const [hover, setHover] = useState(false);
  const [theme, setTheme] = useState<Theme>(() => readPref("theme", "system"));
  const [idleOpacity, setIdleOpacity] = useState<string>(() => readPref("idleOpacity", "0.55"));
  const [devices, setDevices] = useState<DeviceSummary[] | null>(null);
  const [setup, setSetup] = useState<SetupInfo | null>(null);
  const tempTimer = useRef<number | undefined>(undefined);
  const refreshTimer = useRef<number | undefined>(undefined);
  const closeTimer = useRef<number | undefined>(undefined);
  const noticeTimer = useRef<number | undefined>(undefined);
  const pending = useRef<Pending>(new Map());
  const widget = useRef<HTMLDivElement>(null);
  const dir = useWindowFit(widget, hover || panel !== null || notice !== null);

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
      if (String(e) === NOT_CONFIGURED) setPanel("setup");
      else setError(parseError(e));
    }
  }, []);

  useEffect(() => {
    setupApi.get().then(setSetup);
    refresh();
    const id = window.setInterval(refresh, POLL_MS);
    const unlisten = listen("status-changed", () => window.setTimeout(refresh, REFRESH_AFTER_COMMAND_MS));
    // O item "Iniciar com o Windows" da bandeja também muda a opção.
    const unlistenAutostart = listen<boolean>("autostart-changed", (e) => setAutostart(e.payload));
    return () => {
      window.clearInterval(id);
      unlisten.then((fn) => fn());
      unlistenAutostart.then((fn) => fn());
    };
  }, [refresh]);

  useEffect(() => applyTheme(theme), [theme]);
  useEffect(() => applyIdleOpacity(idleOpacity), [idleOpacity]);

  useEffect(() => {
    if (panel === "settings" && !devices) api.listDevices().then(setDevices, (e) => setError(parseError(e)));
    if (panel === "settings") appApi.getAutostart().then(setAutostart, () => setAutostart(null));
  }, [panel, devices]);

  /** Aviso curto colado na barra, para um comando que o ar recusou. */
  const showNotice = useCallback((text: string) => {
    setNotice(text);
    window.clearTimeout(noticeTimer.current);
    noticeTimer.current = window.setTimeout(() => setNotice(null), NOTICE_MS);
  }, []);

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
        const err = parseError(e);
        // Problemas de conexão ou de token ficam no painel; o resto é um comando recusado.
        if (isPersistent(err) && err.kind !== "unknown") setError(err);
        else showNotice(err.kind === "unknown" ? t("errors.rejected") : t(`errors.${err.kind}.text`));
      } finally {
        setBusy(false);
        window.clearTimeout(refreshTimer.current);
        refreshTimer.current = window.setTimeout(refresh, REFRESH_AFTER_COMMAND_MS);
      }
    },
    [refresh, showNotice, t],
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
    setPanel(null);
    setDevices(null);
    setStatus(null);
    setSetup(await setupApi.get());
    refresh();
  };

  const chooseDevice = (id: string) => {
    if (!setup?.country) return;
    setupApi.save(null, setup.country, id).then(onSetupDone, (e) => setError(parseError(e)));
  };

  const disconnect = async () => {
    await setupApi.clear();
    setStatus(null);
    setDevices(null);
    setSetup(await setupApi.get());
    setPanel("setup");
  };

  const changeTheme = (value: Theme) => {
    setTheme(value);
    writePref("theme", value);
  };

  const changeIdleOpacity = (value: string) => {
    setIdleOpacity(value);
    writePref("idleOpacity", value);
  };

  const changeAutostart = (on: boolean) => {
    appApi.setAutostart(on).then(
      () => setAutostart(on),
      () => showNotice(`${t("errors.autostart.title")}. ${t("errors.autostart.text")}`),
    );
  };

  const doErrorAction = (action: ErrorAction) => {
    if (action === "retry") refresh();
    else if (action === "changeToken" || action === "changeCountry") setPanel("setup");
    else if (action === "chooseDevice") setPanel("settings");
    else if (action === "openSite") openUrl(PAT_URL);
    else if (action === "howToFix") openUrl(HELP_URL);
    else if (action === "copy" && error) {
      navigator.clipboard.writeText(`${error.kind}: ${error.detail}`).then(() => {
        setCopied(true);
        window.setTimeout(() => setCopied(false), 2_000);
      });
    }
  };

  const onMouseEnter = () => {
    window.clearTimeout(closeTimer.current);
    setHover(true);
  };

  const onMouseLeave = () => {
    setHover(false);
    // Só o painel de controles fecha sozinho; configurações e conexão esperam o usuário.
    if (panel === "controls") closeTimer.current = window.setTimeout(() => setPanel(null), AUTO_CLOSE_MS);
  };

  const togglePanel = (view: Exclude<Panel, null>) => setPanel((p) => (p === view ? null : view));

  const timeFormat = new Intl.DateTimeFormat(i18n.language, { hour: "2-digit", minute: "2-digit" });
  const regionName = new Intl.DisplayNames([i18n.language], { type: "region" });
  const acs = (devices ?? []).filter((d) => d.deviceType === "DEVICE_AIR_CONDITIONER");
  const key = status ? statusKey(status) : "loading";
  const caps = status?.device.capabilities;
  const timerKind: TimerKind = status?.power ? "stop" : "start";
  const timerSupported = status?.power ? caps?.stopTimer : caps?.startTimer;
  const activeTimer = status?.power ? status.stopTimer : status?.startTimer;
  const configured = setup?.configured ?? true;
  const statusText = t(`status.${key}`);
  const updatedText = updatedAt ? t("updated", { time: timeFormat.format(updatedAt) }) : "";
  const fmt = (n: number | null | undefined) => (n == null ? "–" : `${n.toLocaleString(i18n.language)}°`);
  const errorTitle = error ? t(`errors.${error.kind}.title`) : "";

  // Ícone da bandeja: o pontinho repete a cor do estado do ar.
  useEffect(() => {
    if (!status && !error) return;
    const tray: TrayState =
      error || key === "error" ? "error" : key === "off" ? "off" : key === "cooling" || key === "heating" ? "cooling" : "idle";
    const tooltip = error
      ? errorTitle
      : `${statusText} · ${fmt(status?.currentTemperature)} → ${fmt(status?.targetTemperature)}`;
    appApi.setTrayState(tray, tooltip).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, error, errorTitle, statusText, status?.currentTemperature, status?.targetTemperature]);

  const notices = (
    <>
      {error && (
        <Notice
          severity="error"
          title={errorTitle}
          actions={
            actionsFor(error).length > 0 &&
            actionsFor(error).map((a) => (
              <button key={a} className="secondary small" onClick={() => doErrorAction(a)}>
                {a === "copy" && copied ? t("errors.actions.copied") : t(`errors.actions.${a}`)}
              </button>
            ))
          }
          footnote={
            <>
              {updatedAt && <span>{t("errors.lastRead", { time: timeFormat.format(updatedAt) })}</span>}
              {error.detail && (
                <code className="selectable" title={error.detail}>
                  {error.detail}
                </code>
              )}
            </>
          }
        >
          {t(`errors.${error.kind}.text`)}
        </Notice>
      )}
    </>
  );

  const controls = (
    <>
      {notices}
      {caps && caps.modes.length > 1 && (
        <div className="field">
          <span className="label">{t("mode.title")}</span>
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
        </div>
      )}

      {caps && caps.windStrengths.length > 0 && (
        <div className="field">
          <span className="label">{t("wind.title")}</span>
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
        </div>
      )}

      <div className="row">
        {caps?.swing ? (
          <label className="toggle">
            <input
              type="checkbox"
              checked={status?.swing ?? false}
              disabled={!status?.power}
              onChange={(e) => run({ swing: e.target.checked }, () => api.setSwing(e.target.checked))}
            />
            {t("swing")}
          </label>
        ) : (
          <span />
        )}
        {timerSupported &&
          (activeTimer ? (
            <span className="timer-active">
              <Icon name="clock" />
              {t("timer.active", { time: formatDuration(activeTimer.hours * 60 + activeTimer.minutes) })}
              <button className="text" onClick={() => setTimer(timerKind, 0)}>
                {t("timer.cancel")}
              </button>
            </span>
          ) : (
            <select
              aria-label={t(`timer.${timerKind}`)}
              disabled={!status}
              value=""
              onChange={(e) => setTimer(timerKind, Number(e.target.value))}
            >
              <option value="">{t(`timer.${timerKind}`)}…</option>
              {TIMER_OPTIONS.map((m) => (
                <option key={m} value={m}>
                  {formatDuration(m)}
                </option>
              ))}
            </select>
          ))}
      </div>

      <footer>
        <span className="muted" title={updatedText}>
          {status ? [statusText, updatedText].filter(Boolean).join(" · ") : ""}
        </span>
        <span className="grow" />
        <button className="icon" title={t("actions.refresh")} onClick={refresh} disabled={busy}>
          <Icon name="refresh" />
        </button>
        <button className="icon" title={t("actions.settings")} onClick={() => setPanel("settings")}>
          <Icon name="gear" />
        </button>
        <button className="icon" title={t("actions.hide")} onClick={() => getCurrentWindow().hide()}>
          <Icon name="close" />
        </button>
      </footer>
    </>
  );

  const settings = (
    <div className="settings">
      <h2>{t("settings.title")}</h2>
      {autostart !== null && (
        <label className="toggle">
          <input type="checkbox" checked={autostart} onChange={(e) => changeAutostart(e.target.checked)} />
          {t("settings.autostart")}
        </label>
      )}
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
      <label>
        {t("settings.idleOpacity")}
        <select value={idleOpacity} onChange={(e) => changeIdleOpacity(e.target.value)}>
          {IDLE_OPACITIES.map((v) => (
            <option key={v} value={v}>
              {Math.round(Number(v) * 100)}%
            </option>
          ))}
        </select>
      </label>
      {status && caps?.displayLight && (
        <label className="toggle">
          <input
            type="checkbox"
            checked={status.displayLight}
            onChange={(e) => run({ displayLight: e.target.checked }, () => api.setDisplayLight(e.target.checked))}
          />
          {t("settings.displayLight")}
        </label>
      )}
      <div className="account">
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
                <select value={acs.find((d) => d.selected)?.id ?? ""} onChange={(e) => chooseDevice(e.target.value)}>
                  {acs.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name} ({d.model})
                    </option>
                  ))}
                </select>
              </label>
            )}
            <div className="row">
              <button className="secondary" onClick={() => setPanel("setup")}>
                {t("account.changeToken")}
              </button>
              <button className="secondary" onClick={disconnect}>
                {t("account.disconnect")}
              </button>
            </div>
          </>
        )}
      </div>
      <button className="secondary" onClick={() => setPanel("controls")}>
        {t("settings.back")}
      </button>
    </div>
  );

  return (
    <div
      ref={widget}
      className={`widget${hover ? " hover" : ""}${panel ? " open" : ""}${dir.up ? " up" : ""}${dir.left ? " left" : ""}`}
      data-state={error ? "error" : key}
      data-power={status?.power ? "on" : "off"}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <div className="bar" data-tauri-drag-region>
        <span className="grip start" data-tauri-drag-region title={t("actions.drag")} />
        <i className="dot" title={error ? errorTitle : `${statusText}${updatedText ? ` · ${updatedText}` : ""}`} />
        {configured && status ? (
          <>
            <span className={`room num${error ? " stale" : ""}`} data-tauri-drag-region title={t("room")}>
              {fmt(status.currentTemperature)}
            </span>
            <span className="arrow" data-tauri-drag-region>
              →
            </span>
            <span className="reveal">
              <button
                className="step"
                aria-label={t("actions.colder")}
                onClick={() => changeTemperature(-1)}
                disabled={!status.power}
              >
                −
              </button>
            </span>
            <span className={`target num${error ? " stale" : ""}`} data-tauri-drag-region title={t("target")}>
              {fmt(status.targetTemperature)}
            </span>
            <span className="reveal">
              <button
                className="step"
                aria-label={t("actions.warmer")}
                onClick={() => changeTemperature(1)}
                disabled={!status.power}
              >
                +
              </button>
              <button
                className="power"
                title={status.power ? t("power.off") : t("power.on")}
                disabled={!caps?.power}
                onClick={() => run({ power: !status.power }, () => api.setPower(!status.power))}
              >
                <Icon name="power" />
              </button>
              <button className="icon more" title={t("actions.more")} onClick={() => togglePanel("controls")}>
                <Icon name="chevron" />
              </button>
            </span>
          </>
        ) : (
          <>
            <span className="bar-text" data-tauri-drag-region>
              {!configured ? t("setup.title") : error ? errorTitle : t("status.loading")}
            </span>
            {configured && error && (
              <span className="reveal">
                <button className="icon more" title={t("actions.more")} onClick={() => togglePanel("controls")}>
                  <Icon name="chevron" />
                </button>
              </span>
            )}
          </>
        )}
        <span className="grip end" data-tauri-drag-region title={t("actions.drag")} />
      </div>

      {notice && (
        <div className="bar-notice">
          <Notice severity="warning">{notice}</Notice>
        </div>
      )}

      {panel && (
        <div className="panel">
          {panel === "setup" ? (
            <Setup
              initialCountry={setup?.country ?? null}
              hasToken={setup?.source === "app"}
              offerAutostart={!setup?.configured}
              onDone={onSetupDone}
              onCancel={setup?.configured ? () => setPanel("settings") : undefined}
            />
          ) : panel === "settings" ? (
            settings
          ) : (
            controls
          )}
        </div>
      )}
    </div>
  );
}
