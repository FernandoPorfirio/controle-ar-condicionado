//! Configuração salva pelo próprio app: o token vai para o Gerenciador de
//! Credenciais do Windows; país, client id e aparelho ficam em settings.json.
//! Um .env (THINQ_PAT) tem prioridade, para quem roda pelo código.

use std::fs;
use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};

use crate::thinq::Config;

const KEYRING_SERVICE: &str = "app.controle-ar-condicionado";
const KEYRING_USER: &str = "thinq-pat";
const SETTINGS_FILE: &str = "settings.json";

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Saved {
    pub country: String,
    pub client_id: String,
    pub device_id: Option<String>,
}

/// De onde veio a configuração em uso.
#[derive(Debug, Clone, Copy, PartialEq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum Source {
    Env,
    App,
}

fn keyring_entry() -> Result<keyring::Entry, String> {
    keyring::Entry::new(KEYRING_SERVICE, KEYRING_USER).map_err(|e| format!("Gerenciador de Credenciais: {e}"))
}

pub fn read_saved(config_dir: &Path) -> Option<Saved> {
    let text = fs::read_to_string(config_dir.join(SETTINGS_FILE)).ok()?;
    serde_json::from_str(&text).ok()
}

/// Carrega do .env, se houver THINQ_PAT; senão, do que o app salvou.
pub fn load(env_dirs: &[PathBuf], config_dir: &Path) -> Result<(Config, Source), String> {
    if let Some(config) = Config::from_env(env_dirs) {
        return Ok((config, Source::Env));
    }
    let saved = read_saved(config_dir).ok_or("not_configured")?;
    let token = keyring_entry()?.get_password().map_err(|_| "not_configured")?;
    Ok((
        Config {
            token,
            country: saved.country,
            client_id: saved.client_id,
            device_id: saved.device_id,
        },
        Source::App,
    ))
}

/// Token salvo pelo app, para reaproveitar quando só o país ou o aparelho mudam.
pub fn saved_token() -> Option<String> {
    keyring_entry().ok()?.get_password().ok()
}

pub fn save(config_dir: &Path, config: &Config) -> Result<(), String> {
    keyring_entry()?
        .set_password(&config.token)
        .map_err(|e| format!("Não foi possível salvar o token: {e}"))?;
    let saved = Saved {
        country: config.country.clone(),
        client_id: config.client_id.clone(),
        device_id: config.device_id.clone(),
    };
    fs::create_dir_all(config_dir).map_err(|e| e.to_string())?;
    let json = serde_json::to_string_pretty(&saved).map_err(|e| e.to_string())?;
    fs::write(config_dir.join(SETTINGS_FILE), json).map_err(|e| e.to_string())
}

pub fn clear(config_dir: &Path) {
    if let Ok(entry) = keyring_entry() {
        let _ = entry.delete_credential();
    }
    let _ = fs::remove_file(config_dir.join(SETTINGS_FILE));
}
