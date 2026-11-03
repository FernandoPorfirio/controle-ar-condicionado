//! Cliente mínimo da LG ThinQ Connect API para um ar-condicionado.
//!
//! O token (PAT) só existe aqui no lado Rust; a interface React nunca o vê.
//! O que cada modelo suporta (modos, vento, faixa de temperatura, timers)
//! vem do profile do aparelho, não de valores fixos.

use std::env;
use std::path::PathBuf;

use base64::Engine;
use base64::engine::general_purpose::URL_SAFE_NO_PAD;
use serde::Serialize;
use serde_json::{Value, json};
use tokio::sync::Mutex;

// Chave pública do cliente ThinQ Connect (a mesma do SDK oficial thinqconnect).
const API_KEY: &str = "v6GFvkweNo7DK7yD3ylIZ9w52aKBU0eJ7wLXkSR3";

const AMERICAS: &[&str] = &["BR", "US", "CA", "MX", "AR", "CL", "CO", "PE", "UY", "PY"];
const EUROPE: &[&str] = &["PT", "ES", "FR", "DE", "IT", "GB", "NL", "BE", "PL", "SE", "IE", "AT", "CH"];

const AIR_CONDITIONER: &str = "DEVICE_AIR_CONDITIONER";

// Campos de temperatura alvo, do mais genérico para os específicos de cada modo.
const TARGET_FIELDS: &[(&str, Option<&str>)] = &[
    ("targetTemperature", None),
    ("coolTargetTemperature", Some("COOL")),
    ("heatTargetTemperature", Some("HEAT")),
    ("autoTargetTemperature", Some("AUTO")),
];

pub struct Config {
    pub token: String,
    pub country: String,
    pub client_id: String,
    pub device_id: Option<String>,
}

impl Config {
    /// Lê THINQ_* do ambiente, carregando o primeiro .env encontrado nos `dirs`.
    pub fn load(dirs: &[PathBuf]) -> Result<Self, String> {
        for dir in dirs {
            let file = dir.join(".env");
            if file.is_file() {
                let _ = dotenvy::from_path(&file);
                break;
            }
        }
        let var = |name: &str| env::var(name).ok().map(|v| v.trim().to_string()).filter(|v| !v.is_empty());
        let token = var("THINQ_PAT").ok_or("THINQ_PAT não encontrado (.env)")?;
        Ok(Self {
            token,
            country: var("THINQ_COUNTRY").unwrap_or_else(|| "BR".into()).to_uppercase(),
            client_id: var("THINQ_CLIENT_ID").unwrap_or_else(|| uuid::Uuid::new_v4().to_string()),
            device_id: var("THINQ_DEVICE_ID"),
        })
    }
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Timer {
    pub hours: u32,
    pub minutes: u32,
}

/// O que o modelo aceita, lido do profile.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Capabilities {
    pub power: bool,
    pub modes: Vec<String>,
    pub wind_strengths: Vec<String>,
    pub min_temperature: f64,
    pub max_temperature: f64,
    pub temperature_step: f64,
    pub swing: bool,
    pub display_light: bool,
    pub start_timer: bool,
    pub stop_timer: bool,
    pub sleep_timer: bool,
    #[serde(skip)]
    target_fields: Vec<(&'static str, Option<&'static str>)>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DeviceInfo {
    pub id: String,
    pub name: String,
    pub model: String,
    pub capabilities: Capabilities,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DeviceSummary {
    pub id: String,
    pub name: String,
    pub model: String,
    pub device_type: String,
    pub selected: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AcStatus {
    pub device: DeviceInfo,
    pub power: bool,
    pub error: bool,
    pub mode: String,
    pub current_temperature: Option<f64>,
    pub target_temperature: Option<f64>,
    pub wind_strength: Option<String>,
    pub swing: bool,
    pub display_light: bool,
    pub start_timer: Option<Timer>,
    pub stop_timer: Option<Timer>,
    pub sleep_timer: Option<Timer>,
}

pub struct ThinqClient {
    http: reqwest::Client,
    config: Config,
    base_url: String,
    device: Mutex<Option<DeviceInfo>>,
}

impl ThinqClient {
    pub fn new(config: Config) -> Self {
        let region = if AMERICAS.contains(&config.country.as_str()) {
            "aic"
        } else if EUROPE.contains(&config.country.as_str()) {
            "eic"
        } else {
            "kic"
        };
        Self {
            http: reqwest::Client::new(),
            base_url: format!("https://api-{region}.lgthinq.com"),
            config,
            device: Mutex::new(None),
        }
    }

    async fn request(&self, method: reqwest::Method, path: &str, body: Option<Value>) -> Result<Value, String> {
        let message_id = URL_SAFE_NO_PAD.encode(uuid::Uuid::new_v4().as_bytes());
        let mut req = self
            .http
            .request(method, format!("{}{}", self.base_url, path))
            .bearer_auth(&self.config.token)
            .header("x-country", &self.config.country)
            .header("x-message-id", message_id)
            .header("x-client-id", &self.config.client_id)
            .header("x-api-key", API_KEY)
            .header("x-service-phase", "OP");
        if let Some(body) = body {
            req = req.header("x-conditional-control", "true").json(&body);
        }
        let resp = req.send().await.map_err(|e| format!("Sem conexão com a LG: {e}"))?;
        let status = resp.status();
        let payload: Value = resp.json().await.unwrap_or(Value::Null);
        if !status.is_success() {
            let code = payload["error"]["code"].as_str().unwrap_or("?");
            let message = payload["error"]["message"].as_str().unwrap_or("erro desconhecido");
            return Err(format!("LG {code}: {message}"));
        }
        Ok(payload["response"].clone())
    }

    fn is_selected(&self, device: &Value) -> bool {
        match &self.config.device_id {
            Some(id) => device["deviceId"] == id.as_str(),
            None => device["deviceInfo"]["deviceType"] == AIR_CONDITIONER,
        }
    }

    /// Todos os aparelhos da conta, marcando o que o app está controlando.
    pub async fn devices(&self) -> Result<Vec<DeviceSummary>, String> {
        let list = self.request(reqwest::Method::GET, "/devices", None).await?;
        let mut selected_found = false;
        Ok(list
            .as_array()
            .into_iter()
            .flatten()
            .map(|d| {
                let selected = !selected_found && self.is_selected(d);
                selected_found |= selected;
                DeviceSummary {
                    id: d["deviceId"].as_str().unwrap_or_default().into(),
                    name: d["deviceInfo"]["alias"].as_str().unwrap_or_default().into(),
                    model: d["deviceInfo"]["modelName"].as_str().unwrap_or_default().into(),
                    device_type: d["deviceInfo"]["deviceType"].as_str().unwrap_or_default().into(),
                    selected,
                }
            })
            .collect())
    }

    /// Descobre o ar-condicionado (THINQ_DEVICE_ID ou o primeiro da conta) e lê o profile, uma vez.
    pub async fn device(&self) -> Result<DeviceInfo, String> {
        let mut cached = self.device.lock().await;
        if let Some(device) = cached.as_ref() {
            return Ok(device.clone());
        }
        let list = self.request(reqwest::Method::GET, "/devices", None).await?;
        let found = list
            .as_array()
            .into_iter()
            .flatten()
            .find(|d| self.is_selected(d))
            .ok_or(match &self.config.device_id {
                Some(id) => format!("THINQ_DEVICE_ID {id} não encontrado na conta"),
                None => "Nenhum ar-condicionado encontrado na conta".to_string(),
            })?;
        let id = found["deviceId"].as_str().unwrap_or_default().to_string();
        let profile = self.request(reqwest::Method::GET, &format!("/devices/{id}/profile"), None).await?;
        let device = DeviceInfo {
            name: found["deviceInfo"]["alias"].as_str().unwrap_or("Ar-condicionado").into(),
            model: found["deviceInfo"]["modelName"].as_str().unwrap_or_default().into(),
            capabilities: Capabilities::from_profile(&profile["property"]),
            id,
        };
        *cached = Some(device.clone());
        Ok(device)
    }

    pub async fn status(&self) -> Result<AcStatus, String> {
        let device = self.device().await?;
        let s = self.request(reqwest::Method::GET, &format!("/devices/{}/state", device.id), None).await?;
        let temp = s["temperatureInUnits"]
            .as_array()
            .and_then(|units| units.iter().find(|u| u["unit"] == "C"))
            .unwrap_or(&s["temperature"]);
        let mode = s["airConJobMode"]["currentJobMode"].as_str().unwrap_or_default().to_string();
        // Alguns modelos só informam o alvo do modo atual (coolTargetTemperature etc.).
        let target = TARGET_FIELDS
            .iter()
            .filter(|(_, m)| m.is_none_or(|m| m == mode))
            .find_map(|(field, _)| temp[*field].as_f64());
        Ok(AcStatus {
            power: s["operation"]["airConOperationMode"] == "POWER_ON",
            error: s["runState"]["currentState"] == "ERROR",
            mode,
            current_temperature: temp["currentTemperature"].as_f64(),
            target_temperature: target,
            wind_strength: s["airFlow"]["windStrength"].as_str().map(Into::into),
            swing: s["windDirection"]["rotateUpDown"].as_bool().unwrap_or(false),
            display_light: s["display"]["light"] != "OFF",
            start_timer: timer(&s["timer"], "relativeStartTimer", "Start"),
            stop_timer: timer(&s["timer"], "relativeStopTimer", "Stop"),
            sleep_timer: timer(&s["sleepTimer"], "relativeStopTimer", "Stop"),
            device,
        })
    }

    pub async fn control(&self, body: Value) -> Result<(), String> {
        let device = self.device().await?;
        self.request(reqwest::Method::POST, &format!("/devices/{}/control", device.id), Some(body))
            .await?;
        Ok(())
    }
}

impl Capabilities {
    fn from_profile(p: &Value) -> Self {
        let temp = &p["temperature"];
        let target_fields: Vec<_> = TARGET_FIELDS.iter().copied().filter(|(f, _)| writable(&temp[*f])).collect();
        let (min, max, step) = target_fields
            .iter()
            .find_map(|(f, _)| range(&temp[*f]))
            .unwrap_or((18.0, 30.0, 1.0));
        Self {
            power: writable(&p["operation"]["airConOperationMode"]),
            modes: write_values(&p["airConJobMode"]["currentJobMode"]),
            wind_strengths: write_values(&p["airFlow"]["windStrength"]),
            min_temperature: min,
            max_temperature: max,
            temperature_step: step,
            swing: writable(&p["windDirection"]["rotateUpDown"]),
            display_light: writable(&p["display"]["light"]),
            start_timer: writable(&p["timer"]["relativeHourToStart"]),
            stop_timer: writable(&p["timer"]["relativeHourToStop"]),
            sleep_timer: writable(&p["sleepTimer"]["relativeHourToStop"]),
            target_fields,
        }
    }

    pub fn supports_mode(&self, mode: &str) -> bool {
        self.modes.iter().any(|m| m == mode)
    }

    pub fn supports_wind(&self, strength: &str) -> bool {
        self.wind_strengths.iter().any(|w| w == strength)
    }

    /// Comando de temperatura alvo no campo que o modelo aceita para o modo atual.
    pub fn temperature_body(&self, mode: &str, value: f64) -> Result<Value, String> {
        let field = self
            .target_fields
            .iter()
            .find(|(_, m)| m.is_none_or(|m| m == mode))
            .or(self.target_fields.first())
            .map(|(f, _)| *f)
            .ok_or("Este modelo não permite mudar a temperatura")?;
        let value = value.clamp(self.min_temperature, self.max_temperature);
        Ok(json!({ "temperature": { field: value } }))
    }
}

fn writable(prop: &Value) -> bool {
    prop["mode"].as_array().is_some_and(|m| m.iter().any(|x| x == "w"))
}

fn write_values(prop: &Value) -> Vec<String> {
    prop["value"]["w"]
        .as_array()
        .into_iter()
        .flatten()
        .filter_map(|v| v.as_str().map(Into::into))
        .collect()
}

fn range(prop: &Value) -> Option<(f64, f64, f64)> {
    let r = &prop["value"]["w"];
    Some((r["min"].as_f64()?, r["max"].as_f64()?, r["step"].as_f64().unwrap_or(1.0)))
}

fn timer(section: &Value, flag: &str, suffix: &str) -> Option<Timer> {
    if section[flag] != "SET" {
        return None;
    }
    let num = |key: String| section[key].as_u64().unwrap_or(0) as u32;
    Some(Timer {
        hours: num(format!("relativeHourTo{suffix}")),
        minutes: num(format!("relativeMinuteTo{suffix}")),
    })
}

/// Corpo do comando de timer: `minutes == 0` cancela.
pub fn timer_body(section: &str, kind: &str, minutes: u32) -> Value {
    if minutes == 0 {
        return json!({ section: { format!("relative{kind}Timer"): "UNSET" } });
    }
    json!({ section: {
        format!("relativeHourTo{kind}"): minutes / 60,
        format!("relativeMinuteTo{kind}"): minutes % 60,
    }})
}
