mod thinq;

use serde_json::json;
use tauri::menu::{Menu, MenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{AppHandle, Emitter, Manager, State, WindowEvent};
use tauri_plugin_window_state::StateFlags;

use thinq::{AcStatus, Config, MODES, ThinqClient, WIND_STRENGTHS, timer_body};

/// O cliente, ou a mensagem de erro de configuração para mostrar na janela.
struct Ac(Result<ThinqClient, String>);

impl Ac {
    fn client(&self) -> Result<&ThinqClient, String> {
        self.0.as_ref().map_err(Clone::clone)
    }
}

#[tauri::command]
async fn get_status(ac: State<'_, Ac>) -> Result<AcStatus, String> {
    ac.client()?.status().await
}

#[tauri::command]
async fn set_power(ac: State<'_, Ac>, on: bool) -> Result<(), String> {
    let mode = if on { "POWER_ON" } else { "POWER_OFF" };
    ac.client()?.control(json!({ "operation": { "airConOperationMode": mode } })).await
}

#[tauri::command]
async fn set_mode(ac: State<'_, Ac>, mode: String) -> Result<(), String> {
    if !MODES.contains(&mode.as_str()) {
        return Err(format!("Modo inválido: {mode}"));
    }
    ac.client()?.control(json!({ "airConJobMode": { "currentJobMode": mode } })).await
}

#[tauri::command]
async fn set_target_temperature(ac: State<'_, Ac>, value: f64) -> Result<(), String> {
    // Faixa do profile do aparelho; o app usa graus inteiros (o ar aceita 0,5).
    let value = value.clamp(18.0, 30.0).round();
    ac.client()?.control(json!({ "temperature": { "targetTemperature": value } })).await
}

#[tauri::command]
async fn set_wind_strength(ac: State<'_, Ac>, strength: String) -> Result<(), String> {
    if !WIND_STRENGTHS.contains(&strength.as_str()) {
        return Err(format!("Velocidade inválida: {strength}"));
    }
    ac.client()?.control(json!({ "airFlow": { "windStrength": strength } })).await
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
    let ac = app.state::<Ac>();
    let Ok(client) = ac.client() else { return };
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
        .plugin(
            tauri_plugin_window_state::Builder::new()
                .with_state_flags(StateFlags::POSITION)
                .build(),
        )
        .setup(|app| {
            // Procura o .env na pasta atual, na pasta acima (dev: src-tauri/..),
            // ao lado do executável e na pasta de configuração do app.
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
            if let Ok(config_dir) = app.path().app_config_dir() {
                dirs.push(config_dir);
            }
            app.manage(Ac(Config::load(&dirs).map(ThinqClient::new)));

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
            get_status,
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
