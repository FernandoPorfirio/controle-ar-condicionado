mod settings;
mod thinq;

use std::path::PathBuf;
use std::sync::{Arc, RwLock};

use serde::Serialize;
use serde_json::json;
use tauri::menu::{Menu, MenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{AppHandle, Emitter, Manager, State, WindowEvent};
use tauri_plugin_window_state::StateFlags;

use settings::Source;
use thinq::{AcStatus, AIR_CONDITIONER, Config, DeviceSummary, ThinqClient, new_client_id, timer_body};

/// Erro que a interface reconhece para abrir a tela de configuração.
const NOT_CONFIGURED: &str = "not_configured";

struct Active {
    client: Arc<ThinqClient>,
    source: Source,
    country: String,
    device_id: Option<String>,
}

/// Cliente atual (ou nenhum, enquanto o app não foi configurado).
struct Ac {
    active: RwLock<Option<Active>>,
    config_dir: PathBuf,
}

impl Ac {
    fn client(&self) -> Result<Arc<ThinqClient>, String> {
        let active = self.active.read().unwrap();
        active.as_ref().map(|a| a.client.clone()).ok_or_else(|| NOT_CONFIGURED.into())
    }

    fn set(&self, config: Config, source: Source) {
        *self.active.write().unwrap() = Some(Active {
            country: config.country.clone(),
            device_id: config.device_id.clone(),
            client: Arc::new(ThinqClient::new(config)),
            source,
        });
    }
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct SetupInfo {
    configured: bool,
    source: Option<Source>,
    country: Option<String>,
    device_id: Option<String>,
}

#[tauri::command]
fn get_setup(ac: State<'_, Ac>) -> SetupInfo {
    let active = ac.active.read().unwrap();
    SetupInfo {
        configured: active.is_some(),
        source: active.as_ref().map(|a| a.source),
        country: active.as_ref().map(|a| a.country.clone()),
        device_id: active.as_ref().and_then(|a| a.device_id.clone()),
    }
}

/// Valida o token com a LG e só então salva. `token` vazio reaproveita o salvo
/// (para trocar só o país ou o aparelho). Devolve os aparelhos da conta.
#[tauri::command]
async fn save_setup(
    app: AppHandle,
    ac: State<'_, Ac>,
    token: Option<String>,
    country: String,
    device_id: Option<String>,
) -> Result<Vec<DeviceSummary>, String> {
    if ac.active.read().unwrap().as_ref().is_some_and(|a| a.source == Source::Env) {
        return Err("O app está usando o .env; edite o arquivo para mudar a configuração.".into());
    }
    let token = token
        .map(|t| t.trim().to_string())
        .filter(|t| !t.is_empty())
        .or_else(settings::saved_token)
        .ok_or("Informe o token")?;
    let config = Config {
        token,
        country: country.trim().to_uppercase(),
        client_id: settings::read_saved(&ac.config_dir)
            .map(|s| s.client_id)
            .filter(|id| !id.is_empty())
            .unwrap_or_else(new_client_id),
        device_id: device_id.filter(|id| !id.is_empty()),
    };

    let devices = ThinqClient::new(config.clone()).devices().await?;
    if !devices.iter().any(|d| d.device_type == AIR_CONDITIONER) {
        return Err("Nenhum ar-condicionado encontrado nesta conta".into());
    }
    if let Some(id) = &config.device_id {
        if !devices.iter().any(|d| &d.id == id) {
            return Err("Aparelho não encontrado na conta".into());
        }
    }

    settings::save(&ac.config_dir, &config)?;
    ac.set(config, Source::App);
    let _ = app.emit("status-changed", ());
    ac.client()?.devices().await
}

#[tauri::command]
fn clear_setup(ac: State<'_, Ac>) {
    settings::clear(&ac.config_dir);
    *ac.active.write().unwrap() = None;
}

#[tauri::command]
async fn get_status(ac: State<'_, Ac>) -> Result<AcStatus, String> {
    ac.client()?.status().await
}

#[tauri::command]
async fn list_devices(ac: State<'_, Ac>) -> Result<Vec<DeviceSummary>, String> {
    ac.client()?.devices().await
}

#[tauri::command]
async fn set_power(ac: State<'_, Ac>, on: bool) -> Result<(), String> {
    let mode = if on { "POWER_ON" } else { "POWER_OFF" };
    ac.client()?.control(json!({ "operation": { "airConOperationMode": mode } })).await
}

#[tauri::command]
async fn set_mode(ac: State<'_, Ac>, mode: String) -> Result<(), String> {
    let client = ac.client()?;
    if !client.device().await?.capabilities.supports_mode(&mode) {
        return Err(format!("Modo não suportado: {mode}"));
    }
    client.control(json!({ "airConJobMode": { "currentJobMode": mode } })).await
}

/// `mode` é o modo atual: alguns modelos têm um campo de alvo por modo.
#[tauri::command]
async fn set_target_temperature(ac: State<'_, Ac>, value: f64, mode: String) -> Result<(), String> {
    let client = ac.client()?;
    let body = client.device().await?.capabilities.temperature_body(&mode, value)?;
    client.control(body).await
}

#[tauri::command]
async fn set_wind_strength(ac: State<'_, Ac>, strength: String) -> Result<(), String> {
    let client = ac.client()?;
    if !client.device().await?.capabilities.supports_wind(&strength) {
        return Err(format!("Velocidade não suportada: {strength}"));
    }
    client.control(json!({ "airFlow": { "windStrength": strength } })).await
}

#[tauri::command]
async fn set_swing(ac: State<'_, Ac>, on: bool) -> Result<(), String> {
    ac.client()?.control(json!({ "windDirection": { "rotateUpDown": on } })).await
}

#[tauri::command]
async fn set_display_light(ac: State<'_, Ac>, on: bool) -> Result<(), String> {
    let light = if on { "ON" } else { "OFF" };
    ac.client()?.control(json!({ "display": { "light": light } })).await
}

/// `kind`: "start" (ligar em), "stop" (desligar em) ou "sleep". `minutes == 0` cancela.
#[tauri::command]
async fn set_timer(ac: State<'_, Ac>, kind: String, minutes: u32) -> Result<(), String> {
    let body = match kind.as_str() {
        "start" => timer_body("timer", "Start", minutes),
        "stop" => timer_body("timer", "Stop", minutes),
        "sleep" => timer_body("sleepTimer", "Stop", minutes),
        _ => return Err(format!("Timer inválido: {kind}")),
    };
    ac.client()?.control(body).await
}

fn toggle_window(app: &AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        if window.is_visible().unwrap_or(false) {
            let _ = window.hide();
        } else {
            let _ = window.show();
            let _ = window.set_focus();
        }
    }
}

/// Liga/desliga pela bandeja e avisa a janela para atualizar.
async fn toggle_power(app: AppHandle) {
    let Ok(client) = app.state::<Ac>().client() else { return };
    if let Ok(status) = client.status().await {
        let mode = if status.power { "POWER_OFF" } else { "POWER_ON" };
        let _ = client.control(json!({ "operation": { "airConOperationMode": mode } })).await;
    }
    let _ = app.emit("status-changed", ());
}

fn setup_tray(app: &AppHandle) -> tauri::Result<()> {
    let pt = sys_locale::get_locale().is_some_and(|l| l.starts_with("pt"));
    let label = |pt_text: &'static str, en_text: &'static str| if pt { pt_text } else { en_text };

    let show = MenuItem::with_id(app, "show", label("Mostrar / ocultar", "Show / hide"), true, None::<&str>)?;
    let power = MenuItem::with_id(app, "power", label("Ligar / desligar o ar", "Turn AC on / off"), true, None::<&str>)?;
    let quit = MenuItem::with_id(app, "quit", label("Sair", "Quit"), true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&show, &power, &quit])?;

    TrayIconBuilder::with_id("main")
        .icon(app.default_window_icon().cloned().expect("ícone padrão"))
        .tooltip(label("Ar-condicionado", "Air conditioner"))
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| match event.id.as_ref() {
            "show" => toggle_window(app),
            "power" => {
                tauri::async_runtime::spawn(toggle_power(app.clone()));
            }
            "quit" => app.exit(0),
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click { button: MouseButton::Left, button_state: MouseButtonState::Up, .. } = event {
                toggle_window(tray.app_handle());
            }
        })
        .build(app)?;
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(
            tauri_plugin_window_state::Builder::new()
                .with_state_flags(StateFlags::POSITION)
                .build(),
        )
        .setup(|app| {
            // Quem roda pelo código pode usar um .env: procura na pasta atual, na pasta
            // acima (dev: src-tauri/..), ao lado do executável e na pasta de configuração.
            let mut dirs = Vec::new();
            if let Ok(cwd) = std::env::current_dir() {
                dirs.push(cwd.clone());
                if let Some(parent) = cwd.parent() {
                    dirs.push(parent.to_path_buf());
                }
            }
            if let Some(exe_dir) = std::env::current_exe().ok().and_then(|p| p.parent().map(Into::into)) {
                dirs.push(exe_dir);
            }
            // %APPDATA%\<identifier>: settings.json do app (o token fica no Gerenciador de Credenciais).
            let config_dir = app.path().app_config_dir()?;
            dirs.push(config_dir.clone());
            let ac = Ac { active: RwLock::new(None), config_dir: config_dir.clone() };
            if let Ok((config, source)) = settings::load(&dirs, &config_dir) {
                ac.set(config, source);
            }
            app.manage(ac);

            setup_tray(app.handle())?;
            Ok(())
        })
        .on_window_event(|window, event| {
            // Fechar a janela só esconde; o app continua na bandeja.
            if let WindowEvent::CloseRequested { api, .. } = event {
                api.prevent_close();
                let _ = window.hide();
            }
        })
        .invoke_handler(tauri::generate_handler![
            get_setup,
            save_setup,
            clear_setup,
            get_status,
            list_devices,
            set_power,
            set_mode,
            set_target_temperature,
            set_wind_strength,
            set_swing,
            set_display_light,
            set_timer
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
