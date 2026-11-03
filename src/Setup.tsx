import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { openUrl } from "@tauri-apps/plugin-opener";
import { setupApi, type DeviceSummary } from "./api";

const PAT_URL = "https://connect-pat.lgthinq.com";
const AIR_CONDITIONER = "DEVICE_AIR_CONDITIONER";
// prettier-ignore
const COUNTRIES = [
  "BR", "US", "CA", "MX", "AR", "CL", "CO", "PE", "UY", "PT", "ES", "GB", "FR", "DE", "IT", "NL",
  "AU", "NZ", "IN", "KR", "JP",
];

interface Props {
  initialCountry: string | null;
  /** Já existe um token salvo: o campo pode ficar vazio para mantê-lo. */
  hasToken: boolean;
  onDone: () => void;
  onCancel?: () => void;
}

/** Primeira configuração: token da LG, país e (se houver mais de um) qual ar controlar. */
export default function Setup({ initialCountry, hasToken, onDone, onCancel }: Props) {
  const { t, i18n } = useTranslation();
  const [token, setToken] = useState("");
  const [country, setCountry] = useState(initialCountry ?? (i18n.language === "pt-BR" ? "BR" : "US"));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [acs, setAcs] = useState<DeviceSummary[] | null>(null);

  const regionName = useMemo(() => new Intl.DisplayNames([i18n.language], { type: "region" }), [i18n.language]);
  const countries = useMemo(
    () =>
      COUNTRIES.map((code) => ({ code, name: regionName.of(code) ?? code })).sort((a, b) =>
        a.name.localeCompare(b.name, i18n.language),
      ),
    [regionName, i18n.language],
  );

  const connect = async () => {
    setBusy(true);
    setError(null);
    try {
      const found = (await setupApi.save(token || null, country, null)).filter((d) => d.deviceType === AIR_CONDITIONER);
      if (found.length > 1) setAcs(found);
      else onDone();
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  };

  const chooseDevice = async (id: string) => {
    setBusy(true);
    try {
      await setupApi.save(null, country, id);
      onDone();
    } catch (e) {
      setError(String(e));
      setBusy(false);
    }
  };

  if (acs) {
    return (
      <main className="settings">
        <h2>{t("setup.chooseDevice")}</h2>
        <div className="device-choices">
          {acs.map((d) => (
            <button key={d.id} disabled={busy} onClick={() => chooseDevice(d.id)}>
              <strong>{d.name}</strong>
              <span className="muted">{d.model}</span>
            </button>
          ))}
        </div>
        {error && <p className="error">{error}</p>}
      </main>
    );
  }

  return (
    <main className="settings">
      <h2>{t("setup.title")}</h2>
      <ol className="steps">
        <li>
          {t("setup.step1")}{" "}
          <button className="link" onClick={() => openUrl(PAT_URL)}>
            connect-pat.lgthinq.com
          </button>
        </li>
        <li>{t("setup.step2")}</li>
        <li>{t("setup.step3")}</li>
        <li>{t("setup.step4")}</li>
      </ol>
      <label>
        {t("setup.country")}
        <select value={country} onChange={(e) => setCountry(e.target.value)}>
          {countries.map((c) => (
            <option key={c.code} value={c.code}>
              {c.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        {t("setup.token")}
        <input
          type="password"
          value={token}
          placeholder={hasToken ? t("setup.keepToken") : "thinqpat_…"}
          autoComplete="off"
          spellCheck={false}
          onChange={(e) => setToken(e.target.value)}
        />
      </label>
      {error && <p className="error">{error}</p>}
      <button className="primary" disabled={busy || (!token && !hasToken)} onClick={connect}>
        {busy ? t("setup.connecting") : t("setup.connect")}
      </button>
      {onCancel && (
        <button className="secondary" onClick={onCancel}>
          {t("settings.back")}
        </button>
      )}
      <p className="muted small">{t("setup.privacy")}</p>
    </main>
  );
}
