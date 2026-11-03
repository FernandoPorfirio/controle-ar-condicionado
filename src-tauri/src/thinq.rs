//! Cliente mínimo da LG ThinQ Connect API para um ar-condicionado.
//!
//! O token (PAT) só existe aqui no lado Rust; a interface React nunca o vê.

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

pub const MODES: &[&str] = &["COOL", "AIR_DRY", "FAN"];
pub const WIND_STRENGTHS: &[&str] = &["AUTO", "LOW", "MID", "HIGH"];

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
            country: var("THINQ_COUNTRY").unwrap_or_else(|| "BR".into()),
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

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AcStatus {
    pub name: String,
    pub model: String,
    pub power: bool,
    pub error: bool,
    pub mode: String,
    pub current_temperature: Option<f64>,
    pub target_temperature: Option<f64>,
    pub min_temperature: f64,
    pub max_temperature: f64,
    pub wind_strength: String,
    pub swing: bool,
    pub display_light: bool,
    pub start_timer: Option<Timer>,
    pub stop_timer: Option<Timer>,
    pub sleep_timer: Option<Timer>,
}

struct Device {
    id: String,
    name: String,
    model: String,
}

pub struct ThinqClient {
    http: reqwest::Client,
    config: Config,
    base_url: String,
    device: Mutex<Option<Device>>,
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

    /// Descobre o ar-condicionado da conta (uma vez) e devolve (id, nome, modelo).
    async fn device(&self) -> Result<(String, String, String), String> {
        let mut cached = self.device.lock().await;
        if cached.is_none() {
            let list = self.request(reqwest::Method::GET, "/devices", None).await?;
            let found = list
                .as_array()
                .into_iter()
                .flatten()
                .find(|d| match &self.config.device_id {
                    Some(id) => d["deviceId"] == id.as_str(),
                    None => d["deviceInfo"]["deviceType"] == "DEVICE_AIR_CONDITIONER",
                })
                .ok_or("Nenhum ar-condicionado encontrado na conta")?;
            *cached = Some(Device {
                id: found["deviceId"].as_str().unwrap_or_default().into(),
                name: found["deviceInfo"]["alias"].as_str().unwrap_or("Ar-condicionado").into(),
                model: found["deviceInfo"]["modelName"].as_str().unwrap_or_default().into(),
            });
        }
        let d = cached.as_ref().unwrap();
        Ok((d.id.clone(), d.name.clone(), d.model.clone()))
    }

    pub async fn status(&self) -> Result<AcStatus, String> {
        let (id, name, model) = self.device().await?;
        let s = self.request(reqwest::Method::GET, &format!("/devices/{id}/state"), None).await?;
        let temp = s["temperatureInUnits"]
            .as_array()
            .and_then(|units| units.iter().find(|u| u["unit"] == "C"))
            .unwrap_or(&s["temperature"]);
        Ok(AcStatus {
            name,
            model,
            power: s["operation"]["airConOperationMode"] == "POWER_ON",
            error: s["runState"]["currentState"] == "ERROR",
            mode: s["airConJobMode"]["currentJobMode"].as_str().unwrap_or("COOL").into(),
            current_temperature: temp["currentTemperature"].as_f64(),
            target_temperature: temp["targetTemperature"].as_f64(),
            min_temperature: temp["minTargetTemperature"].as_f64().unwrap_or(18.0),
            max_temperature: temp["maxTargetTemperature"].as_f64().unwrap_or(30.0),
            wind_strength: s["airFlow"]["windStrength"].as_str().unwrap_or("AUTO").into(),
            swing: s["windDirection"]["rotateUpDown"].as_bool().unwrap_or(false),
            display_light: s["display"]["light"] != "OFF",
            start_timer: timer(&s["timer"], "relativeStartTimer", "Start"),
            stop_timer: timer(&s["timer"], "relativeStopTimer", "Stop"),
            sleep_timer: timer(&s["sleepTimer"], "relativeStopTimer", "Stop"),
        })
    }

    pub async fn control(&self, body: Value) -> Result<(), String> {
        let (id, _, _) = self.device().await?;
        self.request(reqwest::Method::POST, &format!("/devices/{id}/control"), Some(body)).await?;
        Ok(())
    }
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
